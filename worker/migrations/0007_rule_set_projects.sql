-- Migration: 0007_rule_set_projects.sql
-- Description: Enable many-to-many relationship between rule_sets and projects
-- This allows a single rule set to be linked to multiple projects

-- Create the linking table for rule_sets <-> projects (many-to-many)
CREATE TABLE IF NOT EXISTS rule_set_projects (
    id TEXT PRIMARY KEY,
    rule_set_id TEXT NOT NULL,
    project_id INTEGER NOT NULL,
    is_primary INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (rule_set_id) REFERENCES rule_sets(id) ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    UNIQUE(rule_set_id, project_id)
);

-- Indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_rule_set_projects_rule_set ON rule_set_projects(rule_set_id);
CREATE INDEX IF NOT EXISTS idx_rule_set_projects_project ON rule_set_projects(project_id);
CREATE INDEX IF NOT EXISTS idx_rule_set_projects_primary ON rule_set_projects(is_primary);

-- Migrate existing data from rule_sets.project_id to the new linking table
-- This preserves any existing project associations
INSERT OR IGNORE INTO rule_set_projects (id, rule_set_id, project_id, is_primary, created_at)
SELECT
    lower(hex(randomblob(16))),
    id,
    project_id,
    1,
    CURRENT_TIMESTAMP
FROM rule_sets
WHERE project_id IS NOT NULL;
