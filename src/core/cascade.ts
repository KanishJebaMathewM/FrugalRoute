import { GoogleGenAI } from '@google/genai';
import { ModelTier, QualityBar, EscalationTraceItem } from '../types.js';
import { SelfConsistencyScorer } from './confidence.js';
import { calculateCost } from './cost.js';
import { getThreshold } from './bandit.js';
import { TIER_CONFIGS } from './tiers.js';

export interface CascadeResult {
  completion: string;
  tierUsed: ModelTier;
  escalated: boolean;
  confidence: number;
  confidenceMethod: string;
  costUsd: number;
  baselineCostUsdIfFrontier: number;
  latencyMs: number;
  escalationTrace: EscalationTraceItem[];
}

const scorer = new SelfConsistencyScorer();

/**
 * Executes the cascade routing orchestration.
 */
export async function runCascade(
  ai: GoogleGenAI,
  taskType: string,
  prompt: string,
  qualityBar: QualityBar,
  maxTier: ModelTier = 'frontier'
): Promise<CascadeResult> {
  const startTime = Date.now();

  // Get current threshold perturbation from bandit
  const { threshold } = await getThreshold(taskType, qualityBar);

  const tiers: ModelTier[] = ['fast', 'mid', 'frontier'];
  const maxTierIndex = tiers.indexOf(maxTier);
  const activeTiers = tiers.slice(0, maxTierIndex + 1);

  const escalationTrace: EscalationTraceItem[] = [];
  let totalCostUsd = 0;
  let finalCompletion = '';
  let finalConfidence = 0.0;
  let finalMethod = '';
  let finalTier: ModelTier = 'fast';
  
  // Track prompt token count from the first successful call to calculate baseline
  let promptTokenCount = 0;
  let successfulCompletionOutputTokens = 0;

  for (let i = 0; i < activeTiers.length; i++) {
    const tier = activeTiers[i];
    const config = TIER_CONFIGS[tier];

    // Score confidence at this tier (which calls Gemini k=3 times in parallel)
    // k=3 is a good balance between accuracy and API quota usage on the free tier
    const result = await scorer.score(ai, config.model, prompt, 3);

    // Accumulated cost of the current tier's k calls
    const tierCost = calculateCost(tier, result.inputTokens, result.outputTokens);
    totalCostUsd += tierCost;

    // Capture the first successful prompt token count to estimate baseline input tokens
    if (promptTokenCount === 0 && result.inputTokens > 0) {
      // result.inputTokens is the sum of k calls, so divide by k (e.g. 5) to get 1-shot prompt tokens
      promptTokenCount = Math.round(result.inputTokens / Math.max(result.completions.length, 1));
    }

    const completion = result.completions[0] || '';
    finalCompletion = completion;
    finalConfidence = result.confidence;
    finalMethod = result.confidenceMethod;
    finalTier = tier;

    // Add to escalation trace
    escalationTrace.push({
      tier,
      confidence: result.confidence,
    });

    // Check if this is the successful completion
    if (result.completions.length > 0) {
      // Estimate the output token count of 1-shot completion
      // result.outputTokens is total output tokens of all successful completions
      successfulCompletionOutputTokens = Math.round(result.outputTokens / result.completions.length);
    }

    // Stop escalating if confidence meets threshold, or we've reached the max tier
    const isMaxTier = i === activeTiers.length - 1;
    if (result.confidence >= threshold || isMaxTier) {
      break;
    }
  }

  const latencyMs = Date.now() - startTime;
  const escalated = finalTier !== 'fast';

  // Calculate always-frontier 1-shot baseline cost
  // If we don't have prompt token count (i.e. all calls failed), estimate characters / 4
  const baselineInput = promptTokenCount > 0 ? promptTokenCount : Math.round(prompt.length / 4);
  const baselineOutput = successfulCompletionOutputTokens > 0 ? successfulCompletionOutputTokens : 50; // fallback output size
  const baselineCostUsdIfFrontier = calculateCost('frontier', baselineInput, baselineOutput);

  return {
    completion: finalCompletion,
    tierUsed: finalTier,
    escalated,
    confidence: finalConfidence,
    confidenceMethod: finalMethod,
    costUsd: totalCostUsd,
    baselineCostUsdIfFrontier,
    latencyMs,
    escalationTrace,
  };
}
