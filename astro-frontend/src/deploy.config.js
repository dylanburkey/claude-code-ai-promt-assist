/**
 * Deployment configuration for Cloudflare Workers Assets compatibility
 * This file defines the deployment pipeline and asset optimization settings
 */

export const deployConfig = {
  // Target environment
  target: 'cloudflare-workers',
  
  // Asset optimization settings
  assets: {
    // Directory structure compatible with Cloudflare Workers Assets
    outputDir: 'dist',
    assetsDir: '_astro',
    publicDir: 'public',
    
    // File patterns to include in deployment
    includePatterns: [
      '**/*.html',
      '**/*.css',
      '**/*.js',
      '**/*.svg',
      '**/*.png',
      '**/*.ico',
      '**/*.txt',
      '**/*.json',
      '**/*.woff2'
    ],
    
    // File patterns to exclude from deployment
    excludePatterns: [
      '**/*.map',
      '**/*.test.*',
      '**/node_modules/**',
      '**/.astro/**'
    ]
  },
  
  // Build optimization settings
  optimization: {
    // Enable minification
    minify: true,
    
    // Enable code splitting
    codeSplit: true,
    
    // Enable tree shaking
    treeShake: true,
    
    // Asset compression
    compress: {
      gzip: true,
      brotli: true
    },
    
    // Bundle analysis
    analyze: process.env.ANALYZE_BUNDLE === 'true'
  },
  
  // Cloudflare Workers specific settings
  cloudflare: {
    // Workers Assets configuration
    assets: {
      // Maximum file size for Workers Assets (25MB limit)
      maxFileSize: 25 * 1024 * 1024,
      
      // MIME type mappings
      mimeTypes: {
        '.html': 'text/html; charset=utf-8',
        '.css': 'text/css; charset=utf-8',
        '.js': 'application/javascript; charset=utf-8',
        '.json': 'application/json; charset=utf-8',
        '.webmanifest': 'application/manifest+json; charset=utf-8',
        '.svg': 'image/svg+xml',
        '.png': 'image/png',
        '.ico': 'image/x-icon',
        '.txt': 'text/plain; charset=utf-8',
        '.woff2': 'font/woff2'
      }
    },
    
    // Caching headers for different asset types
    cacheHeaders: {
      // HTML files - short cache for dynamic content
      html: {
        'Cache-Control': 'public, max-age=300, s-maxage=300',
        'Vary': 'Accept-Encoding'
      },
      
      // Static assets - long cache with immutable hashes
      assets: {
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Vary': 'Accept-Encoding'
      },
      
      // Service worker - no cache to ensure updates
      serviceWorker: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    }
  },
  
  // Validation settings
  validation: {
    // Check for required files
    requiredFiles: [
      'index.html',
      'manifest.json',
      'sw.js',
      'icon.svg'
    ],
    
    // Validate bundle size limits
    bundleSize: {
      // Maximum total bundle size (warning threshold)
      maxTotal: 5 * 1024 * 1024, // 5MB
      
      // Maximum individual chunk size
      maxChunk: 1 * 1024 * 1024, // 1MB
      
      // Maximum CSS bundle size
      maxCSS: 500 * 1024 // 500KB
    },
    
    // Performance budgets
    performance: {
      // First Contentful Paint target
      fcp: 1500, // 1.5 seconds
      
      // Largest Contentful Paint target
      lcp: 2500, // 2.5 seconds
      
      // Cumulative Layout Shift target
      cls: 0.1
    }
  }
};

export default deployConfig;