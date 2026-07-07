import { FastifyInstance } from 'fastify';
import { getOrCreateBanditState } from '../core/bandit.js';
import { calculateCost } from '../core/cost.js';
import { ModelTier, EstimateRequest } from '../types.js';

export async function estimateRoutes(fastify: FastifyInstance) {
  fastify.post('/estimate', async (request, reply) => {
    const { task_type, prompt_length_tokens, quality_bar } = request.body as EstimateRequest;

    if (!task_type || prompt_length_tokens === undefined || !quality_bar) {
      reply.status(400).send({
        error: 'Missing required fields: task_type, prompt_length_tokens, and quality_bar are required.',
      });
      return;
    }

    try {
      const state = await getOrCreateBanditState(task_type);
      const storedThreshold = state.confidenceThreshold;

      // Predict tier based on stored threshold
      let predictedTier: ModelTier = 'fast';
      let predictedLatencyMs = 300;

      if (storedThreshold > 0.75 && storedThreshold <= 0.90) {
        predictedTier = 'mid';
        predictedLatencyMs = 900;
      } else if (storedThreshold > 0.90) {
        predictedTier = 'frontier';
        predictedLatencyMs = 2000;
      }

      // Estimate output tokens as ~25% of input tokens, minimum 100, maximum 1000
      const estimatedOutputTokens = Math.min(
        Math.max(100, Math.round(prompt_length_tokens * 0.25)),
        1000
      );

      // Compute single-shot predicted cost
      const predictedCostUsd = calculateCost(
        predictedTier,
        prompt_length_tokens,
        estimatedOutputTokens
      );

      return {
        predicted_tier: predictedTier,
        predicted_cost_usd: parseFloat(predictedCostUsd.toFixed(6)),
        predicted_latency_ms: predictedLatencyMs,
        current_threshold: parseFloat(storedThreshold.toFixed(2)),
      };
    } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({ error: 'Internal Server Error' });
    }
  });
}
