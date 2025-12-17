/**
 * Integration tests for resource assignment APIs
 * Tests requirements 2.3, 2.4, 3.2, 3.3
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

// Mock D1 Database for testing
class MockD1Database {
  constructor() {
    this.data = new Map();
    this.tables = {
      projects: new Map(),
      agents: new Map(),
      agent_rules: new Map(),
      hooks: new Map(),
      project_resources: new Map()
    };
    this.setupTestData();
  }

  setupTestData() {
    // Setup test projects
    this.tables.projects.set(1, {
      id: 1,
      slug: 'test-project-1',
      name: 'Test Project 1',
      description: 'First test project',
      status: 'active'
    });
    this.tables.projects.set(2, {
      id: 2,
      slug: 'test-project-2',
      name: 'Test Project 2',
      description: 'Second test project',
      status: 'active'
    });

    // Setup test agents
    this.tables.agents.set('agent-1', {
      id: 'agent-1',
      name: 'Test Agent 1',
      role: 'Developer',
      description: 'Primary development agent',
      is_active: 1
    });
    this.tables.agents.set('agent-2', {
      id: 'agent-2',
      name: 'Test Agent 2',
      role: 'Reviewer',
      description: 'Code review agent',
      is_active: 1
    });
    this.tables.agents.set('inactive-agent', {
      id: 'inactive-agent',
      name: 'Inactive Agent',
      role: 'Tester',
      description: 'Inactive test agent',
      is_active: 0
    });

    // Setup test rules
    this.tables.agent_rules.set('rule-1', {
      id: 'rule-1',
      name: 'Test Rule 1',
      description: 'Basic coding standards',
      category: 'coding',
      is_active: 1
    });
    this.tables.agent_rules.set('rule-2', {
      id: 'rule-2',
      name: 'Test Rule 2',
      description: 'Security guidelines',
      category: 'security',
      is_active: 1
    });

    // Setup test hooks
    this.tables.hooks.set('hook-1', {
      id: 'hook-1',
      name: 'Test Hook 1',
      description: 'Pre-commit validation',
      hook_type: 'pre-commit',
      is_enabled: 1
    });
    this.tables.hooks.set('hook-2', {
      id: 'hook-2',
      name: 'Test Hook 2',
      description: 'Post-deploy notification',
      hook_type: 'post-deploy',
      is_enabled: 1
    });
  }

  prepare(query) {
    return {
      bind: (...params) => ({
        run: async () => {
          // Handle INSERT operations
          if (query.includes('INSERT INTO project_resources')) {
            const [id, projectId, resourceType, resourceId, isPrimary, assignmentOrder, configOverrides, assignedBy, assignmentReason] = params;
            
            // Check for duplicates
            const existing = Array.from(this.tables.project_resources.values())
              .find(r => r.project_id === projectId && r.resource_type === resourceType && r.resource_id === resourceId);
            
            if (existing) {
              throw new Error('UNIQUE constraint failed');
            }

            this.tables.project_resources.set(id, {
              id,
              project_id: projectId,
              resource_type: resourceType,
              resource_id: resourceId,
              is_primary: isPrimary,
              assignment_order: assignmentOrder,
              config_overrides: configOverrides,
              assigned_by: assignedBy,
              assignment_reason: assignmentReason,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });

            return { success: true, meta: { changes: 1 } };
          }

          // Handle DELETE operations
          if (query.includes('DELETE FROM project_resources')) {
            const [projectId, resourceType, resourceId] = params;
            let deleted = false;
            
            for (const [key, resource] of this.tables.project_resources.entries()) {
              if (resource.project_id === projectId && 
                  resource.resource_type === resourceType && 
                  resource.resource_id === resourceId) {
                this.tables.project_resources.delete(key);
                deleted = true;
                break;
              }
            }

            return { success: true, meta: { changes: deleted ? 1 : 0 } };
          }

          // Handle UPDATE operations for primary flags
          if (query.includes('UPDATE project_resources SET is_primary = 0')) {
            const [projectId, resourceType] = params;
            
            for (const resource of this.tables.project_resources.values()) {
              if (resource.project_id === projectId && resource.resource_type === resourceType) {
                resource.is_primary = 0;
              }
            }

            return { success: true };
          }

          return { success: true };
        },

        first: async () => {
          // Handle SELECT operations for single records
          if (query.includes('SELECT id FROM projects WHERE id = ?')) {
            const [projectId] = params;
            return this.tables.projects.get(projectId) || null;
          }

          if (query.includes('SELECT id FROM agents WHERE id = ?')) {
            const [resourceId] = params;
            const agent = this.tables.agents.get(resourceId);
            return (agent && agent.is_active) ? agent : null;
          }

          if (query.includes('SELECT id FROM agent_rules WHERE id = ?')) {
            const [resourceId] = params;
            const rule = this.tables.agent_rules.get(resourceId);
            return (rule && rule.is_active) ? rule : null;
          }

          if (query.includes('SELECT id FROM hooks WHERE id = ?')) {
            const [resourceId] = params;
            const hook = this.tables.hooks.get(resourceId);
            return (hook && hook.is_enabled) ? hook : null;
          }

          // Handle resource assignment queries
          if (query.includes('FROM project_resources pr') && query.includes('WHERE pr.id = ?')) {
            const [assignmentId] = params;
            const assignment = this.tables.project_resources.get(assignmentId);
            
            if (!assignment) return null;

            // Add resource name based on type
            let resourceName = '';
            if (assignment.resource_type === 'agent') {
              const agent = this.tables.agents.get(assignment.resource_id);
              resourceName = agent ? agent.name : '';
            } else if (assignment.resource_type === 'rule') {
              const rule = this.tables.agent_rules.get(assignment.resource_id);
              resourceName = rule ? rule.name : '';
            } else if (assignment.resource_type === 'hook') {
              const hook = this.tables.hooks.get(assignment.resource_id);
              resourceName = hook ? hook.name : '';
            }

            return {
              ...assignment,
              resource_name: resourceName
            };
          }

          return null;
        },

        all: async () => {
          // Handle SELECT operations for multiple records
          if (query.includes('FROM project_resources pr') && query.includes('WHERE pr.project_id = ?')) {
            const [projectId, resourceType] = params;
            
            let results = Array.from(this.tables.project_resources.values())
              .filter(r => r.project_id === projectId);

            if (resourceType) {
              results = results.filter(r => r.resource_type === resourceType);
            }

            // Add resource names and descriptions
            results = results.map(assignment => {
              let resourceName = '';
              let resourceDescription = '';
              let resourceMetadata = '';

              if (assignment.resource_type === 'agent') {
                const agent = this.tables.agents.get(assignment.resource_id);
                if (agent) {
                  resourceName = agent.name;
                  resourceDescription = agent.description;
                  resourceMetadata = agent.role;
                }
              } else if (assignment.resource_type === 'rule') {
                const rule = this.tables.agent_rules.get(assignment.resource_id);
                if (rule) {
                  resourceName = rule.name;
                  resourceDescription = rule.description;
                  resourceMetadata = rule.category;
                }
              } else if (assignment.resource_type === 'hook') {
                const hook = this.tables.hooks.get(assignment.resource_id);
                if (hook) {
                  resourceName = hook.name;
                  resourceDescription = hook.description;
                  resourceMetadata = hook.hook_type;
                }
              }

              return {
                ...assignment,
                resource_name: resourceName,
                resource_description: resourceDescription,
                resource_metadata: resourceMetadata
              };
            });

            return { results };
          }

          // Handle available resources queries
          if (query.includes('FROM agents a') && query.includes('LEFT JOIN project_resources pr')) {
            const [projectId] = params;
            const agents = Array.from(this.tables.agents.values())
              .filter(a => a.is_active === 1)
              .map(agent => {
                const isAssigned = Array.from(this.tables.project_resources.values())
                  .some(r => r.project_id === projectId && r.resource_type === 'agent' && r.resource_id === agent.id);
                
                return {
                  resource_type: 'agent',
                  resource_id: agent.id,
                  name: agent.name,
                  role: agent.role,
                  description: agent.description,
                  is_assigned: isAssigned ? 1 : 0
                };
              });

            return { results: agents };
          }

          if (query.includes('FROM agent_rules ar') && query.includes('LEFT JOIN project_resources pr')) {
            const [projectId] = params;
            const rules = Array.from(this.tables.agent_rules.values())
              .filter(r => r.is_active === 1)
              .map(rule => {
                const isAssigned = Array.from(this.tables.project_resources.values())
                  .some(r => r.project_id === projectId && r.resource_type === 'rule' && r.resource_id === rule.id);
                
                return {
                  resource_type: 'rule',
                  resource_id: rule.id,
                  name: rule.name,
                  description: rule.description,
                  category: rule.category,
                  is_assigned: isAssigned ? 1 : 0
                };
              });

            return { results: rules };
          }

          if (query.includes('FROM hooks h') && query.includes('LEFT JOIN project_resources pr')) {
            const [projectId] = params;
            const hooks = Array.from(this.tables.hooks.values())
              .filter(h => h.is_enabled === 1)
              .map(hook => {
                const isAssigned = Array.from(this.tables.project_resources.values())
                  .some(r => r.project_id === projectId && r.resource_type === 'hook' && r.resource_id === hook.id);
                
                return {
                  resource_type: 'hook',
                  resource_id: hook.id,
                  name: hook.name,
                  description: hook.description,
                  hook_type: hook.hook_type,
                  is_assigned: isAssigned ? 1 : 0
                };
              });

            return { results: hooks };
          }

          return { results: [] };
        }
      })
    };
  }
}

// Import the ResourceManager class (we'll need to extract it)
class ResourceManager {
  constructor(db) {
    this.db = db;
  }

  async assignResource(projectId, resourceType, resourceId, options = {}) {
    const {
      isPrimary = false,
      assignmentOrder = 0,
      configOverrides = null,
      assignedBy = null,
      assignmentReason = null
    } = options;

    // Validate resource type
    const validTypes = ['agent', 'rule', 'hook'];
    if (!validTypes.includes(resourceType)) {
      throw new Error(`Invalid resource type. Must be one of: ${validTypes.join(', ')}`);
    }

    // Verify project exists
    const project = await this.db.prepare('SELECT id FROM projects WHERE id = ?').bind(projectId).first();
    if (!project) {
      throw new Error('Project not found');
    }

    // Verify resource exists based on type
    await this._verifyResourceExists(resourceType, resourceId);

    // If setting as primary, clear other primary flags for this resource type
    if (isPrimary) {
      await this.db.prepare(
        'UPDATE project_resources SET is_primary = 0 WHERE project_id = ? AND resource_type = ?'
      ).bind(projectId, resourceType).run();
    }

    try {
      const assignmentId = this._generateId();
      const result = await this.db.prepare(`
        INSERT INTO project_resources (
          id, project_id, resource_type, resource_id, is_primary, 
          assignment_order, config_overrides, assigned_by, assignment_reason
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        assignmentId, projectId, resourceType, resourceId, isPrimary ? 1 : 0,
        assignmentOrder, configOverrides ? JSON.stringify(configOverrides) : null,
        assignedBy, assignmentReason
      ).run();

      if (!result.success) {
        throw new Error('Failed to assign resource');
      }

      return await this.getResourceAssignment(assignmentId);
    } catch (error) {
      if (error.message.includes('UNIQUE constraint failed')) {
        throw new Error('Resource is already assigned to this project');
      }
      throw error;
    }
  }

  async unassignResource(projectId, resourceType, resourceId) {
    const result = await this.db.prepare(`
      DELETE FROM project_resources 
      WHERE project_id = ? AND resource_type = ? AND resource_id = ?
    `).bind(projectId, resourceType, resourceId).run();

    return result.success && (result.meta?.changes > 0 || result.changes > 0);
  }

  async getAvailableResources(projectId, resourceType = null) {
    const validTypes = ['agent', 'rule', 'hook'];
    
    if (resourceType && !validTypes.includes(resourceType)) {
      throw new Error(`Invalid resource type. Must be one of: ${validTypes.join(', ')}`);
    }

    const resources = [];

    // Get agents if requested or no specific type
    if (!resourceType || resourceType === 'agent') {
      const agents = await this.db.prepare(`
        SELECT 'agent' as resource_type, a.id as resource_id, a.name, a.role, a.description, 
               CASE WHEN pr.resource_id IS NOT NULL THEN 1 ELSE 0 END as is_assigned
        FROM agents a
        LEFT JOIN project_resources pr ON pr.resource_type = 'agent' 
          AND pr.resource_id = a.id AND pr.project_id = ?
        WHERE a.is_active = 1
        ORDER BY a.name
      `).bind(projectId).all();
      
      resources.push(...agents.results);
    }

    // Get rules if requested or no specific type
    if (!resourceType || resourceType === 'rule') {
      const rules = await this.db.prepare(`
        SELECT 'rule' as resource_type, ar.id as resource_id, ar.name, ar.description, ar.category,
               CASE WHEN pr.resource_id IS NOT NULL THEN 1 ELSE 0 END as is_assigned
        FROM agent_rules ar
        LEFT JOIN project_resources pr ON pr.resource_type = 'rule' 
          AND pr.resource_id = ar.id AND pr.project_id = ?
        WHERE ar.is_active = 1
        ORDER BY ar.name
      `).bind(projectId).all();
      
      resources.push(...rules.results);
    }

    // Get hooks if requested or no specific type
    if (!resourceType || resourceType === 'hook') {
      const hooks = await this.db.prepare(`
        SELECT 'hook' as resource_type, h.id as resource_id, h.name, h.description, h.hook_type,
               CASE WHEN pr.resource_id IS NOT NULL THEN 1 ELSE 0 END as is_assigned
        FROM hooks h
        LEFT JOIN project_resources pr ON pr.resource_type = 'hook' 
          AND pr.resource_id = h.id AND pr.project_id = ?
        WHERE h.is_enabled = 1
        ORDER BY h.name
      `).bind(projectId).all();
      
      resources.push(...hooks.results);
    }

    return resources;
  }

  async getProjectResources(projectId, resourceType = null) {
    let whereClause = 'WHERE pr.project_id = ?';
    const params = [projectId];

    if (resourceType) {
      whereClause += ' AND pr.resource_type = ?';
      params.push(resourceType);
    }

    const assignments = await this.db.prepare(`
      SELECT pr.*, 
             CASE pr.resource_type
               WHEN 'agent' THEN a.name
               WHEN 'rule' THEN ar.name
               WHEN 'hook' THEN h.name
             END as resource_name,
             CASE pr.resource_type
               WHEN 'agent' THEN a.description
               WHEN 'rule' THEN ar.description
               WHEN 'hook' THEN h.description
             END as resource_description,
             CASE pr.resource_type
               WHEN 'agent' THEN a.role
               WHEN 'rule' THEN ar.category
               WHEN 'hook' THEN h.hook_type
             END as resource_metadata
      FROM project_resources pr
      LEFT JOIN agents a ON pr.resource_type = 'agent' AND pr.resource_id = a.id
      LEFT JOIN agent_rules ar ON pr.resource_type = 'rule' AND pr.resource_id = ar.id
      LEFT JOIN hooks h ON pr.resource_type = 'hook' AND pr.resource_id = h.id
      ${whereClause}
      ORDER BY pr.resource_type, pr.assignment_order, pr.created_at
    `).bind(...params).all();

    return assignments.results.map(assignment => ({
      ...assignment,
      config_overrides: assignment.config_overrides ? JSON.parse(assignment.config_overrides) : null,
      is_primary: Boolean(assignment.is_primary)
    }));
  }

  async getResourceAssignment(assignmentId) {
    const assignment = await this.db.prepare(`
      SELECT pr.*, 
             CASE pr.resource_type
               WHEN 'agent' THEN a.name
               WHEN 'rule' THEN ar.name
               WHEN 'hook' THEN h.name
             END as resource_name,
             CASE pr.resource_type
               WHEN 'agent' THEN a.description
               WHEN 'rule' THEN ar.description
               WHEN 'hook' THEN h.description
             END as resource_description
      FROM project_resources pr
      LEFT JOIN agents a ON pr.resource_type = 'agent' AND pr.resource_id = a.id
      LEFT JOIN agent_rules ar ON pr.resource_type = 'rule' AND pr.resource_id = ar.id
      LEFT JOIN hooks h ON pr.resource_type = 'hook' AND pr.resource_id = h.id
      WHERE pr.id = ?
    `).bind(assignmentId).first();

    if (!assignment) {
      return null;
    }

    return {
      ...assignment,
      config_overrides: assignment.config_overrides ? JSON.parse(assignment.config_overrides) : null,
      is_primary: Boolean(assignment.is_primary)
    };
  }

  async _verifyResourceExists(resourceType, resourceId) {
    let table, condition;
    
    switch (resourceType) {
      case 'agent':
        table = 'agents';
        condition = 'is_active = 1';
        break;
      case 'rule':
        table = 'agent_rules';
        condition = 'is_active = 1';
        break;
      case 'hook':
        table = 'hooks';
        condition = 'is_enabled = 1';
        break;
      default:
        throw new Error(`Invalid resource type: ${resourceType}`);
    }

    const resource = await this.db.prepare(
      `SELECT id FROM ${table} WHERE id = ? AND ${condition}`
    ).bind(resourceId).first();

    if (!resource) {
      throw new Error(`${resourceType} not found or not active`);
    }
  }

  _generateId() {
    return 'test-' + Math.random().toString(36).substr(2, 9);
  }
}

describe('Resource Assignment APIs Integration Tests', () => {
  let db;
  let resourceManager;

  beforeEach(async () => {
    // Create a new mock database for each test
    db = new MockD1Database();
    resourceManager = new ResourceManager(db);
  });

  describe('Resource Assignment Workflow', () => {
    it('should assign an agent to a project successfully', async () => {
      const result = await resourceManager.assignResource(1, 'agent', 'agent-1', {
        isPrimary: true,
        assignmentOrder: 1,
        assignmentReason: 'Primary development agent'
      });
      
      expect(result).toMatchObject({
        project_id: 1,
        resource_type: 'agent',
        resource_id: 'agent-1',
        is_primary: true,
        assignment_order: 1,
        assignment_reason: 'Primary development agent'
      });
      expect(result.id).toBeDefined();
      expect(result.resource_name).toBe('Test Agent 1');
    });

    it('should assign a rule to a project successfully', async () => {
      const result = await resourceManager.assignResource(1, 'rule', 'rule-1', {
        isPrimary: false,
        assignmentOrder: 2
      });
      
      expect(result).toMatchObject({
        project_id: 1,
        resource_type: 'rule',
        resource_id: 'rule-1',
        is_primary: false,
        assignment_order: 2
      });
      expect(result.resource_name).toBe('Test Rule 1');
    });

    it('should assign a hook to a project successfully', async () => {
      const result = await resourceManager.assignResource(1, 'hook', 'hook-1', {
        configOverrides: { enabled: true, priority: 'high' }
      });
      
      expect(result).toMatchObject({
        project_id: 1,
        resource_type: 'hook',
        resource_id: 'hook-1'
      });
      expect(result.config_overrides).toEqual({ enabled: true, priority: 'high' });
      expect(result.resource_name).toBe('Test Hook 1');
    });

    it('should unassign a resource from a project successfully', async () => {
      // First assign a resource
      await resourceManager.assignResource(1, 'agent', 'agent-1');

      // Then unassign it
      const success = await resourceManager.unassignResource(1, 'agent', 'agent-1');
      expect(success).toBe(true);

      // Verify it's no longer assigned
      const resources = await resourceManager.getProjectResources(1);
      expect(resources.find(r => r.resource_id === 'agent-1')).toBeUndefined();
    });

    it('should list project resources correctly', async () => {
      // Assign multiple resources
      await resourceManager.assignResource(1, 'agent', 'agent-1', { isPrimary: true });
      await resourceManager.assignResource(1, 'rule', 'rule-1');

      // List all resources
      const resources = await resourceManager.getProjectResources(1);
      expect(resources).toHaveLength(2);
      
      const agent = resources.find(r => r.resource_type === 'agent');
      const rule = resources.find(r => r.resource_type === 'rule');
      
      expect(agent).toMatchObject({
        resource_type: 'agent',
        resource_id: 'agent-1',
        is_primary: true,
        resource_name: 'Test Agent 1'
      });
      
      expect(rule).toMatchObject({
        resource_type: 'rule',
        resource_id: 'rule-1',
        is_primary: false,
        resource_name: 'Test Rule 1'
      });
    });
  });

  describe('Resource Sharing Across Projects', () => {
    it('should allow the same resource to be assigned to multiple projects', async () => {
      // Assign agent-1 to project 1
      await resourceManager.assignResource(1, 'agent', 'agent-1', { isPrimary: true });

      // Assign the same agent to project 2
      await resourceManager.assignResource(2, 'agent', 'agent-1', { isPrimary: false });

      // Verify both assignments exist
      const project1Resources = await resourceManager.getProjectResources(1);
      expect(project1Resources.find(r => r.resource_id === 'agent-1')).toBeDefined();

      const project2Resources = await resourceManager.getProjectResources(2);
      expect(project2Resources.find(r => r.resource_id === 'agent-1')).toBeDefined();
    });

    it('should maintain resource data integrity when shared across projects', async () => {
      // Assign rule-1 to both projects with different configurations
      await resourceManager.assignResource(1, 'rule', 'rule-1', {
        configOverrides: { strictness: 'high' },
        assignmentReason: 'Strict development rules'
      });

      await resourceManager.assignResource(2, 'rule', 'rule-1', {
        configOverrides: { strictness: 'medium' },
        assignmentReason: 'Moderate rules for testing'
      });

      // Verify each project has its own configuration
      const project1Resources = await resourceManager.getProjectResources(1);
      const project1Rule = project1Resources.find(r => r.resource_id === 'rule-1');
      expect(project1Rule.config_overrides).toEqual({ strictness: 'high' });
      expect(project1Rule.assignment_reason).toBe('Strict development rules');

      const project2Resources = await resourceManager.getProjectResources(2);
      const project2Rule = project2Resources.find(r => r.resource_id === 'rule-1');
      expect(project2Rule.config_overrides).toEqual({ strictness: 'medium' });
      expect(project2Rule.assignment_reason).toBe('Moderate rules for testing');
    });

    it('should handle primary resource flags independently per project', async () => {
      // Set agent-1 as primary in project 1
      await resourceManager.assignResource(1, 'agent', 'agent-1', { isPrimary: true });

      // Set agent-2 as primary in project 2
      await resourceManager.assignResource(2, 'agent', 'agent-2', { isPrimary: true });

      // Add agent-1 to project 2 as non-primary
      await resourceManager.assignResource(2, 'agent', 'agent-1', { isPrimary: false });

      // Verify primary flags are correct for each project
      const project1Resources = await resourceManager.getProjectResources(1);
      const project1Agent1 = project1Resources.find(r => r.resource_id === 'agent-1');
      expect(project1Agent1.is_primary).toBe(true);

      const project2Resources = await resourceManager.getProjectResources(2);
      const project2Agent1 = project2Resources.find(r => r.resource_id === 'agent-1');
      const project2Agent2 = project2Resources.find(r => r.resource_id === 'agent-2');
      expect(project2Agent1.is_primary).toBe(false);
      expect(project2Agent2.is_primary).toBe(true);
    });
  });

  describe('Error Handling for Invalid Resource Assignments', () => {
    it('should throw error for invalid resource type', async () => {
      await expect(
        resourceManager.assignResource(1, 'invalid_type', 'some-id')
      ).rejects.toThrow('Invalid resource type');
    });

    it('should throw error for non-existent project', async () => {
      await expect(
        resourceManager.assignResource(999, 'agent', 'agent-1')
      ).rejects.toThrow('Project not found');
    });

    it('should throw error for non-existent resource', async () => {
      await expect(
        resourceManager.assignResource(1, 'agent', 'non-existent-agent')
      ).rejects.toThrow('agent not found or not active');
    });

    it('should throw error for duplicate resource assignment', async () => {
      // First assignment should succeed
      await resourceManager.assignResource(1, 'agent', 'agent-1');

      // Second assignment of same resource to same project should fail
      await expect(
        resourceManager.assignResource(1, 'agent', 'agent-1')
      ).rejects.toThrow('Resource is already assigned to this project');
    });

    it('should return false when unassigning non-existent resource assignment', async () => {
      const success = await resourceManager.unassignResource(1, 'agent', 'non-existent');
      expect(success).toBe(false);
    });

    it('should handle inactive resources correctly', async () => {
      // Try to assign an inactive agent
      await expect(
        resourceManager.assignResource(1, 'agent', 'inactive-agent')
      ).rejects.toThrow('agent not found or not active');
    });

    it('should handle disabled hooks correctly', async () => {
      // Add a disabled hook to test data
      db.tables.hooks.set('disabled-hook', {
        id: 'disabled-hook',
        name: 'Disabled Hook',
        description: 'Disabled test hook',
        hook_type: 'misc',
        is_enabled: 0
      });

      // Try to assign a disabled hook
      await expect(
        resourceManager.assignResource(1, 'hook', 'disabled-hook')
      ).rejects.toThrow('hook not found or not active');
    });
  });

  describe('Resource Filtering and Querying', () => {
    it('should filter resources by type when listing project resources', async () => {
      // Assign multiple resource types
      await resourceManager.assignResource(1, 'agent', 'agent-1');
      await resourceManager.assignResource(1, 'rule', 'rule-1');

      // Filter by agent type only
      const resources = await resourceManager.getProjectResources(1, 'agent');
      expect(resources).toHaveLength(1);
      expect(resources[0].resource_type).toBe('agent');
    });

    it('should return available resources for import correctly', async () => {
      // Assign one agent to project 1
      await resourceManager.assignResource(1, 'agent', 'agent-1');

      // Get available resources for project 1
      const resources = await resourceManager.getAvailableResources(1);
      
      // Should show agent-1 as assigned and agent-2 as not assigned
      const agent1 = resources.find(r => r.resource_id === 'agent-1');
      const agent2 = resources.find(r => r.resource_id === 'agent-2');
      
      expect(agent1.is_assigned).toBe(1);
      expect(agent2.is_assigned).toBe(0);
    });
  });
});