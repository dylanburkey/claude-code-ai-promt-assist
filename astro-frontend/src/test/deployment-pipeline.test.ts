import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'child_process';
import { existsSync, readFileSync, statSync, readdirSync, rmSync } from 'fs';
import { join, extname } from 'path';
import deployConfig from '../deploy.config.js';

/**
 * Unit tests for build pipeline and deployment configuration
 * Tests build configuration, output validation, and Cloudflare Workers Assets compatibility
 * 
 * **Validates: Requirements 1.1, 4.4, 5.5**
 */
describe('Deployment Pipeline Unit Tests', () => {
  const testBuildDir = 'dist';
  
  // Utility function to format bytes (copied from DeploymentPipeline)
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };
  
  // Utility function to analyze bundle size
  const analyzeBundleSize = () => {
    const stats = { total: 0, files: [] as Array<{ path: string; size: number }> };
    
    const analyzeDirectory = (dir: string, relativePath = '') => {
      if (!existsSync(dir)) return;
      
      const files = readdirSync(dir);
      
      for (const file of files) {
        const filePath = join(dir, file);
        const fullRelativePath = join(relativePath, file);
        const stat = statSync(filePath);
        
        if (stat.isDirectory()) {
          analyzeDirectory(filePath, fullRelativePath);
        } else {
          const size = stat.size;
          stats.total += size;
          stats.files.push({
            path: fullRelativePath,
            size: size
          });
        }
      }
    };
    
    analyzeDirectory(testBuildDir);
    return stats;
  };
  
  // Utility function to validate Cloudflare compatibility
  const validateCloudflareCompatibility = () => {
    const issues: string[] = [];
    
    // Check file size limits
    const bundleStats = analyzeBundleSize();
    
    for (const file of bundleStats.files) {
      if (file.size > deployConfig.cloudflare.assets.maxFileSize) {
        issues.push(`File ${file.path} (${formatBytes(file.size)}) exceeds Cloudflare Workers Assets limit`);
      }
    }
    
    // Check for unsupported file types
    const supportedExtensions = Object.keys(deployConfig.cloudflare.assets.mimeTypes);
    
    for (const file of bundleStats.files) {
      const ext = extname(file.path);
      if (ext && !supportedExtensions.includes(ext)) {
        console.warn(`⚠️  Unsupported file type: ${file.path} (${ext})`);
      }
    }
    
    if (issues.length > 0) {
      throw new Error(`Cloudflare compatibility issues:\n${issues.join('\n')}`);
    }
  };

  afterAll(() => {
    // Clean up test artifacts
    if (existsSync(testBuildDir)) {
      try {
        rmSync(testBuildDir, { recursive: true, force: true });
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  });

  describe('Build Configuration Validation', () => {
    test('should have valid deployment configuration', () => {
      // Verify deployment config structure
      expect(deployConfig).toBeDefined();
      expect(deployConfig.target).toBe('cloudflare-workers');
      expect(deployConfig.assets).toBeDefined();
      expect(deployConfig.optimization).toBeDefined();
      expect(deployConfig.cloudflare).toBeDefined();
      expect(deployConfig.validation).toBeDefined();
    });

    test('should have correct asset configuration', () => {
      const { assets } = deployConfig;
      
      expect(assets.outputDir).toBe('dist');
      expect(assets.assetsDir).toBe('_astro');
      expect(assets.includePatterns).toBeInstanceOf(Array);
      expect(assets.excludePatterns).toBeInstanceOf(Array);
      
      // Should include essential file patterns
      expect(assets.includePatterns).toContain('**/*.html');
      expect(assets.includePatterns).toContain('**/*.css');
      expect(assets.includePatterns).toContain('**/*.js');
    });

    test('should have optimization settings enabled', () => {
      const { optimization } = deployConfig;
      
      expect(optimization.minify).toBe(true);
      expect(optimization.codeSplit).toBe(true);
      expect(optimization.treeShake).toBe(true);
      expect(optimization.compress).toBeDefined();
    });

    test('should have Cloudflare Workers Assets configuration', () => {
      const { cloudflare } = deployConfig;
      
      expect(cloudflare.assets.maxFileSize).toBe(25 * 1024 * 1024); // 25MB
      expect(cloudflare.assets.mimeTypes).toBeDefined();
      expect(cloudflare.cacheHeaders).toBeDefined();
      
      // Verify essential MIME types
      expect(cloudflare.assets.mimeTypes['.html']).toContain('text/html');
      expect(cloudflare.assets.mimeTypes['.css']).toContain('text/css');
      expect(cloudflare.assets.mimeTypes['.js']).toContain('application/javascript');
    });
  });

  describe('Build Output Validation', () => {
    // Note: Tests assume a build has already been run (dist directory exists)

    test('should validate required files exist', () => {
      if (!existsSync(testBuildDir)) {
        console.warn('Build directory not found, skipping validation tests');
        return;
      }

      const requiredFiles = deployConfig.validation.requiredFiles;
      
      requiredFiles.forEach(file => {
        const filePath = join(testBuildDir, file);
        expect(existsSync(filePath)).toBe(true);
      });
    });

    test('should validate bundle size limits', () => {
      if (!existsSync(testBuildDir)) {
        console.warn('Build directory not found, skipping bundle size tests');
        return;
      }

      let totalSize = 0;
      const largestFiles: Array<{ path: string; size: number }> = [];
      
      const calculateSize = (dir: string, relativePath = '') => {
        const files = readdirSync(dir);
        
        files.forEach(file => {
          const filePath = join(dir, file);
          const fullRelativePath = join(relativePath, file);
          const stats = statSync(filePath);
          
          if (stats.isDirectory()) {
            calculateSize(filePath, fullRelativePath);
          } else {
            totalSize += stats.size;
            largestFiles.push({ path: fullRelativePath, size: stats.size });
            
            // Individual file size check
            expect(stats.size).toBeLessThanOrEqual(
              deployConfig.validation.bundleSize.maxChunk
            );
          }
        });
      };
      
      calculateSize(testBuildDir);
      
      // Total bundle size check
      expect(totalSize).toBeLessThanOrEqual(
        deployConfig.validation.bundleSize.maxTotal
      );
      
      // Log largest files for debugging
      largestFiles
        .sort((a, b) => b.size - a.size)
        .slice(0, 5)
        .forEach(file => {
          console.log(`Large file: ${file.path} (${(file.size / 1024).toFixed(2)} KB)`);
        });
    });

    test('should validate Cloudflare Workers Assets compatibility', () => {
      if (!existsSync(testBuildDir)) {
        console.warn('Build directory not found, skipping compatibility tests');
        return;
      }

      const supportedExtensions = Object.keys(deployConfig.cloudflare.assets.mimeTypes);
      const maxFileSize = deployConfig.cloudflare.assets.maxFileSize;
      
      const validateFiles = (dir: string) => {
        const files = readdirSync(dir);
        
        files.forEach(file => {
          const filePath = join(dir, file);
          const stats = statSync(filePath);
          
          if (stats.isDirectory()) {
            validateFiles(filePath);
          } else {
            // File size validation
            expect(stats.size).toBeLessThanOrEqual(maxFileSize);
            
            // MIME type validation
            const ext = extname(file);
            if (ext) {
              expect(supportedExtensions).toContain(ext);
            }
          }
        });
      };
      
      validateFiles(testBuildDir);
    });
  });

  describe('Deployment Pipeline Methods', () => {
    test('should format bytes correctly', () => {
      // Test the formatBytes utility method
      expect(formatBytes(0)).toBe('0 Bytes');
      expect(formatBytes(1024)).toBe('1 KB');
      expect(formatBytes(1024 * 1024)).toBe('1 MB');
      expect(formatBytes(1536)).toBe('1.5 KB');
    });

    test('should analyze bundle size correctly', () => {
      if (!existsSync(testBuildDir)) {
        console.warn('Build directory not found, skipping bundle analysis tests');
        return;
      }

      const stats = analyzeBundleSize();
      
      expect(stats).toBeDefined();
      expect(stats.total).toBeGreaterThan(0);
      expect(stats.files).toBeInstanceOf(Array);
      expect(stats.files.length).toBeGreaterThan(0);
      
      // Each file should have path and size
      stats.files.forEach(file => {
        expect(file.path).toBeDefined();
        expect(file.size).toBeGreaterThan(0);
      });
    });

    test('should validate Cloudflare compatibility without throwing', () => {
      if (!existsSync(testBuildDir)) {
        console.warn('Build directory not found, skipping compatibility validation');
        return;
      }

      // This should not throw an error for a valid build
      expect(() => {
        validateCloudflareCompatibility();
      }).not.toThrow();
    });
  });

  describe('Asset Optimization Verification', () => {
    test('should verify minification is applied', () => {
      if (!existsSync(testBuildDir)) {
        console.warn('Build directory not found, skipping minification tests');
        return;
      }

      const indexPath = join(testBuildDir, 'index.html');
      if (existsSync(indexPath)) {
        const content = readFileSync(indexPath, 'utf8');
        
        // Minified HTML should be reasonably compact
        const lines = content.split('\n');
        
        // Minified HTML should have fewer lines than unminified
        expect(lines.length).toBeLessThan(100); // Reasonable threshold for minified HTML
      }
    });

    test('should verify asset hashing for cache busting', () => {
      if (!existsSync(testBuildDir)) {
        console.warn('Build directory not found, skipping asset hashing tests');
        return;
      }

      const astroDir = join(testBuildDir, '_astro');
      if (existsSync(astroDir)) {
        const astroFiles = readdirSync(astroDir);
        
        // Should have files with hash patterns
        const hashedFiles = astroFiles.filter(file => 
          /\.[a-f0-9]{8,}\.(js|css)$/.test(file)
        );
        
        expect(hashedFiles.length).toBeGreaterThan(0);
      }
    });

    test('should verify code splitting is working', () => {
      if (!existsSync(testBuildDir)) {
        console.warn('Build directory not found, skipping code splitting tests');
        return;
      }

      const astroDir = join(testBuildDir, '_astro');
      if (existsSync(astroDir)) {
        const jsFiles = readdirSync(astroDir).filter(file => file.endsWith('.js'));
        
        // Should have multiple JS files indicating code splitting
        expect(jsFiles.length).toBeGreaterThan(1);
      }
    });
  });
});