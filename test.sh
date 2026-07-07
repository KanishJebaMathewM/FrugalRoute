#!/bin/bash
set -e

echo "=== 0. Health Check ==="
curl -s http://localhost:3000/health
echo -e "\n"

echo "=== 1. Register Agent ==="
REGISTER_RESP=$(curl -s -X POST http://localhost:3000/register \
  -H "Content-Type: application/json" \
  -d '{"agent_name": "test-agent-01"}')
echo "Register Response: $REGISTER_RESP"

# Extract API key
API_KEY=$(echo "$REGISTER_RESP" | grep -o '"api_key":"[^"]*' | grep -o '[^"]*$')
echo "Extracted API Key: $API_KEY"

if [ -z "$API_KEY" ]; then
  echo "Failed to register or extract API Key."
  exit 1
fi
echo -e "\n"

echo "=== 2. Route Request ==="
ROUTE_RESP=$(curl -s -X POST http://localhost:3000/route \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"task_type": "classification", "prompt": "Classify sentiment: '\''The flight was delayed but the crew handled it well.'\''", "quality_bar": "standard"}')
echo "Route Response: $ROUTE_RESP"

# Extract Request ID
REQUEST_ID=$(echo "$ROUTE_RESP" | grep -o '"request_id":"[^"]*' | grep -o '[^"]*$')
echo "Extracted Request ID: $REQUEST_ID"

if [ -z "$REQUEST_ID" ]; then
  echo "Failed to route or extract Request ID."
  exit 1
fi
echo -e "\n"

echo "=== 3. Submit Feedback ==="
FEEDBACK_RESP=$(curl -s -X POST http://localhost:3000/feedback \
  -H "Content-Type: application/json" \
  -d "{\"request_id\": \"$REQUEST_ID\", \"accepted\": true}")
echo "Feedback Response: $FEEDBACK_RESP"
echo -e "\n"

echo "=== 4. Cost/Tier Estimation ==="
ESTIMATE_RESP=$(curl -s -X POST http://localhost:3000/estimate \
  -H "Content-Type: application/json" \
  -d '{"task_type": "multi_step_reasoning", "prompt_length_tokens": 1200, "quality_bar": "strict"}')
echo "Estimate Response: $ESTIMATE_RESP"
echo -e "\n"

echo "=== 5. View Policy ==="
POLICY_RESP=$(curl -s -H "X-API-Key: $API_KEY" http://localhost:3000/policy/classification)
echo "Policy Response: $POLICY_RESP"
echo -e "\n"

echo "=== 6. View Savings ==="
SAVINGS_RESP=$(curl -s -H "X-API-Key: $API_KEY" http://localhost:3000/savings)
echo "Savings Response: $SAVINGS_RESP"
echo -e "\n"

echo "=== 7. Get skill.md (first 10 lines) ==="
curl -s http://localhost:3000/skill.md | head -n 10
echo -e "\n"

echo "=== All Tests Completed Successfully ==="
