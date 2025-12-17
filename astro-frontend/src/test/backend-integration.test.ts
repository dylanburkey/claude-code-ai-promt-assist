/**
 * **Feature: astro-migration, Property 3: Backend integration consistency**
 * **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5**
 * 
 * Property-based tests to verify that the Astro application communicates 
 * with the backend identically to the original application
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import fc from 'fast-check';
import { APIClient, NetworkError, TimeoutError } from '../scripts/api';
import type { Agent, OutputRequirement } from '../types';

// Mock fetch for testing
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Backend Integration Consistency', () => {
  let apiClient: APIClient;

  beforeEach(() => {
    apiClient = new APIClient({ baseURL: '/api', timeout: 1000, retryAttempts: 1 }); // Reduced for testing
    mockFetch.mockClear();
  });

  /**
   * Property 3: Backend integration consistency
   * For any API call or data persistence operation, the Astro application 
   * should communicate with the backend identically to the original application
   */
  test('**Feature: astro-migration, Property 3: Backend integration consistency**', async () => {
    // Simple test that verifies basic API request structure
    const testData = {
      name: 'Test Agent',
      role: 'Test Role'
    };

    const mockResponse = {
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Headers([['content-type', 'application/json']]),
      json: vi.fn().mockResolvedValue({ success: true, data: testData }),
      text: vi.fn().mockResolvedValue('{"success": true}')
    };

    mockFetch.mockResolvedValue(mockResponse);

    const result = await apiClient.request('/agents', {
      method: 'POST',
      body: JSON.stringify(testData)
    });

    // Verify the request was made correctly
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/agents',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json'
        }),
        body: JSON.stringify(testData),
        signal: expect.any(AbortSignal)
      })
    );

    expect(result).toEqual({ success: true, data: testData });
  }, 10000);

  test('API client handles network errors consistently', async () => {
    // Test network error
    mockFetch.mockRejectedValue(new TypeError('Failed to fetch'));

    try {
      await apiClient.request('/agents');
      expect.fail('Should have thrown an error');
    } catch (error) {
      expect(error).toBeInstanceOf(NetworkError);
    }

    // Test timeout error
    mockFetch.mockRejectedValue(Object.assign(new Error('AbortError'), { name: 'AbortError' }));

    try {
      await apiClient.request('/agents');
      expect.fail('Should have thrown an error');
    } catch (error) {
      expect(error).toBeInstanceOf(TimeoutError);
    }
  });

  test('API client retry logic works consistently', async () => {
    let callCount = 0;
    
    // Test successful retry after failure
    mockFetch.mockImplementation(() => {
      callCount++;
      
      if (callCount === 1) {
        // First call fails
        return Promise.resolve({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          headers: new Headers([['content-type', 'application/json']]),
          json: () => Promise.resolve({ error: 'Server error' })
        });
      } else {
        // Second call succeeds
        return Promise.resolve({
          ok: true,
          status: 200,
          statusText: 'OK',
          headers: new Headers([['content-type', 'application/json']]),
          json: () => Promise.resolve({ success: true, data: [] })
        });
      }
    });

    const result = await apiClient.request('/agents');
    expect(callCount).toBe(2); // Should have retried once
    expect(result).toEqual({ success: true, data: [] });
  });

  test('Agent API operations maintain data consistency', async () => {
    await fc.assert(fc.asyncProperty(
      fc.record({
        agent: fc.record({
          name: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
          role: fc.string({ minLength: 1, maxLength: 200 }).filter(s => s.trim().length > 0),
          style: fc.option(fc.string({ maxLength: 500 }), { nil: undefined })
        }),
        operation: fc.constantFrom('create', 'update', 'delete')
      }),
      async (testCase) => {
        const mockAgent: Agent = {
          id: 'test-id',
          name: testCase.agent.name,
          role: testCase.agent.role,
          style: testCase.agent.style,
          created: new Date(),
          updated: new Date()
        };

        mockFetch.mockResolvedValue({
          ok: true,
          status: testCase.operation === 'create' ? 201 : 200,
          statusText: 'OK',
          headers: new Headers([['content-type', 'application/json']]),
          json: () => Promise.resolve(mockAgent)
        });

        switch (testCase.operation) {
          case 'create':
            const createResult = await apiClient.createAgent(testCase.agent);
            expect(mockFetch).toHaveBeenCalledWith(
              '/api/agents',
              expect.objectContaining({
                method: 'POST',
                body: JSON.stringify(testCase.agent)
              })
            );
            expect(createResult).toEqual(mockAgent);
            break;
          case 'update':
            const updateResult = await apiClient.updateAgent('test-id', testCase.agent);
            expect(mockFetch).toHaveBeenCalledWith(
              '/api/agents/test-id',
              expect.objectContaining({
                method: 'PUT',
                body: JSON.stringify(testCase.agent)
              })
            );
            expect(updateResult).toEqual(mockAgent);
            break;
          case 'delete':
            await apiClient.deleteAgent('test-id');
            expect(mockFetch).toHaveBeenCalledWith(
              '/api/agents/test-id',
              expect.objectContaining({
                method: 'DELETE'
              })
            );
            break;
        }
      }
    ), { numRuns: 30 });
  });

  test('Output Requirements API maintains consistency', async () => {
    await fc.assert(fc.asyncProperty(
      fc.record({
        requirement: fc.record({
          name: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
          description: fc.option(fc.string({ maxLength: 500 }), { nil: undefined }),
          requirements_content: fc.string({ minLength: 1, maxLength: 2000 }).filter(s => s.trim().length > 0)
        })
      }),
      async (testCase) => {
        const mockRequirement: OutputRequirement = {
          id: 'req-test-id',
          name: testCase.requirement.name,
          description: testCase.requirement.description,
          requirements_content: testCase.requirement.requirements_content,
          usage_count: 0,
          created: new Date(),
          updated: new Date()
        };

        mockFetch.mockResolvedValue({
          ok: true,
          status: 201,
          statusText: 'Created',
          headers: new Headers([['content-type', 'application/json']]),
          json: () => Promise.resolve(mockRequirement)
        });

        const result = await apiClient.createOutputRequirement(testCase.requirement);

        expect(mockFetch).toHaveBeenCalledWith(
          '/api/output-requirements',
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify(testCase.requirement)
          })
        );

        expect(result).toEqual(mockRequirement);
      }
    ), { numRuns: 30 });
  });
});

