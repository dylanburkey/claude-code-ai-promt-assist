# Projects API

The Projects API manages project containers that organize agents, rules, and hooks for Claude Code project structures.

## Endpoints

### List Projects
```http
GET /api/projects
```

Returns all projects with optional filtering and pagination.

**Query Parameters:**
- `status` (string, optional): Filter by project status (`draft`, `active`, `completed`, `archived`, `on_hold`)
- `category` (string, optional): Filter by project category
- `include_ai_context` (boolean, optional): Include only projects marked for AI context
- `include_related` (boolean, optional): Include related project information
- `limit` (number, optional): Maximum number of results (default: 50)
- `offset` (number, optional): Number of results to skip for pagination

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "slug": "web-app-project",
      "name": "Modern Web Application",
      "description": "Full-stack web application with React and Node.js",
      "status": "active",
      "priority": "high",
      "category": "web-development",
      "tags": ["react", "nodejs", "typescript"],
      "ai_context_summary": "Web application focused on user authentication and data visualization",
      "include_in_ai_context": 1,
      "started_at": "2024-12-01T00:00:00Z",
      "target_completion": "2024-12-31T23:59:59Z",
      "created_at": "2024-12-01T10:00:00Z",
      "updated_at": "2024-12-10T15:30:00Z"
    }
  ],
  "pagination": {
    "total": 25,
    "limit": 50,
    "offset": 0,
    "has_more": false
  }
}
```

### Get Project by Slug
```http
GET /api/projects/slug/{slug}
```

Returns a specific project by its SEO-friendly slug.

**Parameters:**
- `slug` (string, required): Project slug (e.g., "web-app-project")

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "slug": "web-app-project",
    "name": "Modern Web Application",
    "description": "Full-stack web application with React and Node.js",
    "cover_image": "https://example.com/project-cover.jpg",
    "cover_image_alt": "Project screenshot showing dashboard interface",
    "project_info": "Detailed project information and requirements",
    "project_info_placeholder": "Enter project details...",
    "status": "active",
    "priority": "high",
    "category": "web-development",
    "tags": ["react", "nodejs", "typescript"],
    "ai_context_summary": "Web application focused on user authentication and data visualization",
    "include_in_ai_context": 1,
    "started_at": "2024-12-01T00:00:00Z",
    "target_completion": "2024-12-31T23:59:59Z",
    "completed_at": null,
    "created_at": "2024-12-01T10:00:00Z",
    "updated_at": "2024-12-10T15:30:00Z"
  }
}
```

### Get Project by ID
```http
GET /api/projects/{id}
```

Returns a specific project by its numeric ID.

**Parameters:**
- `id` (number, required): Project ID

**Response:** Same as Get Project by Slug

### Create Project
```http
POST /api/projects
```

Creates a new project with automatic slug generation.

**Request Body:**
```json
{
  "name": "Modern Web Application",
  "description": "Full-stack web application with React and Node.js",
  "cover_image": "https://example.com/project-cover.jpg",
  "cover_image_alt": "Project screenshot showing dashboard interface",
  "project_info": "Detailed project information and requirements",
  "status": "draft",
  "priority": "medium",
  "category": "web-development",
  "tags": ["react", "nodejs", "typescript"],
  "ai_context_summary": "Web application focused on user authentication and data visualization",
  "include_in_ai_context": true,
  "started_at": "2024-12-01T00:00:00Z",
  "target_completion": "2024-12-31T23:59:59Z"
}
```

**Required Fields:**
- `name` (string): Project display name
- `description` (string): Project description

**Optional Fields:**
- `cover_image` (string): URL to project cover image
- `cover_image_alt` (string): Alt text for cover image
- `project_info` (string): Detailed project information
- `status` (string): Project status (default: "draft")
- `priority` (string): Project priority (default: "medium")
- `category` (string): Project category
- `tags` (array): Array of tag strings
- `ai_context_summary` (string): AI context summary
- `include_in_ai_context` (boolean): Include in AI context (default: true)
- `started_at` (string): ISO 8601 start date
- `target_completion` (string): ISO 8601 target completion date

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "slug": "modern-web-application",
    // ... full project object
  },
  "message": "Project created successfully"
}
```

### Update Project
```http
PUT /api/projects/{id}
```

Updates an existing project.

**Parameters:**
- `id` (number, required): Project ID

**Request Body:** Same as create, all fields optional
```json
{
  "name": "Updated Project Name",
  "status": "active",
  "priority": "high"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    // Updated project object
  },
  "message": "Project updated successfully"
}
```

### Delete Project
```http
DELETE /api/projects/{id}
```

Deletes a project and handles cleanup of related resources.

**Parameters:**
- `id` (number, required): Project ID

**Response:**
```json
{
  "success": true,
  "message": "Project deleted successfully"
}
```

## Project Object Schema

| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Unique project identifier |
| `slug` | string | SEO-friendly URL slug (auto-generated from name) |
| `name` | string | Project display name |
| `description` | string | Project description |
| `cover_image` | string | URL to project cover image |
| `cover_image_alt` | string | Alt text for cover image |
| `project_info` | string | Detailed project information |
| `project_info_placeholder` | string | Placeholder text for project info |
| `status` | string | Project status (draft, active, completed, archived, on_hold) |
| `priority` | string | Project priority (low, medium, high, critical) |
| `category` | string | Project category |
| `tags` | array | Array of tag strings |
| `ai_context_summary` | string | AI-generated context summary |
| `include_in_ai_context` | integer | 1 if included in AI context, 0 otherwise |
| `started_at` | string | ISO 8601 start date |
| `target_completion` | string | ISO 8601 target completion date |
| `completed_at` | string | ISO 8601 completion date |
| `created_at` | string | ISO 8601 creation timestamp |
| `updated_at` | string | ISO 8601 last update timestamp |

## Usage Examples

### Create a Web Development Project
```bash
curl -X POST http://localhost:8787/api/projects \
  -H "Content-Type: application/json" \
  -d '{
    "name": "E-commerce Platform",
    "description": "Modern e-commerce platform with React and Stripe integration",
    "category": "web-development",
    "tags": ["react", "stripe", "ecommerce"],
    "priority": "high",
    "status": "active",
    "target_completion": "2024-12-31T23:59:59Z"
  }'
```

### Update Project Status
```bash
curl -X PUT http://localhost:8787/api/projects/1 \
  -H "Content-Type: application/json" \
  -d '{
    "status": "completed",
    "completed_at": "2024-12-15T10:00:00Z"
  }'
```

### List Active Projects
```bash
curl "http://localhost:8787/api/projects?status=active&limit=10"
```

### Get Project by Slug
```bash
curl "http://localhost:8787/api/projects/slug/e-commerce-platform"
```

## Error Responses

### Project Not Found
```json
{
  "success": false,
  "error": {
    "code": "PROJECT_NOT_FOUND",
    "message": "Project not found"
  }
}
```

### Validation Error
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Name and description are required",
    "details": "Missing required fields: name, description"
  }
}
```

### Duplicate Slug
```json
{
  "success": false,
  "error": {
    "code": "DUPLICATE_SLUG",
    "message": "A project with this name already exists"
  }
}
```

## Related APIs

### Resource Management
Projects can have agents, rules, and hooks assigned to them. See the [Resources API](resources.md) for:
- Assigning resources to projects
- Managing resource configurations
- Importing resources from other projects
- Setting primary resources and priorities

### Project Relationships
Projects can be linked to other projects with various relationship types:
- `depends_on` / `blocks` - Dependency relationships
- `parent` / `child` - Hierarchical relationships  
- `related` - General associations
- `shares_code` / `shares_resources` - Resource sharing

## Best Practices

### Project Naming
- Use descriptive, specific names that clearly identify the project purpose
- Avoid generic names like "Project 1" or "Test Project"
- Consider including technology stack or domain in the name

### Slug Generation
- Slugs are automatically generated from project names
- Special characters are removed and spaces become hyphens
- Duplicate slugs are handled with numeric suffixes

### Status Management
- Use `draft` for projects in planning phase
- Use `active` for projects currently being worked on
- Use `completed` for finished projects
- Use `archived` for old projects no longer relevant
- Use `on_hold` for temporarily paused projects

### AI Context Integration
- Set `include_in_ai_context` to true for projects that should inform AI suggestions
- Provide meaningful `ai_context_summary` to help AI understand project scope
- Update context summary as project evolves

### Resource Organization
- Assign primary agents, rules, and hooks for each project
- Use the [Resources API](resources.md) to manage resource assignments
- Import proven resources from successful projects
- Configure project-specific overrides when needed

### Tags and Categories
- Use consistent tag naming conventions across projects
- Categories should represent broad project types (web-development, mobile-app, etc.)
- Tags should represent specific technologies, features, or characteristics