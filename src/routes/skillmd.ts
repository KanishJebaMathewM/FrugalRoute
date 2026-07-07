import { FastifyInstance } from 'fastify';
import fs from 'fs';
import path from 'path';

export async function skillmdRoutes(fastify: FastifyInstance) {
  fastify.get('/skill.md', async (request, reply) => {
    try {
      const filePath = path.resolve(process.cwd(), './skill.md');
      const content = await fs.promises.readFile(filePath, 'utf-8');
      reply.type('text/markdown').send(content);
    } catch (error) {
      fastify.log.error(error);
      reply.status(404).send({ error: 'skill.md file not found' });
    }
  });
}
