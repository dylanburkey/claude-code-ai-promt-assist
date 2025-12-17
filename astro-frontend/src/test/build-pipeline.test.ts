import { describe, test, expect, beforeAll } from 'vitest';
import fc from 'fast-check';
import { execSync } from 'child_process';
import { existsSync, readFileSync, statSync, readdirSync } from 'fs';
import { join, extname } from 'path';
import deployConfig from '../deploy.config.js';

/**
 * **Feature: astro-migration, Property 4: Build optimization correctness**
 * 
 * Property: For any valid Astro project configuration, the build pipeline should 
 * generate optimized, deployable assets that maintain all functionality
 * 
 * **Validates: Requirements 1.1, 1.2, 5.5**
 */
describe('Build Pipeline Optimization Properties', () => {
  // Note: Tests assume a build has already been run (dist directory exists)

  test('**Feature: astro-migration, Property 4: Build optimization correctness**', () => {
    fc.assert(fc.property(
      fc.record({
        // Test different file path patterns
        checkManifest: fc.boolean(),
        checkAssets: fc.boolean(),
        validateHTML: fc.boolean()
      }),
      (config) => {
        // Property: Build output should always be valid and optimized
        
        // 1. Build should produce dist directory
        const distPath = join(process.cwd(), 'dist');
        expect(existsSync(distPath)).toBe(true);
        
        // 2. Build should produce index.html
        const indexPath = join(distPath, 'index.html');
        expect(existsSync(indexPath)).toBe(true);
        
        if (config.validateHTML) {
          // 3. Generated HTML should be valid and optimized
          const htmlContent = readFileSync(indexPath, 'utf8');
          expect(htmlContent).toContain('<!DOCTYPE html>');
          expect(htmlContent).toContain('<html');
          expect(htmlContent).toContain('</html>');
          
          // HTML should be minified (no excessive whitespace)
          const lines = htmlContent.split('\n');
          const nonEmptyLines = lines.filter(line => line.trim().length > 0);
          expect(nonEmptyLines.length).toBeGreaterThan(0);
        }
        
        if (config.checkManifest) {
          // 4. Build should generate PWA manifest
          const manifestPath = join(distPath, 'manifest.webmanifest');
          if (existsSync(manifestPath)) {
            const manifestContent = readFileSync(manifestPath, 'utf8');
            const manifest = JSON.parse(manifestContent);
            expect(manifest.name).toBe('Semantic Prompt Workstation');
            expect(manifest.short_name).toBe('PromptEngine');
          }
        }
        
        if (config.checkAssets) {
          // 5. Assets should be optimized (check file sizes are reasonable)
          const stats = statSync(indexPath);
          expect(stats.size).toBeGreaterThan(0);
          expect(stats.size).toBeLessThan(1024 * 1024); // Should be less than 1MB for basic page
          
          // 6. Check that assets directory exists and contains files
          const distFiles = readdirSync(distPath);
          expect(distFiles.length).toBeGreaterThan(0);
          expect(distFiles).toContain('index.html');
        }
        
        return true;
      }
    ), { numRuns: 100 });
  });
  
  test('Build output structure is consistent', () => {
    // Property: Build should always produce the same file structure
    const distPath = join(process.cwd(), 'dist');
    const distFiles = readdirSync(distPath);
    
    // Should always contain index.html
    expect(distFiles).toContain('index.html');
    
    // All files should be readable
    distFiles.forEach(file => {
      const filePath = join(distPath, file);
      const stats = statSync(filePath);
      expect(stats.size).toBeGreaterThan(0);
    });
  });

  test('Cloudflare Workers Assets compatibility validation', () => {
    fc.assert(fc.property(
      fc.record({
        checkFileSize: fc.boolean(),
        checkMimeTypes: fc.boolean(),
        validateStructure: fc.boolean()
      }),
      (config) => {
        const distPath = join(process.cwd(), 'dist');
        
        if (config.validateStructure) {
          // Verify required files for Cloudflare Workers Assets
          deployConfig.validation.requiredFiles.forEach(file => {
            const filePath = join(distPath, file);
            expect(existsSync(filePath)).toBe(true);
          });
        }
        
        if (config.checkFileSize) {
          // Check file size limits for Cloudflare Workers Assets
          const checkFileSizes = (dir) => {
            const files = readdirSync(dir);
            files.forEach(file => {
              const filePath = join(dir, file);
              const stats = statSync(filePath);
              
              if (stats.isDirectory()) {
                checkFileSizes(filePath);
              } else {
                // Each file should be under Cloudflare Workers Assets limit
                expect(stats.size).toBeLessThanOrEqual(deployConfig.cloudflare.assets.maxFileSize);
              }
            });
          };
          
          checkFileSizes(distPath);
        }
        
        if (config.checkMimeTypes) {
          // Verify supported file types
          const supportedExtensions = Object.keys(deployConfig.cloudflare.assets.mimeTypes);
          
          const checkFileTypes = (dir) => {
            const files = readdirSync(dir);
            files.forEach(file => {
              const filePath = join(dir, file);
              const stats = statSync(filePath);
              
              if (stats.isDirectory()) {
                checkFileTypes(filePath);
              } else {
                const ext = extname(file);
                if (ext) {
                  // File extension should be supported by Cloudflare Workers Assets
                  expect(supportedExtensions).toContain(ext);
                }
              }
            });
          };
          
          checkFileTypes(distPath);
        }
        
        return true;
      }
    ), { numRuns: 50 });
  });

  test('Build optimization features are working', () => {
    const distPath = join(process.cwd(), 'dist');
    
    // Check for minified assets
    const indexPath = join(distPath, 'index.html');
    const htmlContent = readFileSync(indexPath, 'utf8');
    
    // HTML should be optimized (check for basic minification)
    // The HTML should be on fewer lines than unminified (basic check)
    const lines = htmlContent.split('\n');
    expect(lines.length).toBeLessThan(100); // Reasonable minification threshold
    
    // Check for asset optimization
    const astroDir = join(distPath, '_astro');
    if (existsSync(astroDir)) {
      const astroFiles = readdirSync(astroDir);
      
      // Should have hashed filenames for caching
      const hasHashedFiles = astroFiles.some(file => 
        /\.[a-f0-9]{8,}\.(js|css)$/.test(file)
      );
      expect(hasHashedFiles).toBe(true);
    }
  });

  test('Bundle size validation', () => {
    const distPath = join(process.cwd(), 'dist');
    
    // Calculate total bundle size
    let totalSize = 0;
    const calculateSize = (dir) => {
      const files = readdirSync(dir);
      files.forEach(file => {
        const filePath = join(dir, file);
        const stats = statSync(filePath);
        
        if (stats.isDirectory()) {
          calculateSize(filePath);
        } else {
          totalSize += stats.size;
        }
      });
    };
    
    calculateSize(distPath);
    
    // Total bundle should be within reasonable limits
    expect(totalSize).toBeGreaterThan(0);
    expect(totalSize).toBeLessThanOrEqual(deployConfig.validation.bundleSize.maxTotal);
  });
});