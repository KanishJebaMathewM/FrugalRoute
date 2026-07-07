import Fastify from 'fastify';
import cors from '@fastify/cors';
import { GoogleGenAI } from '@google/genai';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Extend FastifyInstance type to hold the GoogleGenAI instance
declare module 'fastify' {
  interface FastifyInstance {
    ai: GoogleGenAI;
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
      options: {
        colorize: true,
      },
    },
  },
});

// Setup API Client for Gemini
const geminiApiKey = process.env.GEMINI_API_KEY;
if (!geminiApiKey) {
  fastify.log.error('Missing GEMINI_API_KEY environment variable. Server cannot start.');
  process.exit(1);
}
const ai = new GoogleGenAI({ apiKey: geminiApiKey });
fastify.decorate('ai', ai);

// Register CORS middleware
fastify.register(cors, {
  origin: '*',
});

// Health check endpoint
fastify.get('/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

// Register routes
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
    // Run migrations before listening
    await runMigrations();

    await fastify.listen({ port, host: '0.0.0.0' });
    fastify.log.info(`Server is listening on port ${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
