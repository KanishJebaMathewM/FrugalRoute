import Fastify from 'fastify';
import cors from '@fastify/cors';
import OpenAI from 'openai';
import * as dotenv from 'dotenv';

dotenv.config();

// Extend FastifyInstance to hold the OpenAI-compatible client
declare module 'fastify' {
  interface FastifyInstance {
    ai: OpenAI;
  }
}

import { runMigrations } from './db/migrate.js';
import { registerRoutes } from './routes/register.js';
import { routeRoutes } from './routes/route.js';
import { feedbackRoutes } from './routes/feedback.js';
import { estimateRoutes } from './routes/estimate.js';
import { policyRoutes } from './routes/policy.js';
import { savingsRoutes } from './routes/savings.js';
import { skillmdRoutes } from './routes/skillmd.js';

const fastify = Fastify({
  logger: {
    transport: {
      target: 'pino-pretty',
      options: { colorize: true },
    },
  },
});

// Setup OpenRouter client (OpenAI-compatible)
const openrouterApiKey = process.env.OPENROUTER_API_KEY;
if (!openrouterApiKey) {
  fastify.log.error('Missing OPENROUTER_API_KEY environment variable. Server cannot start.');
  process.exit(1);
}

const ai = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: openrouterApiKey,
  defaultHeaders: {
    'HTTP-Referer': 'https://frugalroute-backend.onrender.com',
    'X-Title': 'FrugalRoute',
  },
});
fastify.decorate('ai', ai);

fastify.register(cors, { origin: '*' });

fastify.get('/health', async () => ({
  status: 'ok',
  timestamp: new Date().toISOString(),
}));

fastify.register(registerRoutes);
fastify.register(routeRoutes);
fastify.register(feedbackRoutes);
fastify.register(estimateRoutes);
fastify.register(policyRoutes);
fastify.register(savingsRoutes);
fastify.register(skillmdRoutes);

const port = Number(process.env.PORT) || 3000;

const start = async () => {
  try {
    await runMigrations();
    await fastify.listen({ port, host: '0.0.0.0' });
    fastify.log.info(`Server is listening on port ${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
