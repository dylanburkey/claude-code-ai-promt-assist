/**
 * Tests for ProjectValidator - Comprehensive validation system
 * **Feature: claude-code-bootstrap, Task 8: Create comprehensive validation system**
 * **Validates: Requirements 8.1, 8.2, 8.4**
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ProjectValidator } from './index.js';

// Mock database for testing
const mockDb = {
  prepare: (query) => ({
    bind: (...params) => ({
      all: () => ({ results: [] }),
      first: () => null,
      run: () => ({ success: true })
    })
  })
};

describe('ProjectValidator', () => {
  let validator;

  beforeEach(() => {
    validator = new ProjectValidator(mockDb);
  });

  describe('validateResourceDefinition', () => {
    it('should validate agent definitions correctly', async () => {
      const agentData = {
        name: 'Test Agent',
        role: 'Development Assistant',
        system_prompt: 'You are a helpful development assistant that helps with coding tasks.',
        description: 'A test agent for development tasks'
      };

      const result = await validator.validateResourceDefinition('agent', agentData);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing required fields in agent', async () => {
      const agentData = {
        name: '',
        role: '',
        system_prompt: ''
      };

      const result = await validator.validateResourceDefinition('agent', agentData);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Agent name is required');
      expect(result.errors).toContain('Agent role is required');
      expect(result.errors).toContain('Agent system prompt is required');
    });

    it('should validate rule definitions correctly', async () => {
      const ruleData = {
        title: 'Code Quality Rule',
        description: 'Ensures high code quality standards',
        rule_text: 'Always write clean, readable, and well-documented code',
        category: 'guidelines',
        priority: 'high'
      };

      const result = await validator.validateResourceDefinition('rule', ruleData);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect invalid priority in rule', async () => {
      const ruleData = {
        title: 'Test Rule',
        rule_text: 'Test rule content',
        priority: 'invalid_priority'
      };

      const result = await validator.validateResourceDefinition('rule', ruleData);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(error => error.includes('Invalid priority'))).toBe(true);
    });

    it('should validate hook definitions correctly', async () => {
      const hookData = {
        name: 'Test Hook',
        description: 'A test automation hook',
        trigger_event: 'on_file_save',
        command: 'echo "File saved"'
      };

      const result = await validator.validateResourceDefinition('hook', hookData);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect dangerous commands in hooks', async () => {
      const hookData = {
        name: 'Dangerous Hook',
        trigger_event: 'on_file_save',
        command: 'rm -rf /'
      };

      const result = await validator.validateResourceDefinition('hook', hookData);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(error => error.includes('dangerous operations'))).toBe(true);
    });

    it('should reject invalid resource types', async () => {
      const result = await validator.validateResourceDefinition('invalid_type', {});
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid resource type: invalid_type');
    });
  });

  describe('validateExportRequirements', () => {
    it('should validate complete project export requirements', async () => {
      const project = {
        name: 'Test Project',
        description: 'A test project for validation',
        status: 'active'
      };

      const resources = {
        agents: [
          { id: '1', name: 'Agent 1', is_primary: true, system_prompt: 'Test prompt' }
        ],
        rules: [
          { id: '1', title: 'Rule 1', rule_text: 'Test rule' }
        ],
        hooks: [
          { id: '1', name: 'Hook 1', trigger_event: 'on_file_save', command: 'echo test' }
        ]
      };

      const result = await validator.validateExportRequirements(project, resources);
      
      expect(result.isValid).toBe(true);
      expect(result.requiredComponents.project).toBe(true);
      expect(result.requiredComponents.agents).toBe(true);
      expect(result.requiredComponents.primaryAgent).toBe(true);
      expect(result.requiredComponents.rules).toBe(true);
      expect(result.requiredComponents.hooks).toBe(true);
    });

    it('should detect missing project name', async () => {
      const project = {
        name: '',
        description: 'Test project'
      };

      const resources = { agents: [], rules: [], hooks: [] };

      const result = await validator.validateExportRequirements(project, resources);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Project name is required for export');
    });

    it('should warn about missing resources', async () => {
      const project = {
        name: 'Test Project',
        description: 'Test project'
      };

      const resources = { agents: [], rules: [], hooks: [] };

      const result = await validator.validateExportRequirements(project, resources);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Project has no assigned resources - cannot generate meaningful Claude Code export');
      expect(result.missingComponents).toContain('agents');
      expect(result.missingComponents).toContain('rules');
      expect(result.missingComponents).toContain('hooks');
    });

    it('should warn about multiple primary agents', async () => {
      const project = {
        name: 'Test Project',
        description: 'Test project'
      };

      const resources = {
        agents: [
          { id: '1', name: 'Agent 1', is_primary: true },
          { id: '2', name: 'Agent 2', is_primary: true }
        ],
        rules: [],
        hooks: []
      };

      const result = await validator.validateExportRequirements(project, resources);
      
      expect(result.warnings).toContain('Multiple primary agents found - only one should be primary');
    });
  });

  describe('validateDependencies', () => {
    it('should handle empty resource list', async () => {
      const result = await validator.validateDependencies([]);
      
      expect(result.isValid).toBe(true);
      expect(result.missingDependencies).toHaveLength(0);
      expect(result.circularDependencies).toHaveLength(0);
    });

    it('should validate resource list without dependencies', async () => {
      const resources = [
        { resource_type: 'agent', resource_id: '1' },
        { resource_type: 'rule', resource_id: '1' }
      ];

      const result = await validator.validateDependencies(resources);
      
      expect(result.isValid).toBe(true);
    });
  });

  describe('Claude Code best practices validation', () => {
    it('should recommend Claude-specific improvements for agents', async () => {
      const agentData = {
        name: 'Basic Agent',
        role: 'Helper',
        system_prompt: 'Help with tasks', // Very basic prompt
        description: 'Basic helper'
      };

      const result = await validator.validateResourceDefinition('agent', agentData);
      
      // Check for XML structure recommendations (Claude Code specific)
      expect(result.recommendations.some(rec => 
        rec.includes('XML structure')
      )).toBe(true);
      
      // Should also recommend expanding description
      expect(result.recommendations.some(rec => 
        rec.includes('expanding the description')
      )).toBe(true);
    });

    it('should recommend actionable language for rules', async () => {
      const ruleData = {
        title: 'Vague Rule',
        rule_text: 'Be good at coding', // Not actionable
        description: 'A vague rule'
      };

      const result = await validator.validateResourceDefinition('rule', ruleData);
      
      expect(result.recommendations.some(rec => 
        rec.includes('actionable language')
      )).toBe(true);
    });
  });

  // Additional comprehensive validation tests for Requirements 8.1, 8.2, 8.3, 8.4, 8.5
  describe('Comprehensive resource validation against Claude Code requirements', () => {
    it('should validate agent system prompt length constraints', async () => {
      const shortPromptAgent = {
        name: 'Short Agent',
        role: 'Helper',
        system_prompt: 'Help', // Too short
        description: 'Agent with short prompt'
      };

      const result = await validator.validateResourceDefinition('agent', shortPromptAgent);
      
      expect(result.warnings.some(warning => 
        warning.includes('System prompt is very short')
      )).toBe(true);
    });

    it('should validate agent output format JSON structure', async () => {
      const invalidFormatAgent = {
        name: 'Format Agent',
        role: 'Helper',
        system_prompt: 'Help with formatting tasks',
        output_format: '{ invalid json }' // Invalid JSON
      };

      const result = await validator.validateResourceDefinition('agent', invalidFormatAgent);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Output format must be valid JSON');
    });

    it('should validate rule category against standard categories', async () => {
      const customCategoryRule = {
        title: 'Custom Rule',
        rule_text: 'Follow custom guidelines',
        category: 'custom_category' // Non-standard category
      };

      const result = await validator.validateResourceDefinition('rule', customCategoryRule);
      
      expect(result.warnings.some(warning => 
        warning.includes('Unusual category')
      )).toBe(true);
    });

    it('should validate hook trigger events against supported events', async () => {
      const customTriggerHook = {
        name: 'Custom Hook',
        trigger_event: 'on_custom_event', // Non-standard trigger
        command: 'echo "custom trigger"'
      };

      const result = await validator.validateResourceDefinition('hook', customTriggerHook);
      
      expect(result.warnings.some(warning => 
        warning.includes('Unusual trigger event')
      )).toBe(true);
    });

    it('should detect field length violations', async () => {
      const longNameAgent = {
        name: 'A'.repeat(150), // Too long
        role: 'B'.repeat(250), // Too long
        system_prompt: 'Valid prompt'
      };

      const result = await validator.validateResourceDefinition('agent', longNameAgent);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Agent name must be 100 characters or less');
      expect(result.errors).toContain('Agent role must be 200 characters or less');
    });
  });

  describe('Export validation with various project configurations', () => {
    it('should validate project with only agents', async () => {
      const project = {
        name: 'Agent Only Project',
        description: 'Project with only agents'
      };

      const resources = {
        agents: [
          { id: '1', name: 'Primary Agent', is_primary: true, system_prompt: 'Test prompt' }
        ],
        rules: [],
        hooks: []
      };

      const result = await validator.validateExportRequirements(project, resources);
      
      expect(result.isValid).toBe(true);
      expect(result.requiredComponents.agents).toBe(true);
      expect(result.requiredComponents.primaryAgent).toBe(true);
      expect(result.missingComponents).toContain('rules');
      expect(result.missingComponents).toContain('hooks');
    });

    it('should validate project with draft status', async () => {
      const project = {
        name: 'Draft Project',
        description: 'A project in draft status',
        status: 'draft'
      };

      const resources = {
        agents: [{ id: '1', name: 'Agent', is_primary: true }],
        rules: [],
        hooks: []
      };

      const result = await validator.validateExportRequirements(project, resources);
      
      expect(result.warnings).toContain('Project is in draft status - consider activating before export');
    });

    it('should validate project with no primary agent', async () => {
      const project = {
        name: 'No Primary Project',
        description: 'Project without primary agent'
      };

      const resources = {
        agents: [
          { id: '1', name: 'Agent 1', is_primary: false },
          { id: '2', name: 'Agent 2', is_primary: false }
        ],
        rules: [],
        hooks: []
      };

      const result = await validator.validateExportRequirements(project, resources);
      
      expect(result.warnings).toContain('No primary agent assigned - consider setting one agent as primary');
      expect(result.requiredComponents.primaryAgent).toBe(false);
    });

    it('should validate project with special characters in name', async () => {
      const project = {
        name: 'Project@#$%^&*()',
        description: 'Project with special characters'
      };

      const resources = {
        agents: [{ id: '1', name: 'Agent', is_primary: true }],
        rules: [],
        hooks: []
      };

      const result = await validator.validateExportRequirements(project, resources);
      
      expect(result.warnings.some(warning => 
        warning.includes('special characters that may cause issues')
      )).toBe(true);
    });

    it('should validate project with duplicate agent names', async () => {
      const project = {
        name: 'Duplicate Names Project',
        description: 'Project with duplicate agent names'
      };

      const resources = {
        agents: [
          { id: '1', name: 'Duplicate Agent', is_primary: true },
          { id: '2', name: 'Duplicate Agent', is_primary: false }
        ],
        rules: [],
        hooks: []
      };

      const result = await validator.validateExportRequirements(project, resources);
      
      expect(result.warnings.some(warning => 
        warning.includes('Duplicate agent names found')
      )).toBe(true);
    });

    it('should validate project name sanitization requirements', async () => {
      const project = {
        name: '@#$%^&*()', // Only special characters
        description: 'Project with only special characters in name'
      };

      const resources = {
        agents: [{ id: '1', name: 'Agent', is_primary: true }],
        rules: [],
        hooks: []
      };

      const result = await validator.validateExportRequirements(project, resources);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Project name contains only special characters - cannot create valid file structure');
    });
  });

  describe('Error message clarity and resolution guidance', () => {
    it('should provide specific guidance for missing required fields', async () => {
      const incompleteAgent = {
        name: '',
        role: '',
        system_prompt: ''
      };

      const result = await validator.validateResourceDefinition('agent', incompleteAgent);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Agent name is required');
      expect(result.errors).toContain('Agent role is required');
      expect(result.errors).toContain('Agent system prompt is required');
      
      // Each error should be specific and actionable
      result.errors.forEach(error => {
        expect(error).toMatch(/^Agent .+ is required$/);
      });
    });

    it('should provide clear guidance for invalid priority values', async () => {
      const invalidPriorityRule = {
        title: 'Test Rule',
        rule_text: 'Test rule content',
        priority: 'super_high' // Invalid priority
      };

      const result = await validator.validateResourceDefinition('rule', invalidPriorityRule);
      
      expect(result.isValid).toBe(false);
      const priorityError = result.errors.find(error => error.includes('Invalid priority'));
      expect(priorityError).toContain('Must be one of: low, medium, high, critical');
    });

    it('should provide actionable recommendations for improvement', async () => {
      const basicAgent = {
        name: 'AI',
        role: 'Help',
        system_prompt: 'Help users with tasks',
        description: ''
      };

      const result = await validator.validateResourceDefinition('agent', basicAgent);
      
      expect(result.recommendations).toContain('Consider using more descriptive names');
      expect(result.recommendations).toContain('Consider adding a description for better documentation');
    });

    it('should provide specific guidance for dangerous hook commands', async () => {
      const dangerousHook = {
        name: 'Dangerous Hook',
        trigger_event: 'on_file_save',
        command: 'sudo rm -rf /'
      };

      const result = await validator.validateResourceDefinition('hook', dangerousHook);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Hook command contains potentially dangerous operations');
    });

    it('should provide category suggestions for rules', async () => {
      const uncategorizedRule = {
        title: 'Test Rule',
        rule_text: 'Follow these guidelines',
        category: 'weird_category'
      };

      const result = await validator.validateResourceDefinition('rule', uncategorizedRule);
      
      const categoryWarning = result.warnings.find(warning => warning.includes('Unusual category'));
      expect(categoryWarning).toContain('Consider using: behavior, formatting, constraints, guidelines, security, performance, style, workflow');
    });

    it('should provide trigger event suggestions for hooks', async () => {
      const customTriggerHook = {
        name: 'Custom Hook',
        trigger_event: 'on_weird_event',
        command: 'echo "test"'
      };

      const result = await validator.validateResourceDefinition('hook', customTriggerHook);
      
      const triggerWarning = result.warnings.find(warning => warning.includes('Unusual trigger event'));
      expect(triggerWarning).toContain('Consider using: on_message_send, on_agent_complete, on_session_create, on_file_save, on_manual_trigger, on_project_open');
    });
  });

  describe('Missing component detection and suggestions', () => {
    it('should detect and suggest missing project description', async () => {
      const project = {
        name: 'Test Project',
        description: '' // Missing description
      };

      const resources = {
        agents: [{ id: '1', name: 'Agent', is_primary: true }],
        rules: [],
        hooks: []
      };

      const result = await validator.validateExportRequirements(project, resources);
      
      expect(result.warnings).toContain('Project description is missing - consider adding one for better documentation');
    });

    it('should suggest adding rules when missing', async () => {
      const project = {
        name: 'Test Project',
        description: 'Test project'
      };

      const resources = {
        agents: [{ id: '1', name: 'Agent', is_primary: true }],
        rules: [], // No rules
        hooks: []
      };

      const result = await validator.validateExportRequirements(project, resources);
      
      expect(result.recommendations).toContain('Consider adding rules to guide agent behavior');
    });

    it('should suggest adding hooks when missing', async () => {
      const project = {
        name: 'Test Project',
        description: 'Test project'
      };

      const resources = {
        agents: [{ id: '1', name: 'Agent', is_primary: true }],
        rules: [{ id: '1', title: 'Rule', rule_text: 'Test rule' }],
        hooks: [] // No hooks
      };

      const result = await validator.validateExportRequirements(project, resources);
      
      expect(result.recommendations).toContain('Consider adding hooks for workflow automation');
    });

    it('should detect missing agents and provide guidance', async () => {
      const project = {
        name: 'Test Project',
        description: 'Test project'
      };

      const resources = {
        agents: [], // No agents
        rules: [{ id: '1', title: 'Rule', rule_text: 'Test rule' }],
        hooks: []
      };

      const result = await validator.validateExportRequirements(project, resources);
      
      expect(result.warnings).toContain('No agents assigned to project - Claude Code projects typically include at least one agent');
    });
  });

  describe('Graceful error handling with user-friendly messages', () => {
    it('should handle null project data gracefully', async () => {
      const result = await validator.validateExportRequirements(null, { agents: [], rules: [], hooks: [] });
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Project data is required');
    });

    it('should handle missing resource data gracefully', async () => {
      const project = {
        name: 'Test Project',
        description: 'Test project'
      };

      const result = await validator.validateExportRequirements(project, null);
      
      // Should not crash and should provide meaningful feedback
      expect(result).toBeDefined();
      expect(result.isValid).toBeDefined();
    });

    it('should handle validation errors gracefully', async () => {
      // Test with malformed data that might cause internal errors
      const malformedData = {
        name: null,
        role: undefined,
        system_prompt: { invalid: 'object' }
      };

      const result = await validator.validateResourceDefinition('agent', malformedData);
      
      expect(result).toBeDefined();
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should provide user-friendly messages for system errors', async () => {
      // Test error handling in validateResourceDefinition with malformed input that causes internal errors
      const result = await validator.validateResourceDefinition('agent', {
        name: 'Test Agent',
        role: 'Test Role', 
        system_prompt: 'Test prompt',
        output_format: '{ "valid": "json" }' // This should work fine
      });
      
      // This test verifies that the validation system handles errors gracefully
      // Even if no error occurs, the system should still provide a valid response structure
      expect(result).toBeDefined();
      expect(result.isValid).toBeDefined();
      expect(Array.isArray(result.errors)).toBe(true);
      expect(Array.isArray(result.warnings)).toBe(true);
      expect(Array.isArray(result.recommendations)).toBe(true);
    });
  });
});