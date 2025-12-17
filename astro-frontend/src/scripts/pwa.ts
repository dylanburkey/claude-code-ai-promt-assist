/**
 * PWA functionality utilities
 * Handles service worker registration, update notifications, and offline detection
 */

export interface PWAUpdateEvent {
  type: 'update-available' | 'update-ready' | 'offline' | 'online';
  data?: any;
}

export class PWAManager {
  private static instance: PWAManager;
  private listeners: Map<string, Function[]> = new Map();
  private isOnline: boolean = navigator.onLine;
  private registration: ServiceWorkerRegistration | null = null;

  static getInstance(): PWAManager {
    if (!PWAManager.instance) {
      PWAManager.instance = new PWAManager();
    }
    return PWAManager.instance;
  }

  constructor() {
    this.setupOnlineOfflineListeners();
    this.registerServiceWorker();
  }

  /**
   * Subscribe to PWA events
   */
  on(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  /**
   * Emit PWA events to subscribers
   */
  private emit(event: string, data?: any) {
    const callbacks = this.listeners.get(event) || [];
    callbacks.forEach(callback => callback({ type: event, data }));
  }

  /**
   * Register service worker and handle updates
   */
  private async registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      try {
        this.registration = await navigator.serviceWorker.register('/sw.js');
        
        // Handle service worker updates
        this.registration.addEventListener('updatefound', () => {
          const newWorker = this.registration!.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                this.emit('update-available');
              }
            });
          }
        });

        // Listen for messages from service worker
        navigator.serviceWorker.addEventListener('message', (event) => {
          if (event.data && event.data.type === 'SKIP_WAITING') {
            this.emit('update-ready');
          }
        });

      } catch (error) {
        console.error('Service worker registration failed:', error);
      }
    }
  }

  /**
   * Setup online/offline detection
   */
  private setupOnlineOfflineListeners() {
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.emit('online');
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      this.emit('offline');
    });
  }

  /**
   * Check if app is currently online
   */
  getOnlineStatus(): boolean {
    return this.isOnline;
  }

  /**
   * Manually trigger service worker update
   */
  async checkForUpdates(): Promise<void> {
    if (this.registration) {
      await this.registration.update();
    }
  }

  /**
   * Skip waiting and activate new service worker
   */
  async activateUpdate(): Promise<void> {
    if (this.registration && this.registration.waiting) {
      this.registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      // Wait for the new service worker to take control
      await new Promise<void>((resolve) => {
        const handleControllerChange = () => {
          navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
          resolve();
        };
        navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);
      });
    }
  }

  /**
   * Force cache invalidation and refresh
   */
  async invalidateCache(): Promise<void> {
    await this.clearCaches();
    if (this.registration) {
      await this.registration.update();
    }
    // Reload the page to get fresh content
    window.location.reload();
  }

  /**
   * Show install prompt for PWA
   */
  async showInstallPrompt(): Promise<boolean> {
    // This will be handled by the browser's install prompt
    // We can listen for the beforeinstallprompt event
    return new Promise((resolve) => {
      window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        // Store the event for later use
        (e as any).prompt();
        (e as any).userChoice.then((choiceResult: any) => {
          resolve(choiceResult.outcome === 'accepted');
        });
      });
    });
  }

  /**
   * Get cache status and size information
   */
  async getCacheInfo(): Promise<{ size: number; entries: number }> {
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      let totalSize = 0;
      let totalEntries = 0;

      for (const cacheName of cacheNames) {
        const cache = await caches.open(cacheName);
        const keys = await cache.keys();
        totalEntries += keys.length;
        
        // Estimate size (this is approximate)
        for (const request of keys) {
          const response = await cache.match(request);
          if (response) {
            const blob = await response.blob();
            totalSize += blob.size;
          }
        }
      }

      return { size: totalSize, entries: totalEntries };
    }

    return { size: 0, entries: 0 };
  }

  /**
   * Clear all caches
   */
  async clearCaches(): Promise<void> {
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.map(cacheName => caches.delete(cacheName))
      );
    }
  }
}

// Initialize PWA manager when script loads
export const pwaManager = PWAManager.getInstance();

// Export utility functions for easy use
export const isPWAInstalled = (): boolean => {
  return window.matchMedia('(display-mode: standalone)').matches ||
         (window.navigator as any).standalone === true;
};

export const canInstallPWA = (): boolean => {
  return 'serviceWorker' in navigator && 'caches' in window;
};