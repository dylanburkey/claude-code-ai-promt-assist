-- Semantic Prompt Workstation - Initial Database Schema
-- This schema supports:
-- 1. Agents (personas for prompt generation)
-- 2. Prompt Templates (reusable prompt structures)
-- 3. Agent Rules (IDE/Agent-specific guidelines)
-- 4. Project Plans (complex project planning with steps)

-- ============================================
-- AGENTS TABLE
-- Core table for storing AI agent personas
-- ============================================
CREATE TABLE IF NOT EXISTS agents (
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

-- Index for listing active agents
CREATE INDEX IF NOT EXISTS idx_agents_active ON agents(is_active, created_at DESC);

-- ============================================
-- PROMPT TEMPLATES TABLE
-- Reusable prompt structures with placeholders
-- ============================================
CREATE TABLE IF NOT EXISTS prompt_templates (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    name TEXT NOT NULL,
    description TEXT,
    template_content TEXT NOT NULL,
    -- JSON array of placeholder objects: [{name, description, required, default_value}]
    placeholders TEXT DEFAULT '[]',
    category TEXT,
    tags TEXT DEFAULT '[]', -- JSON array of strings
    usage_count INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Index for searching templates
CREATE INDEX IF NOT EXISTS idx_templates_category ON prompt_templates(category, is_active);
CREATE INDEX IF NOT EXISTS idx_templates_usage ON prompt_templates(usage_count DESC);

-- ============================================
-- IDES TABLE
-- Supported IDEs for organizing rules
-- ============================================
CREATE TABLE IF NOT EXISTS ides (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    name TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    icon TEXT,
    description TEXT,
    config_file_path TEXT, -- e.g., ".claude/rules.md" for Claude Code
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Seed default IDEs
INSERT OR IGNORE INTO ides (id, name, display_name, config_file_path) VALUES
    ('ide_claude_code', 'claude-code', 'Claude Code', '.claude/rules.md'),
    ('ide_cursor', 'cursor', 'Cursor', '.cursorrules'),
    ('ide_windsurf', 'windsurf', 'Windsurf', '.windsurfrules'),
    ('ide_vscode', 'vscode', 'VS Code', '.vscode/settings.json'),
    ('ide_zed', 'zed', 'Zed', '.zed/settings.json');

-- ============================================
-- AGENT RULES TABLE
-- Rules/guidelines organized by IDE and Agent
-- ============================================
CREATE TABLE IF NOT EXISTS agent_rules (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    name TEXT NOT NULL,
    description TEXT,
    rule_content TEXT NOT NULL,
    -- Foreign keys (nullable for global rules)
    ide_id TEXT REFERENCES ides(id) ON DELETE SET NULL,
    agent_id TEXT REFERENCES agents(id) ON DELETE SET NULL,
    -- Rule metadata
    category TEXT, -- e.g., 'code-style', 'security', 'testing', 'documentation'
    priority INTEGER DEFAULT 0, -- Higher = more important
    tags TEXT DEFAULT '[]', -- JSON array of strings
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Indexes for filtering rules
CREATE INDEX IF NOT EXISTS idx_rules_ide ON agent_rules(ide_id, is_active);
CREATE INDEX IF NOT EXISTS idx_rules_agent ON agent_rules(agent_id, is_active);
CREATE INDEX IF NOT EXISTS idx_rules_category ON agent_rules(category, is_active);

-- ============================================
-- PROJECT PLANS TABLE
-- Complex project planning containers
-- ============================================
CREATE TABLE IF NOT EXISTS project_plans (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    title TEXT NOT NULL,
    description TEXT,
    -- Original user input
    raw_input TEXT NOT NULL,
    -- Overall project metadata
    status TEXT DEFAULT 'draft', -- draft, active, completed, archived
    priority TEXT DEFAULT 'medium', -- low, medium, high, critical
    estimated_complexity TEXT, -- simple, moderate, complex, very_complex
    tags TEXT DEFAULT '[]', -- JSON array of strings
    -- Timestamps
    started_at TEXT,
    completed_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Index for listing plans
CREATE INDEX IF NOT EXISTS idx_plans_status ON project_plans(status, created_at DESC);

-- ============================================
-- PLAN STEPS TABLE
-- Individual steps within a project plan
-- ============================================
CREATE TABLE IF NOT EXISTS plan_steps (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    plan_id TEXT NOT NULL REFERENCES project_plans(id) ON DELETE CASCADE,
    -- Step details
    step_number INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    -- The semantic prompt for this step
    semantic_prompt TEXT,
    -- Step metadata
    status TEXT DEFAULT 'pending', -- pending, in_progress, completed, skipped, blocked
    estimated_effort TEXT, -- small, medium, large
    -- Dependencies (JSON array of step IDs)
    depends_on TEXT DEFAULT '[]',
    -- Output/notes from completing the step
    output_notes TEXT,
    completed_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Indexes for plan steps
CREATE INDEX IF NOT EXISTS idx_steps_plan ON plan_steps(plan_id, step_number);
CREATE INDEX IF NOT EXISTS idx_steps_status ON plan_steps(plan_id, status);

-- ============================================
-- PLAN STEP PROMPTS TABLE
-- Multiple prompt variations for each step
-- ============================================
CREATE TABLE IF NOT EXISTS plan_step_prompts (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    step_id TEXT NOT NULL REFERENCES plan_steps(id) ON DELETE CASCADE,
    -- Prompt details
    prompt_type TEXT NOT NULL, -- 'primary', 'alternative', 'followup'
    prompt_content TEXT NOT NULL,
    -- Optional: which agent to use
    agent_id TEXT REFERENCES agents(id) ON DELETE SET NULL,
    -- Ordering
    display_order INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_step_prompts ON plan_step_prompts(step_id, display_order);

-- ============================================
-- RULE SETS TABLE
-- Grouped collections of rules for export
-- ============================================
CREATE TABLE IF NOT EXISTS rule_sets (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    name TEXT NOT NULL,
    description TEXT,
    ide_id TEXT REFERENCES ides(id) ON DELETE SET NULL,
    -- JSON array of rule IDs in this set
    rule_ids TEXT DEFAULT '[]',
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_rule_sets_ide ON rule_sets(ide_id, is_active);

-- ============================================
-- USAGE HISTORY TABLE
-- Track prompt generation for analytics
-- ============================================
CREATE TABLE IF NOT EXISTS usage_history (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    agent_id TEXT REFERENCES agents(id) ON DELETE SET NULL,
    template_id TEXT REFERENCES prompt_templates(id) ON DELETE SET NULL,
    -- What was generated
    task_summary TEXT,
    generated_prompt TEXT,
    -- Metadata
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_usage_date ON usage_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_agent ON usage_history(agent_id, created_at DESC);

-- ============================================
-- TRIGGERS FOR updated_at
-- ============================================
CREATE TRIGGER IF NOT EXISTS agents_updated_at
    AFTER UPDATE ON agents
    FOR EACH ROW
BEGIN
    UPDATE agents SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS templates_updated_at
    AFTER UPDATE ON prompt_templates
    FOR EACH ROW
BEGIN
    UPDATE prompt_templates SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS rules_updated_at
    AFTER UPDATE ON agent_rules
    FOR EACH ROW
BEGIN
    UPDATE agent_rules SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS plans_updated_at
    AFTER UPDATE ON project_plans
    FOR EACH ROW
BEGIN
    UPDATE project_plans SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS steps_updated_at
    AFTER UPDATE ON plan_steps
    FOR EACH ROW
BEGIN
    UPDATE plan_steps SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS rule_sets_updated_at
    AFTER UPDATE ON rule_sets
    FOR EACH ROW
BEGIN
    UPDATE rule_sets SET updated_at = datetime('now') WHERE id = NEW.id;
END;
