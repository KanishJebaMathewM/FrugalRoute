import { ModelTier } from '../types.js';

export interface TierConfig {
  model: string;
  inputCostPer1M: number;  // USD per 1,000,000 input tokens
  outputCostPer1M: number; // USD per 1,000,000 output tokens
}

/**
 * Model tiers mapped to OpenRouter model IDs.
 * All three are on the free tier — no billing required.
 *
 * fast:     llama-3.1-8b  — small, very low latency
 * mid:      llama-3.3-70b — strong general model
 * frontier: deepseek-r1   — reasoning model for hard tasks
 *
 * Pricing shown is the paid-tier rate; free usage is $0 but
 * we track it for the savings baseline calculation.
 */
export const TIER_CONFIGS: Record<ModelTier, TierConfig> = {
  fast: {
    model: 'meta-llama/llama-3.1-8b-instruct:free',
    inputCostPer1M: 0.06,
    outputCostPer1M: 0.06,
  },
  mid: {
    model: 'meta-llama/llama-3.3-70b-instruct:free',
    inputCostPer1M: 0.12,
    outputCostPer1M: 0.30,
  },
  frontier: {
    model: 'deepseek/deepseek-r1:free',
    inputCostPer1M: 0.55,
    outputCostPer1M: 2.19,
  },
};
