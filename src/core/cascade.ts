import OpenAI from 'openai';
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
  client: OpenAI,
  taskType: string,
  prompt: string,
  qualityBar: QualityBar,
  maxTier: ModelTier = 'frontier'
): Promise<CascadeResult> {
  const startTime = Date.now();

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

  let promptTokenCount = 0;
  let successfulCompletionOutputTokens = 0;

  for (let i = 0; i < activeTiers.length; i++) {
    const tier = activeTiers[i];
    const config = TIER_CONFIGS[tier];

    const result = await scorer.score(client, config.model, prompt, 3);

    const tierCost = calculateCost(tier, result.inputTokens, result.outputTokens);
    totalCostUsd += tierCost;

    if (promptTokenCount === 0 && result.inputTokens > 0) {
      promptTokenCount = Math.round(result.inputTokens / Math.max(result.completions.length, 1));
    }

    const completion = result.completions[0] || '';
    finalCompletion = completion;
    finalConfidence = result.confidence;
    finalMethod = result.confidenceMethod;
    finalTier = tier;

    escalationTrace.push({ tier, confidence: result.confidence });

    if (result.completions.length > 0) {
      successfulCompletionOutputTokens = Math.round(result.outputTokens / result.completions.length);
    }

    const isMaxTier = i === activeTiers.length - 1;
    if (result.confidence >= threshold || isMaxTier) {
      break;
    }
  }

  const latencyMs = Date.now() - startTime;
  const escalated = finalTier !== 'fast';

  const baselineInput = promptTokenCount > 0 ? promptTokenCount : Math.round(prompt.length / 4);
  const baselineOutput = successfulCompletionOutputTokens > 0 ? successfulCompletionOutputTokens : 50;
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
