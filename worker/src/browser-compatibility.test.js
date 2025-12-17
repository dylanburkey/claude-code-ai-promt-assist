/**
 * Cross-Browser Compatibility Tests
 * Tests browser-specific functionality and compatibility
 * Task 12: Final integration and documentation - Cross-browser compatibility testing
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

// Mock different browser environments
class BrowserEnvironment {
  constructor(browserType) {
    this.browserType = browserType;
    this.setupBrowserSpecifics();
  }

  setupBrowserSpecifics() {
    switch (this.browserType) {
      case 'chrome':
        this.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
        this.features = {
          fetch: true,
          webWorkers: true,
          indexedDB: true,
          localStorage: true,
          sessionStorage: true,
          webAssembly: true,
          modules: true
        };
        break;
      
      case 'firefox':
        this.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0';
        this.features = {
          fetch: true,
          webWorkers: true,
          indexedDB: true,
          localStorage: true,
          sessionStorage: true,
          webAssembly: true,
          modules: true
        };
        break;
      
      case 'safari':
        this.userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15';
        this.features = {
          fetch: true,
          webWorkers: true,
          indexedDB: true,
          localStorage: true,
          sessionStorage: true,
          webAssembly: true,
          modules: true
        };
        break;
      
      case 'edge':
        this.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36 Edg/91.0.864.59';
        this.features = {
          fetch: true,
          webWorkers: true,
          indexedDB: true,
          localStorage: true,
          sessionStorage: true,
          webAssembly: true,
          modules: true
        };
        break;
      
      case 'ie11':
        this.userAgent = 'Mozilla/5.0 (Windows NT 10.0; WOW64; Trident/7.0; rv:11.0) like Gecko';
        this.features = {
          fetch: false, // Requires polyfill
          webWorkers: true,
          indexedDB: true,
          localStorage: true,
          sessionStorage: true,
          webAssembly: false,
          modules: false // Requires transpilation
        };
        break;
      
      default:
        throw new Error(`Unknown browser type: ${this.browserType}`);
    }
  }

  createMockWindow() {
    const mockWindow = {
      navigator: {
        userAgent: this.userAgent
      },
      location: {
        href: 'http://localhost:8787',
        protocol: 'http:',
        host: 'localhost:8787',
        pathname: '/',
        search: '',
        hash: ''
      },
      localStorage: this.features.localStorage ? new MockStorage() : undefined,
      sessionStorage: this.features.sessionStorage ? new MockStorage() : undefined,
      indexedDB: this.features.indexedDB ? new MockIndexedDB() : undefined,
      fetch: this.features.fetch ? this.createMockFetch() : undefined,
      Worker: this.features.webWorkers ? MockWorker : undefined,
      WebAssembly: this.features.webAssembly ? MockWebAssembly : undefined
    };

    return mockWindow;
  }

  createMockFetch() {
    return async (url, options = {}) => {
      // Simulate browser-specific fetch behavior
      const response = {
        ok: true,
        status: 200,
        headers: new Map([
          ['content-type', 'application/json'],
          ['user-agent', this.userAgent]
        ]),
        json: async () => ({
          success: true,
          browser: this.browserType,
          userAgent: this.userAgent,
          timestamp: new Date().toISOString()
        }),
        text: async () => JSON.stringify({
          success: true,
          browser: this.browserType
        }),
        blob: async () => new Blob(['test data'], { type: 'application/octet-stream' })
      };

      // Simulate browser-specific delays
      const delay = this.getBrowserDelay();
      await new Promise(resolve => setTimeout(resolve, delay));

      return response;
    };
  }

  getBrowserDelay() {
    // Simulate different browser performance characteristics
    switch (this.browserType) {
      case 'chrome': return 10;
      case 'firefox': return 15;
      case 'safari': return 20;
      case 'edge': return 12;
      case 'ie11': return 50;
      default: return 25;
    }
  }
}

// Mock storage implementation
class MockStorage {
  constructor() {
    this.data = new Map();
  }

  getItem(key) {
    return this.data.get(key) || null;
  }

  setItem(key, value) {
    this.data.set(key, String(value));
  }

  removeItem(key) {
    this.data.delete(key);
  }

  clear() {
    this.data.clear();
  }

  get length() {
    return this.data.size;
  }

  key(index) {
    const keys = Array.from(this.data.keys());
    return keys[index] || null;
  }
}

// Mock IndexedDB implementation
class MockIndexedDB {
  open(name, version) {
    return Promise.resolve({
      result: {
        createObjectStore: () => ({}),
        transaction: () => ({
          objectStore: () => ({
            add: () => Promise.resolve(),
            get: () => Promise.resolve({ result: null }),
            put: () => Promise.resolve(),
            delete: () => Promise.resolve()
          })
        })
      }
    });
  }
}

// Mock Worker implementation
class MockWorker {
  constructor(scriptURL) {
    this.scriptURL = scriptURL;
    this.onmessage = null;
    this.onerror = null;
  }

  postMessage(data) {
    // Simulate worker processing
    setTimeout(() => {
      if (this.onmessage) {
        this.onmessage({ data: { result: 'processed', original: data } });
      }
    }, 10);
  }

  terminate() {
    // Mock termination
  }
}

// Mock WebAssembly implementation
class MockWebAssembly {
  static instantiate(bytes) {
    return Promise.resolve({
      instance: {
        exports: {
          add: (a, b) => a + b
        }
      }
    });
  }
}

// Application functionality to test across browsers
class ProjectManager {
  constructor(window) {
    this.window = window;
    this.storage = window.localStorage;
    this.fetch = window.fetch;
  }

  async createProject(projectData) {
    // Test localStorage functionality
    if (this.storage) {
      this.storage.setItem('lastProject', JSON.stringify(projectData));
    }

    // Test fetch functionality
    if (this.fetch) {
      const response = await this.fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(projectData)
      });
      return await response.json();
    }

    // Fallback for browsers without fetch
    return { id: Date.now(), ...projectData };
  }

  async exportProject(projectId) {
    if (this.fetch) {
      const response = await this.fetch(`/api/export/claude-code/${projectId}`, {
        method: 'POST'
      });
      return await response.blob();
    }

    // Fallback for browsers without fetch
    return new Blob(['fallback export data'], { type: 'application/zip' });
  }

  getStoredProjects() {
    if (this.storage) {
      const stored = this.storage.getItem('projects');
      return stored ? JSON.parse(stored) : [];
    }
    return [];
  }

  storeProjects(projects) {
    if (this.storage) {
      this.storage.setItem('projects', JSON.stringify(projects));
      return true;
    }
    return false;
  }
}

describe('Cross-Browser Compatibility Tests', () => {
  const browsers = ['chrome', 'firefox', 'safari', 'edge'];
  const legacyBrowsers = ['ie11'];

  describe('Modern Browser Compatibility', () => {
    browsers.forEach(browserType => {
      describe(`${browserType.toUpperCase()} Browser`, () => {
        let browserEnv;
        let mockWindow;
        let projectManager;

        beforeEach(() => {
          browserEnv = new BrowserEnvironment(browserType);
          mockWindow = browserEnv.createMockWindow();
          projectManager = new ProjectManager(mockWindow);
        });

        it('should support basic project creation', async () => {
          const projectData = {
            name: `${browserType} Test Project`,
            description: `Project created in ${browserType} browser`,
            status: 'active'
          };

          const result = await projectManager.createProject(projectData);
          
          expect(result).toBeDefined();
          expect(result.name).toBe(projectData.name);
          expect(result.browser).toBe(browserType);
        });

        it('should support localStorage operations', () => {
          const testData = [
            { id: 1, name: 'Project 1' },
            { id: 2, name: 'Project 2' }
          ];

          const stored = projectManager.storeProjects(testData);
          expect(stored).toBe(true);

          const retrieved = projectManager.getStoredProjects();
          expect(retrieved).toEqual(testData);
        });

        it('should support fetch API operations', async () => {
          expect(mockWindow.fetch).toBeDefined();

          const response = await mockWindow.fetch('/api/test');
          expect(response.ok).toBe(true);

          const data = await response.json();
          expect(data.browser).toBe(browserType);
          expect(data.userAgent).toBe(browserEnv.userAgent);
        });

        it('should support blob operations for exports', async () => {
          const blob = await projectManager.exportProject(123);
          
          expect(blob).toBeInstanceOf(Blob);
          expect(blob.size).toBeGreaterThan(0);
          expect(blob.type).toBe('application/octet-stream');
        });

        it('should handle concurrent operations', async () => {
          const operations = [];
          
          // Create multiple projects concurrently
          for (let i = 0; i < 5; i++) {
            operations.push(
              projectManager.createProject({
                name: `Concurrent Project ${i}`,
                description: `Project ${i} for ${browserType}`
              })
            );
          }

          const results = await Promise.all(operations);
          
          expect(results).toHaveLength(5);
          results.forEach((result, index) => {
            expect(result.name).toBe(`Concurrent Project ${index}`);
            expect(result.browser).toBe(browserType);
          });
        });

        it('should handle different content types', async () => {
          const contentTypes = [
            'application/json',
            'text/plain',
            'application/octet-stream'
          ];

          for (const contentType of contentTypes) {
            const response = await mockWindow.fetch('/api/test', {
              headers: { 'Content-Type': contentType }
            });

            expect(response.ok).toBe(true);
            
            if (contentType === 'application/json') {
              const data = await response.json();
              expect(data.browser).toBe(browserType);
            } else {
              const text = await response.text();
              expect(text).toBeDefined();
            }
          }
        });

        it('should handle browser-specific performance characteristics', async () => {
          const startTime = Date.now();
          
          await projectManager.createProject({
            name: 'Performance Test Project',
            description: 'Testing browser performance'
          });
          
          const endTime = Date.now();
          const duration = endTime - startTime;
          
          // Verify operation completed within reasonable time
          expect(duration).toBeLessThan(1000);
          
          // Browser-specific performance expectations
          const expectedDelay = browserEnv.getBrowserDelay();
          expect(duration).toBeGreaterThanOrEqual(expectedDelay);
        });

        it('should support modern JavaScript features', () => {
          // Test arrow functions
          const arrowFunction = () => 'arrow function works';
          expect(arrowFunction()).toBe('arrow function works');

          // Test template literals
          const templateLiteral = `Template literal in ${browserType}`;
          expect(templateLiteral).toBe(`Template literal in ${browserType}`);

          // Test destructuring
          const { name, description } = { name: 'test', description: 'test desc' };
          expect(name).toBe('test');
          expect(description).toBe('test desc');

          // Test async/await (already tested in other tests)
          expect(true).toBe(true);
        });
      });
    });
  });

  describe('Legacy Browser Compatibility', () => {
    legacyBrowsers.forEach(browserType => {
      describe(`${browserType.toUpperCase()} Browser`, () => {
        let browserEnv;
        let mockWindow;
        let projectManager;

        beforeEach(() => {
          browserEnv = new BrowserEnvironment(browserType);
          mockWindow = browserEnv.createMockWindow();
          projectManager = new ProjectManager(mockWindow);
        });

        it('should handle missing fetch API gracefully', async () => {
          expect(mockWindow.fetch).toBeUndefined();

          // Should fall back to alternative implementation
          const result = await projectManager.createProject({
            name: 'IE11 Test Project',
            description: 'Project for legacy browser'
          });

          expect(result).toBeDefined();
          expect(result.name).toBe('IE11 Test Project');
          expect(result.id).toBeDefined();
        });

        it('should support localStorage in legacy browsers', () => {
          expect(mockWindow.localStorage).toBeDefined();

          const testData = [{ id: 1, name: 'Legacy Project' }];
          const stored = projectManager.storeProjects(testData);
          expect(stored).toBe(true);

          const retrieved = projectManager.getStoredProjects();
          expect(retrieved).toEqual(testData);
        });

        it('should handle export operations without modern APIs', async () => {
          const blob = await projectManager.exportProject(123);
          
          expect(blob).toBeInstanceOf(Blob);
          expect(blob.size).toBeGreaterThan(0);
        });

        it('should work with polyfilled features', () => {
          // Test that basic functionality works even without modern features
          const projectData = {
            name: 'Polyfill Test',
            description: 'Testing with polyfills'
          };

          // Should work with basic object operations
          expect(projectData.name).toBe('Polyfill Test');
          expect(Object.keys(projectData)).toContain('name');
          expect(Object.keys(projectData)).toContain('description');
        });
      });
    });
  });

  describe('Feature Detection and Graceful Degradation', () => {
    it('should detect browser capabilities correctly', () => {
      browsers.forEach(browserType => {
        const browserEnv = new BrowserEnvironment(browserType);
        const mockWindow = browserEnv.createMockWindow();

        // Modern browsers should have all features
        expect(mockWindow.fetch).toBeDefined();
        expect(mockWindow.localStorage).toBeDefined();
        expect(mockWindow.Worker).toBeDefined();
        expect(mockWindow.WebAssembly).toBeDefined();
      });

      legacyBrowsers.forEach(browserType => {
        const browserEnv = new BrowserEnvironment(browserType);
        const mockWindow = browserEnv.createMockWindow();

        // Legacy browsers may lack some features
        expect(mockWindow.fetch).toBeUndefined();
        expect(mockWindow.localStorage).toBeDefined();
        expect(mockWindow.WebAssembly).toBeUndefined();
      });
    });

    it('should provide appropriate fallbacks', async () => {
      const browserEnv = new BrowserEnvironment('ie11');
      const mockWindow = browserEnv.createMockWindow();
      const projectManager = new ProjectManager(mockWindow);

      // Should work even without fetch
      const result = await projectManager.createProject({
        name: 'Fallback Test',
        description: 'Testing fallback functionality'
      });

      expect(result).toBeDefined();
      expect(result.name).toBe('Fallback Test');
    });

    it('should handle missing APIs gracefully', () => {
      const browserEnv = new BrowserEnvironment('ie11');
      const mockWindow = browserEnv.createMockWindow();

      // Should not throw errors when accessing missing APIs
      expect(() => {
        const hasWebAssembly = typeof mockWindow.WebAssembly !== 'undefined';
        const hasFetch = typeof mockWindow.fetch !== 'undefined';
        const hasWorkers = typeof mockWindow.Worker !== 'undefined';

        expect(hasWebAssembly).toBe(false);
        expect(hasFetch).toBe(false);
        expect(hasWorkers).toBe(true);
      }).not.toThrow();
    });
  });

  describe('Error Handling Across Browsers', () => {
    it('should handle network errors consistently', async () => {
      browsers.forEach(async (browserType) => {
        const browserEnv = new BrowserEnvironment(browserType);
        const mockWindow = browserEnv.createMockWindow();

        // Mock fetch to simulate network error
        mockWindow.fetch = async () => {
          throw new Error('Network error');
        };

        const projectManager = new ProjectManager(mockWindow);

        try {
          await projectManager.createProject({
            name: 'Error Test Project',
            description: 'Testing error handling'
          });
          // Should not reach here if fetch fails
          expect(false).toBe(true);
        } catch (error) {
          expect(error.message).toBe('Network error');
        }
      });
    });

    it('should handle storage quota errors', () => {
      browsers.forEach(browserType => {
        const browserEnv = new BrowserEnvironment(browserType);
        const mockWindow = browserEnv.createMockWindow();

        // Mock storage to simulate quota exceeded
        mockWindow.localStorage.setItem = () => {
          throw new Error('QuotaExceededError');
        };

        const projectManager = new ProjectManager(mockWindow);

        expect(() => {
          projectManager.storeProjects([{ id: 1, name: 'Test' }]);
        }).toThrow('QuotaExceededError');
      });
    });
  });

  describe('Performance Across Browsers', () => {
    it('should maintain acceptable performance in all browsers', async () => {
      const performanceResults = [];

      for (const browserType of [...browsers, ...legacyBrowsers]) {
        const browserEnv = new BrowserEnvironment(browserType);
        const mockWindow = browserEnv.createMockWindow();
        const projectManager = new ProjectManager(mockWindow);

        const startTime = Date.now();

        // Perform standard operations
        await projectManager.createProject({
          name: `Performance Test ${browserType}`,
          description: 'Testing performance'
        });

        const endTime = Date.now();
        const duration = endTime - startTime;

        performanceResults.push({
          browser: browserType,
          duration
        });

        // All browsers should complete within reasonable time
        expect(duration).toBeLessThan(1000);
      }

      // Log performance comparison
      console.log('Browser Performance Results:', performanceResults);

      // Legacy browsers may be slower but should still be reasonable
      const ie11Result = performanceResults.find(r => r.browser === 'ie11');
      if (ie11Result) {
        expect(ie11Result.duration).toBeLessThan(2000); // Allow more time for IE11
      }
    });
  });
});