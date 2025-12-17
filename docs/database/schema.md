# Database Schema

Complete reference for the Semantic Prompt Workstation database schema.

## Schema Overview

The database is organized into several functional areas:

- **Core System**: Agents, templates, and basic functionality
- **Project Management**: Projects, plans, and steps
- **Rule System**: IDE rules and rule sets
- **Analytics**: Usage tracking and history

## Core Tables

### agents
Stores AI agent personas with roles and output styles.

```sql
CREATE TABLE agents (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    style TEXT,
    description TEXT,
    is_default INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);
```

**Indexes:**
- `idx_agents_active` on `(is_active, created_at DESC)`

**Key Fields:**
- `id`: UUID without hyphens (e.g., "a1b2c3d4e5f6")
- `name`: Display name (e.g., "Senior Python Developer")
- `role`: Detailed expertise description
- `style`: Output preferences and tone
- `is_default`: Only one agent can be default (1)
- `is_active`: Soft deletion flag (0 = deleted)

### prompt_templates
Reusable prompt structures with placeholder support.

```sql
CREATE TABLE prompt_templates (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    name TEXT NOT NULL,
    description TEXT,
    template_content TEXT NOT NULL,
    placeholders TEXT DEFAULT '[]', -- JSON array
    category TEXT,
    tags TEXT DEFAULT '[]', -- JSON array
    usage_count INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);
```

**Indexes:**
- `idx_templates_category` on `(category, is_active)`
- `idx_templates_usage` on `(usage_count DESC)`

**JSON Fields:**
- `placeholders`: Array of `{name, description, required, default_value}`
- `tags`: Array of string tags for categorization

## Project Management

### projects
Main project containers with SEO-friendly URLs.

```sql
CREATE TABLE projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    cover_image TEXT,
    cover_image_alt TEXT,
    project_info TEXT,
    project_info_placeholder TEXT DEFAULT '...',
    status TEXT DEFAULT 'active' CHECK(status IN ('draft', 'active', 'completed', 'archived', 'on_hold')),
    priority TEXT DEFAULT 'medium' CHECK(priority IN ('low', 'medium', 'high', 'critical')),
    category TEXT,
    tags TEXT, -- JSON array
    ai_context_summary TEXT,
    include_in_ai_context INTEGER DEFAULT 1,
    started_at DATETIME,
    target_completion DATETIME,
    completed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Indexes:**
- `idx_projects_slug` on `(slug)` - UNIQUE
- `idx_projects_status` on `(status)`
- `idx_projects_category` on `(category)`
- `idx_projects_ai_context` on `(include_in_ai_context)`

### project_plans
Complex project planning containers.

```sql
CREATE TABLE project_plans (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    title TEXT NOT NULL,
    description TEXT,
    raw_input TEXT NOT NULL,
    status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'active', 'completed', 'archived')),
    priority TEXT DEFAULT 'medium' CHECK(priority IN ('low', 'medium', 'high', 'critical')),
    estimated_complexity TEXT, -- simple, moderate, complex, very_complex
    tags TEXT DEFAULT '[]', -- JSON array
    started_at TEXT,
    completed_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);
```

### plan_steps
Individual steps within project plans.

```sql
CREATE TABLE plan_steps (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    plan_id TEXT NOT NULL REFERENCES project_plans(id) ON DELETE CASCADE,
    step_number INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    semantic_prompt TEXT,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'in_progress', 'completed', 'skipped', 'blocked')),
    estimated_effort TEXT, -- small, medium, large
    depends_on TEXT DEFAULT '[]', -- JSON array of step IDs
    output_notes TEXT,
    completed_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);
```

**Indexes:**
- `idx_steps_plan` on `(plan_id, step_number)`
- `idx_steps_status` on `(plan_id, status)`

## Rule System

### ides
Supported IDE configurations (read-only reference data).

```sql
CREATE TABLE ides (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    name TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    icon TEXT,
    description TEXT,
    config_file_path TEXT, -- e.g., ".claude/rules.md"
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
);
```

**Default Data:**
```sql
INSERT INTO ides (id, name, display_name, config_file_path) VALUES
    ('ide_claude_code', 'claude-code', 'Claude Code', '.claude/rules.md'),
    ('ide_cursor', 'cursor', 'Cursor', '.cursorrules'),
    ('ide_windsurf', 'windsurf', 'Windsurf', '.windsurfrules'),
    ('ide_vscode', 'vscode', 'VS Code', '.vscode/settings.json'),
    ('ide_zed', 'zed', 'Zed', '.zed/settings.json');
```

### agent_rules
Rules and guidelines organized by IDE and agent.

```sql
CREATE TABLE agent_rules (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    name TEXT NOT NULL,
    description TEXT,
    rule_content TEXT NOT NULL,
    ide_id TEXT REFERENCES ides(id) ON DELETE SET NULL,
    agent_id TEXT REFERENCES agents(id) ON DELETE SET NULL,
    category TEXT, -- 'code-style', 'security', 'testing', 'documentation'
    priority INTEGER DEFAULT 0, -- Higher = more important
    tags TEXT DEFAULT '[]', -- JSON array
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);
```

**Indexes:**
- `idx_rules_ide` on `(ide_id, is_active)`
- `idx_rules_agent` on `(agent_id, is_active)`
- `idx_rules_category` on `(category, is_active)`

### rule_sets
Grouped collections of rules for export.

```sql
CREATE TABLE rule_sets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    file_type TEXT DEFAULT 'CLAUDE.md' CHECK(file_type IN ('CLAUDE.md', '.claude/rules')),
    project_id INTEGER,
    rules TEXT DEFAULT '[]', -- JSON array of rule objects
    rules_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
);
```

## Relationship Tables

### project_relationships
Many-to-many project relationships.

```sql
CREATE TABLE project_relationships (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_project_id INTEGER NOT NULL,
    related_project_id INTEGER NOT NULL,
    relationship_type TEXT DEFAULT 'related' CHECK(relationship_type IN (
        'related', 'depends_on', 'blocks', 'parent', 'child',
        'shares_code', 'shares_resources', 'successor', 'predecessor'
    )),
    description TEXT,
    is_bidirectional INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (source_project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (related_project_id) REFERENCES projects(id) ON DELETE CASCADE,
    UNIQUE(source_project_id, related_project_id, relationship_type),
    CHECK(source_project_id != related_project_id)
);
```

### project_plans_link
Links projects to plans.

```sql
CREATE TABLE project_plans_link (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    plan_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (plan_id) REFERENCES project_plans(id) ON DELETE CASCADE,
    UNIQUE(project_id, plan_id)
);
```

### project_resources
Enhanced project-resource relationship tracking with full assignment management.

```sql
CREATE TABLE project_resources (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    project_id INTEGER NOT NULL,
    resource_type TEXT NOT NULL CHECK(resource_type IN ('agent', 'rule', 'hook')),
    resource_id TEXT NOT NULL,
    is_primary INTEGER DEFAULT 0,
    assignment_order INTEGER DEFAULT 0,
    config_overrides TEXT, -- JSON object for project-specific settings
    assigned_by TEXT,
    assignment_reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    UNIQUE(project_id, resource_type, resource_id)
);
```

**Indexes:**
- `idx_project_resources_project` on `(project_id, resource_type)`
- `idx_project_resources_resource` on `(resource_type, resource_id)`
- `idx_project_resources_primary` on `(project_id, resource_type, is_primary)`

**Key Features:**
- **Resource Types**: Supports agents, rules, and hooks
- **Primary Assignment**: One primary resource per type per project
- **Assignment Order**: Priority ordering within resource types
- **Configuration Overrides**: Project-specific JSON configuration
- **Assignment Tracking**: Who assigned and why
- **Unique Constraints**: Prevents duplicate assignments

### export_history
Comprehensive export operation tracking.

```sql
CREATE TABLE export_history (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    project_id INTEGER NOT NULL,
    export_format TEXT DEFAULT 'zip',
    included_resources TEXT DEFAULT '[]',
    export_settings TEXT,
    file_size INTEGER,
    file_path TEXT,
    error_message TEXT,
    download_count INTEGER DEFAULT 0,
    last_downloaded_at DATETIME,
    expires_at DATETIME,
    processing_started_at DATETIME,
    processing_completed_at DATETIME,
    processing_duration_ms INTEGER,
    exported_by TEXT,
    export_notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);
```

### resource_dependencies
Resource relationship and dependency tracking.

```sql
CREATE TABLE resource_dependencies (
    id TEXT PRIMARY KEY,
    source_resource_type TEXT NOT NULL,
    source_resource_id TEXT NOT NULL,
    target_resource_type TEXT NOT NULL,
    target_resource_id TEXT NOT NULL,
    dependency_type TEXT NOT NULL DEFAULT 'requires',
    dependency_reason TEXT,
    is_critical INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### project_agents
Links projects to agents (legacy table, superseded by project_resources).

```sql
CREATE TABLE project_agents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    agent_id INTEGER NOT NULL,
    is_primary INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
    UNIQUE(project_id, agent_id)
);
```

## Analytics Tables

### usage_history
Tracks prompt generation for analytics.

```sql
CREATE TABLE usage_history (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    agent_id TEXT REFERENCES agents(id) ON DELETE SET NULL,
    template_id TEXT REFERENCES prompt_templates(id) ON DELETE SET NULL,
    task_summary TEXT,
    generated_prompt TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);
```

**Indexes:**
- `idx_usage_date` on `(created_at DESC)`
- `idx_usage_agent` on `(agent_id, created_at DESC)`

### project_prompts
Project-specific prompt history.

```sql
CREATE TABLE project_prompts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    prompt_content TEXT NOT NULL,
    prompt_type TEXT DEFAULT 'general',
    prompt_notes TEXT,
    was_useful INTEGER, -- 1 = yes, 0 = no, NULL = not rated
    feedback TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);
```

## Triggers

Automatic `updated_at` timestamp updates:

```sql
CREATE TRIGGER agents_updated_at
    AFTER UPDATE ON agents
    FOR EACH ROW
BEGIN
    UPDATE agents SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- Similar triggers exist for:
-- - prompt_templates
-- - agent_rules  
-- - project_plans
-- - plan_steps
-- - rule_sets
-- - projects
```

## Data Types and Constraints

### ID Generation
- **UUID Format**: `lower(hex(randomblob(16)))` - 32 character lowercase hex
- **Auto-increment**: Used for projects table only
- **Foreign Keys**: Properly constrained with CASCADE/SET NULL

### JSON Fields
All JSON fields are stored as TEXT with JSON validation in application layer:
- `placeholders`: Template placeholder definitions
- `tags`: String arrays for categorization
- `depends_on`: Step dependency arrays
- `rules`: Rule set definitions

### Timestamps
- **Format**: ISO 8601 strings via `datetime('now')`
- **Timezone**: UTC (SQLite default)
- **Auto-update**: Via triggers on UPDATE operations

### Status Enums
Enforced via CHECK constraints:
- **Project Status**: draft, active, completed, archived, on_hold
- **Priority**: low, medium, high, critical
- **Step Status**: pending, in_progress, completed, skipped, blocked
- **Relationship Types**: related, depends_on, blocks, parent, child, etc.

## Query Patterns

### Common Joins
```sql
-- Agents with their rules
SELECT a.*, ar.rule_content 
FROM agents a 
LEFT JOIN agent_rules ar ON a.id = ar.agent_id 
WHERE a.is_active = 1;

-- Projects with plans and steps
SELECT p.name, pl.title, ps.title as step_title
FROM projects p
JOIN project_plans_link ppl ON p.id = ppl.project_id
JOIN project_plans pl ON ppl.plan_id = pl.id
JOIN plan_steps ps ON pl.id = ps.plan_id
ORDER BY p.name, ps.step_number;
```

### Performance Tips
- Use indexes for WHERE clauses
- Limit result sets with LIMIT/OFFSET
- Use prepared statements for repeated queries
- Consider JSON extraction for complex JSON queries