/**
 * Property-Based Tests for Project Data Persistence
 * **Feature: claude-code-bootstrap, Property 1: Project data persistence**
 * **Validates: Requirements 1.5, 7.1**
 */

import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';
import { ProjectManager } from './index.js';

// Simplified mock database for testing core persistence
class MockDatabase {
  constructor() {
    this.data = new Map();
  }

  prepare(query) {
    return {
      // Direct query methods (no bind)
      all: async () => {
        if (query.includes('SELECT slug FROM projects')) {
          return { results: Array.from(this.data.values()).map(p => ({ slug: p.slug })) };
        }
        return { results: [] };
      },
      
      // Bound query methods
      bind: (...params) => ({
        run: async () => {
          if (query.includes('INSERT INTO projects')) {
            const projectData = this._parseInsertParams(params);
            this.data.set(projectData.id, projectData);
            return { success: true, meta: { changes: 1 } };
          }
          return { success: true };
        },
        first: async () => {
          if (query.includes('SELECT * FROM projects WHERE id = ?')) {
            const id = params[0];
            return this.data.get(id) || null;
          }
          if (query.includes('SELECT * FROM projects WHERE slug = ?')) {
            const slug = params[0];
            for (const project of this.data.values()) {
              if (project.slug === slug) {
                return project;
              }
            }
            return null;
          }
          return null;
        }
      })
    };
  }

  _parseInsertParams(params) {
    const [id, slug, name, description, category, tags, projectInfo, status, priority, 
           coverImage, coverImageAlt, aiContextSummary, includeInAiContext, 
           startedAt, targetCompletion, createdAt, updatedAt] = params;
    
    return {
      id, slug, name, description, category, tags, project_info: projectInfo,
      status, priority, cover_image: coverImage, cover_image_alt: coverImageAlt,
      ai_context_summary: aiContextSummary, include_in_ai_context: includeInAiContext,
      started_at: startedAt, target_completion: targetCompletion,
      created_at: createdAt, updated_at: updatedAt
    };
  }

  clear() {
    this.data.clear();
  }
}

// Simple generator for valid project names that will produce valid slugs
const validProjectNameGenerator = fc.string({ minLength: 2, maxLength: 50 })
  .filter(s => s.trim().length > 0)
  .map(s => s.replace(/[^\w\s]/g, '').trim()) // Remove special chars
  .filter(s => s.length >= 2) // Ensure at least 2 chars to avoid single char collisions
  .map(s => s.length > 20 ? s.substring(0, 20) : s); // Keep reasonable length

const basicProjectDataGenerator = fc.record({
  name: validProjectNameGenerator,
  description: fc.option(fc.string({ maxLength: 200 }), { nil: '' }),
  status: fc.constantFrom('draft', 'active', 'completed'),
  priority: fc.constantFrom('low', 'medium', 'high')
});

describe('Project Data Persistence Properties', () => {
  let mockDb;
  let projectManager;

  beforeEach(() => {
    mockDb = new MockDatabase();
    projectManager = new ProjectManager(mockDb);
  });

  /**
   * **Feature: claude-code-bootstrap, Property 1: Project data persistence**
   * **Validates: Requirements 1.5, 7.1**
   * 
   * Property: For any valid project data, storing and then retrieving the project
   * should return equivalent data with all core fields preserved.
   */
  it('should preserve core project data through store-retrieve cycle', async () => {
    await fc.assert(
      fc.asyncProperty(basicProjectDataGenerator, async (projectData) => {
        // Store the project
        const createdProject = await projectManager.createProject(projectData);
        
        // Verify the project was created successfully
        expect(createdProject).toBeDefined();
        expect(createdProject.id).toBeDefined();
        expect(createdProject.slug).toBeDefined();
        
        // Retrieve the project by ID
        const retrievedById = await projectManager.getProject(createdProject.id);
        expect(retrievedById).toBeDefined();
        
        // Retrieve the project by slug
        const retrievedBySlug = await projectManager.getProjectBySlug(createdProject.slug);
        expect(retrievedBySlug).toBeDefined();
        
        // Verify both retrieval methods return the same data
        expect(retrievedById.id).toBe(retrievedBySlug.id);
        expect(retrievedById.name).toBe(retrievedBySlug.name);
        expect(retrievedById.slug).toBe(retrievedBySlug.slug);
        
        // Verify core data is preserved
        expect(retrievedById.name).toBe(projectData.name);
        expect(retrievedById.description).toBe(projectData.description || '');
        expect(retrievedById.status).toBe(projectData.status);
        expect(retrievedById.priority).toBe(projectData.priority);
        
        // Verify timestamps are set
        expect(retrievedById.created_at).toBeDefined();
        expect(retrievedById.updated_at).toBeDefined();
        
        // Verify slug is valid format
        expect(retrievedById.slug).toMatch(/^[a-z0-9-]+$/);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Project names should generate valid slugs
   */
  it('should generate valid slugs for project names', async () => {
    await fc.assert(
      fc.asyncProperty(validProjectNameGenerator, async (projectName) => {
        const project = await projectManager.createProject({ name: projectName });
        
        // Verify slug is valid format
        expect(project.slug).toMatch(/^[a-z0-9-]+$/);
        expect(project.slug.length).toBeGreaterThan(0);
        
        // Verify project can be retrieved by slug
        const retrieved = await projectManager.getProjectBySlug(project.slug);
        expect(retrieved).toBeDefined();
        expect(retrieved.id).toBe(project.id);
        expect(retrieved.name).toBe(project.name);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Project data should be consistent across multiple retrieval operations
   */
  it('should maintain data consistency across multiple retrievals', async () => {
    await fc.assert(
      fc.asyncProperty(basicProjectDataGenerator, async (projectData) => {
        // Create project
        const created = await projectManager.createProject(projectData);
        
        // Retrieve multiple times and verify consistency
        const retrieval1 = await projectManager.getProject(created.id);
        const retrieval2 = await projectManager.getProject(created.id);
        const retrieval3 = await projectManager.getProjectBySlug(created.slug);
        
        // All retrievals should return identical data
        expect(retrieval1).toEqual(retrieval2);
        expect(retrieval2).toEqual(retrieval3);
        
        // Core fields should match original input
        expect(retrieval1.name).toBe(projectData.name);
        expect(retrieval1.description).toBe(projectData.description || '');
        expect(retrieval1.status).toBe(projectData.status);
        expect(retrieval1.priority).toBe(projectData.priority);
      }),
      { numRuns: 100 }
    );
  });
});