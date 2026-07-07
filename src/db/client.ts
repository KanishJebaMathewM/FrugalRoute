import { drizzle } from 'drizzle-orm/node-postgres';
import pkg from 'pg';
const { Pool } = pkg;
import * as schema from './schema.js';
import * as dotenv from 'dotenv';
dotenv.config();

const databaseUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/frugalroute';

export const pool = new Pool({
  connectionString: databaseUrl,
});

export const db = drizzle(pool, { schema });
