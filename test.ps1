$baseUrl = "http://localhost:3000"

Write-Host "=== 0. Health Check ==="
Invoke-RestMethod -Uri "$baseUrl/health" -Method Get | ConvertTo-Json

Write-Host "`n=== 1. Register Agent ==="
$regBody = @{ agent_name = "test-agent-01" } | ConvertTo-Json
$regResp = Invoke-RestMethod -Uri "$baseUrl/register" -Method Post -Body $regBody -ContentType "application/json"
$regResp | ConvertTo-Json
$apiKey = $regResp.api_key
Write-Host "Extracted API Key: $apiKey"

Write-Host "`n=== 2. Route Request ==="
$routeBody = @{
    task_type = "classification"
    prompt = "Classify sentiment: 'The flight was delayed but the crew handled it well.'"
    quality_bar = "standard"
} | ConvertTo-Json
$routeResp = Invoke-RestMethod -Uri "$baseUrl/route" -Method Post -Body $routeBody -ContentType "application/json" -Headers @{ "X-API-Key" = $apiKey }
$routeResp | ConvertTo-Json
$requestId = $routeResp.request_id
Write-Host "Extracted Request ID: $requestId"

Write-Host "`n=== 3. Submit Feedback ==="
$fbBody = @{
    request_id = $requestId
    accepted = $true
} | ConvertTo-Json
$fbResp = Invoke-RestMethod -Uri "$baseUrl/feedback" -Method Post -Body $fbBody -ContentType "application/json"
$fbResp | ConvertTo-Json

Write-Host "`n=== 4. Cost/Tier Estimation ==="
$estBody = @{
    task_type = "multi_step_reasoning"
    prompt_length_tokens = 1200
    quality_bar = "strict"
} | ConvertTo-Json
$estResp = Invoke-RestMethod -Uri "$baseUrl/estimate" -Method Post -Body $estBody -ContentType "application/json"
$estResp | ConvertTo-Json

Write-Host "`n=== 5. View Policy ==="
Invoke-RestMethod -Uri "$baseUrl/policy/classification" -Method Get -Headers @{ "X-API-Key" = $apiKey } | ConvertTo-Json

Write-Host "`n=== 6. View Savings ==="
Invoke-RestMethod -Uri "$baseUrl/savings" -Method Get -Headers @{ "X-API-Key" = $apiKey } | ConvertTo-Json

Write-Host "`n=== 7. Get skill.md (first 10 lines) ==="
$skill = Invoke-RestMethod -Uri "$baseUrl/skill.md" -Method Get
$skill.Split("`n")[0..9] -join "`n"

Write-Host "`n=== All Tests Completed Successfully ==="
