import { ModelTier } from '../types.js';

export interface TierConfig {
  model: string;
  inputCostPer1M: number;  // USD per 1,000,000 input tokens
  outputCostPer1M: number; // USD per 1,000,000 output tokens
}

/**
 * Model tiers mapped to OpenRouter model IDs (all free tier).
 *
 * fast:     google/gemma-4-31b-it:free     — fast, Google's Gemma 4 31B
 * mid:      openai/gpt-oss-20b:free        — OpenAI open-source 20B
 * frontier: nvidia/nemotron-3-ultra-550b-a55b:free — NVIDIA 550B MoE, most capable free model
 *
 * Pricing shown is illustrative for savings baseline calculation (actual cost is $0 on free tier).
 */
export const TIER_CONFIGS: Record<ModelTier, TierConfig> = {
  fast: {
    model: 'google/gemma-4-31b-it:free',
    inputCostPer1M: 0.10,
    outputCostPer1M: 0.10,
  },
  mid: {
    model: 'openai/gpt-oss-20b:free',
    inputCostPer1M: 0.30,
    outputCostPer1M: 0.60,
  },
  frontier: {
    model: 'nvidia/nemotron-3-ultra-550b-a55b:free',
    inputCostPer1M: 0.90,
    outputCostPer1M: 3.50,
  },
};
