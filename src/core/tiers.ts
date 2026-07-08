import { ModelTier } from '../types.js';

export interface TierConfig {
  model: string;
  inputCostPer1M: number;  // USD per 1,000,000 input tokens
  outputCostPer1M: number; // USD per 1,000,000 output tokens
}

/**
 * Pricing table for the mapped Gemini models (as of July 2026).
 * gemini-2.5-flash: fast, cheapest, free tier available
 * gemini-2.5-pro:   mid — balanced cost/quality
 * gemini-2.5-pro:   frontier — same model, stricter quality bar threshold forces it only for hard tasks
 * 
 * Note: gemini-1.5-pro is retired. gemini-2.5-flash and gemini-2.5-pro are stable until Oct 16, 2026.
 */
export const TIER_CONFIGS: Record<ModelTier, TierConfig> = {
  fast: {
    model: 'gemini-2.5-flash',
    inputCostPer1M: 0.075,
    outputCostPer1M: 0.30,
  },
  mid: {
    model: 'gemini-2.5-pro',
    inputCostPer1M: 1.25,
    outputCostPer1M: 10.00,
  },
  frontier: {
    model: 'gemini-2.5-pro',
    inputCostPer1M: 1.25,
    outputCostPer1M: 10.00,
  },
};
