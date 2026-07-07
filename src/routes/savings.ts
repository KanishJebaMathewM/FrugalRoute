import { FastifyInstance } from 'fastify';
import { authenticateAgent } from '../middleware/auth.js';
import { db } from '../db/client.js';
import { requests } from '../db/schema.js';
import { eq, and, gte } from 'drizzle-orm';

interface SavingsQuery {
  since?: string;
}

export async function savingsRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/savings',
    { preHandler: [authenticateAgent] },
    async (request, reply) => {
      const agent = request.agent!;
      const { since } = request.query as SavingsQuery;

      let sinceDate: Date;
      if (since) {
        sinceDate = new Date(since);
        if (isNaN(sinceDate.getTime())) {
          reply.status(400).send({ error: 'Invalid date format for since parameter. Use YYYY-MM-DD.' });
          return;
        }
      } else {
        // Fallback to start of time to include all requests
        sinceDate = new Date(0);
      }

      try {
        const history = await db.select({
          costUsd: requests.costUsd,
          baselineCostUsdIfFrontier: requests.baselineCostUsdIfFrontier,
          createdAt: requests.createdAt,
        })
          .from(requests)
          .where(
            and(
              eq(requests.agentId, agent.id),
              gte(requests.createdAt, sinceDate)
            )
          );

        const totalRequests = history.length;
        const totalCostUsd = history.reduce((sum, r) => sum + parseFloat(r.costUsd), 0.0);
        const baselineCostUsd = history.reduce((sum, r) => sum + parseFloat(r.baselineCostUsdIfFrontier), 0.0);

        const savingsPct = baselineCostUsd > 0
          ? ((baselineCostUsd - totalCostUsd) / baselineCostUsd) * 100
          : 0.0;

        const todayStr = new Date().toISOString().split('T')[0];
        let periodStr = '';

        if (since) {
          periodStr = `${since}/${todayStr}`;
        } else if (history.length > 0) {
          const earliestTime = Math.min(...history.map((r) => r.createdAt.getTime()));
          const earliestStr = new Date(earliestTime).toISOString().split('T')[0];
          periodStr = `${earliestStr}/${todayStr}`;
        } else {
          periodStr = `${todayStr}/${todayStr}`;
        }

        return {
          period: periodStr,
          total_requests: totalRequests,
          total_cost_usd: parseFloat(totalCostUsd.toFixed(6)),
          baseline_cost_usd: parseFloat(baselineCostUsd.toFixed(6)),
          savings_pct: parseFloat(savingsPct.toFixed(2)),
        };
      } catch (error) {
        fastify.log.error(error);
        reply.status(500).send({ error: 'Internal Server Error' });
      }
    }
  );
}
