import { ModelTier } from '../types.js';
import { TIER_CONFIGS } from './tiers.js';

/**
 * Calculates the cost of an LLM request in USD based on model pricing.
 */
export function calculateCost(tier: ModelTier, inputTokens: number, outputTokens: number): number {
  const config = TIER_CONFIGS[tier];
  const inputCost = (inputTokens / 1_000_000) * config.inputCostPer1M;
  const outputCost = (outputTokens / 1_000_000) * config.outputCostPer1M;
  return inputCost + outputCost;
}
