import { FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../db/client.js';
import { agents } from '../db/schema.js';
import { eq } from 'drizzle-orm';

declare module 'fastify' {
  interface FastifyRequest {
    agent?: typeof agents.$inferSelect;
  }
}

/**
 * Authentication and rate-limiting middleware.
 * Validates X-API-Key, resets daily quota if expired, and enforces daily limits.
 */
export async function authenticateAgent(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const apiKey = request.headers['x-api-key'] as string;

  if (!apiKey) {
    reply.status(401).send({ error: 'Unauthorized: Missing X-API-Key header' });
    return;
  }

  const results = await db.select().from(agents).where(eq(agents.apiKey, apiKey)).limit(1);

  if (results.length === 0) {
    reply.status(401).send({ error: 'Unauthorized: Invalid API Key' });
    return;
  }

  let agent = results[0];
  const now = new Date();

  // Check if daily quota reset is needed
  if (now > agent.quotaResetAt) {
    const newResetTime = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    
    // Reset requests_today to 0 and update quota_reset_at to now + 24 hours
    const updated = await db.update(agents)
      .set({
        requestsToday: 0,
        quotaResetAt: newResetTime,
      })
      .where(eq(agents.id, agent.id))
      .returning();
      
    if (updated.length > 0) {
      agent = updated[0];
    }
  }

  // Check if rate limit is exceeded
  if (agent.requestsToday >= agent.dailyLimit) {
    reply.status(429).send({
      error: 'Rate Limit Exceeded: Daily free tier quota reached.',
      daily_limit: agent.dailyLimit,
      quota_reset_at: agent.quotaResetAt.toISOString(),
    });
    return;
  }

  // Attach agent metadata to request object
  request.agent = agent;
}
