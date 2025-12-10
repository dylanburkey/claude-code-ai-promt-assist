-- Migration: 0005_prompt_project_linking.sql
-- Description: Enhanced prompt-project linking for the prompt builder
-- Allows users to associate generated prompts with one or more projects
-- and enables AI to learn from prompt generation to update project context

-- First, ensure the projects table exists (from 0004)
CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    cover_image TEXT,
    cover_image_alt TEXT,
    project_info TEXT,
    project_info_placeholder TEXT DEFAULT 'Describe your project here.',
    status TEXT DEFAULT 'active' CHECK(status IN ('draft', 'active', 'completed', 'archived', 'on_hold')),
    priority TEXT DEFAULT 'medium' CHECK(priority IN ('low', 'medium', 'high', 'critical')),
    category TEXT,
    tags TEXT,
    ai_context_summary TEXT,
    include_in_ai_context INTEGER DEFAULT 1,
    started_at DATETIME,
    target_completion DATETIME,
    completed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create project_prompts table with all columns
CREATE TABLE IF NOT EXISTS project_prompts (
    id TEXT PRIMARY KEY,
    project_id INTEGER NOT NULL,
    prompt_content TEXT NOT NULL,
    prompt_type TEXT DEFAULT 'general',
    title TEXT,
    prompt_notes TEXT,
    was_useful INTEGER,
    feedback TEXT,
    agent_id TEXT,
    agent_name TEXT,
    context_used TEXT,
    constraints_used TEXT,
    output_format TEXT,
    output_requirements_id TEXT,
    output_requirements_content TEXT,
    enhancement_type TEXT,
    is_primary INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- Table for linking prompts to multiple projects (many-to-many)
CREATE TABLE IF NOT EXISTS prompt_project_links (
    id TEXT PRIMARY KEY,
    prompt_id TEXT NOT NULL,
    project_id INTEGER NOT NULL,
    is_primary INTEGER DEFAULT 0,
    link_notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (prompt_id) REFERENCES project_prompts(id) ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    UNIQUE(prompt_id, project_id)
);

-- Table for tracking AI learning from prompts
CREATE TABLE IF NOT EXISTS project_ai_insights (
    id TEXT PRIMARY KEY,
    project_id INTEGER NOT NULL,
    insight_type TEXT NOT NULL CHECK(insight_type IN (
        'context_update',
        'pattern_detected',
        'technology_used',
        'requirement_inferred'
    )),
    insight_content TEXT NOT NULL,
    confidence REAL DEFAULT 0.5,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'accepted', 'rejected', 'applied')),
    source_prompt_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    reviewed_at DATETIME,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- Project relationships (from 0004)
CREATE TABLE IF NOT EXISTS project_relationships (
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

-- Project-Plan links (from 0004)
CREATE TABLE IF NOT EXISTS project_plans_link (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    plan_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    UNIQUE(project_id, plan_id)
);

-- Project-Agent links (from 0004)
CREATE TABLE IF NOT EXISTS project_agents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    agent_id TEXT NOT NULL,
    is_primary INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    UNIQUE(project_id, agent_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_projects_slug ON projects(slug);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_project_prompts_project ON project_prompts(project_id);
CREATE INDEX IF NOT EXISTS idx_prompt_project_links_prompt ON prompt_project_links(prompt_id);
CREATE INDEX IF NOT EXISTS idx_prompt_project_links_project ON prompt_project_links(project_id);
CREATE INDEX IF NOT EXISTS idx_project_ai_insights_project ON project_ai_insights(project_id);
CREATE INDEX IF NOT EXISTS idx_project_ai_insights_status ON project_ai_insights(status);
CREATE INDEX IF NOT EXISTS idx_project_relationships_source ON project_relationships(source_project_id);

-- Trigger to update the updated_at timestamp
CREATE TRIGGER IF NOT EXISTS update_projects_timestamp
AFTER UPDATE ON projects
BEGIN
    UPDATE projects SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
