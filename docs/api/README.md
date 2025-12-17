# API Documentation

The Semantic Prompt Workstation API provides RESTful endpoints for managing agents, prompts, projects, and AI-enhanced features.

## Base URL

- **Development**: `http://localhost:8787`
- **Production**: `https://your-worker.your-subdomain.workers.dev`

## Authentication

Currently, the API does not require authentication. All endpoints are publicly accessible.

## API Endpoints Overview

### Core Resources

| Endpoint | Description |
|----------|-------------|
| [`/api/agents`](agents.md) | Agent persona management |
| [`/api/templates`](templates.md) | Prompt template operations |
| [`/api/output-requirements`](output-requirements.md) | Output format specifications |
| [`/api/projects`](projects.md) | Project management |
| [`/api/projects`](projects.md) | Project management and organization |
| [`/api/resources`](resources.md) | Project resource assignment and management |
| [`/api/plans`](plans.md) | Project planning and steps |

### Configuration & Rules

| Endpoint | Description |
|----------|-------------|
| [`/api/ides`](ides.md) | IDE configurations (read-only) |
| [`/api/rules`](rules.md) | Agent rules and guidelines |
| [`/api/rule-sets`](rule-sets.md) | Grouped rule collections |

### AI & Enhancement

| Endpoint | Description |
|----------|-------------|
| [`/api/ai`](ai.md) | AI-powered prompt enhancement and resource suggestions |
| [`/api/export`](export.md) | Claude Code project export functionality |

### Import & Resource Management

| Endpoint | Description |
|----------|-------------|
| [`/api/projects/:id/import`](resources.md#import-resources) | Bulk resource import with dependency resolution |
| [`/api/projects/:id/import/preview`](resources.md#preview-import) | Preview import operations with compatibility analysis |
| [`/api/resources/available`](resources.md#available-resources) | List importable resources across projects |

## Common Response Format

All API responses follow this structure:

```json
{
  "success": true,
  "data": {
    // Response data
  },
  "message": "Optional message",
  "timestamp": "2024-12-10T10:30:00Z"
}
```

### Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": "Additional error details"
  },
  "timestamp": "2024-12-10T10:30:00Z"
}
```

## HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request |
| 404 | Not Found |
| 500 | Internal Server Error |

## Rate Limiting

- **Development**: No rate limiting
- **Production**: Cloudflare Workers standard limits apply

## CORS

CORS is enabled for all origins on `/api/*` endpoints:
- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS`
- `Access-Control-Allow-Headers: Content-Type`

## Data Types

### Common Field Types

| Type | Description | Example |
|------|-------------|---------|
| `id` | Unique identifier (UUID without hyphens) | `"a1b2c3d4e5f6"` |
| `timestamp` | ISO 8601 datetime string | `"2024-12-10T10:30:00Z"` |
| `json_array` | JSON-encoded array stored as string | `"[\"tag1\", \"tag2\"]"` |
| `json_object` | JSON-encoded object stored as string | `"{\"key\": \"value\"}"` |

### Status Values

**Project Status**: `draft`, `active`, `completed`, `archived`, `on_hold`
**Priority**: `low`, `medium`, `high`, `critical`
**Step Status**: `pending`, `in_progress`, `completed`, `skipped`, `blocked`

## Quick Start Examples

### Create an Agent
```bash
curl -X POST http://localhost:8787/api/agents \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Senior Python Developer",
    "role": "Expert Python developer with 10+ years experience",
    "style": "Concise, practical, security-focused"
  }'
```

### Generate a Prompt
```bash
curl -X POST http://localhost:8787/api/ai/enhance-prompt \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Help me write a Python function",
    "agent_id": "agent_id_here"
  }'
```

### Export Claude Code Rules
```bash
curl http://localhost:8787/api/export/claude-code/rule_set_id
```

## SDK and Client Libraries

Currently, no official SDKs are available. The API is designed to be consumed directly via HTTP requests or with standard HTTP client libraries.

### JavaScript Example
```javascript
// Fetch agents
const response = await fetch('/api/agents');
const { data: agents } = await response.json();

// Create new agent
const newAgent = await fetch('/api/agents', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'My Agent',
    role: 'Helpful assistant',
    style: 'Friendly and detailed'
  })
});
```

## Detailed Endpoint Documentation

- [Agents API](agents.md) - Complete agent management
- [Templates API](templates.md) - Prompt template operations  
- [Projects API](projects.md) - Project and planning features
- [AI Enhancement API](ai.md) - AI-powered features
- [Export API](export.md) - Data export functionality