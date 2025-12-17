-- Fix Agent Schema - Add missing system_prompt column
-- This migration adds the system_prompt column that the backend expects

-- Add system_prompt column to agents table
ALTER TABLE agents ADD COLUMN system_prompt TEXT;

-- Update existing agents to use role as system_prompt if system_prompt is empty
UPDATE agents 
SET system_prompt = role 
WHERE system_prompt IS NULL OR system_prompt = '';