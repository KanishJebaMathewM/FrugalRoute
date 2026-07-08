# FrugalRoute

**Confidence-gated LLM cascade router with a learned, per-task-type routing policy.**

Agents calling LLMs almost always hardcode a single model tier for every request — a one-line classification, a JSON reformat, and a complex multi-step reasoning task all get billed at the same frontier-model rate. FrugalRoute fixes this. Agents call `/route` instead of calling a model directly. FrugalRoute starts at the cheapest tier, measures confidence, and only escalates when the response isn't good enough — saving up to **95% in inference cost** while hitting the same quality bar.

Live at: **https://frugalroute-backend.onrender.com**
SkillMD: **https://frugalroute-backend.onrender.com/skill.md**

---

## How it works

```
Agent sends prompt
      │
      ▼
  [ fast tier ]  ──confidence >= threshold?──► return response
      │ no
      ▼
  [ mid tier ]   ──confidence >= threshold?──► return response
      │ no
      ▼
  [ frontier ]   ──────────────────────────► return response
```

**Confidence** is measured via self-consistency: k=3 completions are drawn at low temperature, and average pairwise Jaccard similarity across them is the confidence score. High agreement = the model is sure. Low agreement = escalate.

**The threshold isn't fixed.** A Thompson Sampling contextual bandit (Beta-Bernoulli reward model) maintains a per-`task_type` confidence threshold. Every `/feedback` call shifts the posterior — the router learns whether it's been too aggressive or too conservative for that task type and self-corrects.

**State is shared** — your feedback trains the policy for a `task_type` globally. Other agents using the same label benefit from your signal.

---

## Model Tiers (via OpenRouter)

| Tier | Model | Use case |
|---|---|---|
| **fast** | `google/gemma-4-31b-it:free` | Classification, extraction, formatting |
| **mid** | `openai/gpt-oss-20b:free` | Moderate reasoning, longer context |
| **frontier** | `nvidia/nemotron-3-ultra-550b-a55b:free` | Complex multi-step reasoning, high-stakes correctness |

All three are on OpenRouter's free tier — no billing required.

---

## API

Base URL: `https://frugalroute-backend.onrender.com`

Auth: `X-API-Key` header on all routes except `/register`, `/estimate`, and `/health`.

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/register` | Get an API key |
| `POST` | `/route` | Route a prompt through the cascade |
| `POST` | `/feedback` | Report result quality — trains the bandit |
| `POST` | `/estimate` | Dry-run cost/tier prediction without executing |
| `GET` | `/policy/:task_type` | Inspect the learned routing policy for a task type |
| `GET` | `/savings` | Cumulative cost savings vs always-frontier baseline |
| `GET` | `/health` | Health check |
| `GET` | `/skill.md` | Full SkillMD for OpenClaw agents |

Full request/response examples are in [`skill.md`](./skill.md).

---

## Quick start

```bash
# 1. Register
curl -X POST https://frugalroute-backend.onrender.com/register \
  -H "Content-Type: application/json" \
  -d '{"agent_name": "my-agent"}'
# → { "api_key": "fr_live_...", "daily_limit": 500 }

# 2. Route a request
curl -X POST https://frugalroute-backend.onrender.com/route \
  -H "X-API-Key: fr_live_..." \
  -H "Content-Type: application/json" \
  -d '{"task_type": "classification", "prompt": "Classify sentiment: Great product!", "quality_bar": "standard"}'
# → { "completion": "Positive.", "tier_used": "fast", "escalated": false, "confidence": 0.94, "cost_usd": 0.000005, "savings_vs_frontier": "95%" }

# 3. Send feedback — this is what trains the router
curl -X POST https://frugalroute-backend.onrender.com/feedback \
  -H "Content-Type: application/json" \
  -d '{"request_id": "req_...", "accepted": true}'

# 4. Check what you've saved
curl https://frugalroute-backend.onrender.com/savings \
  -H "X-API-Key: fr_live_..."
# → { "total_requests": 120, "total_cost_usd": 0.41, "baseline_cost_usd": 8.90, "savings_pct": 95.4 }
```

---

## Tech stack

- **Runtime**: Node.js 20+ / TypeScript
- **Framework**: Fastify
- **Database**: PostgreSQL via Drizzle ORM (migrations run on startup)
- **LLM API**: OpenRouter (OpenAI-compatible, one key for all tiers)
- **Deployed on**: Render (web service + managed Postgres via `render.yaml`)

---

## Local setup

```bash
# 1. Install
npm install

# 2. Configure
cp .env.example .env
# Fill in: DATABASE_URL, OPENROUTER_API_KEY

# 3. Run (migrations run automatically on startup)
npm run dev
```

Get a free OpenRouter API key at [openrouter.ai](https://openrouter.ai) — no credit card required.

---

## Deploy to Render

1. Fork the repo
2. Create a new **Blueprint** on [render.com](https://render.com) and connect this repo — `render.yaml` provisions the web service and Postgres automatically
3. Add `OPENROUTER_API_KEY` in the Render environment dashboard
4. Deploy — migrations run on first boot

---

## Why task_type labels matter

The bandit learns a separate policy per `task_type`. Reusing consistent labels (`classification`, `extraction`, `summarization`, `code_gen`, `multi_step_reasoning`) is what lets the router specialize — generic labels like `"general"` mix unrelated traffic and slow down learning.
