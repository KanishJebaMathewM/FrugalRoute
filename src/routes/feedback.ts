import { FastifyInstance } from 'fastify';
import { db } from '../db/client.js';
import { requests } from '../db/schema.js';
import { updateBanditState } from '../core/bandit.js';
import { eq } from 'drizzle-orm';
import { FeedbackRequest } from '../types.js';

export async function feedbackRoutes(fastify: FastifyInstance) {
  fastify.post('/feedback', async (request, reply) => {
    const { request_id, accepted } = request.body as FeedbackRequest;

    if (!request_id || accepted === undefined) {
      reply.status(400).send({ error: 'Missing required fields: request_id and accepted.' });
      return;
    }

    try {
      const dbRequests = await db.select().from(requests).where(eq(requests.id, request_id)).limit(1);

      if (dbRequests.length === 0) {
        reply.status(404).send({ error: 'Request not found' });
        return;
      }

      const dbRequest = dbRequests[0];

      // Update request acceptance in the database
      await db.update(requests)
        .set({ accepted })
        .where(eq(requests.id, request_id));

      // Update Thompson Sampling bandit state
      await updateBanditState(dbRequest.taskType, accepted);

      return {
        request_id,
        policy_updated: true,
        task_type: dbRequest.taskType,
      };
    } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({ error: 'Internal Server Error' });
    }
  });
}
