# Agents API

The Agents API manages AI agent personas that define roles, styles, and behaviors for prompt generation.

## Endpoints

### List Agents
```http
GET /api/agents
```

Returns all active agents ordered by creation date.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "a1b2c3d4e5f6",
      "name": "Senior Python Developer",
      "role": "Expert Python developer with 10+ years experience in web development, API design, and system architecture",
      "style": "Concise, practical, security-focused responses with code examples",
      "description": "Specializes in Django, FastAPI, and cloud deployments",
      "is_default": 0,
      "is_active": 1,
      "created_at": "2024-12-10T10:30:00Z",
      "updated_at": "2024-12-10T10:30:00Z"
    }
  ]
}
```

### Get Agent
```http
GET /api/agents/{id}
```

Returns a specific agent by ID.

**Parameters:**
- `id` (string, required): Agent ID

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "a1b2c3d4e5f6",
    "name": "Senior Python Developer",
    "role": "Expert Python developer...",
    "style": "Concise, practical...",
    "description": "Specializes in Django...",
    "is_default": 0,
    "is_active": 1,
    "created_at": "2024-12-10T10:30:00Z",
    "updated_at": "2024-12-10T10:30:00Z"
  }
}
```

### Create Agent
```http
POST /api/agents
```

Creates a new agent persona.

**Request Body:**
```json
{
  "name": "Senior Python Developer",
  "role": "Expert Python developer with 10+ years experience",
  "style": "Concise, practical, security-focused",
  "description": "Specializes in Django, FastAPI, and cloud deployments",
  "is_default": false
}
```

**Required Fields:**
- `name` (string): Display name for the agent
- `role` (string): Detailed role description defining expertise and behavior

**Optional Fields:**
- `style` (string): Output style preferences
- `description` (string): Additional context about the agent
- `is_default` (boolean): Whether this is the default agent (default: false)

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "a1b2c3d4e5f6",
    "name": "Senior Python Developer",
    // ... full agent object
  },
  "message": "Agent created successfully"
}
```

### Update Agent
```http
PUT /api/agents/{id}
```

Updates an existing agent.

**Parameters:**
- `id` (string, required): Agent ID

**Request Body:** Same as create, all fields optional
```json
{
  "name": "Updated Agent Name",
  "style": "New style preferences"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    // Updated agent object
  },
  "message": "Agent updated successfully"
}
```

### Delete Agent
```http
DELETE /api/agents/{id}
```

Soft deletes an agent (sets `is_active` to 0).

**Parameters:**
- `id` (string, required): Agent ID

**Response:**
```json
{
  "success": true,
  "message": "Agent deleted successfully"
}
```

### Set Default Agent
```http
POST /api/agents/{id}/set-default
```

Sets an agent as the default (unsets all other defaults).

**Parameters:**
- `id` (string, required): Agent ID

**Response:**
```json
{
  "success": true,
  "message": "Default agent updated"
}
```

## Agent Object Schema

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier (UUID without hyphens) |
| `name` | string | Display name |
| `role` | string | Detailed role and expertise description |
| `style` | string | Output style preferences |
| `description` | string | Additional context |
| `is_default` | integer | 1 if default agent, 0 otherwise |
| `is_active` | integer | 1 if active, 0 if deleted |
| `created_at` | string | ISO 8601 creation timestamp |
| `updated_at` | string | ISO 8601 last update timestamp |

## Usage Examples

### Create a Coding Assistant
```bash
curl -X POST http://localhost:8787/api/agents \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Full-Stack Developer",
    "role": "Experienced full-stack developer proficient in React, Node.js, Python, and cloud architecture. Focuses on scalable, maintainable solutions.",
    "style": "Detailed explanations with code examples, considers performance and security",
    "description": "Specializes in modern web development, API design, and DevOps practices"
  }'
```

### Create a Content Writer
```bash
curl -X POST http://localhost:8787/api/agents \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Technical Writer",
    "role": "Professional technical writer with expertise in developer documentation, API guides, and user manuals",
    "style": "Clear, concise, user-focused writing with practical examples",
    "description": "Experienced in documentation for SaaS products and developer tools"
  }'
```

### Update Agent Style
```bash
curl -X PUT http://localhost:8787/api/agents/a1b2c3d4e5f6 \
  -H "Content-Type: application/json" \
  -d '{
    "style": "More conversational tone with step-by-step explanations"
  }'
```

## Error Responses

### Agent Not Found
```json
{
  "success": false,
  "error": {
    "code": "AGENT_NOT_FOUND",
    "message": "Agent not found"
  }
}
```

### Validation Error
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Name and role are required",
    "details": "Missing required fields: name, role"
  }
}
```

### Duplicate Name
```json
{
  "success": false,
  "error": {
    "code": "DUPLICATE_NAME",
    "message": "Agent with this name already exists"
  }
}
```

## Best Practices

### Agent Design
- **Name**: Use descriptive, role-based names
- **Role**: Be specific about expertise areas and experience level
- **Style**: Define clear output preferences and tone
- **Description**: Add context about specializations or use cases

### Role Examples
- "Senior DevOps engineer with 8+ years experience in Kubernetes, AWS, and CI/CD pipelines"
- "UX researcher specializing in user interviews, usability testing, and data-driven design decisions"
- "Product manager with B2B SaaS background, focused on feature prioritization and user adoption metrics"

### Style Examples
- "Concise, actionable responses with bullet points and code examples"
- "Detailed explanations with pros/cons analysis and alternative approaches"
- "Friendly, encouraging tone with step-by-step guidance for beginners"