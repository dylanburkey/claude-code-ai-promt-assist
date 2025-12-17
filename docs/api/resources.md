# Project Resources API

The Project Resources API manages the assignment and organization of agents, rules, and hooks within project contexts. This API enables the Claude Code Bootstrap System's resource management capabilities.

## Endpoints

### Assign Resource to Project
```http
POST /api/projects/{id}/resources
```

Assigns an agent, rule, or hook to a project with configuration options.

**Parameters:**
- `id` (number, required): Project ID

**Request Body:**
```json
{
  "resource_type": "agent",
  "resource_id": "a1b2c3d4e5f6",
  "is_primary": false,
  "assignment_order": 0,
  "config_overrides": {
    "custom_setting": "value"
  },
  "assigned_by": "user_id",
  "assignment_reason": "Primary development agent for this project"
}
```

**Required Fields:**
- `resource_type` (string): Type of resource (`agent`, `rule`, `hook`)
- `resource_id` (string): ID of the resource to assign

**Optional Fields:**
- `is_primary` (boolean): Whether this is the primary resource of its type (default: false)
- `assignment_order` (number): Order for resource priority (default: 0)
- `config_overrides` (object): Project-specific configuration overrides
- `assigned_by` (string): ID of user who made the assignment
- `assignment_reason` (string): Reason for the assignment

**Response:**
```json
{
  "id": "assignment123",
  "project_id": 1,
  "resource_type": "agent",
  "resource_id": "a1b2c3d4e5f6",
  "resource_name": "Senior Python Developer",
  "resource_description": "Expert Python developer with 10+ years experience",
  "is_primary": 0,
  "assignment_order": 0,
  "config_overrides": null,
  "assigned_by": "user_id",
  "assignment_reason": "Primary development agent for this project",
  "created_at": "2024-12-10T10:30:00Z",
  "updated_at": "2024-12-10T10:30:00Z"
}
```

### Unassign Resource from Project
```http
DELETE /api/projects/{id}/resources/{resourceId}?resource_type={type}
```

Removes a resource assignment from a project.

**Parameters:**
- `id` (number, required): Project ID
- `resourceId` (string, required): Resource ID to unassign
- `resource_type` (string, required): Type of resource (`agent`, `rule`, `hook`)

**Response:**
```json
{
  "success": true
}
```

### List Project Resources
```http
GET /api/projects/{id}/resources
```

Returns all resources assigned to a project.

**Parameters:**
- `id` (number, required): Project ID

**Query Parameters:**
- `resource_type` (string, optional): Filter by resource type (`agent`, `rule`, `hook`)

**Response:**
```json
[
  {
    "id": "assignment123",
    "project_id": 1,
    "resource_type": "agent",
    "resource_id": "a1b2c3d4e5f6",
    "resource_name": "Senior Python Developer",
    "resource_description": "Expert Python developer with 10+ years experience",
    "resource_metadata": "Specializes in Django, FastAPI, and cloud deployments",
    "is_primary": 1,
    "assignment_order": 0,
    "config_overrides": null,
    "assigned_by": "user_id",
    "assignment_reason": "Primary development agent for this project",
    "created_at": "2024-12-10T10:30:00Z",
    "updated_at": "2024-12-10T10:30:00Z"
  }
]
```

### Get Available Resources for Import
```http
GET /api/projects/{id}/available-resources
```

Returns resources that can be imported into the project, showing assignment status.

**Parameters:**
- `id` (number, required): Project ID

**Query Parameters:**
- `resource_type` (string, optional): Filter by resource type (`agent`, `rule`, `hook`)

**Response:**
```json
[
  {
    "resource_type": "agent",
    "resource_id": "a1b2c3d4e5f6",
    "name": "Senior Python Developer",
    "role": "Expert Python developer with 10+ years experience",
    "description": "Specializes in Django, FastAPI, and cloud deployments",
    "is_assigned": 0
  },
  {
    "resource_type": "rule",
    "resource_id": "r7h8i9j0k1l2",
    "name": "Python Code Style",
    "description": "PEP 8 compliance and best practices",
    "category": "code-style",
    "is_assigned": 1
  }
]
```

### Update Resource Assignment
```http
PUT /api/projects/{projectId}/resources/{assignmentId}
```

Updates configuration for an existing resource assignment.

**Parameters:**
- `projectId` (number, required): Project ID
- `assignmentId` (string, required): Assignment ID

**Request Body:**
```json
{
  "is_primary": true,
  "assignment_order": 1,
  "config_overrides": {
    "custom_setting": "updated_value"
  },
  "assignment_reason": "Updated to primary agent"
}
```

**Response:**
```json
{
  "id": "assignment123",
  "project_id": 1,
  "resource_type": "agent",
  "resource_id": "a1b2c3d4e5f6",
  "resource_name": "Senior Python Developer",
  "is_primary": 1,
  "assignment_order": 1,
  "config_overrides": {
    "custom_setting": "updated_value"
  },
  "assignment_reason": "Updated to primary agent",
  "created_at": "2024-12-10T10:30:00Z",
  "updated_at": "2024-12-10T15:45:00Z"
}
```

### Get Specific Resource Assignment
```http
GET /api/projects/{projectId}/resources/assignments/{assignmentId}
```

Returns details for a specific resource assignment.

**Parameters:**
- `projectId` (number, required): Project ID
- `assignmentId` (string, required): Assignment ID

**Response:**
```json
{
  "id": "assignment123",
  "project_id": 1,
  "resource_type": "agent",
  "resource_id": "a1b2c3d4e5f6",
  "resource_name": "Senior Python Developer",
  "resource_description": "Expert Python developer with 10+ years experience",
  "is_primary": 1,
  "assignment_order": 0,
  "config_overrides": null,
  "assigned_by": "user_id",
  "assignment_reason": "Primary development agent for this project",
  "created_at": "2024-12-10T10:30:00Z",
  "updated_at": "2024-12-10T10:30:00Z"
}
```

## Resource Types

### Agent Resources
Agents represent AI personas with specific roles and capabilities.

**Fields:**
- `name`: Display name of the agent
- `role`: Detailed role description
- `description`: Additional context about the agent
- `resource_metadata`: Agent's role information

### Rule Resources
Rules define guidelines and constraints for project workflows.

**Fields:**
- `name`: Rule name
- `description`: Rule description
- `category`: Rule category (e.g., 'code-style', 'security', 'testing')
- `resource_metadata`: Rule category

### Hook Resources
Hooks define automation triggers and workflows (future implementation).

**Fields:**
- `name`: Hook name
- `description`: Hook description
- `hook_type`: Type of hook trigger
- `resource_metadata`: Hook type

## Assignment Configuration

### Primary Resources
Each project can have one primary resource per type:
- Setting `is_primary: true` automatically unsets other primary flags for that resource type
- Primary resources are used as defaults for project operations

### Assignment Order
Resources can be ordered within their type using `assignment_order`:
- Lower numbers have higher priority
- Used for determining resource precedence in operations

### Configuration Overrides
Project-specific settings can be applied to resources:
```json
{
  "config_overrides": {
    "output_style": "concise",
    "include_examples": true,
    "max_response_length": 500
  }
}
```

## Usage Examples

### Assign Primary Agent to Project
```bash
curl -X POST http://localhost:8787/api/projects/1/resources \
  -H "Content-Type: application/json" \
  -d '{
    "resource_type": "agent",
    "resource_id": "a1b2c3d4e5f6",
    "is_primary": true,
    "assignment_reason": "Primary development agent for Python project"
  }'
```

### Import Multiple Rules
```bash
# First, get available rules
curl "http://localhost:8787/api/projects/1/available-resources?resource_type=rule"

# Then assign specific rules
curl -X POST http://localhost:8787/api/projects/1/resources \
  -H "Content-Type: application/json" \
  -d '{
    "resource_type": "rule",
    "resource_id": "r7h8i9j0k1l2",
    "assignment_order": 1
  }'
```

### Update Assignment Priority
```bash
curl -X PUT http://localhost:8787/api/projects/1/resources/assignment123 \
  -H "Content-Type: application/json" \
  -d '{
    "assignment_order": 0,
    "is_primary": true
  }'
```

### List Project Resources by Type
```bash
curl "http://localhost:8787/api/projects/1/resources?resource_type=agent"
```

## Error Responses

### Resource Not Found
```json
{
  "error": "agent not found or not active"
}
```

### Project Not Found
```json
{
  "error": "Project not found"
}
```

### Resource Already Assigned
```json
{
  "error": "Resource is already assigned to this project"
}
```

### Invalid Resource Type
```json
{
  "error": "Invalid resource type. Must be one of: agent, rule, hook"
}
```

### Assignment Not Found
```json
{
  "error": "Resource assignment not found"
}
```

## Best Practices

### Resource Organization
- Use primary flags to designate default resources for each type
- Order resources by importance using `assignment_order`
- Provide clear `assignment_reason` for documentation

### Configuration Management
- Use `config_overrides` for project-specific customizations
- Keep overrides minimal and well-documented
- Test configuration changes before applying to production projects

### Import Workflow
1. Use `GET /available-resources` to see importable resources
2. Check `is_assigned` status to avoid duplicates
3. Assign resources with appropriate priority and configuration
4. Verify assignments with `GET /resources`

### Resource Sharing
- Resources can be shared across multiple projects
- Modifications to shared resources affect all assigned projects
- Use project-specific overrides for customization without affecting other projects

## Import & Dependency Management

### Import Resources into Project
```http
POST /api/projects/{id}/import
```

Imports multiple resources into a project with dependency resolution and conflict handling.

**Parameters:**
- `id` (number, required): Project ID

**Request Body:**
```json
{
  "resources": [
    {
      "resource_type": "agent",
      "resource_id": "a1b2c3d4e5f6",
      "config_overrides": {
        "custom_setting": "value"
      }
    },
    {
      "resource_type": "rule",
      "resource_id": "r7h8i9j0k1l2"
    }
  ],
  "options": {
    "resolve_dependencies": true,
    "conflict_resolution": "skip",
    "assigned_by": "user_id",
    "import_reason": "bulk_import"
  }
}
```

**Required Fields:**
- `resources` (array): Array of resource objects to import
  - `resource_type` (string): Type of resource (`agent`, `rule`, `hook`)
  - `resource_id` (string): ID of the resource to import

**Optional Fields:**
- `config_overrides` (object): Project-specific configuration overrides
- `options` (object): Import configuration
  - `resolve_dependencies` (boolean): Automatically resolve dependencies (default: true)
  - `conflict_resolution` (string): How to handle conflicts (`skip`, `overwrite`, `rename`) (default: skip)
  - `assigned_by` (string): ID of user performing import
  - `import_reason` (string): Reason for import operation

**Response:**
```json
{
  "project_id": 1,
  "import_summary": {
    "total": 2,
    "successful": 2,
    "failed": 0,
    "skipped": 0,
    "dependencies_found": 1
  },
  "results": {
    "successful": [
      {
        "resource_type": "agent",
        "resource_id": "a1b2c3d4e5f6",
        "assignment_id": "assignment123",
        "action": "imported",
        "dependencies": 0
      },
      {
        "resource_type": "rule",
        "resource_id": "r7h8i9j0k1l2",
        "assignment_id": "assignment124",
        "action": "imported",
        "dependencies": 1
      }
    ],
    "failed": [],
    "skipped": [],
    "dependencies": [
      {
        "resource_type": "rule",
        "resource_id": "r9x8y7z6w5v4",
        "dependency_type": "references",
        "is_critical": false,
        "exists": true
      }
    ]
  },
  "timestamp": "2024-12-10T10:30:00Z"
}
```

### Preview Import Operation
```http
POST /api/projects/{id}/import/preview
```

Analyzes resources for import without actually importing them, providing compatibility indicators and dependency information.

**Parameters:**
- `id` (number, required): Project ID

**Request Body:**
```json
{
  "resources": [
    {
      "resource_type": "agent",
      "resource_id": "a1b2c3d4e5f6"
    }
  ],
  "options": {
    "include_dependencies": true,
    "check_compatibility": true
  }
}
```

**Response:**
```json
{
  "project_id": 1,
  "resources": [
    {
      "resource_type": "agent",
      "resource_id": "a1b2c3d4e5f6",
      "exists": true,
      "already_assigned": false,
      "dependencies": [
        {
          "resource_type": "rule",
          "resource_id": "r9x8y7z6w5v4",
          "dependency_type": "references",
          "is_critical": false,
          "exists": true
        }
      ],
      "compatibility_score": 0.9,
      "warnings": []
    }
  ],
  "dependencies": [
    {
      "resource_type": "rule",
      "resource_id": "r9x8y7z6w5v4",
      "dependency_type": "references",
      "dependency_reason": "Referenced in agent system prompt",
      "is_critical": false,
      "exists": true
    }
  ],
  "conflicts": [],
  "compatibility": {
    "overall_score": 0.9,
    "warnings": [],
    "recommendations": [
      "All resources are compatible with this project"
    ]
  },
  "summary": {
    "total_resources": 1,
    "new_assignments": 1,
    "existing_assignments": 0,
    "missing_resources": 0,
    "critical_dependencies": 0
  }
}
```

### Get Available Resources for Import
```http
GET /api/resources/available
```

Returns all resources available for import across the system, with assignment status for a specific project.

**Query Parameters:**
- `project_id` (number, optional): Project ID to check assignment status against
- `resource_type` (string, optional): Filter by resource type (`agent`, `rule`, `hook`)
- `category` (string, optional): Filter by resource category
- `search` (string, optional): Search in resource names and descriptions

**Response:**
```json
[
  {
    "resource_type": "agent",
    "resource_id": "a1b2c3d4e5f6",
    "name": "Senior Python Developer",
    "role": "Expert Python developer with 10+ years experience",
    "description": "Specializes in Django, FastAPI, and cloud deployments",
    "category": "development",
    "is_assigned": 0,
    "assignment_count": 3,
    "last_used": "2024-12-09T15:30:00Z"
  },
  {
    "resource_type": "rule",
    "resource_id": "r7h8i9j0k1l2",
    "name": "Python Code Style",
    "description": "PEP 8 compliance and best practices",
    "category": "code-style",
    "is_assigned": 1,
    "assignment_count": 5,
    "last_used": "2024-12-10T09:15:00Z"
  }
]
```

## Dependency Management

### Resource Dependencies
The system automatically tracks and manages dependencies between resources:

**Dependency Types:**
- `references`: One resource references another in its content
- `requires`: One resource requires another to function properly
- `enhances`: One resource enhances the functionality of another
- `conflicts`: Resources that cannot be used together

**Dependency Resolution:**
- Critical dependencies are automatically included in import operations
- Non-critical dependencies are suggested but not required
- Circular dependencies are detected and reported
- Missing dependencies are flagged with resolution suggestions

### Conflict Resolution Strategies

**Skip (default):**
- Existing assignments are left unchanged
- Only new resources are imported
- Conflicts are reported but don't stop the import

**Overwrite:**
- Existing assignments are updated with new configuration
- Assignment metadata is preserved but updated
- Use with caution as it may affect existing project behavior

**Rename:**
- Conflicting resources are assigned with modified configuration
- Original assignments remain unchanged
- New assignments get incremented order values

## Usage Examples

### Import Resources with Dependencies
```bash
curl -X POST http://localhost:8787/api/projects/1/import \
  -H "Content-Type: application/json" \
  -d '{
    "resources": [
      {
        "resource_type": "agent",
        "resource_id": "a1b2c3d4e5f6"
      }
    ],
    "options": {
      "resolve_dependencies": true,
      "conflict_resolution": "skip",
      "import_reason": "Adding Python development capabilities"
    }
  }'
```

### Preview Import with Compatibility Check
```bash
curl -X POST http://localhost:8787/api/projects/1/import/preview \
  -H "Content-Type: application/json" \
  -d '{
    "resources": [
      {
        "resource_type": "rule",
        "resource_id": "r7h8i9j0k1l2"
      }
    ],
    "options": {
      "include_dependencies": true,
      "check_compatibility": true
    }
  }'
```

### Search Available Resources
```bash
curl "http://localhost:8787/api/resources/available?project_id=1&resource_type=agent&search=python"
```

## Error Responses

### Import Validation Error
```json
{
  "error": "Import validation failed",
  "details": {
    "invalid_resources": [
      {
        "resource_type": "agent",
        "resource_id": "invalid-id",
        "error": "Resource not found or not active"
      }
    ]
  }
}
```

### Dependency Resolution Error
```json
{
  "error": "Critical dependencies missing",
  "details": {
    "missing_dependencies": [
      {
        "resource_type": "rule",
        "resource_id": "required-rule",
        "dependency_reason": "Required by agent system prompt",
        "is_critical": true
      }
    ]
  }
}
```

### Circular Dependency Error
```json
{
  "error": "Circular dependency detected",
  "details": {
    "dependency_chain": [
      "agent-1 -> rule-1 -> hook-1 -> agent-1"
    ]
  }
}
```

## Best Practices

### Import Planning
- Always use preview before importing to understand impact
- Review dependency chains for complex resources
- Consider compatibility scores when selecting resources
- Plan imports in logical groups (e.g., all agents first, then rules)

### Dependency Management
- Keep dependency chains shallow to avoid complexity
- Document critical dependencies in resource descriptions
- Regularly review and clean up unused dependencies
- Use dependency analysis to identify tightly coupled resources

### Conflict Resolution
- Use "skip" for safe imports that won't affect existing setup
- Use "overwrite" only when you want to update existing configurations
- Test imports in development projects before applying to production
- Keep backups of project configurations before major imports

### Performance Optimization
- Import resources in batches rather than individually
- Use resource type filters to reduce API response sizes
- Cache available resources list for better UI performance
- Monitor import operation performance for large resource sets