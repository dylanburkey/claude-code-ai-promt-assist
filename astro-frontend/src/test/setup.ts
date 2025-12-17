import { vi } from 'vitest';

// Mock browser APIs that might not be available in test environment
Object.defineProperty(window, 'localStorage', {
  value: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  },
  writable: true,
});

// Mock fetch for API testing
global.fetch = vi.fn();

// Mock service worker registration
Object.defineProperty(navigator, 'serviceWorker', {
  value: {
    register: vi.fn(),
    ready: Promise.resolve({
      unregister: vi.fn(),
    }),
  },
  writable: true,
});