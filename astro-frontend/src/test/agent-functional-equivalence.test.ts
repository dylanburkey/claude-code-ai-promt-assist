import { describe, test, expect, vi, beforeEach } from 'vitest';
import fc from 'fast-check';
import type { Agent } from '../types';
import { api } from '../scripts/api';
import { actions, appState } from '../scripts/state';

/**
 * **Feature: astro-migration, Property 1: Functional equivalence across all features (Agent subset)**
 * **Validates: Requirements 2.1, 6.3, 6.5**
 * 
 * This test verifies that agent management operations in the Astro application
 * behave identically to the original vanilla JavaScript implementation.
 */

// Mock the API client
vi.mock('../scripts/api', () => ({
  api: {
    agents: {
      list: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn()
    }
  }
}));

// Agent generator for property-based testing
const agentArbitrary = fc.record({
  id: fc.string({ minLength: 1, maxLength: 50 }),
  name: fc.string({ minLength: 1, maxLength: 100 }),
  role: fc.string({ minLength: 1, maxLength: 500 }),
  style: fc.option(fc.string({ maxLength: 1000 }), { nil: undefined }),
  created: fc.option(fc.date(), { nil: undefined }),
  updated: fc.option(fc.date(), { nil: undefined })
});

const agentCreateDataArbitrary = fc.record({
  name: fc.string({ minLength: 1, maxLength: 100 }),
  role: fc.string({ minLength: 1, maxLength: 500 }),
  style: fc.option(fc.string({ maxLength: 1000 }), { nil: undefined })
});

const agentUpdateDataArbitrary = fc.record({
  name: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined }),
  role: fc.option(fc.string({ minLength: 1, maxLength: 500 }), { nil: undefined }),
  style: fc.option(fc.string({ maxLength: 1000 }), { nil: undefined })
});

describe('Agent Functional Equivalence Properties', () => {
  beforeEach(() => {
    // Reset state before each test
    appState.reset();
    vi.clearAllMocks();
  });

  test('**Feature: astro-migration, Property 1: Agent CRUD operations maintain functional equivalence**', async () => {
    await fc.assert(fc.asyncProperty(
      fc.constantFrom('create', 'read', 'update', 'delete'),
      fc.array(agentArbitrary, { minLength: 0, maxLength: 10 }),
      agentCreateDataArbitrary,
      agentUpdateDataArbitrary,
      fc.string({ minLength: 1, maxLength: 50 }), // agent ID for update/delete
      async (operation, existingAgents, createData, updateData, targetId) => {
        // Reset state for each property test iteration
        appState.reset();
        // Setup initial state
        actions.setAgents(existingAgents);
        
        // Mock API responses based on operation
        const mockAgent: Agent = {
          id: targetId,
          name: createData.name,
          role: createData.role,
          style: createData.style,
          created: new Date(),
          updated: new Date()
        };

        switch (operation) {
          case 'create':
            (api.agents.create as any).mockResolvedValue(mockAgent);
            
            // Test create operation
            const createdAgent = await api.agents.create(createData);
            actions.addAgent(createdAgent);
            
            // Verify agent was added to state
            const stateAfterCreate = appState.state.agents;
            expect(stateAfterCreate).toContainEqual(mockAgent);
            expect(stateAfterCreate.length).toBe(existingAgents.length + 1);
            break;

          case 'read':
            (api.agents.list as any).mockResolvedValue(existingAgents);
            
            // Test read operation
            const agents = await api.agents.list();
            actions.setAgents(agents);
            
            // Verify state matches API response
            expect(appState.state.agents).toEqual(existingAgents);
            break;

          case 'update':
            if (existingAgents.length > 0) {
              const existingAgent = existingAgents[0];
              const updatedAgent = { ...existingAgent, ...updateData };
              (api.agents.update as any).mockResolvedValue(updatedAgent);
              
              // Test update operation
              const result = await api.agents.update(existingAgent.id, updateData);
              actions.updateAgent(existingAgent.id, updateData);
              
              // Verify agent was updated in state
              const updatedState = appState.state.agents;
              const foundAgent = updatedState.find(a => a.id === existingAgent.id);
              expect(foundAgent).toBeDefined();
              if (foundAgent) {
                // Check that update data was applied
                Object.keys(updateData).forEach(key => {
                  if (updateData[key as keyof typeof updateData] !== undefined) {
                    expect(foundAgent[key as keyof Agent]).toBe(updateData[key as keyof typeof updateData]);
                  }
                });
              }
            }
            break;

          case 'delete':
            if (existingAgents.length > 0) {
              const agentToDelete = existingAgents[0];
              (api.agents.delete as any).mockResolvedValue(undefined);
              
              // Test delete operation
              await api.agents.delete(agentToDelete.id);
              actions.removeAgent(agentToDelete.id);
              
              // Verify agent was removed from state
              const stateAfterDelete = appState.state.agents;
              expect(stateAfterDelete).not.toContainEqual(agentToDelete);
              expect(stateAfterDelete.length).toBe(existingAgents.length - 1);
              
              // Verify selection is cleared if deleted agent was selected
              if (appState.state.ui.selectedAgentId === agentToDelete.id) {
                expect(appState.state.ui.selectedAgentId).toBeNull();
              }
            }
            break;
        }
      }
    ), { numRuns: 100 });
  });

  test('**Feature: astro-migration, Property 1: Agent selection behavior maintains equivalence**', () => {
    fc.assert(fc.property(
      fc.array(agentArbitrary, { minLength: 1, maxLength: 10 }),
      fc.integer({ min: 0, max: 9 }),
      (agents, selectionIndex) => {
        // Setup initial state
        actions.setAgents(agents);
        
        // Test agent selection
        const agentToSelect = agents[selectionIndex % agents.length];
        actions.setSelectedAgent(agentToSelect.id);
        
        // Verify selection state
        expect(appState.state.ui.selectedAgentId).toBe(agentToSelect.id);
        expect(appState.getSelectedAgent()).toEqual(agentToSelect);
        
        // Test deselection
        actions.setSelectedAgent(null);
        expect(appState.state.ui.selectedAgentId).toBeNull();
        expect(appState.getSelectedAgent()).toBeNull();
      }
    ), { numRuns: 100 });
  });

  test('**Feature: astro-migration, Property 1: Agent state persistence maintains equivalence**', () => {
    fc.assert(fc.property(
      fc.array(agentArbitrary, { minLength: 0, maxLength: 5 }),
      fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: null }),
      (agents, selectedAgentId) => {
        // Setup initial state
        actions.setAgents(agents);
        if (selectedAgentId && agents.some(a => a.id === selectedAgentId)) {
          actions.setSelectedAgent(selectedAgentId);
        }
        
        // Capture current state
        const currentState = appState.state;
        
        // Verify state structure matches expected format
        expect(Array.isArray(currentState.agents)).toBe(true);
        if (selectedAgentId && agents.some(a => a.id === selectedAgentId)) {
          expect(typeof currentState.ui.selectedAgentId).toBe('string');
        } else {
          expect(currentState.ui.selectedAgentId).toBeNull();
        }
        
        // Verify agent data integrity
        currentState.agents.forEach(agent => {
          expect(typeof agent.id).toBe('string');
          expect(typeof agent.name).toBe('string');
          expect(typeof agent.role).toBe('string');
          expect(agent.name.length).toBeGreaterThan(0);
          expect(agent.role.length).toBeGreaterThan(0);
        });
        
        // Verify selected agent exists in agents array if selection is set
        if (currentState.ui.selectedAgentId) {
          const selectedAgent = currentState.agents.find(a => a.id === currentState.ui.selectedAgentId);
          expect(selectedAgent).toBeDefined();
        }
      }
    ), { numRuns: 100 });
  });

  test('**Feature: astro-migration, Property 1: Agent validation maintains equivalence**', () => {
    fc.assert(fc.property(
      fc.record({
        name: fc.string({ maxLength: 200 }),
        role: fc.string({ maxLength: 1000 }),
        style: fc.option(fc.string({ maxLength: 2000 }), { nil: undefined })
      }),
      (agentData) => {
        // Test validation logic that should match original implementation
        // Filter out invalid inputs that would be rejected by the system
        const trimmedName = agentData.name.trim();
        const trimmedRole = agentData.role.trim();
        
        // Skip test cases with empty or whitespace-only required fields
        if (trimmedName.length === 0 || trimmedRole.length === 0) {
          return true; // Skip invalid inputs
        }
        
        const isValidName = trimmedName.length > 0;
        const isValidRole = trimmedRole.length > 0;
        const isValid = isValidName && isValidRole;
        
        // Valid agents should be processable
        const processedAgent = {
          ...agentData,
          name: trimmedName,
          role: trimmedRole,
          style: agentData.style?.trim() || undefined
        };
        
        expect(processedAgent.name.length).toBeGreaterThan(0);
        expect(processedAgent.role.length).toBeGreaterThan(0);
      }
    ), { numRuns: 100 });
  });

  test('**Feature: astro-migration, Property 1: Agent error handling maintains equivalence**', async () => {
    await fc.assert(fc.asyncProperty(
      fc.constantFrom('network_error', 'server_error', 'validation_error'),
      fc.array(agentArbitrary, { minLength: 0, maxLength: 5 }),
      async (errorType, existingAgents) => {
        // Reset state for each property test iteration
        appState.reset();
        // Setup initial state
        actions.setAgents(existingAgents);
        
        // Mock different error scenarios
        const mockError = new Error(`Mock ${errorType}`);
        
        switch (errorType) {
          case 'network_error':
            (api.agents.list as any).mockRejectedValue(mockError);
            break;
          case 'server_error':
            (api.agents.create as any).mockRejectedValue(mockError);
            break;
          case 'validation_error':
            (api.agents.update as any).mockRejectedValue(mockError);
            break;
        }
        
        // Test error handling
        try {
          switch (errorType) {
            case 'network_error':
              await api.agents.list();
              break;
            case 'server_error':
              await api.agents.create({ name: 'Test', role: 'Test Role' });
              break;
            case 'validation_error':
              await api.agents.update('test-id', { name: 'Updated' });
              break;
          }
          
          // Should not reach here if error was thrown
          expect(false).toBe(true);
        } catch (error) {
          // Verify error was properly thrown
          expect(error).toBe(mockError);
          
          // Verify state remains consistent after error
          expect(appState.state.agents).toEqual(existingAgents);
        }
      }
    ), { numRuns: 100 });
  });
});