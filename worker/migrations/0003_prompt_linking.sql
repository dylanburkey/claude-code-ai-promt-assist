-- Migration: Add prompt linking and export tracking
-- Run with: wrangler d1 execute prompt-workstation-db --remote --file=./migrations/0003_prompt_linking.sql

-- Add prompt_id to plan_steps for linking saved prompts
-- Check if column exists before adding
SELECT CASE
  WHEN (SELECT COUNT(*) FROM pragma_table_info('plan_steps') WHERE name = 'prompt_id') = 0
  THEN 1
  ELSE 0
END AS needs_column;

-- Export history tracking table
CREATE TABLE IF NOT EXISTS export_history (
  id TEXT PRIMARY KEY,
  export_type TEXT NOT NULL, -- 'claude-code', 'claude-md', 'openai', 'gemini', 'raw'
  content_hash TEXT,
  agent_id TEXT REFERENCES agents(id),
  template_id TEXT REFERENCES prompt_templates(id),
  plan_id TEXT REFERENCES project_plans(id),
  exported_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  metadata TEXT -- JSON blob for additional data
);

-- Index for export history queries
CREATE INDEX IF NOT EXISTS idx_export_history_type ON export_history(export_type);
CREATE INDEX IF NOT EXISTS idx_export_history_date ON export_history(exported_at);
CREATE INDEX IF NOT EXISTS idx_plan_steps_prompt_id ON plan_steps(prompt_id);
