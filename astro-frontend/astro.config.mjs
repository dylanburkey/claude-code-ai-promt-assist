// @ts-check
import { defineConfig } from 'astro/config';
import { VitePWA } from 'vite-plugin-pwa';

// https://astro.build/config
export default defineConfig({
  output: 'static',
  outDir: './dist',
  publicDir: './public',
  
  // Build optimizations for production
  build: {
    // Inline small assets to reduce HTTP requests
    inlineStylesheets: 'auto',
    // Split chunks for better caching
    split: true,
    // Minify output
    minify: true,
    // Generate source maps for debugging
    sourcemap: false, // Disable in production for smaller bundles
    // Assets directory structure compatible with Cloudflare Workers Assets
    assets: '_astro'
  },

  // Cloudflare Workers Assets compatibility
  site: process.env.CF_PAGES_URL || 'https://localhost:4321',
  base: '/',
  
  // Vite configuration for advanced optimizations
  vite: {
    plugins: [
      VitePWA({
        mode: 'production',
        base: '/',
        scope: '/',
        includeAssets: ['icon.svg', 'favicon.svg'],
        registerType: 'autoUpdate',
        workbox: {
          navigateFallback: '/',
          globPatterns: ['**/*.{css,js,html,svg,png,ico,txt,woff2}'],
          // Cache invalidation strategy
          cleanupOutdatedCaches: true,
          skipWaiting: true,
          clientsClaim: true,
          // Runtime caching for API calls
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/.*\.workers\.dev\/api\/.*/,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'api-cache',
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 60 * 60 * 24 // 24 hours
                },
                networkTimeoutSeconds: 10
              }
            },
            {
              urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/,
              handler: 'CacheFirst',
              options: {
                cacheName: 'images-cache',
                expiration: {
                  maxEntries: 50,
                  maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
                }
              }
            }
          ]
        },
        manifest: {
          name: 'Semantic Prompt Workstation',
          short_name: 'PromptEngine',
          description: 'A powerful prompt engine for generating semantic prompts',
          start_url: '/',
          display: 'standalone',
          background_color: '#0f172a',
          theme_color: '#0f172a',
          orientation: 'portrait-primary',
          icons: [
            {
              src: 'icon.svg',
              sizes: 'any',
              type: 'image/svg+xml'
            }
          ]
        },
        devOptions: {
          enabled: true,
          type: 'module'
        }
      })
    ],
    
    // Build optimizations
    build: {
      // Code splitting configuration
      rollupOptions: {
        output: {
          // Manual chunk splitting for better caching
          manualChunks: {
            // Vendor chunks for third-party libraries
            vendor: ['fast-check'],
            // Component chunks for better caching
            components: [
              './src/components/AgentManager.astro',
              './src/components/PromptBuilder.astro',
              './src/components/ThemeManager.astro',
              './src/components/ExportPanel.astro'
            ]
          },
          // Asset naming for Cloudflare Workers Assets compatibility
          assetFileNames: (assetInfo) => {
            const info = assetInfo.name.split('.');
            const ext = info[info.length - 1];
            if (/\.(css)$/.test(assetInfo.name)) {
              return `_astro/[name].[hash].${ext}`;
            }
            return `_astro/[name].[hash].${ext}`;
          },
          chunkFileNames: '_astro/[name].[hash].js',
          entryFileNames: '_astro/[name].[hash].js'
        }
      },
      // Target modern browsers for better optimization
      target: 'es2020',
      // Minification settings
      minify: 'esbuild',
      // CSS code splitting
      cssCodeSplit: true,
      // Source maps for production debugging (disabled for smaller bundles)
      sourcemap: false
    },
    
    // Development and build-time definitions
    define: {
      __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
      __PROD__: JSON.stringify(process.env.NODE_ENV === 'production')
    },
    
    // Optimization settings
    optimizeDeps: {
      include: ['fast-check'],
      exclude: []
    },
    
    // CSS preprocessing
    css: {
      // CSS modules configuration
      modules: {
        localsConvention: 'camelCase'
      },
      // PostCSS configuration for optimization
      postcss: {
        plugins: []
      }
    }
  },
  
  // Remove experimental features that are not available in current Astro version
});
