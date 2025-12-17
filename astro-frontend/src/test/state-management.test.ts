/**
 * **Feature: astro-migration, Property 6: State management preservation**
 * **Validates: Requirements 6.4**
 * 
 * Property-based tests to verify that the Astro application maintains 
 * the same state persistence patterns as the original
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import fc from 'fast-check';
import { AppStateManager } from '../scripts/state';
import { uiState, selections, formDrafts, cache } from '../scripts/storage';
import type { Agent } from '../types';

// Mock localStorage
const mockLocalStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
    get length() { return Object.keys(store).length; },
    key: vi.fn((index: number) => Object.keys(store)[index] || null)
  };
})();

// Mock window and localStorage globally
Object.defineProperty(globalThis, 'window', {
  value: {
    localStorage: mockLocalStorage,
    setTimeout: globalThis.setTimeout,
    clearTimeout: globalThis.clearTimeout
  },
  writable: true
});

Object.defineProperty(globalThis, 'localStorage', { value: mockLocalStorage });

describe('State Management Preservation', () => {
  let appStateManager: AppStateManager;

  beforeEach(() => {
    // Clear localStorage mock
    mockLocalStorage.clear();
    mockLocalStorage.getItem.mockClear();
    mockLocalStorage.setItem.mockClear();
    mockLocalStorage.removeItem.mockClear();
    
    // Create fresh state manager
    appStateManager = new AppStateManager();
  });

  /**
   * Property 6: State management preservation
   * For any application state or localStorage operation, the Astro application 
   * should maintain the same state persistence patterns as the original
   */
  test('**Feature: astro-migration, Property 6: State management preservation**', async () => {
    // Simple test that verifies basic state persistence
    const testAgent: Agent = {
      id: 'test-agent-id',
      name: 'Test Agent',
      role: 'Test Role'
    };

    // Set up initial state
    appStateManager.setAgents([testAgent]);
    appStateManager.setSelectedAgent('test-agent-id');
    appStateManager.setSidebarOpen(true);
    appStateManager.setActiveView('builder');

    // Wait for auto-save to complete
    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify localStorage was called for persistence
    expect(mockLocalStorage.setItem).toHaveBeenCalled();

    // Verify current state
    const currentState = appStateManager.state;
    expect(currentState.agents).toContainEqual(testAgent);
    expect(currentState.ui.selectedAgentId).toBe('test-agent-id');
    expect(currentState.ui.sidebarOpen).toBe(true);
    expect(currentState.ui.activeView).toBe('builder');
  });

  test('State updates trigger proper persistence', async () => {
    await fc.assert(fc.asyncProperty(
      fc.record({
        operation: fc.constantFrom('addAgent', 'updateAgent', 'removeAgent', 'setUI'),
        agentData: fc.record({
          id: fc.uuid(),
          name: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
          role: fc.string({ minLength: 1, maxLength: 200 }).filter(s => s.trim().length > 0)
        }),
        uiUpdate: fc.record({
          selectedAgentId: fc.option(fc.uuid()),
          sidebarOpen: fc.boolean()
        })
      }),
      async (testCase) => {
        const initialCallCount = mockLocalStorage.setItem.mock.calls.length;

        switch (testCase.operation) {
          case 'addAgent':
            appStateManager.addAgent(testCase.agentData as Agent);
            break;
          case 'updateAgent':
            // First add an agent, then update it
            appStateManager.addAgent(testCase.agentData as Agent);
            appStateManager.updateAgent(testCase.agentData.id, { name: 'Updated Name' });
            break;
          case 'removeAgent':
            // First add an agent, then remove it
            appStateManager.addAgent(testCase.agentData as Agent);
            appStateManager.removeAgent(testCase.agentData.id);
            break;
          case 'setUI':
            appStateManager.setSelectedAgent(testCase.uiUpdate.selectedAgentId);
            appStateManager.setSidebarOpen(testCase.uiUpdate.sidebarOpen);
            break;
        }

        // Wait for auto-save
        await new Promise(resolve => setTimeout(resolve, 600));

        // Verify localStorage was called more times (indicating persistence)
        expect(mockLocalStorage.setItem.mock.calls.length).toBeGreaterThan(initialCallCount);
      }
    ), { numRuns: 30 });
  });

  test('Form draft persistence works correctly', async () => {
    await fc.assert(fc.asyncProperty(
      fc.record({
        formId: fc.string({ minLength: 1, maxLength: 50 }),
        formData: fc.record({
          name: fc.string({ maxLength: 100 }),
          description: fc.option(fc.string({ maxLength: 500 })),
          value: fc.integer({ min: 0, max: 1000 })
        })
      }),
      async (testCase) => {
        // Save form draft
        const success = formDrafts.save(testCase.formId, testCase.formData);
        expect(success).toBe(true);

        // Retrieve form draft
        const retrieved = formDrafts.get(testCase.formId);
        expect(retrieved).not.toBeNull();
        expect(retrieved?.formId).toBe(testCase.formId);
        expect(retrieved?.data).toEqual(testCase.formData);
        expect(retrieved?.timestamp).toBeTypeOf('number');

        // Verify it's in the list of all drafts
        const allDrafts = formDrafts.getAll();
        const foundDraft = allDrafts.find(d => d.formId === testCase.formId);
        expect(foundDraft).toBeDefined();
        expect(foundDraft?.data).toEqual(testCase.formData);
      }
    ), { numRuns: 30 });
  });

  test('Cache operations maintain consistency', async () => {
    await fc.assert(fc.asyncProperty(
      fc.record({
        cacheKey: fc.constantFrom('agents', 'requirements', 'projects'),
        data: fc.array(fc.record({
          id: fc.uuid(),
          name: fc.string({ minLength: 1, maxLength: 100 })
        }), { maxLength: 5 }),
        ttl: fc.integer({ min: 1000, max: 10000 })
      }),
      async (testCase) => {
        // Set cache data
        const success = cache.set(testCase.cacheKey as any, testCase.data, testCase.ttl);
        expect(success).toBe(true);

        // Immediately retrieve should work
        const retrieved = cache.get(testCase.cacheKey as any);
        expect(retrieved).toEqual(testCase.data);

        // Check if cache is valid
        const isValid = cache.isValid(testCase.cacheKey as any);
        expect(isValid).toBe(true);

        // Verify cache entry exists in getAll
        const allCached = cache.getAll();
        expect(allCached[testCase.cacheKey]).toBeDefined();
        expect(allCached[testCase.cacheKey]?.data).toEqual(testCase.data);
      }
    ), { numRuns: 30 });
  });

  test('Selection state persistence works correctly', async () => {
    await fc.assert(fc.asyncProperty(
      fc.record({
        agentId: fc.option(fc.uuid()),
        requirementId: fc.option(fc.uuid()),
        projectId: fc.option(fc.uuid())
      }),
      async (testCase) => {
        // Set selections
        if (testCase.agentId) {
          const success = selections.setAgent(testCase.agentId);
          expect(success).toBe(true);
        }

        if (testCase.requirementId) {
          const success = selections.setRequirement(testCase.requirementId);
          expect(success).toBe(true);
        }

        if (testCase.projectId) {
          const success = selections.setProject(testCase.projectId);
          expect(success).toBe(true);
        }

        // Retrieve selections
        const retrievedAgent = selections.getAgent();
        const retrievedRequirement = selections.getRequirement();
        const retrievedProject = selections.getProject();

        // Only check if we actually set values
        if (testCase.agentId !== null) {
          expect(retrievedAgent).toBe(testCase.agentId);
        }
        if (testCase.requirementId !== null) {
          expect(retrievedRequirement).toBe(testCase.requirementId);
        }
        if (testCase.projectId !== null) {
          expect(retrievedProject).toBe(testCase.projectId);
        }

        // Verify UI state was also updated (only if we set values)
        const currentUIState = uiState.load();
        if (testCase.agentId !== null) {
          expect(currentUIState.selectedAgentId).toBe(testCase.agentId);
        }
        if (testCase.requirementId !== null) {
          expect(currentUIState.selectedRequirementId).toBe(testCase.requirementId);
        }
        if (testCase.projectId !== null) {
          expect(currentUIState.currentProjectId).toBe(testCase.projectId);
        }
      }
    ), { numRuns: 30 });
  });

  test('State manager reactive updates work correctly', async () => {
    let updateCallCount = 0;
    let lastState: any = null;

    // Subscribe to state changes
    const unsubscribe = appStateManager.subscribe((newState) => {
      updateCallCount++;
      lastState = newState;
    });

    const testAgent: Agent = {
      id: 'test-agent-id',
      name: 'Test Agent',
      role: 'Test Role'
    };

    // Set initial agents
    appStateManager.setAgents([testAgent]);
    
    // Wait a bit for async updates
    await new Promise(resolve => setTimeout(resolve, 10));
    
    expect(updateCallCount).toBeGreaterThan(0);
    expect(lastState.agents).toContainEqual(testAgent);

    // Add new agent
    const newAgent: Agent = {
      id: 'new-agent-id',
      name: 'New Agent',
      role: 'New Role'
    };

    const previousCallCount = updateCallCount;
    appStateManager.addAgent(newAgent);
    
    await new Promise(resolve => setTimeout(resolve, 10));
    
    expect(updateCallCount).toBeGreaterThan(previousCallCount);
    expect(lastState.agents).toHaveLength(2);
    expect(lastState.agents).toContainEqual(newAgent);

    // Clean up
    unsubscribe();
  });

  test('Error state management works correctly', async () => {
    const errorMessage = 'Test error message';

    // Set error
    appStateManager.setError('agents', errorMessage);

    // Wait for state update
    await new Promise(resolve => setTimeout(resolve, 10));

    // Verify error is set in state
    const currentState = appStateManager.state;
    expect(currentState.errors.agents).toBe(errorMessage);

    // Verify hasErrors returns true
    expect(appStateManager.hasErrors()).toBe(true);

    // Verify getAllErrors includes our error
    const allErrors = appStateManager.getAllErrors();
    expect(allErrors).toContain(errorMessage);

    // Clear errors
    appStateManager.clearErrors();

    // Wait for state update
    await new Promise(resolve => setTimeout(resolve, 10));

    // Verify error is cleared
    const clearedState = appStateManager.state;
    expect(clearedState.errors.agents).toBeNull();
    expect(appStateManager.hasErrors()).toBe(false);
  });
});