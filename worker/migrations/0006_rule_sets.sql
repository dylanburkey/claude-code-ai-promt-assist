-- Migration: 0006_rule_sets.sql
-- Description: Update rule_sets table with new columns for Claude Code semantic rules file generation
-- Note: rule_sets was originally created in 0001_initial_schema.sql with a different schema

-- Add new columns to existing rule_sets table
ALTER TABLE rule_sets ADD COLUMN file_type TEXT DEFAULT 'CLAUDE.md' CHECK(file_type IN ('CLAUDE.md', '.claude/rules'));
ALTER TABLE rule_sets ADD COLUMN project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL;
ALTER TABLE rule_sets ADD COLUMN rules TEXT DEFAULT '[]';
ALTER TABLE rule_sets ADD COLUMN rules_count INTEGER DEFAULT 0;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_rule_sets_project ON rule_sets(project_id);
CREATE INDEX IF NOT EXISTS idx_rule_sets_file_type ON rule_sets(file_type);
CREATE INDEX IF NOT EXISTS idx_rule_sets_updated ON rule_sets(updated_at);

-- Trigger to update the updated_at timestamp
CREATE TRIGGER IF NOT EXISTS update_rule_sets_timestamp
AFTER UPDATE ON rule_sets
BEGIN
    UPDATE rule_sets SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
