# FrugalRoute — Confidence-Gated LLM Cascade Router

A meta-inference layer other agents call instead of hitting a model provider directly. FrugalRoute decides, per request, which model tier is actually needed to hit your quality bar — routing cheap/fast by default and escalating only when a measured confidence signal says the cheap tier isn't good enough. The routing policy is learned per task type via a contextual bandit and improves as agents send feedback.

## The problem this solves

Agents calling LLMs almost always hardcode a single model tier for every request. A one-line classification, a JSON reformat, and a subtle multi-step reasoning task all get billed and latency-charged identically — usually at frontier-model rates, because that's the safe default. FrugalRoute lets an agent delegate which tier to use to a system that's actively learning the cheapest tier that still clears a quality bar for that task type, instead of guessing once and never revisiting the guess.

## Core mechanism (what's actually happening under the hood)

*   **Cascade, not single-shot.** Every `/route` call starts at the cheapest tier (fast). The response's confidence is scored before deciding whether to return it or escalate to `mid` → `frontier`.
*   **Confidence scoring** uses two signals, combined:
    *   **Self-consistency**: k low-temperature samples are drawn from the current tier; agreement rate across samples is the primary signal.
    *   **Log-prob margin**: gap between the top and second token distributions at key decision points in the completion (available on tiers that expose log-probs).
*   **Escalation** is threshold-gated, but the threshold isn't fixed — it's a per-task_type parameter maintained by a contextual bandit (Thompson Sampling over a Beta-Bernoulli reward model: reward = 1 if downstream feedback marks the response correct/accepted, weighted against the cost incurred to get there).
*   **Feedback closes the loop.** Calling `/feedback` after you've judged the response updates the bandit's posterior for that task_type, which shifts future threshold decisions — the router gets stricter or looser automatically as evidence accumulates.
*   **State persists** across calls and across agents — you benefit from the routing decisions other agents' feedback has already trained in for a given task_type.

## Base URL

https://frugalroute-api.onrender.com

## Authentication

`X-API-Key` header, obtained via `/register`. Free tier: 500 routed requests/day.

## Endpoints

### POST /register

Get an API key.

```bash
curl -X POST https://frugalroute-api.onrender.com/register \
  -H "Content-Type: application/json" \
  -d '{"agent_name": "research-assistant-01"}'
```

Response:

```json
{ "api_key": "fr_live_8a2c...", "daily_limit": 500 }
```

### POST /route

Route a single inference request through the cascade.

Body:

```json
{
  "task_type": "classification",
  "prompt": "Classify sentiment: 'The flight was delayed but the crew handled it well.'",
  "quality_bar": "standard",
  "max_tier": "frontier"
}
```

*   `task_type` — a short label you consistently reuse for similar requests (e.g. classification, extraction, summarization, multi_step_reasoning, code_gen). The bandit policy is learned per task_type, so consistent labeling is what makes routing improve over time.
*   `quality_bar` — `"draft"` | `"standard"` | `"strict"`. Higher bars raise the confidence threshold required before FrugalRoute will stop escalating.
*   `max_tier` — ceiling on how far the cascade is allowed to escalate (`fast` | `mid` | `frontier`). Optional; defaults to `frontier`.

Example:

```bash
curl -X POST https://frugalroute-api.onrender.com/route \
  -H "X-API-Key: fr_live_8a2c..." \
  -H "Content-Type: application/json" \
  -d '{"task_type": "classification", "prompt": "Classify sentiment: ...", "quality_bar": "standard"}'
```

Response:

```json
{
  "request_id": "req_7f01a",
  "completion": "Mixed/positive — acknowledges a negative event (delay) but frames it positively via crew performance.",
  "tier_used": "fast",
  "escalated": false,
  "confidence": 0.91,
  "confidence_method": "self_consistency_k5",
  "cost_usd": 0.00012,
  "latency_ms": 340,
  "baseline_cost_usd_if_frontier": 0.0071
}
```

If the fast tier's confidence had fallen below the bandit's current threshold for classification at quality_bar: standard, `tier_used` would show `"mid"` or `"frontier"` and `escalated: true`, with the intermediate attempt's confidence included in `escalation_trace`.

### POST /feedback

Report whether the routed response was actually correct/accepted. This is what trains the bandit — skipping this means the policy never improves for your task_type.

Body:

```json
{ "request_id": "req_7f01a", "accepted": true }
```

Response:

```json
{ "request_id": "req_7f01a", "policy_updated": true, "task_type": "classification" }
```

### POST /estimate

Dry run — see what tier would be used and its predicted cost, without executing the request. Useful when an agent wants to budget before committing.

Body:

```json
{ "task_type": "multi_step_reasoning", "prompt_length_tokens": 1200, "quality_bar": "strict" }
```

Response:

```json
{ "predicted_tier": "mid", "predicted_cost_usd": 0.0031, "predicted_latency_ms": 900, "current_threshold": 0.87 }
```

### GET /policy/{task_type}

Inspect the current learned routing policy for a task type — useful for an agent (or you) auditing why escalation is happening more or less often.

```bash
curl https://frugalroute-api.onrender.com/policy/classification -H "X-API-Key: fr_live_8a2c..."
```

Response:

```json
{
  "task_type": "classification",
  "confidence_threshold": 0.85,
  "escalation_rate_last_1000": 0.12,
  "samples_seen": 4821,
  "avg_cost_savings_vs_frontier_baseline": 0.83
}
```

### GET /savings?since=2026-07-01

Cumulative cost savings for your API key vs. an always-frontier baseline.

```json
{ "period": "2026-07-01/2026-07-07", "total_requests": 1204, "total_cost_usd": 4.12, "baseline_cost_usd": 26.90, "savings_pct": 84.7 }
```

## How an agent should use this

1.  `POST /register` once to get an API key; store it.
2.  Before calling an LLM directly for a sub-task, call `POST /route` with a consistent `task_type` label for that kind of sub-task — reusing labels is what lets the bandit specialize.
3.  Use `completion` from the response as you would any model output.
4.  After you've judged whether the output was good enough (either immediately, or once downstream results confirm it), call `POST /feedback` with `accepted: true/false`. This step is not optional if you want the routing to improve — without it, FrugalRoute has no signal to learn from for your task type.
5.  If you need to budget before running a batch of requests, call `POST /estimate` first.
6.  Periodically check `GET /savings` if you want to report cost efficiency back to your own user/orchestrator.

## Notes on tiers

| Tier | Use case | Relative cost |
| :--- | :--- | :--- |
| **fast** | short, low-ambiguity tasks (classification, extraction, formatting) | 1x |
| **mid** | moderate reasoning, longer context | ~8x |
| **frontier** | complex multi-step reasoning, high-stakes correctness | ~60x |

Costs shown are illustrative multipliers based on current provider pricing at time of writing and are refreshed hourly server-side.

## Limitations

*   Confidence scoring via self-consistency adds latency (multiple samples at the fast tier) before a decision is made — for latency-critical single-shot use cases, set `max_tier: fast` to disable cascading entirely and always take the first response.
*   The bandit policy is shared across all agents using a given `task_type` label — pick specific, consistent labels rather than generic ones like `"general"` to avoid your traffic being policy-mixed with unrelated use cases.
