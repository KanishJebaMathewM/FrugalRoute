CREATE TABLE IF NOT EXISTS "agents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_name" text NOT NULL,
	"api_key" text NOT NULL,
	"daily_limit" integer DEFAULT 500 NOT NULL,
	"requests_today" integer DEFAULT 0 NOT NULL,
	"quota_reset_at" timestamp with time zone DEFAULT now() + interval '1 day' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agents_api_key_unique" UNIQUE("api_key")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bandit_state" (
	"task_type" text PRIMARY KEY NOT NULL,
	"alpha" real DEFAULT 1 NOT NULL,
	"beta" real DEFAULT 1 NOT NULL,
	"confidence_threshold" real DEFAULT 0.85 NOT NULL,
	"samples_seen" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid,
	"task_type" text NOT NULL,
	"quality_bar" text NOT NULL,
	"tier_used" text NOT NULL,
	"escalated" boolean DEFAULT false NOT NULL,
	"escalation_trace" jsonb,
	"confidence" real NOT NULL,
	"confidence_method" text NOT NULL,
	"cost_usd" numeric(10, 6) NOT NULL,
	"baseline_cost_usd_if_frontier" numeric(10, 6) NOT NULL,
	"latency_ms" integer NOT NULL,
	"accepted" boolean,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "requests" ADD CONSTRAINT "requests_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
