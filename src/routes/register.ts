import { FastifyInstance } from 'fastify';
import { db } from '../db/client.js';
import { agents } from '../db/schema.js';
import crypto from 'crypto';

interface RegisterBody {
  agent_name?: string;
}

export async function registerRoutes(fastify: FastifyInstance) {
  fastify.post('/register', async (request, reply) => {
    const { agent_name } = request.body as RegisterBody;
    
    if (!agent_name) {
      reply.status(400).send({ error: 'Missing agent_name in request body' });
      return;
    }

    const apiKey = `fr_live_${crypto.randomBytes(16).toString('hex')}`;

    try {
      const newAgents = await db.insert(agents).values({
        agentName: agent_name,
        apiKey,
        dailyLimit: 500,
        requestsToday: 0,
        quotaResetAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      }).returning();

      const newAgent = newAgents[0];

      return {
        api_key: newAgent.apiKey,
        daily_limit: newAgent.dailyLimit,
      };
    } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({ error: 'Internal Server Error' });
    }
  });
}
