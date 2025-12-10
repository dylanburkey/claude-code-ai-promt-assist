-- Migration: 0004_projects.sql
-- Description: Add projects system with SEO-friendly URLs and project relationships

-- Projects table (main container for user projects)
CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    -- SEO-friendly URL slug (e.g., "my-awesome-project")
    slug TEXT UNIQUE NOT NULL,

    -- Project metadata
    name TEXT NOT NULL,
    description TEXT,

    -- Cover image (optional) - stores URL or base64 data
    cover_image TEXT,
    cover_image_alt TEXT,

    -- Project information textarea content
    project_info TEXT,
    project_info_placeholder TEXT DEFAULT 'Describe your project here. Include:
- Project goals and objectives
- Target audience or users
- Key features and requirements
- Technical constraints or preferences
- Related technologies or frameworks',

    -- Status tracking
    status TEXT DEFAULT 'active' CHECK(status IN ('draft', 'active', 'completed', 'archived', 'on_hold')),
    priority TEXT DEFAULT 'medium' CHECK(priority IN ('low', 'medium', 'high', 'critical')),

    -- Categorization
    category TEXT,
    tags TEXT, -- JSON array of tags

    -- AI Context fields (for cross-project awareness)
    ai_context_summary TEXT, -- Brief summary for AI to understand project
    include_in_ai_context INTEGER DEFAULT 1, -- Whether to include in AI context

    -- Timestamps
    started_at DATETIME,
    target_completion DATETIME,
    completed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Project relationships (many-to-many self-referencing)
CREATE TABLE IF NOT EXISTS project_relationships (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    -- The source project
    source_project_id INTEGER NOT NULL,

    -- The related project
    related_project_id INTEGER NOT NULL,

    -- Type of relationship
    relationship_type TEXT DEFAULT 'related' CHECK(relationship_type IN (
        'related',           -- General relationship
        'depends_on',        -- Source depends on related
        'blocks',            -- Source blocks related
        'parent',            -- Source is parent of related
        'child',             -- Source is child of related
        'shares_code',       -- Projects share code
        'shares_resources',  -- Projects share resources/assets
        'successor',         -- Source is successor to related
        'predecessor'        -- Source is predecessor to related
    )),

    -- Optional description of the relationship
    description TEXT,

    -- Bi-directional flag (if true, relationship works both ways)
    is_bidirectional INTEGER DEFAULT 0,

    -- Timestamps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    FOREIGN KEY (source_project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (related_project_id) REFERENCES projects(id) ON DELETE CASCADE,

    -- Prevent duplicate relationships
    UNIQUE(source_project_id, related_project_id, relationship_type),

    -- Prevent self-referencing
    CHECK(source_project_id != related_project_id)
);

-- Link projects to plans (existing table)
CREATE TABLE IF NOT EXISTS project_plans_link (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    plan_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (plan_id) REFERENCES project_plans(id) ON DELETE CASCADE,
    UNIQUE(project_id, plan_id)
);

-- Link projects to agents (which agents are used for this project)
CREATE TABLE IF NOT EXISTS project_agents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    agent_id INTEGER NOT NULL,
    is_primary INTEGER DEFAULT 0, -- Primary agent for this project
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
    UNIQUE(project_id, agent_id)
);

-- Project prompts history (track prompts generated for each project)
CREATE TABLE IF NOT EXISTS project_prompts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,

    -- The generated prompt
    prompt_content TEXT NOT NULL,

    -- Context about the prompt
    prompt_type TEXT DEFAULT 'general', -- general, planning, coding, review, etc.
    prompt_notes TEXT,

    -- Track effectiveness
    was_useful INTEGER, -- 1 = yes, 0 = no, NULL = not rated
    feedback TEXT,

    -- Timestamps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_projects_slug ON projects(slug);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_category ON projects(category);
CREATE INDEX IF NOT EXISTS idx_projects_ai_context ON projects(include_in_ai_context);

CREATE INDEX IF NOT EXISTS idx_project_relationships_source ON project_relationships(source_project_id);
CREATE INDEX IF NOT EXISTS idx_project_relationships_related ON project_relationships(related_project_id);
CREATE INDEX IF NOT EXISTS idx_project_relationships_type ON project_relationships(relationship_type);

CREATE INDEX IF NOT EXISTS idx_project_plans_link_project ON project_plans_link(project_id);
CREATE INDEX IF NOT EXISTS idx_project_plans_link_plan ON project_plans_link(plan_id);

CREATE INDEX IF NOT EXISTS idx_project_agents_project ON project_agents(project_id);
CREATE INDEX IF NOT EXISTS idx_project_prompts_project ON project_prompts(project_id);

-- Trigger to update the updated_at timestamp
CREATE TRIGGER IF NOT EXISTS update_projects_timestamp
AFTER UPDATE ON projects
BEGIN
    UPDATE projects SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
