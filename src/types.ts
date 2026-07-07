export type ModelTier = 'fast' | 'mid' | 'frontier';

export type QualityBar = 'draft' | 'standard' | 'strict';

export interface RouteRequest {
  task_type: string;
  prompt: string;
  quality_bar: QualityBar;
  max_tier?: ModelTier;
}

export interface FeedbackRequest {
  request_id: string;
  accepted: boolean;
}

export interface EstimateRequest {
  task_type: string;
  prompt_length_tokens: number;
  quality_bar: QualityBar;
}

export interface EscalationTraceItem {
  tier: ModelTier;
  confidence: number;
}
