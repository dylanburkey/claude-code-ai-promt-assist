#!/usr/bin/env node

/**
 * Deployment script for Astro frontend to Cloudflare Workers Assets
 * This script handles the complete build and deployment pipeline
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync, statSync, readdirSync } from 'fs';
import { join, extname } from 'path';
import { deployConfig } from '../src/deploy.config.js';

class DeploymentPipeline {
  constructor() {
    this.config = deployConfig;
    this.buildDir = this.config.assets.outputDir;
    this.workerPublicDir = '../worker/public';
  }

  /**
   * Execute the complete deployment pipeline
   */
  async deploy() {
    console.log('🚀 Starting Astro deployment pipeline...');
    
    try {
      // Step 1: Clean previous builds
      await this.clean();
      
      // Step 2: Run tests
      await this.runTests();
      
      // Step 3: Build for production
      await this.build();
      
      // Step 4: Validate build output
      await this.validate();
      
      // Step 5: Optimize assets
      await this.optimize();
      
      // Step 6: Copy to worker public directory
      await this.copyToWorker();
      
      // Step 7: Generate deployment report
      await this.generateReport();
      
      console.log('✅ Deployment pipeline completed successfully!');
      
    } catch (error) {
      console.error('❌ Deployment pipeline failed:', error.message);
      process.exit(1);
    }
  }

  /**
   * Clean previous build artifacts
   */
  async clean() {
    console.log('🧹 Cleaning previous builds...');
    
    try {
      execSync('npm run clean', { stdio: 'inherit' });
      console.log('✅ Clean completed');
    } catch (error) {
      throw new Error(`Clean failed: ${error.message}`);
    }
  }

  /**
   * Run test suite
   */
  async runTests() {
    console.log('🧪 Running test suite...');
    
    try {
      execSync('npm test', { stdio: 'inherit' });
      console.log('✅ All tests passed');
    } catch (error) {
      throw new Error(`Tests failed: ${error.message}`);
    }
  }

  /**
   * Build the application for production
   */
  async build() {
    console.log('🔨 Building for production...');
    
    try {
      execSync('npm run build:prod', { stdio: 'inherit' });
      console.log('✅ Build completed');
    } catch (error) {
      throw new Error(`Build failed: ${error.message}`);
    }
  }

  /**
   * Validate build output
   */
  async validate() {
    console.log('🔍 Validating build output...');
    
    // Check required files exist
    for (const file of this.config.validation.requiredFiles) {
      const filePath = join(this.buildDir, file);
      if (!existsSync(filePath)) {
        throw new Error(`Required file missing: ${file}`);
      }
    }
    
    // Check bundle sizes
    const bundleStats = this.analyzeBundleSize();
    
    if (bundleStats.total > this.config.validation.bundleSize.maxTotal) {
      console.warn(`⚠️  Bundle size (${this.formatBytes(bundleStats.total)}) exceeds recommended limit (${this.formatBytes(this.config.validation.bundleSize.maxTotal)})`);
    }
    
    // Validate Cloudflare Workers Assets compatibility
    this.validateCloudflareCompatibility();
    
    console.log('✅ Validation completed');
  }

  /**
   * Optimize assets for deployment
   */
  async optimize() {
    console.log('⚡ Optimizing assets...');
    
    // Assets are already optimized by Astro build process
    // This step can be extended for additional optimizations
    
    console.log('✅ Optimization completed');
  }

  /**
   * Copy build output to worker public directory
   */
  async copyToWorker() {
    console.log('📁 Copying assets to worker directory...');
    
    try {
      // Ensure worker public directory exists
      execSync(`mkdir -p ${this.workerPublicDir}`, { stdio: 'pipe' });
      
      // Copy all build output to worker public directory
      execSync(`cp -r ${this.buildDir}/* ${this.workerPublicDir}/`, { stdio: 'inherit' });
      
      console.log('✅ Assets copied to worker directory');
    } catch (error) {
      throw new Error(`Failed to copy assets: ${error.message}`);
    }
  }

  /**
   * Analyze bundle size
   */
  analyzeBundleSize() {
    const stats = { total: 0, files: [] };
    
    const analyzeDirectory = (dir) => {
      const files = readdirSync(dir);
      
      for (const file of files) {
        const filePath = join(dir, file);
        const stat = statSync(filePath);
        
        if (stat.isDirectory()) {
          analyzeDirectory(filePath);
        } else {
          const size = stat.size;
          stats.total += size;
          stats.files.push({
            path: filePath.replace(this.buildDir + '/', ''),
            size: size
          });
        }
      }
    };
    
    if (existsSync(this.buildDir)) {
      analyzeDirectory(this.buildDir);
    }
    
    return stats;
  }

  /**
   * Validate Cloudflare Workers Assets compatibility
   */
  validateCloudflareCompatibility() {
    const issues = [];
    
    // Check file size limits
    const bundleStats = this.analyzeBundleSize();
    
    for (const file of bundleStats.files) {
      if (file.size > this.config.cloudflare.assets.maxFileSize) {
        issues.push(`File ${file.path} (${this.formatBytes(file.size)}) exceeds Cloudflare Workers Assets limit`);
      }
    }
    
    // Check for unsupported file types
    const supportedExtensions = Object.keys(this.config.cloudflare.assets.mimeTypes);
    
    for (const file of bundleStats.files) {
      const ext = extname(file.path);
      if (ext && !supportedExtensions.includes(ext)) {
        console.warn(`⚠️  Unsupported file type: ${file.path} (${ext})`);
      }
    }
    
    if (issues.length > 0) {
      throw new Error(`Cloudflare compatibility issues:\n${issues.join('\n')}`);
    }
  }

  /**
   * Generate deployment report
   */
  async generateReport() {
    console.log('📊 Generating deployment report...');
    
    const bundleStats = this.analyzeBundleSize();
    const timestamp = new Date().toISOString();
    
    const report = {
      timestamp,
      buildConfig: {
        target: this.config.target,
        optimization: this.config.optimization
      },
      bundleStats: {
        totalSize: bundleStats.total,
        totalSizeFormatted: this.formatBytes(bundleStats.total),
        fileCount: bundleStats.files.length,
        largestFiles: bundleStats.files
          .sort((a, b) => b.size - a.size)
          .slice(0, 10)
          .map(f => ({
            path: f.path,
            size: this.formatBytes(f.size)
          }))
      },
      validation: {
        requiredFilesPresent: this.config.validation.requiredFiles.every(
          file => existsSync(join(this.buildDir, file))
        ),
        bundleSizeWithinLimits: bundleStats.total <= this.config.validation.bundleSize.maxTotal,
        cloudflareCompatible: true // Set by validation step
      }
    };
    
    // Write report to file
    writeFileSync(
      join(this.buildDir, 'deployment-report.json'),
      JSON.stringify(report, null, 2)
    );
    
    // Display summary
    console.log('\n📋 Deployment Summary:');
    console.log(`   Total bundle size: ${report.bundleStats.totalSizeFormatted}`);
    console.log(`   File count: ${report.bundleStats.fileCount}`);
    console.log(`   Cloudflare compatible: ${report.validation.cloudflareCompatible ? '✅' : '❌'}`);
    console.log(`   Report saved: deployment-report.json`);
  }

  /**
   * Format bytes to human readable string
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

// Run deployment if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const pipeline = new DeploymentPipeline();
  pipeline.deploy().catch(console.error);
}

export { DeploymentPipeline };