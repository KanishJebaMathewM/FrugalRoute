import { FastifyInstance } from 'fastify';
import { authenticateAgent } from '../middleware/auth.js';
import { db } from '../db/client.js';
import { banditState, requests } from '../db/schema.js';
import { eq, desc } from 'drizzle-orm';

export async function policyRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/policy/:taskType',
    { preHandler: [authenticateAgent] },
    async (request, reply) => {
      const { taskType } = request.params as { taskType: string };

      if (!taskType) {
        reply.status(400).send({ error: 'Missing taskType parameter' });
        return;
      }

      try {
        // Fetch bandit state
        const states = await db.select().from(banditState).where(eq(banditState.taskType, taskType)).limit(1);

        const state = states[0] || {
          taskType,
          confidenceThreshold: 0.85,
          samplesSeen: 0,
        };

        // Fetch last 1000 requests for this task type
        const history = await db.select({
          escalated: requests.escalated,
          costUsd: requests.costUsd,
          baselineCostUsdIfFrontier: requests.baselineCostUsdIfFrontier,
        })
          .from(requests)
          .where(eq(requests.taskType, taskType))
          .orderBy(desc(requests.createdAt))
          .limit(1000);

        // Compute escalation rate
        const escalatedCount = history.filter((r) => r.escalated).length;
        const escalationRate = history.length > 0 ? escalatedCount / history.length : 0.0;

        // Compute average cost savings
        let totalSavingsPct = 0;
        let validSavingsCount = 0;

        for (const r of history) {
          const cost = parseFloat(r.costUsd);
          const baseline = parseFloat(r.baselineCostUsdIfFrontier);
          if (baseline > 0) {
            // savings = (baseline - cost) / baseline
            const savings = (baseline - cost) / baseline;
            totalSavingsPct += savings;
            validSavingsCount++;
          }
        }

        const avgCostSavings = validSavingsCount > 0 ? totalSavingsPct / validSavingsCount : 0.0;

        return {
          task_type: taskType,
          confidence_threshold: parseFloat(state.confidenceThreshold.toFixed(4)),
          escalation_rate_last_1000: parseFloat(escalationRate.toFixed(4)),
          samples_seen: state.samplesSeen,
          avg_cost_savings_vs_frontier_baseline: parseFloat(avgCostSavings.toFixed(4)),
        };
      } catch (error) {
        fastify.log.error(error);
        reply.status(500).send({ error: 'Internal Server Error' });
      }
    }
  );
}
