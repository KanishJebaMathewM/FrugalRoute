import { FastifyInstance } from 'fastify';
import { authenticateAgent } from '../middleware/auth.js';
import { runCascade } from '../core/cascade.js';
import { db } from '../db/client.js';
import { requests, agents } from '../db/schema.js';
import { eq, sql } from 'drizzle-orm';
import { RouteRequest } from '../types.js';

export async function routeRoutes(fastify: FastifyInstance) {
  fastify.post(
    '/route',
    { preHandler: [authenticateAgent] },
    async (request, reply) => {
      const agent = request.agent!;
      const { task_type, prompt, quality_bar, max_tier } = request.body as RouteRequest;

      if (!task_type || !prompt || !quality_bar) {
        reply.status(400).send({
          error: 'Missing required fields: task_type, prompt, and quality_bar are required.',
        });
        return;
      }

      const validQualityBars = ['draft', 'standard', 'strict'];
      if (!validQualityBars.includes(quality_bar)) {
        reply.status(400).send({
          error: `Invalid quality_bar: must be one of ${validQualityBars.join(', ')}`,
        });
        return;
      }

      if (max_tier) {
        const validTiers = ['fast', 'mid', 'frontier'];
        if (!validTiers.includes(max_tier)) {
          reply.status(400).send({
            error: `Invalid max_tier: must be one of ${validTiers.join(', ')}`,
          });
          return;
        }
      }

      try {
        // Run the cascade router
        const result = await runCascade(
          fastify.ai,
          task_type,
          prompt,
          quality_bar,
          max_tier || 'frontier'
        );

        // Update daily requests count for the agent
        await db.update(agents)
          .set({ requestsToday: sql`${agents.requestsToday} + 1` })
          .where(eq(agents.id, agent.id));

        // Save request history in DB
        const insertedRequests = await db.insert(requests).values({
          agentId: agent.id,
          taskType: task_type,
          qualityBar: quality_bar,
          tierUsed: result.tierUsed,
          escalated: result.escalated,
          escalationTrace: result.escalationTrace,
          confidence: result.confidence,
          confidenceMethod: result.confidenceMethod,
          costUsd: result.costUsd.toFixed(6),
          baselineCostUsdIfFrontier: result.baselineCostUsdIfFrontier.toFixed(6),
          latencyMs: result.latencyMs,
        }).returning();

        const savedRequest = insertedRequests[0];

        return {
          request_id: savedRequest.id,
          completion: result.completion,
          tier_used: result.tierUsed,
          escalated: result.escalated,
          confidence: result.confidence,
          confidence_method: result.confidenceMethod,
          cost_usd: parseFloat(savedRequest.costUsd),
          latency_ms: result.latencyMs,
          baseline_cost_usd_if_frontier: parseFloat(savedRequest.baselineCostUsdIfFrontier),
          // We can also include the escalation trace if escalated
          ...(result.escalated ? { escalation_trace: result.escalationTrace } : {}),
        };
      } catch (error: any) {
        fastify.log.error(error);
        reply.status(500).send({ error: 'Internal Server Error during cascading: ' + error.message });
      }
    }
  );
}
