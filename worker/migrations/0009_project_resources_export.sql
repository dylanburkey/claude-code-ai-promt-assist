-- Migration: 0009_project_resources_export.sql
-- Description: Drop and recreate tables with correct schema for Claude Code Bootstrap System
-- Note: This migration drops existing tables to ensure clean schema

-- Drop existing tables if they exist (to handle schema conflicts)
DROP TABLE IF EXISTS project_resources;
DROP TABLE IF EXISTS resource_dependencies;

-- Drop and recreate export_history with new schema
DROP TABLE IF EXISTS export_history;
CREATE TABLE export_history (
    id TEXT PRIMARY KEY,
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
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- Create project_resources table (base table)
CREATE TABLE project_resources (
    id TEXT PRIMARY KEY,
    project_id INTEGER NOT NULL,
    resource_type TEXT DEFAULT 'agent',
    resource_id TEXT DEFAULT '',
    is_primary INTEGER DEFAULT 0,
    assignment_order INTEGER DEFAULT 0,
    config_overrides TEXT,
    assigned_by TEXT,
    assignment_reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- Create resource dependencies table
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

-- Create indexes for performance
CREATE INDEX idx_export_history_project ON export_history(project_id);
CREATE INDEX idx_export_history_status ON export_history(status);
CREATE INDEX idx_export_history_created ON export_history(created_at);

CREATE INDEX idx_project_resources_project ON project_resources(project_id);
CREATE INDEX idx_project_resources_type ON project_resources(resource_type);
CREATE INDEX idx_project_resources_resource ON project_resources(resource_type, resource_id);
CREATE INDEX idx_project_resources_primary ON project_resources(project_id, is_primary);

CREATE INDEX idx_resource_dependencies_source ON resource_dependencies(source_resource_type, source_resource_id);
CREATE INDEX idx_resource_dependencies_target ON resource_dependencies(target_resource_type, target_resource_id);

-- Triggers to update the updated_at timestamp
CREATE TRIGGER update_export_history_timestamp
AFTER UPDATE ON export_history
BEGIN
    UPDATE export_history SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER update_project_resources_timestamp
AFTER UPDATE ON project_resources
BEGIN
    UPDATE project_resources SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;