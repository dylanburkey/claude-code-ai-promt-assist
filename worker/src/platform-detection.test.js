/**
 * Simple Property-Based Tests for Platform Detection Engine
 * **Feature: ai-assisted-rule-creation, Property 1: Platform-aware template suggestions**
 * **Validates: Requirements 1.1, 1.2, 1.4**
 */

import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';
import { PlatformDetectionEngine, TemplateSuggestionService } from './index.js';

// Mock database for testing
const createMockDb = () => {
  return {
    prepare: () => ({
      bind: () => ({
        all: () => ({ results: [] }),
        first: () => null,
        run: () => ({ success: true })
      })
    })
  };
};

describe('Platform Detection Engine - Simple Tests', () => {
  let platformEngine;
  let mockDb;

  beforeEach(() => {
    mockDb = createMockDb();
    platformEngine = new PlatformDetectionEngine(mockDb);
  });

  describe('Property 1: Platform-aware template suggestions', () => {
    /**
     * **Feature: ai-assisted-rule-creation, Property 1: Platform-aware template suggestions**
     * **Validates: Requirements 1.1, 1.2, 1.4**
     */
    it('should detect platforms for realistic inputs', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            platform: fc.constantFrom('shopify', 'stripe', 'nextjs'),
            context: fc.string({ minLength: 10, maxLength: 50 })
          }),
          async ({ platform, context }) => {
            const input = `Working with ${platform} ${context}`;
            const detections = platformEngine.detectPlatforms(input);
            
            // Property: Should detect the mentioned platform
            expect(Array.isArray(detections)).toBe(true);
            
            // For clear platform mentions, we should get detections
            const platformDetected = detections.some(d => d.platform === platform);
            expect(platformDetected).toBe(true);
            
            // Each detection should have valid structure
            for (const detection of detections) {
              expect(detection).toHaveProperty('platform');
              expect(detection).toHaveProperty('confidence');
              expect(detection).toHaveProperty('keywords');
              expect(detection).toHaveProperty('category');
              expect(typeof detection.confidence).toBe('number');
              expect(detection.confidence).toBeGreaterThan(0);
              expect(detection.confidence).toBeLessThanOrEqual(1);
            }
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should handle edge cases gracefully', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.oneof(
            fc.constant(''),
            fc.string({ maxLength: 5 }),
            fc.string({ minLength: 100, maxLength: 200 })
          ),
          async (input) => {
            const detections = platformEngine.detectPlatforms(input);
            
            // Property: Should always return valid array
            expect(Array.isArray(detections)).toBe(true);
            
            // Property: All detections should be valid
            for (const detection of detections) {
              expect(typeof detection.platform).toBe('string');
              expect(typeof detection.confidence).toBe('number');
              expect(Array.isArray(detection.keywords)).toBe(true);
              expect(detection.confidence).toBeGreaterThanOrEqual(0);
              expect(detection.confidence).toBeLessThanOrEqual(1);
            }
          }
        ),
        { numRuns: 20 }
      );
    });
  });
});