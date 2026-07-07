import { pgTable, uuid, text, integer, timestamp, boolean, real, numeric, jsonb } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const agents = pgTable('agents', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  agentName: text('agent_name').notNull(),
  apiKey: text('api_key').unique().notNull(),
  dailyLimit: integer('daily_limit').notNull().default(500),
  requestsToday: integer('requests_today').notNull().default(0),
  quotaResetAt: timestamp('quota_reset_at', { withTimezone: true })
    .notNull()
    .default(sql`now() + interval '1 day'`),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const requests = pgTable('requests', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  agentId: uuid('agent_id').references(() => agents.id),
  taskType: text('task_type').notNull(),
  qualityBar: text('quality_bar').notNull(),
  tierUsed: text('tier_used').notNull(),
  escalated: boolean('escalated').notNull().default(false),
  escalationTrace: jsonb('escalation_trace'), // Array of { tier: string, confidence: number }
  confidence: real('confidence').notNull(),
  confidenceMethod: text('confidence_method').notNull(),
  costUsd: numeric('cost_usd', { precision: 10, scale: 6 }).notNull(),
  baselineCostUsdIfFrontier: numeric('baseline_cost_usd_if_frontier', { precision: 10, scale: 6 }).notNull(),
  latencyMs: integer('latency_ms').notNull(),
  accepted: boolean('accepted'), // Nullable until /feedback is called
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const banditState = pgTable('bandit_state', {
  taskType: text('task_type').primaryKey(),
  alpha: real('alpha').notNull().default(1.0),
  beta: real('beta').notNull().default(1.0),
  confidenceThreshold: real('confidence_threshold').notNull().default(0.85),
  samplesSeen: integer('samples_seen').notNull().default(0),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
