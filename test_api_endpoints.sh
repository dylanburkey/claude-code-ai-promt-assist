#!/bin/bash

# API Endpoint Testing Script
# Tests all API endpoints to verify they return 200/201 for valid requests

BASE_URL="http://localhost:8787"
FAILED_TESTS=0
TOTAL_TESTS=0

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to test an endpoint
test_endpoint() {
    local method=$1
    local endpoint=$2
    local data=$3
    local expected_codes=$4
    local description=$5
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    echo -n "Testing $method $endpoint - $description... "
    
    if [ -n "$data" ]; then
        response=$(curl -s -w "%{http_code}" -X $method "$BASE_URL$endpoint" \
                   -H "Content-Type: application/json" \
                   -d "$data")
    else
        response=$(curl -s -w "%{http_code}" -X $method "$BASE_URL$endpoint")
    fi
    
    # Extract status code (last 3 characters)
    status_code="${response: -3}"
    
    # Check if status code is in expected codes
    if [[ "$expected_codes" == *"$status_code"* ]]; then
        echo -e "${GREEN}✓ $status_code${NC}"
    else
        echo -e "${RED}✗ $status_code (expected: $expected_codes)${NC}"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        # Show response body for debugging (without status code)
        echo "  Response: ${response%???}"
    fi
}

echo "=== API Endpoint Testing ==="
echo "Testing against: $BASE_URL"
echo

# Test Agents endpoints
echo "--- Agents Endpoints ---"
test_endpoint "GET" "/api/agents" "" "200" "List agents"
test_endpoint "POST" "/api/agents" '{"name":"Test Agent","role":"Developer","description":"Test","system_prompt":"You are a test agent."}' "200 201" "Create agent"

# Get the created agent ID for further tests
agent_response=$(curl -s -X GET "$BASE_URL/api/agents")
agent_id=$(echo "$agent_response" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -n "$agent_id" ]; then
    test_endpoint "GET" "/api/agents/$agent_id" "" "200" "Get single agent"
    test_endpoint "PUT" "/api/agents/$agent_id" '{"name":"Updated Test Agent"}' "200" "Update agent"
    test_endpoint "DELETE" "/api/agents/$agent_id" "" "200" "Delete agent"
fi

echo

# Test Projects endpoints
echo "--- Projects Endpoints ---"
test_endpoint "GET" "/api/projects" "" "200" "List projects"
test_endpoint "POST" "/api/projects" '{"name":"Test Project","description":"Test project"}' "200 201" "Create project"

# Get the created project ID for further tests
project_response=$(curl -s -X GET "$BASE_URL/api/projects")
project_id=$(echo "$project_response" | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)

if [ -n "$project_id" ]; then
    test_endpoint "GET" "/api/projects/$project_id" "" "200" "Get single project"
    test_endpoint "PUT" "/api/projects/$project_id" '{"name":"Updated Test Project"}' "200" "Update project"
    test_endpoint "GET" "/api/projects/$project_id/resources" "" "200" "List project resources"
    test_endpoint "DELETE" "/api/projects/$project_id" "" "200" "Delete project"
fi

echo

# Test Rules endpoints
echo "--- Rules Endpoints ---"
test_endpoint "GET" "/api/rules" "" "200" "List rules"
test_endpoint "POST" "/api/rules" '{"name":"Test Rule","description":"Test rule","rule_content":"Test content"}' "200 201" "Create rule"

# Get the created rule ID for further tests
rule_response=$(curl -s -X GET "$BASE_URL/api/rules")
rule_id=$(echo "$rule_response" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -n "$rule_id" ]; then
    test_endpoint "GET" "/api/rules/$rule_id" "" "200" "Get single rule"
    test_endpoint "PUT" "/api/rules/$rule_id" '{"name":"Updated Test Rule"}' "200" "Update rule"
    test_endpoint "DELETE" "/api/rules/$rule_id" "" "200" "Delete rule"
fi

echo

# Test Templates endpoints
echo "--- Templates Endpoints ---"
test_endpoint "GET" "/api/templates" "" "200" "List templates"
test_endpoint "POST" "/api/templates" '{"name":"Test Template","template_content":"Test {{placeholder}}"}' "200 201" "Create template"

# Get the created template ID for further tests
template_response=$(curl -s -X GET "$BASE_URL/api/templates")
template_id=$(echo "$template_response" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -n "$template_id" ]; then
    test_endpoint "GET" "/api/templates/$template_id" "" "200" "Get single template"
    test_endpoint "PUT" "/api/templates/$template_id" '{"name":"Updated Test Template"}' "200" "Update template"
    test_endpoint "DELETE" "/api/templates/$template_id" "" "200" "Delete template"
fi

echo

# Test Output Requirements endpoints
echo "--- Output Requirements Endpoints ---"
test_endpoint "GET" "/api/output-requirements" "" "200" "List output requirements"
test_endpoint "POST" "/api/output-requirements" '{"name":"Test Output","requirements_content":"Test requirements"}' "200 201" "Create output requirement"

# Get the created output requirement ID for further tests
output_response=$(curl -s -X GET "$BASE_URL/api/output-requirements")
output_id=$(echo "$output_response" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -n "$output_id" ]; then
    test_endpoint "GET" "/api/output-requirements/$output_id" "" "200" "Get single output requirement"
    test_endpoint "PUT" "/api/output-requirements/$output_id" '{"name":"Updated Test Output"}' "200" "Update output requirement"
    test_endpoint "DELETE" "/api/output-requirements/$output_id" "" "200" "Delete output requirement"
fi

echo

# Test AI endpoints
echo "--- AI Endpoints ---"
test_endpoint "GET" "/api/ai/prompt-context" "" "200" "Get AI prompt context"
test_endpoint "POST" "/api/ai/enhance-prompt" '{"prompt":"Test prompt"}' "200" "Enhance prompt"
test_endpoint "POST" "/api/ai/detect-platforms" '{"input":"Test input"}' "200" "Detect platforms"
test_endpoint "GET" "/api/ai/platform-info" "" "200" "Get platform info"

echo

# Test Export endpoints
echo "--- Export Endpoints ---"
test_endpoint "POST" "/api/export/claude-code" '{"prompt":"Test prompt","agent":{"name":"Test","role":"Developer"}}' "200" "Export Claude Code"
test_endpoint "POST" "/api/export/claude-md" '{"prompt":"Test prompt","agent":{"name":"Test","role":"Developer"}}' "200" "Export Claude MD"

echo

# Test IDEs endpoint
echo "--- IDEs Endpoint ---"
test_endpoint "GET" "/api/ides" "" "200" "List IDEs"

echo

# Summary
echo "=== Test Summary ==="
echo "Total tests: $TOTAL_TESTS"
echo "Failed tests: $FAILED_TESTS"
echo "Passed tests: $((TOTAL_TESTS - FAILED_TESTS))"

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}All tests passed! ✓${NC}"
    exit 0
else
    echo -e "${RED}$FAILED_TESTS tests failed! ✗${NC}"
    exit 1
fi