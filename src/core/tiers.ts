import { ModelTier } from '../types.js';

export interface TierConfig {
  model: string;
  inputCostPer1M: number;  // USD per 1,000,000 input tokens
  outputCostPer1M: number; // USD per 1,000,000 output tokens
}

/**
 * Pricing table for the mapped Gemini models (as of early 2026).
 * Refresh periodically based on Google Cloud Vertex AI / AI Studio pricing.
 */
export const TIER_CONFIGS: Record<ModelTier, TierConfig> = {
  fast: {
    model: 'gemini-2.5-flash',
    inputCostPer1M: 0.075,
    outputCostPer1M: 0.30,
  },
  mid: {
    model: 'gemini-1.5-pro',
    inputCostPer1M: 1.25,
    outputCostPer1M: 5.00,
  },
  frontier: {
    model: 'gemini-2.5-pro',
    inputCostPer1M: 1.25,
    outputCostPer1M: 5.00,
  },
};
