/**
 * Semantic Prompt Workstation - Cloudflare Worker with Hono
 * Serves static assets and provides API endpoints for D1 database operations
 * Enhanced with Workers AI for prompt optimization and Claude Code export
 */

import { Hono } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";

const app = new Hono();

// ============================================
// GLOBAL INSTANCES
// ============================================

// Global error handler and transaction manager instances
let globalErrorHandler;
let globalTransactionManager;
let globalProjectManager;
let globalResourceManager;
let globalProjectValidator;

// ============================================
// MIDDLEWARE
// ============================================

// CORS middleware
app.use(
  "/api/*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type"],
  }),
);

// Security headers for all responses
app.use(
  "*",
  secureHeaders({
    xFrameOptions: "DENY",
    xContentTypeOptions: "nosniff",
    referrerPolicy: "strict-origin-when-cross-origin",
  }),
);

// Initialize global instances middleware
app.use("*", async (c, next) => {
  if (!globalErrorHandler) {
    globalErrorHandler = new ErrorHandler();
    globalTransactionManager = new TransactionManager(c.env.DB, globalErrorHandler);
    globalProjectManager = new ProjectManager(c.env.DB, globalErrorHandler, globalTransactionManager);
    globalResourceManager = new ResourceManager(c.env.DB, globalErrorHandler, globalTransactionManager);
    globalProjectValidator = new ProjectValidator(c.env.DB, globalErrorHandler);
  }
  
  // Add instances to context for easy access
  c.set('errorHandler', globalErrorHandler);
  c.set('transactionManager', globalTransactionManager);
  c.set('projectManager', globalProjectManager);
  c.set('resourceManager', globalResourceManager);
  c.set('projectValidator', globalProjectValidator);
  
  await next();
});

// ============================================
// ERROR HANDLING AND RECOVERY SYSTEM
// ============================================

/**
 * Custom error classes for better error handling and recovery
 */
class SystemError extends Error {
  constructor(message, code, details = {}, recoveryOptions = []) {
    super(message);
    this.name = 'SystemError';
    this.code = code;
    this.details = details;
    this.recoveryOptions = recoveryOptions;
    this.timestamp = new Date().toISOString();
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      details: this.details,
      recoveryOptions: this.recoveryOptions,
      timestamp: this.timestamp,
      stack: this.stack
    };
  }
}

class ValidationError extends SystemError {
  constructor(message, field, value, details = {}) {
    super(message, 'VALIDATION_ERROR', { field, value, ...details }, [
      'Check input format and try again',
      'Refer to API documentation for valid values'
    ]);
    this.name = 'ValidationError';
    this.field = field;
    this.value = value;
  }
}

class ResourceNotFoundError extends SystemError {
  constructor(resourceType, resourceId, details = {}) {
    super(
      `${resourceType} with ID '${resourceId}' not found or not accessible`,
      'RESOURCE_NOT_FOUND',
      { resourceType, resourceId, ...details },
      [
        'Verify the resource ID is correct',
        'Check if the resource is active/enabled',
        'Ensure you have permission to access this resource'
      ]
    );
    this.name = 'ResourceNotFoundError';
    this.resourceType = resourceType;
    this.resourceId = resourceId;
  }
}

class ConflictError extends SystemError {
  constructor(message, conflictType, existingResource = null, details = {}) {
    super(message, 'CONFLICT_ERROR', { conflictType, existingResource, ...details }, [
      'Use a different name or identifier',
      'Update the existing resource instead',
      'Delete the conflicting resource first'
    ]);
    this.name = 'ConflictError';
    this.conflictType = conflictType;
    this.existingResource = existingResource;
  }
}

class TransactionError extends SystemError {
  constructor(message, operation, rollbackStatus = null, details = {}) {
    super(
      message,
      'TRANSACTION_ERROR',
      { operation, rollbackStatus, ...details },
      rollbackStatus === 'success' ? [
        'Operation was rolled back successfully',
        'Review the error and try again',
        'Check system logs for more details'
      ] : [
        'Manual intervention may be required',
        'Contact system administrator',
        'Check data consistency'
      ]
    );
    this.name = 'TransactionError';
    this.operation = operation;
    this.rollbackStatus = rollbackStatus;
  }
}

/**
 * Error Handler - Provides centralized error handling and recovery
 */
class ErrorHandler {
  constructor() {
    this.errorLog = [];
    this.maxLogSize = 1000;
  }

  /**
   * Handle and log errors with recovery options
   * @param {Error} error - The error to handle
   * @param {Object} context - Additional context information
   * @returns {Object} - Formatted error response
   */
  handleError(error, context = {}) {
    const errorEntry = {
      timestamp: new Date().toISOString(),
      error: error instanceof SystemError ? error.toJSON() : {
        name: error.name,
        message: error.message,
        stack: error.stack
      },
      context,
      id: crypto.randomUUID()
    };

    // Log the error
    this.logError(errorEntry);

    // Return user-friendly error response
    return this.formatErrorResponse(error, errorEntry.id);
  }

  /**
   * Log error to internal log
   * @private
   */
  logError(errorEntry) {
    this.errorLog.push(errorEntry);
    
    // Keep log size manageable
    if (this.errorLog.length > this.maxLogSize) {
      this.errorLog = this.errorLog.slice(-this.maxLogSize);
    }

    // In production, this would also log to external monitoring
    console.error('System Error:', errorEntry);
  }

  /**
   * Format error response for API consumers
   * @private
   */
  formatErrorResponse(error, errorId) {
    if (error instanceof SystemError) {
      return {
        success: false,
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
          recoveryOptions: error.recoveryOptions,
          errorId,
          timestamp: error.timestamp
        }
      };
    }

    // Handle standard errors
    const errorCode = this.getErrorCode(error);
    const userMessage = this.getUserFriendlyMessage(error);
    const recoveryOptions = this.getRecoveryOptions(error);

    return {
      success: false,
      error: {
        code: errorCode,
        message: userMessage,
        recoveryOptions,
        errorId,
        timestamp: new Date().toISOString()
      }
    };
  }

  /**
   * Get error code for standard errors
   * @private
   */
  getErrorCode(error) {
    if (error.message.includes('UNIQUE constraint failed')) {
      return 'DUPLICATE_RESOURCE';
    }
    if (error.message.includes('NOT NULL constraint failed')) {
      return 'MISSING_REQUIRED_FIELD';
    }
    if (error.message.includes('FOREIGN KEY constraint failed')) {
      return 'INVALID_REFERENCE';
    }
    if (error.message.includes('not found')) {
      return 'RESOURCE_NOT_FOUND';
    }
    return 'INTERNAL_ERROR';
  }

  /**
   * Get user-friendly message for standard errors
   * @private
   */
  getUserFriendlyMessage(error) {
    const code = this.getErrorCode(error);
    
    switch (code) {
      case 'DUPLICATE_RESOURCE':
        return 'A resource with this identifier already exists. Please use a different name or update the existing resource.';
      case 'MISSING_REQUIRED_FIELD':
        return 'Required information is missing. Please provide all required fields and try again.';
      case 'INVALID_REFERENCE':
        return 'Referenced resource does not exist. Please verify the resource ID and try again.';
      case 'RESOURCE_NOT_FOUND':
        return 'The requested resource could not be found. Please verify the ID and try again.';
      default:
        return 'An unexpected error occurred. Please try again or contact support if the problem persists.';
    }
  }

  /**
   * Get recovery options for standard errors
   * @private
   */
  getRecoveryOptions(error) {
    const code = this.getErrorCode(error);
    
    switch (code) {
      case 'DUPLICATE_RESOURCE':
        return [
          'Use a different name or identifier',
          'Update the existing resource instead',
          'Delete the conflicting resource first'
        ];
      case 'MISSING_REQUIRED_FIELD':
        return [
          'Review required fields in the API documentation',
          'Ensure all mandatory fields are provided',
          'Check field format and data types'
        ];
      case 'INVALID_REFERENCE':
        return [
          'Verify the referenced resource exists',
          'Check the resource ID format',
          'Ensure the resource is active and accessible'
        ];
      case 'RESOURCE_NOT_FOUND':
        return [
          'Verify the resource ID is correct',
          'Check if the resource has been deleted',
          'Ensure you have permission to access this resource'
        ];
      default:
        return [
          'Try the operation again',
          'Check system status',
          'Contact support if the problem persists'
        ];
    }
  }

  /**
   * Get recent errors for monitoring
   */
  getRecentErrors(limit = 50) {
    return this.errorLog.slice(-limit);
  }

  /**
   * Clear error log
   */
  clearErrorLog() {
    this.errorLog = [];
  }
}

// ============================================
// TRANSACTION MANAGER
// ============================================

/**
 * TransactionManager - Handles database transactions and rollback capabilities
 * Implements requirements 7.2, 7.3, 7.5
 */
class TransactionManager {
  constructor(db, errorHandler) {
    this.db = db;
    this.errorHandler = errorHandler;
    this.activeTransactions = new Map();
  }

  /**
   * Execute operations within a transaction with automatic rollback on failure
   * @param {Function} operations - Async function containing operations to execute
   * @param {Object} options - Transaction options
   * @returns {Promise<any>} - Result of operations or throws TransactionError
   */
  async executeTransaction(operations, options = {}) {
    const {
      transactionId = crypto.randomUUID(),
      timeout = 30000, // 30 seconds default timeout
      retryCount = 0,
      maxRetries = 2
    } = options;

    const transaction = {
      id: transactionId,
      startTime: Date.now(),
      operations: [],
      rollbackOperations: [],
      status: 'active'
    };

    this.activeTransactions.set(transactionId, transaction);

    try {
      // Set transaction timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new TransactionError(
            `Transaction timeout after ${timeout}ms`,
            'timeout',
            null,
            { transactionId, timeout }
          ));
        }, timeout);
      });

      // Execute operations with timeout
      const result = await Promise.race([
        this._executeWithRollbackTracking(operations, transaction),
        timeoutPromise
      ]);

      // Mark transaction as completed
      transaction.status = 'completed';
      transaction.endTime = Date.now();
      transaction.duration = transaction.endTime - transaction.startTime;

      return result;

    } catch (error) {
      // Attempt rollback
      const rollbackResult = await this._performRollback(transaction);
      
      // Clean up transaction
      this.activeTransactions.delete(transactionId);

      // If this was a retryable error and we haven't exceeded max retries
      if (this._isRetryableError(error) && retryCount < maxRetries) {
        console.warn(`Transaction failed, retrying (${retryCount + 1}/${maxRetries}):`, error.message);
        return this.executeTransaction(operations, {
          ...options,
          retryCount: retryCount + 1,
          transactionId: crypto.randomUUID() // New transaction ID for retry
        });
      }

      // Throw enhanced error with rollback information
      throw new TransactionError(
        `Transaction failed: ${error.message}`,
        'execution_failed',
        rollbackResult.success ? 'success' : 'failed',
        {
          transactionId,
          originalError: error.message,
          rollbackDetails: rollbackResult,
          retryCount,
          duration: Date.now() - transaction.startTime
        }
      );
    } finally {
      // Clean up completed transaction
      if (this.activeTransactions.has(transactionId)) {
        this.activeTransactions.delete(transactionId);
      }
    }
  }

  /**
   * Execute operations while tracking rollback information
   * @private
   */
  async _executeWithRollbackTracking(operations, transaction) {
    // Create a proxy database that tracks operations for rollback
    const trackedDb = this._createTrackedDatabase(transaction);
    
    // Execute the operations with the tracked database
    return await operations(trackedDb);
  }

  /**
   * Create a database proxy that tracks operations for rollback
   * @private
   */
  _createTrackedDatabase(transaction) {
    const self = this;
    
    return {
      prepare: (query) => {
        const originalPrepared = self.db.prepare(query);
        
        return {
          bind: (...params) => {
            const originalBound = originalPrepared.bind(...params);
            
            return {
              run: async () => {
                // Track the operation for potential rollback
                const operation = {
                  type: 'run',
                  query,
                  params,
                  timestamp: Date.now()
                };

                try {
                  const result = await originalBound.run();
                  
                  // Track successful operation
                  operation.result = result;
                  operation.status = 'success';
                  transaction.operations.push(operation);

                  // Generate rollback operation if needed
                  const rollbackOp = self._generateRollbackOperation(query, params, result);
                  if (rollbackOp) {
                    transaction.rollbackOperations.unshift(rollbackOp); // Add to front for reverse order
                  }

                  return result;
                } catch (error) {
                  operation.error = error.message;
                  operation.status = 'failed';
                  transaction.operations.push(operation);
                  throw error;
                }
              },

              first: async () => {
                const operation = {
                  type: 'first',
                  query,
                  params,
                  timestamp: Date.now()
                };

                try {
                  const result = await originalBound.first();
                  operation.result = result;
                  operation.status = 'success';
                  transaction.operations.push(operation);
                  return result;
                } catch (error) {
                  operation.error = error.message;
                  operation.status = 'failed';
                  transaction.operations.push(operation);
                  throw error;
                }
              },

              all: async () => {
                const operation = {
                  type: 'all',
                  query,
                  params,
                  timestamp: Date.now()
                };

                try {
                  const result = await originalBound.all();
                  operation.result = result;
                  operation.status = 'success';
                  transaction.operations.push(operation);
                  return result;
                } catch (error) {
                  operation.error = error.message;
                  operation.status = 'failed';
                  transaction.operations.push(operation);
                  throw error;
                }
              }
            };
          },

          // Direct methods (no bind)
          run: async () => originalPrepared.run(),
          first: async () => originalPrepared.first(),
          all: async () => originalPrepared.all()
        };
      }
    };
  }

  /**
   * Generate rollback operation for a given database operation
   * @private
   */
  _generateRollbackOperation(query, params, result) {
    const queryLower = query.toLowerCase().trim();

    if (queryLower.startsWith('insert into')) {
      // For INSERT, generate DELETE
      const tableMatch = query.match(/insert\s+into\s+(\w+)/i);
      if (tableMatch && result.meta?.last_row_id) {
        return {
          type: 'rollback_delete',
          query: `DELETE FROM ${tableMatch[1]} WHERE rowid = ?`,
          params: [result.meta.last_row_id],
          description: `Rollback INSERT into ${tableMatch[1]}`
        };
      }
    } else if (queryLower.startsWith('update')) {
      // For UPDATE, we would need to store the original values
      // This is a simplified implementation - in production you'd want to
      // SELECT the original values before UPDATE
      const tableMatch = query.match(/update\s+(\w+)/i);
      if (tableMatch) {
        return {
          type: 'rollback_warning',
          description: `UPDATE to ${tableMatch[1]} cannot be automatically rolled back`,
          recommendation: 'Manual data restoration may be required'
        };
      }
    } else if (queryLower.startsWith('delete from')) {
      // For DELETE, we would need to store the deleted data
      // This is a simplified implementation
      const tableMatch = query.match(/delete\s+from\s+(\w+)/i);
      if (tableMatch) {
        return {
          type: 'rollback_warning',
          description: `DELETE from ${tableMatch[1]} cannot be automatically rolled back`,
          recommendation: 'Manual data restoration may be required'
        };
      }
    }

    return null;
  }

  /**
   * Perform rollback operations
   * @private
   */
  async _performRollback(transaction) {
    const rollbackResult = {
      success: true,
      operationsRolledBack: 0,
      operationsFailed: 0,
      warnings: [],
      errors: []
    };

    transaction.status = 'rolling_back';

    try {
      for (const rollbackOp of transaction.rollbackOperations) {
        try {
          if (rollbackOp.type === 'rollback_delete') {
            await this.db.prepare(rollbackOp.query).bind(...rollbackOp.params).run();
            rollbackResult.operationsRolledBack++;
          } else if (rollbackOp.type === 'rollback_warning') {
            rollbackResult.warnings.push(rollbackOp.description);
            if (rollbackOp.recommendation) {
              rollbackResult.warnings.push(`Recommendation: ${rollbackOp.recommendation}`);
            }
          }
        } catch (error) {
          rollbackResult.operationsFailed++;
          rollbackResult.errors.push({
            operation: rollbackOp,
            error: error.message
          });
          rollbackResult.success = false;
        }
      }

      transaction.status = rollbackResult.success ? 'rolled_back' : 'rollback_failed';
      return rollbackResult;

    } catch (error) {
      transaction.status = 'rollback_failed';
      rollbackResult.success = false;
      rollbackResult.errors.push({
        operation: 'rollback_process',
        error: error.message
      });
      return rollbackResult;
    }
  }

  /**
   * Check if an error is retryable
   * @private
   */
  _isRetryableError(error) {
    const retryablePatterns = [
      'database is locked',
      'timeout',
      'connection',
      'network',
      'temporary'
    ];

    const errorMessage = error.message.toLowerCase();
    return retryablePatterns.some(pattern => errorMessage.includes(pattern));
  }

  /**
   * Get active transactions for monitoring
   */
  getActiveTransactions() {
    return Array.from(this.activeTransactions.values()).map(tx => ({
      id: tx.id,
      status: tx.status,
      startTime: tx.startTime,
      duration: Date.now() - tx.startTime,
      operationCount: tx.operations.length
    }));
  }

  /**
   * Force rollback of a specific transaction
   */
  async forceRollback(transactionId) {
    const transaction = this.activeTransactions.get(transactionId);
    if (!transaction) {
      throw new Error(`Transaction ${transactionId} not found`);
    }

    return await this._performRollback(transaction);
  }
}

// ============================================
// PLATFORM DETECTION ENGINE
// ============================================

/**
 * PlatformDetectionEngine - Detects platforms and technologies from user input
 * Implements requirements 1.1, 1.2
 */
class PlatformDetectionEngine {
  constructor(db) {
    this.db = db;
    
    // Platform keyword mappings with confidence weights
    this.platformKeywords = {
      'shopify': {
        keywords: ['shopify', 'liquid', 'storefront', 'checkout', 'cart', 'product', 'collection', 'theme', 'app store', 'webhook', 'graphql admin', 'storefront api'],
        weight: 1.0,
        category: 'ecommerce'
      },
      'stripe': {
        keywords: ['stripe', 'payment', 'checkout', 'subscription', 'invoice', 'customer', 'charge', 'payment intent', 'webhook', 'connect', 'marketplace'],
        weight: 1.0,
        category: 'payment'
      },
      'nextjs': {
        keywords: ['next.js', 'nextjs', 'vercel', 'ssg', 'ssr', 'isr', 'getstaticprops', 'getserversideprops', 'app router', 'pages router'],
        weight: 1.0,
        category: 'framework'
      },
      'react': {
        keywords: ['react', 'jsx', 'component', 'hook', 'usestate', 'useeffect', 'context', 'redux', 'props', 'state'],
        weight: 0.8,
        category: 'framework'
      },
      'nodejs': {
        keywords: ['node.js', 'nodejs', 'npm', 'express', 'fastify', 'koa', 'hapi', 'middleware', 'package.json'],
        weight: 0.8,
        category: 'runtime'
      },
      'aws': {
        keywords: ['aws', 'lambda', 's3', 'ec2', 'rds', 'dynamodb', 'cloudformation', 'cloudwatch', 'api gateway', 'cognito'],
        weight: 0.9,
        category: 'cloud'
      },
      'docker': {
        keywords: ['docker', 'dockerfile', 'container', 'image', 'compose', 'kubernetes', 'k8s', 'pod', 'deployment'],
        weight: 0.7,
        category: 'infrastructure'
      },
      'api': {
        keywords: ['api', 'rest api', 'graphql', 'endpoint', 'json', 'http', 'get', 'post', 'put', 'delete', 'webhook'],
        weight: 0.7,
        category: 'integration'
      },
      'database': {
        keywords: ['mysql', 'postgresql', 'mongodb', 'redis', 'sqlite', 'database', 'sql', 'nosql', 'orm', 'migration'],
        weight: 0.7,
        category: 'database'
      },
      'security': {
        keywords: ['auth', 'authentication', 'authorization', 'jwt', 'oauth', 'ssl', 'https', 'encryption', 'csrf', 'xss'],
        weight: 0.5,
        category: 'security'
      }
    };
  }

  /**
   * Detect platforms from user input text
   * @param {string} input - User input text to analyze
   * @returns {Array} - Array of platform detections with confidence scores
   */
  detectPlatforms(input) {
    if (!input || typeof input !== 'string') {
      return [];
    }

    const normalizedInput = input.toLowerCase();
    const detections = [];

    // Check each platform for keyword matches
    for (const [platform, config] of Object.entries(this.platformKeywords)) {
      const matches = this._findKeywordMatches(normalizedInput, config.keywords);
      
      if (matches.length > 0) {
        const confidence = this._calculateConfidence(matches, config.weight, normalizedInput.length);
        
        detections.push({
          platform,
          confidence,
          keywords: matches,
          category: config.category,
          matchCount: matches.length
        });
      }
    }

    // Sort by confidence score (highest first)
    return detections.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Get platform templates based on detected platforms
   * @param {Array} platforms - Array of platform names
   * @returns {Array} - Array of relevant templates
   */
  async getPlatformTemplates(platforms) {
    if (!platforms || platforms.length === 0) {
      return [];
    }

    try {
      // Build query for multiple platforms
      const placeholders = platforms.map(() => '?').join(',');
      const query = `
        SELECT * FROM platform_templates 
        WHERE platform IN (${placeholders}) AND is_active = 1
        ORDER BY usage_count DESC, success_rate DESC
      `;

      const result = await this.db.prepare(query).bind(...platforms).all();
      
      return result.results.map(template => ({
        ...template,
        keywords: template.keywords ? JSON.parse(template.keywords) : []
      }));
    } catch (error) {
      console.error('Error getting platform templates:', error);
      return [];
    }
  }

  /**
   * Rank template suggestions by relevance to context
   * @param {Array} suggestions - Array of template suggestions
   * @param {Object} context - Context information (project, existing rules, etc.)
   * @returns {Array} - Ranked suggestions
   */
  rankSuggestionsByRelevance(suggestions, context = {}) {
    if (!suggestions || suggestions.length === 0) {
      return [];
    }

    const { 
      projectId = null, 
      existingRules = [], 
      detectedPlatforms = [],
      userInput = '' 
    } = context;

    // Calculate relevance score for each suggestion
    const rankedSuggestions = suggestions.map(suggestion => {
      let relevanceScore = suggestion.success_rate || 0.5; // Base score from success rate
      
      // Boost score if platform matches detected platforms
      const platformMatch = detectedPlatforms.find(p => p.platform === suggestion.platform);
      if (platformMatch) {
        relevanceScore += platformMatch.confidence * 0.3;
      }

      // Boost score based on usage count (normalized)
      const maxUsage = Math.max(...suggestions.map(s => s.usage_count || 0));
      if (maxUsage > 0) {
        relevanceScore += (suggestion.usage_count || 0) / maxUsage * 0.2;
      }

      // Reduce score if similar rules already exist
      const similarRules = existingRules.filter(rule => 
        rule.category === suggestion.category || 
        rule.platform_tags?.includes(suggestion.platform)
      );
      if (similarRules.length > 0) {
        relevanceScore -= Math.min(similarRules.length * 0.1, 0.3);
      }

      // Boost score for keyword matches in user input
      if (userInput && suggestion.keywords) {
        const keywordMatches = this._findKeywordMatches(
          userInput.toLowerCase(), 
          suggestion.keywords
        );
        if (keywordMatches.length > 0) {
          relevanceScore += keywordMatches.length * 0.05;
        }
      }

      return {
        ...suggestion,
        relevanceScore: Math.max(0, Math.min(1, relevanceScore))
      };
    });

    // Sort by relevance score (highest first)
    return rankedSuggestions.sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  /**
   * Find keyword matches in input text
   * @private
   * @param {string} input - Normalized input text
   * @param {Array} keywords - Array of keywords to search for
   * @returns {Array} - Array of matched keywords
   */
  _findKeywordMatches(input, keywords) {
    const matches = [];
    
    for (const keyword of keywords) {
      const normalizedKeyword = keyword.toLowerCase();
      
      // Check for exact matches and partial matches
      if (input.includes(normalizedKeyword)) {
        matches.push(keyword);
      } else {
        // Check for word boundary matches to avoid false positives
        const wordBoundaryRegex = new RegExp(`\\b${normalizedKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
        if (wordBoundaryRegex.test(input)) {
          matches.push(keyword);
        }
      }
    }
    
    return matches;
  }

  /**
   * Calculate confidence score for platform detection
   * @private
   * @param {Array} matches - Array of matched keywords
   * @param {number} platformWeight - Weight of the platform
   * @param {number} inputLength - Length of input text
   * @returns {number} - Confidence score between 0 and 1
   */
  _calculateConfidence(matches, platformWeight, inputLength) {
    // Base confidence from number of matches
    let confidence = Math.min(matches.length * 0.4, 0.9);
    
    // Apply platform weight
    confidence *= platformWeight;
    
    // For very short inputs, if we have a clear keyword match, be more lenient
    if (inputLength <= 10 && matches.length > 0) {
      confidence = Math.max(confidence, 0.3); // Minimum confidence for short inputs with matches
    }
    
    // Adjust for input length (but don't penalize too much for short inputs with clear matches)
    const lengthFactor = Math.min(inputLength / 30, 1.0); // Further reduced threshold
    confidence *= Math.max(0.5, 0.7 + lengthFactor * 0.3); // Higher minimum multiplier
    
    // Boost confidence for multiple unique matches
    if (matches.length > 1) {
      confidence += Math.min((matches.length - 1) * 0.1, 0.2);
    }
    
    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * Get platform categories for filtering
   * @returns {Array} - Array of available categories
   */
  getPlatformCategories() {
    const categories = new Set();
    for (const config of Object.values(this.platformKeywords)) {
      categories.add(config.category);
    }
    return Array.from(categories).sort();
  }

  /**
   * Get supported platforms
   * @returns {Array} - Array of supported platform names
   */
  getSupportedPlatforms() {
    return Object.keys(this.platformKeywords).sort();
  }
}

// ============================================
// TEMPLATE SUGGESTION SERVICE
// ============================================

/**
 * TemplateSuggestionService - Provides contextual template suggestions
 * Implements requirements 1.4, 3.3
 */
class TemplateSuggestionService {
  constructor(db, platformDetectionEngine) {
    this.db = db;
    this.platformDetectionEngine = platformDetectionEngine;
  }

  /**
   * Get template suggestions for detected platforms
   * @param {string} platform - Platform name
   * @param {Array} existingRules - Array of existing rules for context
   * @returns {Array} - Array of template suggestions
   */
  async getSuggestionsForPlatform(platform, existingRules = []) {
    try {
      // Get templates for the specific platform
      const platformTemplates = await this.db.prepare(`
        SELECT * FROM platform_templates 
        WHERE platform = ? AND is_active = 1
        ORDER BY usage_count DESC, success_rate DESC
        LIMIT 10
      `).bind(platform).all();

      // Also get general templates that might be relevant
      const generalTemplates = await this.db.prepare(`
        SELECT * FROM platform_templates 
        WHERE platform = 'general' AND is_active = 1
        ORDER BY usage_count DESC, success_rate DESC
        LIMIT 5
      `).bind().all();

      const allTemplates = [...platformTemplates.results, ...generalTemplates.results];

      // Filter out templates similar to existing rules
      const filteredTemplates = this._filterSimilarTemplates(allTemplates, existingRules);

      return filteredTemplates.map(template => ({
        ...template,
        keywords: template.keywords ? JSON.parse(template.keywords) : [],
        suggestedReason: this._getSuggestionReason(template, platform, existingRules)
      }));
    } catch (error) {
      console.error('Error getting platform suggestions:', error);
      return [];
    }
  }

  /**
   * Analyze existing rules to identify patterns
   * @param {number} projectId - Project ID to analyze
   * @returns {Array} - Array of identified patterns
   */
  async analyzeExistingRules(projectId) {
    try {
      // Get all rules for the project
      const rules = await this.db.prepare(`
        SELECT ar.* FROM agent_rules ar
        JOIN project_resources pr ON ar.id = pr.resource_id
        WHERE pr.project_id = ? AND pr.resource_type = 'rule' AND ar.is_active = 1
      `).bind(projectId).all();

      const patterns = [];

      if (rules.results.length === 0) {
        return patterns;
      }

      // Analyze platform distribution
      const platformCounts = {};
      const categoryCount = {};
      
      for (const rule of rules.results) {
        // Parse platform tags
        const platformTags = rule.platform_tags ? JSON.parse(rule.platform_tags) : [];
        for (const platform of platformTags) {
          platformCounts[platform] = (platformCounts[platform] || 0) + 1;
        }

        // Count categories (inferred from rule content)
        const category = this._inferRuleCategory(rule);
        if (category) {
          categoryCount[category] = (categoryCount[category] || 0) + 1;
        }
      }

      // Identify dominant platforms
      const dominantPlatforms = Object.entries(platformCounts)
        .filter(([_, count]) => count >= 2)
        .sort(([_, a], [__, b]) => b - a)
        .slice(0, 3);

      if (dominantPlatforms.length > 0) {
        patterns.push({
          type: 'platform_focus',
          description: `Project focuses on ${dominantPlatforms.map(([p]) => p).join(', ')}`,
          platforms: dominantPlatforms.map(([platform, count]) => ({ platform, count })),
          confidence: Math.min(dominantPlatforms[0][1] / rules.results.length, 1.0)
        });
      }

      // Identify missing categories
      const commonCategories = ['security', 'performance', 'best-practices', 'integration'];
      const missingCategories = commonCategories.filter(cat => !categoryCount[cat]);
      
      if (missingCategories.length > 0) {
        patterns.push({
          type: 'missing_categories',
          description: `Missing rules for ${missingCategories.join(', ')}`,
          categories: missingCategories,
          confidence: 0.7
        });
      }

      // Identify quality patterns
      const aiEnhancedCount = rules.results.filter(r => r.ai_enhanced).length;
      if (aiEnhancedCount < rules.results.length * 0.5) {
        patterns.push({
          type: 'enhancement_opportunity',
          description: 'Many rules could benefit from AI enhancement',
          enhancementOpportunity: rules.results.length - aiEnhancedCount,
          confidence: 0.6
        });
      }

      return patterns;
    } catch (error) {
      console.error('Error analyzing existing rules:', error);
      return [];
    }
  }

  /**
   * Suggest improvements based on patterns and best practices
   * @param {Object} ruleData - Partial rule data being created
   * @param {Array} patterns - Identified patterns from analysis
   * @returns {Array} - Array of improvement suggestions
   */
  suggestImprovements(ruleData, patterns) {
    const suggestions = [];

    // Suggest platform-specific templates based on patterns
    const platformFocusPattern = patterns.find(p => p.type === 'platform_focus');
    if (platformFocusPattern && ruleData.name) {
      const detectedPlatforms = this.platformDetectionEngine.detectPlatforms(
        `${ruleData.name} ${ruleData.description || ''}`
      );
      
      for (const detection of detectedPlatforms.slice(0, 2)) {
        if (platformFocusPattern.platforms.some(p => p.platform === detection.platform)) {
          suggestions.push({
            type: 'platform_template',
            title: `Use ${detection.platform} template`,
            description: `Based on your project's focus on ${detection.platform}, consider using a specialized template`,
            platform: detection.platform,
            confidence: detection.confidence * 0.8,
            action: 'suggest_template'
          });
        }
      }
    }

    // Suggest missing categories
    const missingCategoriesPattern = patterns.find(p => p.type === 'missing_categories');
    if (missingCategoriesPattern) {
      for (const category of missingCategoriesPattern.categories.slice(0, 2)) {
        suggestions.push({
          type: 'category_suggestion',
          title: `Add ${category} rules`,
          description: `Your project is missing ${category} guidelines. Consider adding them for completeness`,
          category,
          confidence: 0.6,
          action: 'suggest_category'
        });
      }
    }

    // Suggest AI enhancement
    const enhancementPattern = patterns.find(p => p.type === 'enhancement_opportunity');
    if (enhancementPattern && (!ruleData.ai_enhanced || ruleData.ai_enhanced === 0)) {
      suggestions.push({
        type: 'ai_enhancement',
        title: 'Enhance with AI',
        description: 'AI can help improve the structure and clarity of this rule',
        confidence: 0.7,
        action: 'enhance_with_ai'
      });
    }

    // Sort by confidence
    return suggestions.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Filter out templates similar to existing rules
   * @private
   * @param {Array} templates - Array of templates
   * @param {Array} existingRules - Array of existing rules
   * @returns {Array} - Filtered templates
   */
  _filterSimilarTemplates(templates, existingRules) {
    if (!existingRules || existingRules.length === 0) {
      return templates;
    }

    return templates.filter(template => {
      // Check if a similar rule already exists
      const similarRule = existingRules.find(rule => {
        // Check category match
        const ruleCategory = this._inferRuleCategory(rule);
        if (ruleCategory === template.category) {
          return true;
        }

        // Check platform match
        const rulePlatforms = rule.platform_tags ? JSON.parse(rule.platform_tags) : [];
        if (rulePlatforms.includes(template.platform)) {
          return true;
        }

        // Check content similarity (basic keyword matching)
        const templateKeywords = template.keywords ? JSON.parse(template.keywords) : [];
        const ruleContent = `${rule.name} ${rule.description || ''}`.toLowerCase();
        const matchingKeywords = templateKeywords.filter(keyword => 
          ruleContent.includes(keyword.toLowerCase())
        );
        
        return matchingKeywords.length >= 2;
      });

      return !similarRule;
    });
  }

  /**
   * Infer rule category from content
   * @private
   * @param {Object} rule - Rule object
   * @returns {string|null} - Inferred category
   */
  _inferRuleCategory(rule) {
    const content = `${rule.name} ${rule.description || ''}`.toLowerCase();
    
    const categoryKeywords = {
      'security': ['security', 'auth', 'authentication', 'authorization', 'ssl', 'https', 'encryption', 'csrf', 'xss', 'injection'],
      'performance': ['performance', 'optimization', 'cache', 'speed', 'fast', 'efficient', 'memory', 'cpu', 'load'],
      'best-practices': ['best practice', 'guideline', 'standard', 'convention', 'pattern', 'clean', 'maintainable'],
      'integration': ['api', 'integration', 'webhook', 'endpoint', 'service', 'external', 'third-party']
    };

    for (const [category, keywords] of Object.entries(categoryKeywords)) {
      if (keywords.some(keyword => content.includes(keyword))) {
        return category;
      }
    }

    return null;
  }

  /**
   * Get suggestion reason for a template
   * @private
   * @param {Object} template - Template object
   * @param {string} platform - Detected platform
   * @param {Array} existingRules - Existing rules
   * @returns {string} - Reason for suggestion
   */
  _getSuggestionReason(template, platform, existingRules) {
    if (template.platform === platform) {
      return `Recommended for ${platform} development`;
    }
    
    if (template.platform === 'general') {
      const categoryCount = existingRules.filter(rule => 
        this._inferRuleCategory(rule) === template.category
      ).length;
      
      if (categoryCount === 0) {
        return `Essential ${template.category} guidelines missing`;
      }
      return `Additional ${template.category} best practices`;
    }
    
    return 'Commonly used template';
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function generateId() {
  return crypto.randomUUID().replace(/-/g, "");
}

/**
 * Generate SEO-friendly slug from project name
 * @param {string} name - Project name
 * @param {Array} existingSlugs - Array of existing slugs to avoid conflicts
 * @returns {string} - SEO-friendly slug
 */
function generateSlug(name, existingSlugs = []) {
  // Convert to lowercase and replace spaces/special chars with hyphens
  let slug = name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with hyphens
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens

  // Handle empty slug
  if (!slug) {
    slug = 'project';
  }

  // Handle conflicts by appending numbers
  let finalSlug = slug;
  let counter = 1;
  while (existingSlugs.includes(finalSlug)) {
    finalSlug = `${slug}-${counter}`;
    counter++;
  }

  return finalSlug;
}

// ============================================
// PROJECT MANAGER CLASS
// ============================================

/**
 * ProjectManager - Handles CRUD operations for projects
 * Implements requirements 1.1, 1.2, 1.3, 1.4, 1.5, 7.1, 7.5
 */
class ProjectManager {
  constructor(db, errorHandler = null, transactionManager = null) {
    this.db = db;
    this.errorHandler = errorHandler || new ErrorHandler();
    this.transactionManager = transactionManager || new TransactionManager(db, this.errorHandler);
  }

  /**
   * Create a new project
   * @param {Object} projectData - Project data
   * @returns {Object} - Created project with generated ID and slug
   */
  async createProject(projectData) {
    try {
      return await this.transactionManager.executeTransaction(async (db) => {
        const {
          name,
          description = '',
          category = '',
          tags = [],
          projectInfo = '',
          status = 'active',
          priority = 'medium',
          coverImage = null,
          coverImageAlt = null,
          aiContextSummary = '',
          includeInAiContext = 1,
          startedAt = null,
          targetCompletion = null
        } = projectData;

        // Validate required fields
        if (!name || name.trim().length === 0) {
          throw new ValidationError('Project name is required', 'name', name);
        }

        if (name.length > 255) {
          throw new ValidationError('Project name must be 255 characters or less', 'name', name, {
            maxLength: 255,
            currentLength: name.length
          });
        }

        // Validate status
        const validStatuses = ['draft', 'active', 'completed', 'archived', 'on_hold'];
        if (!validStatuses.includes(status)) {
          throw new ValidationError(
            `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
            'status',
            status,
            { validValues: validStatuses }
          );
        }

        // Validate priority
        const validPriorities = ['low', 'medium', 'high', 'critical'];
        if (!validPriorities.includes(priority)) {
          throw new ValidationError(
            `Invalid priority. Must be one of: ${validPriorities.join(', ')}`,
            'priority',
            priority,
            { validValues: validPriorities }
          );
        }

        // Get existing slugs to avoid conflicts
        const existingSlugsResult = await db.prepare('SELECT slug FROM projects').all();
        const existingSlugs = existingSlugsResult.results.map(row => row.slug);

        // Generate unique slug
        const slug = generateSlug(name, existingSlugs);

        // Prepare data for insertion
        const projectId = Date.now(); // Use timestamp as ID for simplicity
        const now = new Date().toISOString();
        const tagsJson = JSON.stringify(Array.isArray(tags) ? tags : []);

        const result = await db.prepare(`
          INSERT INTO projects (
            id, slug, name, description, category, tags, project_info,
            status, priority, cover_image, cover_image_alt,
            ai_context_summary, include_in_ai_context,
            started_at, target_completion, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          projectId, slug, name, description, category, tagsJson, projectInfo,
          status, priority, coverImage, coverImageAlt,
          aiContextSummary, includeInAiContext,
          startedAt, targetCompletion, now, now
        ).run();

        if (!result.success) {
          throw new SystemError('Failed to create project in database', 'DATABASE_ERROR', {
            projectId,
            slug,
            name
          });
        }

        // Return the created project
        return await this.getProject(projectId);
      });
    } catch (error) {
      if (error.message.includes('UNIQUE constraint failed: projects.slug')) {
        throw new ConflictError(
          'A project with this name already exists',
          'duplicate_slug',
          { slug: generateSlug(projectData.name || '') },
          { suggestedName: `${projectData.name} (Copy)` }
        );
      }
      
      // Re-throw custom errors as-is
      if (error instanceof SystemError) {
        throw error;
      }
      
      // Wrap unexpected errors
      throw this.errorHandler.handleError(error, {
        operation: 'createProject',
        projectData: { name: projectData.name, status: projectData.status }
      });
    }
  }

  /**
   * Update an existing project
   * @param {number} projectId - Project ID
   * @param {Object} updateData - Data to update
   * @returns {Object} - Updated project
   */
  async updateProject(projectId, updateData) {
    // First check if project exists
    const existingProject = await this.getProject(projectId);
    if (!existingProject) {
      throw new Error('Project not found');
    }

    const {
      name,
      description,
      category,
      tags,
      projectInfo,
      status,
      priority,
      coverImage,
      coverImageAlt,
      aiContextSummary,
      includeInAiContext,
      startedAt,
      targetCompletion,
      completedAt
    } = updateData;

    // Build dynamic update query
    const updates = [];
    const values = [];

    if (name !== undefined) {
      if (!name || name.trim().length === 0) {
        throw new Error('Project name is required');
      }
      if (name.length > 255) {
        throw new Error('Project name must be 255 characters or less');
      }

      // Check if we need to update slug
      if (name !== existingProject.name) {
        const existingSlugsResult = await this.db.prepare('SELECT slug FROM projects WHERE id != ?').bind(projectId).all();
        const existingSlugs = existingSlugsResult.results.map(row => row.slug);
        const newSlug = generateSlug(name, existingSlugs);
        
        updates.push('name = ?', 'slug = ?');
        values.push(name, newSlug);
      } else {
        updates.push('name = ?');
        values.push(name);
      }
    }

    if (description !== undefined) {
      updates.push('description = ?');
      values.push(description);
    }

    if (category !== undefined) {
      updates.push('category = ?');
      values.push(category);
    }

    if (tags !== undefined) {
      updates.push('tags = ?');
      values.push(JSON.stringify(Array.isArray(tags) ? tags : []));
    }

    if (projectInfo !== undefined) {
      updates.push('project_info = ?');
      values.push(projectInfo);
    }

    if (status !== undefined) {
      const validStatuses = ['draft', 'active', 'completed', 'archived', 'on_hold'];
      if (!validStatuses.includes(status)) {
        throw new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
      }
      updates.push('status = ?');
      values.push(status);

      // Auto-set completed_at when status changes to completed
      if (status === 'completed' && existingProject.status !== 'completed') {
        updates.push('completed_at = ?');
        values.push(new Date().toISOString());
      } else if (status !== 'completed') {
        updates.push('completed_at = ?');
        values.push(null);
      }
    }

    if (priority !== undefined) {
      const validPriorities = ['low', 'medium', 'high', 'critical'];
      if (!validPriorities.includes(priority)) {
        throw new Error(`Invalid priority. Must be one of: ${validPriorities.join(', ')}`);
      }
      updates.push('priority = ?');
      values.push(priority);
    }

    if (coverImage !== undefined) {
      updates.push('cover_image = ?');
      values.push(coverImage);
    }

    if (coverImageAlt !== undefined) {
      updates.push('cover_image_alt = ?');
      values.push(coverImageAlt);
    }

    if (aiContextSummary !== undefined) {
      updates.push('ai_context_summary = ?');
      values.push(aiContextSummary);
    }

    if (includeInAiContext !== undefined) {
      updates.push('include_in_ai_context = ?');
      values.push(includeInAiContext ? 1 : 0);
    }

    if (startedAt !== undefined) {
      updates.push('started_at = ?');
      values.push(startedAt);
    }

    if (targetCompletion !== undefined) {
      updates.push('target_completion = ?');
      values.push(targetCompletion);
    }

    if (completedAt !== undefined) {
      updates.push('completed_at = ?');
      values.push(completedAt);
    }

    if (updates.length === 0) {
      return existingProject; // No updates needed
    }

    // Add updated_at timestamp
    updates.push('updated_at = ?');
    values.push(new Date().toISOString());

    // Add project ID for WHERE clause
    values.push(projectId);

    try {
      const result = await this.db.prepare(`
        UPDATE projects SET ${updates.join(', ')} WHERE id = ?
      `).bind(...values).run();

      if (!result.success) {
        throw new Error('Failed to update project');
      }

      return await this.getProject(projectId);
    } catch (error) {
      if (error.message.includes('UNIQUE constraint failed: projects.slug')) {
        throw new Error('A project with this name already exists');
      }
      throw error;
    }
  }

  /**
   * Delete a project and handle cleanup while preserving shared resources
   * @param {number} projectId - Project ID
   * @returns {Object} - Deletion result with cleanup details
   */
  async deleteProject(projectId) {
    try {
      return await this.transactionManager.executeTransaction(async (db) => {
        // Check if project exists
        const existingProject = await this.getProject(projectId);
        if (!existingProject) {
          throw new ResourceNotFoundError('project', projectId);
        }

        // Get all resource assignments for this project
        const resourceAssignments = await db.prepare(`
          SELECT resource_type, resource_id, COUNT(*) as assignment_count
          FROM project_resources 
          WHERE project_id = ?
          GROUP BY resource_type, resource_id
        `).bind(projectId).all();

        const cleanupSummary = {
          projectId,
          projectName: existingProject.name,
          resourcesUnassigned: 0,
          sharedResourcesPreserved: 0,
          exportHistoryCleared: 0,
          warnings: []
        };

        // Check for shared resources (assigned to multiple projects)
        for (const assignment of resourceAssignments.results) {
          const { resource_type, resource_id } = assignment;
          
          // Count how many projects use this resource
          const usageCount = await db.prepare(`
            SELECT COUNT(DISTINCT project_id) as project_count
            FROM project_resources 
            WHERE resource_type = ? AND resource_id = ?
          `).bind(resource_type, resource_id).first();

          if (usageCount.project_count > 1) {
            cleanupSummary.sharedResourcesPreserved++;
            cleanupSummary.warnings.push(
              `${resource_type} '${resource_id}' is shared with other projects and will be preserved`
            );
          }
        }

        // Delete project resource assignments (this preserves the actual resources)
        const resourceDeletionResult = await db.prepare(
          'DELETE FROM project_resources WHERE project_id = ?'
        ).bind(projectId).run();

        cleanupSummary.resourcesUnassigned = resourceDeletionResult.meta?.changes || resourceDeletionResult.changes || 0;

        // Clean up export history for this project
        const exportHistoryResult = await db.prepare(
          'DELETE FROM export_history WHERE project_id = ?'
        ).bind(projectId).run();

        cleanupSummary.exportHistoryCleared = exportHistoryResult.meta?.changes || exportHistoryResult.changes || 0;

        // Finally, delete the project itself
        const projectDeletionResult = await db.prepare(
          'DELETE FROM projects WHERE id = ?'
        ).bind(projectId).run();

        if (!projectDeletionResult.success || (projectDeletionResult.meta?.changes || projectDeletionResult.changes) === 0) {
          throw new SystemError('Failed to delete project from database', 'DATABASE_ERROR', {
            projectId,
            projectName: existingProject.name
          });
        }

        return {
          success: true,
          cleanup: cleanupSummary,
          message: `Project '${existingProject.name}' deleted successfully`
        };
      });
    } catch (error) {
      // Re-throw custom errors as-is
      if (error instanceof SystemError) {
        throw error;
      }
      
      // Wrap unexpected errors
      const errorResponse = this.errorHandler.handleError(error, {
        operation: 'deleteProject',
        projectId
      });
      throw new SystemError(
        errorResponse.error.message,
        errorResponse.error.code,
        { projectId, originalError: error.message }
      );
    }
  }

  /**
   * Get a single project by ID
   * @param {number} projectId - Project ID
   * @returns {Object|null} - Project data or null if not found
   */
  async getProject(projectId) {
    try {
      const result = await this.db.prepare('SELECT * FROM projects WHERE id = ?').bind(projectId).first();
      
      if (!result) {
        return null;
      }

      // Parse JSON fields
      return {
        ...result,
        tags: result.tags ? JSON.parse(result.tags) : [],
        includeInAiContext: Boolean(result.include_in_ai_context)
      };
    } catch (error) {
      throw new Error(`Failed to get project: ${error.message}`);
    }
  }

  /**
   * Get a project by slug
   * @param {string} slug - Project slug
   * @returns {Object|null} - Project data or null if not found
   */
  async getProjectBySlug(slug) {
    try {
      const result = await this.db.prepare('SELECT * FROM projects WHERE slug = ?').bind(slug).first();
      
      if (!result) {
        return null;
      }

      // Parse JSON fields
      return {
        ...result,
        tags: result.tags ? JSON.parse(result.tags) : [],
        includeInAiContext: Boolean(result.include_in_ai_context)
      };
    } catch (error) {
      throw new Error(`Failed to get project by slug: ${error.message}`);
    }
  }

  /**
   * List projects with filtering and pagination
   * @param {Object} options - Query options
   * @returns {Object} - Projects list with metadata
   */
  async listProjects(options = {}) {
    const {
      status = null,
      category = null,
      priority = null,
      includeInAiContext = null,
      search = null,
      sortBy = 'updated_at',
      sortOrder = 'DESC',
      limit = 50,
      offset = 0
    } = options;

    try {
      // Build WHERE clause
      const conditions = [];
      const values = [];

      if (status) {
        conditions.push('status = ?');
        values.push(status);
      }

      if (category) {
        conditions.push('category = ?');
        values.push(category);
      }

      if (priority) {
        conditions.push('priority = ?');
        values.push(priority);
      }

      if (includeInAiContext !== null) {
        conditions.push('include_in_ai_context = ?');
        values.push(includeInAiContext ? 1 : 0);
      }

      if (search) {
        conditions.push('(name LIKE ? OR description LIKE ? OR ai_context_summary LIKE ?)');
        const searchPattern = `%${search}%`;
        values.push(searchPattern, searchPattern, searchPattern);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Validate sort parameters
      const validSortFields = ['name', 'created_at', 'updated_at', 'status', 'priority', 'category'];
      const validSortOrders = ['ASC', 'DESC'];
      
      const safeSortBy = validSortFields.includes(sortBy) ? sortBy : 'updated_at';
      const safeSortOrder = validSortOrders.includes(sortOrder.toUpperCase()) ? sortOrder.toUpperCase() : 'DESC';

      // Get total count
      const countQuery = `SELECT COUNT(*) as total FROM projects ${whereClause}`;
      const countResult = await this.db.prepare(countQuery).bind(...values).first();
      const total = countResult.total;

      // Get projects
      const projectsQuery = `
        SELECT * FROM projects 
        ${whereClause}
        ORDER BY ${safeSortBy} ${safeSortOrder}
        LIMIT ? OFFSET ?
      `;
      
      values.push(limit, offset);
      const projectsResult = await this.db.prepare(projectsQuery).bind(...values).all();

      // Parse JSON fields for each project with error handling
      const projects = projectsResult.results.map(project => {
        let parsedTags = [];
        
        try {
          if (project.tags) {
            // Handle both JSON array and comma-separated string formats
            if (project.tags.startsWith('[') && project.tags.endsWith(']')) {
              parsedTags = JSON.parse(project.tags);
            } else if (typeof project.tags === 'string' && project.tags.trim()) {
              // Handle comma-separated string format
              parsedTags = project.tags.split(',').map(tag => tag.trim()).filter(tag => tag);
            }
          }
        } catch (error) {
          console.error('Error parsing tags for project', project.id, ':', error);
          // Fallback: treat as comma-separated string
          if (typeof project.tags === 'string' && project.tags.trim()) {
            parsedTags = project.tags.split(',').map(tag => tag.trim()).filter(tag => tag);
          }
        }
        
        return {
          ...project,
          tags: parsedTags,
          includeInAiContext: Boolean(project.include_in_ai_context)
        };
      });

      return {
        projects,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total
        }
      };
    } catch (error) {
      throw new Error(`Failed to list projects: ${error.message}`);
    }
  }

  /**
   * Get project statistics
   * @returns {Object} - Project statistics
   */
  async getProjectStats() {
    try {
      const statsQuery = `
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN status = 'active' THEN 1 END) as active,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
          COUNT(CASE WHEN status = 'draft' THEN 1 END) as draft,
          COUNT(CASE WHEN status = 'archived' THEN 1 END) as archived,
          COUNT(CASE WHEN status = 'on_hold' THEN 1 END) as on_hold,
          COUNT(CASE WHEN priority = 'critical' THEN 1 END) as critical_priority,
          COUNT(CASE WHEN priority = 'high' THEN 1 END) as high_priority
        FROM projects
      `;

      const result = await this.db.prepare(statsQuery).first();
      return result;
    } catch (error) {
      throw new Error(`Failed to get project statistics: ${error.message}`);
    }
  }

  /**
   * Import resources into a project with dependency resolution
   * @param {number} projectId - Target project ID
   * @param {Array} resourceImports - Array of resources to import
   * @param {Object} options - Import options
   * @returns {Object} - Import result with success/failure details
   */
  async importResources(projectId, resourceImports, options = {}) {
    const {
      resolveDependencies = true,
      conflictResolution = 'skip', // 'skip', 'overwrite', 'rename'
      assignedBy = null,
      importReason = 'bulk_import'
    } = options;

    // Validate project exists
    const project = await this.getProject(projectId);
    if (!project) {
      throw new Error('Target project not found');
    }

    const results = {
      successful: [],
      failed: [],
      skipped: [],
      dependencies: [],
      conflicts: []
    };

    try {
      // Process each resource import
      for (const resourceImport of resourceImports) {
        const { resource_type, resource_id, config_overrides = null } = resourceImport;

        try {
          // Check if resource already assigned
          const existingAssignment = await this.db.prepare(`
            SELECT id FROM project_resources 
            WHERE project_id = ? AND resource_type = ? AND resource_id = ?
          `).bind(projectId, resource_type, resource_id).first();

          if (existingAssignment) {
            if (conflictResolution === 'skip') {
              results.skipped.push({
                resource_type,
                resource_id,
                reason: 'already_assigned'
              });
              continue;
            } else if (conflictResolution === 'overwrite') {
              // Update existing assignment
              await this.db.prepare(`
                UPDATE project_resources 
                SET config_overrides = ?, assignment_reason = ?, updated_at = CURRENT_TIMESTAMP
                WHERE project_id = ? AND resource_type = ? AND resource_id = ?
              `).bind(
                config_overrides ? JSON.stringify(config_overrides) : null,
                importReason,
                projectId,
                resource_type,
                resource_id
              ).run();

              results.successful.push({
                resource_type,
                resource_id,
                action: 'updated'
              });
              continue;
            }
          }

          // Verify resource exists and is active
          await this._verifyResourceExists(resource_type, resource_id);

          // Get dependencies if requested
          let dependencies = [];
          if (resolveDependencies) {
            dependencies = await this.getResourceDependencies(resource_type, resource_id);
            results.dependencies.push(...dependencies);
          }

          // Create new assignment
          const assignmentId = generateId();
          await this.db.prepare(`
            INSERT INTO project_resources (
              id, project_id, resource_type, resource_id, 
              config_overrides, assigned_by, assignment_reason
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
          `).bind(
            assignmentId,
            projectId,
            resource_type,
            resource_id,
            config_overrides ? JSON.stringify(config_overrides) : null,
            assignedBy,
            importReason
          ).run();

          results.successful.push({
            resource_type,
            resource_id,
            assignment_id: assignmentId,
            action: 'imported',
            dependencies: dependencies.length
          });

        } catch (error) {
          results.failed.push({
            resource_type,
            resource_id,
            error: error.message
          });
        }
      }

      return {
        project_id: projectId,
        import_summary: {
          total: resourceImports.length,
          successful: results.successful.length,
          failed: results.failed.length,
          skipped: results.skipped.length,
          dependencies_found: results.dependencies.length
        },
        results,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      throw new Error(`Import operation failed: ${error.message}`);
    }
  }

  /**
   * Get resource dependencies for import planning
   * @param {string} resourceType - Type of resource
   * @param {string} resourceId - Resource ID
   * @returns {Array} - Array of dependent resources
   */
  async getResourceDependencies(resourceType, resourceId) {
    try {
      // Get direct dependencies from resource_dependencies table
      const directDeps = await this.db.prepare(`
        SELECT target_resource_type, target_resource_id, dependency_type, dependency_reason, is_critical
        FROM resource_dependencies 
        WHERE source_resource_type = ? AND source_resource_id = ?
      `).bind(resourceType, resourceId).all();

      const dependencies = [];

      for (const dep of directDeps.results) {
        // Verify the dependency resource still exists
        try {
          await this._verifyResourceExists(dep.target_resource_type, dep.target_resource_id);
          
          dependencies.push({
            resource_type: dep.target_resource_type,
            resource_id: dep.target_resource_id,
            dependency_type: dep.dependency_type,
            dependency_reason: dep.dependency_reason,
            is_critical: Boolean(dep.is_critical),
            exists: true
          });
        } catch (error) {
          dependencies.push({
            resource_type: dep.target_resource_type,
            resource_id: dep.target_resource_id,
            dependency_type: dep.dependency_type,
            dependency_reason: dep.dependency_reason,
            is_critical: Boolean(dep.is_critical),
            exists: false,
            error: error.message
          });
        }
      }

      // Get implicit dependencies based on resource content analysis
      const implicitDeps = await this._analyzeImplicitDependencies(resourceType, resourceId);
      dependencies.push(...implicitDeps);

      return dependencies;
    } catch (error) {
      console.error('Error getting resource dependencies:', error);
      return [];
    }
  }

  /**
   * Preview import operation with compatibility analysis
   * @param {number} projectId - Target project ID
   * @param {Array} resourceImports - Resources to preview
   * @param {Object} options - Preview options
   * @returns {Object} - Preview result with compatibility indicators
   */
  async previewImport(projectId, resourceImports, options = {}) {
    const { includeDependencies = true, checkCompatibility = true } = options;

    const preview = {
      project_id: projectId,
      resources: [],
      dependencies: [],
      conflicts: [],
      compatibility: {
        overall_score: 0,
        warnings: [],
        recommendations: []
      },
      summary: {
        total_resources: resourceImports.length,
        new_assignments: 0,
        existing_assignments: 0,
        missing_resources: 0,
        critical_dependencies: 0
      }
    };

    try {
      for (const resourceImport of resourceImports) {
        const { resource_type, resource_id } = resourceImport;
        const resourcePreview = {
          resource_type,
          resource_id,
          exists: false,
          already_assigned: false,
          dependencies: [],
          compatibility_score: 0,
          warnings: []
        };

        try {
          // Check if resource exists
          await this._verifyResourceExists(resource_type, resource_id);
          resourcePreview.exists = true;

          // Check if already assigned
          const existing = await this.db.prepare(`
            SELECT id FROM project_resources 
            WHERE project_id = ? AND resource_type = ? AND resource_id = ?
          `).bind(projectId, resource_type, resource_id).first();

          if (existing) {
            resourcePreview.already_assigned = true;
            preview.summary.existing_assignments++;
            preview.conflicts.push({
              resource_type,
              resource_id,
              conflict_type: 'already_assigned',
              resolution_options: ['skip', 'overwrite']
            });
          } else {
            preview.summary.new_assignments++;
          }

          // Get dependencies if requested
          if (includeDependencies) {
            const deps = await this.getResourceDependencies(resource_type, resource_id);
            resourcePreview.dependencies = deps;
            preview.dependencies.push(...deps);
            
            const criticalDeps = deps.filter(d => d.is_critical && !d.exists);
            preview.summary.critical_dependencies += criticalDeps.length;
          }

          // Basic compatibility scoring
          resourcePreview.compatibility_score = this._calculateCompatibilityScore(resourcePreview);

        } catch (error) {
          resourcePreview.exists = false;
          resourcePreview.error = error.message;
          preview.summary.missing_resources++;
          resourcePreview.warnings.push(`Resource not found: ${error.message}`);
        }

        preview.resources.push(resourcePreview);
      }

      // Calculate overall compatibility
      const validResources = preview.resources.filter(r => r.exists);
      if (validResources.length > 0) {
        preview.compatibility.overall_score = 
          validResources.reduce((sum, r) => sum + r.compatibility_score, 0) / validResources.length;
      }

      // Add recommendations
      if (preview.conflicts.length > 0) {
        preview.compatibility.warnings.push(`${preview.conflicts.length} resources are already assigned to this project`);
        preview.compatibility.recommendations.push('Consider using conflict resolution strategy');
      }

      if (preview.summary.missing_resources > 0) {
        preview.compatibility.warnings.push(`${preview.summary.missing_resources} resources not found`);
        preview.compatibility.recommendations.push('Verify resource IDs and ensure resources are active');
      }

      if (preview.summary.critical_dependencies > 0) {
        preview.compatibility.warnings.push(`${preview.summary.critical_dependencies} critical dependencies are missing`);
        preview.compatibility.recommendations.push('Import missing dependencies first');
      }

      return preview;

    } catch (error) {
      throw new Error(`Import preview failed: ${error.message}`);
    }
  }

  /**
   * Verify that a resource exists and is active
   * @private
   * @param {string} resourceType - Type of resource
   * @param {string} resourceId - Resource ID
   */
  async _verifyResourceExists(resourceType, resourceId) {
    let table, condition;
    
    switch (resourceType) {
      case 'agent':
        table = 'agents';
        condition = 'is_active = 1';
        break;
      case 'rule':
        table = 'agent_rules';
        condition = 'is_active = 1';
        break;
      case 'hook':
        table = 'hooks';
        condition = 'is_enabled = 1';
        break;
      default:
        throw new Error(`Invalid resource type: ${resourceType}`);
    }

    const resource = await this.db.prepare(
      `SELECT id FROM ${table} WHERE id = ? AND ${condition}`
    ).bind(resourceId).first();

    if (!resource) {
      throw new Error(`${resourceType} not found or not active`);
    }
  }

  /**
   * Analyze implicit dependencies based on resource content
   * @private
   * @param {string} resourceType - Type of resource
   * @param {string} resourceId - Resource ID
   * @returns {Array} - Array of implicit dependencies
   */
  async _analyzeImplicitDependencies(resourceType, resourceId) {
    // This is a placeholder for more sophisticated dependency analysis
    // In a real implementation, this could analyze:
    // - Agent system prompts for references to rules or other agents
    // - Rule content for references to other rules or hooks
    // - Hook commands for dependencies on other resources
    
    try {
      const implicitDeps = [];
      
      // Basic analysis based on resource type
      if (resourceType === 'agent') {
        // Check if agent references any rules in its system prompt
        const agent = await this.db.prepare('SELECT system_prompt FROM agents WHERE id = ?')
          .bind(resourceId).first();
        
        if (agent && agent.system_prompt) {
          // Simple pattern matching for rule references
          const ruleMatches = agent.system_prompt.match(/rule[:\s]+([a-zA-Z0-9-_]+)/gi);
          if (ruleMatches) {
            for (const match of ruleMatches) {
              const ruleId = match.split(/[:\s]+/)[1];
              if (ruleId) {
                implicitDeps.push({
                  resource_type: 'rule',
                  resource_id: ruleId,
                  dependency_type: 'references',
                  dependency_reason: 'Referenced in agent system prompt',
                  is_critical: false,
                  exists: true // Will be verified by caller
                });
              }
            }
          }
        }
      }

      return implicitDeps;
    } catch (error) {
      console.error('Error analyzing implicit dependencies:', error);
      return [];
    }
  }

  /**
   * Calculate compatibility score for a resource
   * @private
   * @param {Object} resourcePreview - Resource preview data
   * @returns {number} - Compatibility score (0-1)
   */
  _calculateCompatibilityScore(resourcePreview) {
    let score = 0.5; // Base score

    if (resourcePreview.exists) {
      score += 0.3;
    }

    if (!resourcePreview.already_assigned) {
      score += 0.2;
    }

    // Reduce score for missing critical dependencies
    const criticalMissing = resourcePreview.dependencies.filter(d => d.is_critical && !d.exists);
    score -= criticalMissing.length * 0.1;

    return Math.max(0, Math.min(1, score));
  }
}

// ============================================
// RESOURCE MANAGER CLASS
// ============================================

/**
 * ResourceManager - Handles resource assignment and management for projects
 * Implements requirements 2.3, 2.4, 3.2, 3.3
 */
class ResourceManager {
  constructor(db, errorHandler = null, transactionManager = null) {
    this.db = db;
    this.errorHandler = errorHandler || new ErrorHandler();
    this.transactionManager = transactionManager || new TransactionManager(db, this.errorHandler);
  }

  /**
   * Assign a resource to a project with transaction support and update propagation
   * @param {number} projectId - Project ID
   * @param {string} resourceType - Type of resource ('agent', 'rule', 'hook')
   * @param {string} resourceId - Resource ID
   * @param {Object} options - Assignment options
   * @returns {Object} - Assignment result
   */
  async assignResource(projectId, resourceType, resourceId, options = {}) {
    try {
      return await this.transactionManager.executeTransaction(async (db) => {
        const {
          isPrimary = false,
          assignmentOrder = 0,
          configOverrides = null,
          assignedBy = null,
          assignmentReason = null
        } = options;

        // Validate resource type
        const validTypes = ['agent', 'rule', 'hook'];
        if (!validTypes.includes(resourceType)) {
          throw new ValidationError(
            `Invalid resource type. Must be one of: ${validTypes.join(', ')}`,
            'resourceType',
            resourceType,
            { validValues: validTypes }
          );
        }

        // Verify project exists
        const project = await db.prepare('SELECT id FROM projects WHERE id = ?').bind(projectId).first();
        if (!project) {
          throw new ResourceNotFoundError('project', projectId);
        }

        // Verify resource exists based on type
        await this._verifyResourceExists(resourceType, resourceId, db);

        // Check for existing assignment
        const existingAssignment = await db.prepare(`
          SELECT id FROM project_resources 
          WHERE project_id = ? AND resource_type = ? AND resource_id = ?
        `).bind(projectId, resourceType, resourceId).first();

        if (existingAssignment) {
          throw new ConflictError(
            'Resource is already assigned to this project',
            'duplicate_assignment',
            existingAssignment,
            {
              projectId,
              resourceType,
              resourceId,
              existingAssignmentId: existingAssignment.id
            }
          );
        }

        // If setting as primary, clear other primary flags for this resource type
        if (isPrimary) {
          const clearPrimaryResult = await db.prepare(
            'UPDATE project_resources SET is_primary = 0 WHERE project_id = ? AND resource_type = ?'
          ).bind(projectId, resourceType).run();

          // Log the update propagation
          if (clearPrimaryResult.meta?.changes > 0 || clearPrimaryResult.changes > 0) {
            console.log(`Cleared primary flag for ${clearPrimaryResult.meta?.changes || clearPrimaryResult.changes} existing ${resourceType}(s) in project ${projectId}`);
          }
        }

        const assignmentId = generateId();
        const result = await db.prepare(`
          INSERT INTO project_resources (
            id, project_id, resource_type, resource_id, is_primary, 
            assignment_order, config_overrides, assigned_by, assignment_reason
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          assignmentId, projectId, resourceType, resourceId, isPrimary ? 1 : 0,
          assignmentOrder, configOverrides ? JSON.stringify(configOverrides) : null,
          assignedBy, assignmentReason
        ).run();

        if (!result.success) {
          throw new SystemError('Failed to assign resource', 'DATABASE_ERROR', {
            assignmentId,
            projectId,
            resourceType,
            resourceId
          });
        }

        // Propagate updates to related projects if this resource is shared
        await this._propagateResourceUpdates(resourceType, resourceId, db);

        return await this.getResourceAssignment(assignmentId);
      });
    } catch (error) {
      // Re-throw custom errors as-is
      if (error instanceof SystemError) {
        throw error;
      }
      
      // Wrap unexpected errors
      const errorResponse = this.errorHandler.handleError(error, {
        operation: 'assignResource',
        projectId,
        resourceType,
        resourceId
      });
      throw new SystemError(
        errorResponse.error.message,
        errorResponse.error.code,
        { projectId, resourceType, resourceId, originalError: error.message }
      );
    }
  }

  /**
   * Unassign a resource from a project
   * @param {number} projectId - Project ID
   * @param {string} resourceType - Type of resource
   * @param {string} resourceId - Resource ID
   * @returns {boolean} - Success status
   */
  async unassignResource(projectId, resourceType, resourceId) {
    const result = await this.db.prepare(`
      DELETE FROM project_resources 
      WHERE project_id = ? AND resource_type = ? AND resource_id = ?
    `).bind(projectId, resourceType, resourceId).run();

    return result.success && (result.meta?.changes > 0 || result.changes > 0);
  }

  /**
   * Get available resources for import (not assigned to current project)
   * @param {number} projectId - Project ID to exclude from results
   * @param {string} resourceType - Type of resource to get
   * @returns {Array} - Available resources
   */
  async getAvailableResources(projectId, resourceType = null) {
    const validTypes = ['agent', 'rule', 'hook'];
    
    if (resourceType && !validTypes.includes(resourceType)) {
      throw new Error(`Invalid resource type. Must be one of: ${validTypes.join(', ')}`);
    }

    const resources = [];

    // Get agents if requested or no specific type
    if (!resourceType || resourceType === 'agent') {
      const agents = await this.db.prepare(`
        SELECT 'agent' as resource_type, a.id as resource_id, a.name, a.role, a.description, 
               CASE WHEN pr.resource_id IS NOT NULL THEN 1 ELSE 0 END as is_assigned
        FROM agents a
        LEFT JOIN project_resources pr ON pr.resource_type = 'agent' 
          AND pr.resource_id = a.id AND pr.project_id = ?
        WHERE a.is_active = 1
        ORDER BY a.name
      `).bind(projectId).all();
      
      resources.push(...agents.results);
    }

    // Get rules if requested or no specific type
    if (!resourceType || resourceType === 'rule') {
      const rules = await this.db.prepare(`
        SELECT 'rule' as resource_type, ar.id as resource_id, ar.name, ar.description, ar.category,
               CASE WHEN pr.resource_id IS NOT NULL THEN 1 ELSE 0 END as is_assigned
        FROM agent_rules ar
        LEFT JOIN project_resources pr ON pr.resource_type = 'rule' 
          AND pr.resource_id = ar.id AND pr.project_id = ?
        WHERE ar.is_active = 1
        ORDER BY ar.name
      `).bind(projectId).all();
      
      resources.push(...rules.results);
    }

    // Get hooks if requested or no specific type
    if (!resourceType || resourceType === 'hook') {
      const hooks = await this.db.prepare(`
        SELECT 'hook' as resource_type, h.id as resource_id, h.name, h.description, h.hook_type,
               CASE WHEN pr.resource_id IS NOT NULL THEN 1 ELSE 0 END as is_assigned
        FROM hooks h
        LEFT JOIN project_resources pr ON pr.resource_type = 'hook' 
          AND pr.resource_id = h.id AND pr.project_id = ?
        WHERE h.is_enabled = 1
        ORDER BY h.name
      `).bind(projectId).all();
      
      resources.push(...hooks.results);
    }

    return resources;
  }

  /**
   * Get all resources assigned to a project
   * @param {number} projectId - Project ID
   * @param {string} resourceType - Optional resource type filter
   * @returns {Array} - Assigned resources with details
   */
  async getProjectResources(projectId, resourceType = null) {
    let whereClause = 'WHERE pr.project_id = ?';
    const params = [projectId];

    if (resourceType) {
      whereClause += ' AND pr.resource_type = ?';
      params.push(resourceType);
    }

    const assignments = await this.db.prepare(`
      SELECT pr.*, 
             CASE pr.resource_type
               WHEN 'agent' THEN a.name
               WHEN 'rule' THEN ar.name
               WHEN 'hook' THEN h.name
             END as resource_name,
             CASE pr.resource_type
               WHEN 'agent' THEN a.description
               WHEN 'rule' THEN ar.description
               WHEN 'hook' THEN h.description
             END as resource_description,
             CASE pr.resource_type
               WHEN 'agent' THEN a.role
               WHEN 'rule' THEN ar.category
               WHEN 'hook' THEN h.hook_type
             END as resource_metadata
      FROM project_resources pr
      LEFT JOIN agents a ON pr.resource_type = 'agent' AND pr.resource_id = a.id
      LEFT JOIN agent_rules ar ON pr.resource_type = 'rule' AND pr.resource_id = ar.id
      LEFT JOIN hooks h ON pr.resource_type = 'hook' AND pr.resource_id = h.id
      ${whereClause}
      ORDER BY pr.resource_type, pr.assignment_order, pr.created_at
    `).bind(...params).all();

    return assignments.results.map(assignment => ({
      ...assignment,
      config_overrides: assignment.config_overrides ? JSON.parse(assignment.config_overrides) : null,
      is_primary: Boolean(assignment.is_primary)
    }));
  }

  /**
   * Get a specific resource assignment
   * @param {number} assignmentId - Assignment ID
   * @returns {Object|null} - Assignment details
   */
  async getResourceAssignment(assignmentId) {
    const assignment = await this.db.prepare(`
      SELECT pr.*, 
             CASE pr.resource_type
               WHEN 'agent' THEN a.name
               WHEN 'rule' THEN ar.name
               WHEN 'hook' THEN h.name
             END as resource_name,
             CASE pr.resource_type
               WHEN 'agent' THEN a.description
               WHEN 'rule' THEN ar.description
               WHEN 'hook' THEN h.description
             END as resource_description
      FROM project_resources pr
      LEFT JOIN agents a ON pr.resource_type = 'agent' AND pr.resource_id = a.id
      LEFT JOIN agent_rules ar ON pr.resource_type = 'rule' AND pr.resource_id = ar.id
      LEFT JOIN hooks h ON pr.resource_type = 'hook' AND pr.resource_id = h.id
      WHERE pr.id = ?
    `).bind(assignmentId).first();

    if (!assignment) {
      return null;
    }

    return {
      ...assignment,
      config_overrides: assignment.config_overrides ? JSON.parse(assignment.config_overrides) : null,
      is_primary: Boolean(assignment.is_primary)
    };
  }

  /**
   * Update resource assignment configuration
   * @param {number} assignmentId - Assignment ID
   * @param {Object} updates - Updates to apply
   * @returns {Object} - Updated assignment
   */
  async updateResourceAssignment(assignmentId, updates) {
    const {
      isPrimary,
      assignmentOrder,
      configOverrides,
      assignmentReason
    } = updates;

    const existing = await this.getResourceAssignment(assignmentId);
    if (!existing) {
      throw new Error('Resource assignment not found');
    }

    // If setting as primary, clear other primary flags for this resource type
    if (isPrimary) {
      await this.db.prepare(
        'UPDATE project_resources SET is_primary = 0 WHERE project_id = ? AND resource_type = ? AND id != ?'
      ).bind(existing.project_id, existing.resource_type, assignmentId).run();
    }

    const updateFields = [];
    const values = [];

    if (isPrimary !== undefined) {
      updateFields.push('is_primary = ?');
      values.push(isPrimary ? 1 : 0);
    }

    if (assignmentOrder !== undefined) {
      updateFields.push('assignment_order = ?');
      values.push(assignmentOrder);
    }

    if (configOverrides !== undefined) {
      updateFields.push('config_overrides = ?');
      values.push(configOverrides ? JSON.stringify(configOverrides) : null);
    }

    if (assignmentReason !== undefined) {
      updateFields.push('assignment_reason = ?');
      values.push(assignmentReason);
    }

    if (updateFields.length === 0) {
      return existing;
    }

    values.push(assignmentId);

    await this.db.prepare(`
      UPDATE project_resources SET ${updateFields.join(', ')} WHERE id = ?
    `).bind(...values).run();

    return await this.getResourceAssignment(assignmentId);
  }

  /**
   * Verify that a resource exists based on its type
   * @private
   * @param {string} resourceType - Type of resource
   * @param {string} resourceId - Resource ID
   * @param {Object} db - Database connection (for transaction support)
   */
  async _verifyResourceExists(resourceType, resourceId, db = null) {
    const database = db || this.db;
    let table, condition;
    
    switch (resourceType) {
      case 'agent':
        table = 'agents';
        condition = 'is_active = 1';
        break;
      case 'rule':
        table = 'agent_rules';
        condition = 'is_active = 1';
        break;
      case 'hook':
        table = 'hooks';
        condition = 'is_enabled = 1';
        break;
      default:
        throw new ValidationError(`Invalid resource type: ${resourceType}`, 'resourceType', resourceType);
    }

    const resource = await database.prepare(
      `SELECT id FROM ${table} WHERE id = ? AND ${condition}`
    ).bind(resourceId).first();

    if (!resource) {
      throw new ResourceNotFoundError(resourceType, resourceId, {
        table,
        condition,
        suggestion: `Verify the ${resourceType} ID and ensure it is active/enabled`
      });
    }
  }

  /**
   * Propagate resource updates to all projects that use this resource
   * @private
   * @param {string} resourceType - Type of resource
   * @param {string} resourceId - Resource ID
   * @param {Object} db - Database connection (for transaction support)
   */
  async _propagateResourceUpdates(resourceType, resourceId, db = null) {
    const database = db || this.db;
    
    try {
      // Get all projects that use this resource
      const affectedProjects = await database.prepare(`
        SELECT DISTINCT project_id, COUNT(*) as assignment_count
        FROM project_resources 
        WHERE resource_type = ? AND resource_id = ?
        GROUP BY project_id
      `).bind(resourceType, resourceId).all();

      if (affectedProjects.results.length > 1) {
        // Resource is shared across multiple projects
        console.log(`Resource ${resourceType}:${resourceId} is now shared across ${affectedProjects.results.length} projects`);
        
        // Update the updated_at timestamp for all affected project assignments
        const updateResult = await database.prepare(`
          UPDATE project_resources 
          SET updated_at = CURRENT_TIMESTAMP 
          WHERE resource_type = ? AND resource_id = ?
        `).bind(resourceType, resourceId).run();

        console.log(`Updated ${updateResult.meta?.changes || updateResult.changes || 0} project assignments for resource propagation`);
      }
    } catch (error) {
      // Log the error but don't fail the main operation
      console.warn(`Failed to propagate resource updates for ${resourceType}:${resourceId}:`, error.message);
    }
  }
}

// ============================================
// AI ENHANCEMENT ENGINE CLASS
// ============================================

/**
 * AIEnhancementEngine - Provides AI-powered contextual suggestions for resource creation
 * Implements requirements 2.1, 2.2, 4.1, 4.2, 4.3
 */
class AIEnhancementEngine {
  constructor(ai, db) {
    this.ai = ai;
    this.db = db;
  }

  /**
   * Enhance resource creation with AI-powered suggestions
   * @param {string} resourceType - Type of resource ('agent', 'rule', 'hook')
   * @param {Object} projectContext - Project context information
   * @param {Object} resourceData - Partial resource data for enhancement
   * @returns {Object} - Enhanced resource suggestions
   */
  async enhanceResourceCreation(resourceType, projectContext, resourceData = {}) {
    if (!this.ai) {
      throw new Error('AI service not available');
    }

    const validTypes = ['agent', 'rule', 'hook'];
    if (!validTypes.includes(resourceType)) {
      throw new Error(`Invalid resource type. Must be one of: ${validTypes.join(', ')}`);
    }

    try {
      const contextPrompt = await this.buildContextPrompt(projectContext, resourceType);
      const enhancementPrompt = this._buildEnhancementPrompt(resourceType, resourceData, contextPrompt);

      const response = await this.ai.run("@cf/meta/llama-3.1-8b-instruct", {
        messages: [
          {
            role: "system",
            content: this._getSystemPrompt(resourceType)
          },
          {
            role: "user",
            content: enhancementPrompt
          }
        ],
        max_tokens: 2048,
        temperature: 0.3,
      });

      return this._parseEnhancementResponse(response.response, resourceType);
    } catch (error) {
      // Provide fallback suggestions when AI fails
      return this._getFallbackSuggestions(resourceType, resourceData);
    }
  }

  /**
   * Build context prompt from project data
   * @param {Object} projectContext - Project context information
   * @param {string} resourceType - Type of resource being created
   * @returns {string} - Formatted context prompt
   */
  async buildContextPrompt(projectContext, resourceType) {
    if (!projectContext || !projectContext.projectId) {
      return "No project context available.";
    }

    try {
      // Get project details
      const project = await this.db.prepare('SELECT * FROM projects WHERE id = ?')
        .bind(projectContext.projectId).first();

      if (!project) {
        return "Project not found.";
      }

      // Get existing resources of the same type
      const existingResources = await this._getExistingResources(projectContext.projectId, resourceType);

      // Build context string
      let context = `Project: ${project.name}\n`;
      if (project.description) {
        context += `Description: ${project.description}\n`;
      }
      if (project.category) {
        context += `Category: ${project.category}\n`;
      }
      if (project.ai_context_summary) {
        context += `AI Context: ${project.ai_context_summary}\n`;
      }

      if (existingResources.length > 0) {
        context += `\nExisting ${resourceType}s in project:\n`;
        existingResources.forEach((resource, index) => {
          context += `${index + 1}. ${resource.name || resource.title}: ${resource.description || 'No description'}\n`;
        });
      }

      return context;
    } catch (error) {
      console.error('Error building context prompt:', error);
      return `Project ID: ${projectContext.projectId} (context unavailable)`;
    }
  }

  /**
   * Validate resource compatibility using AI
   * @param {string} resourceType - Type of resource
   * @param {Object} resourceData - Resource data to validate
   * @param {Object} projectContext - Project context
   * @returns {Object} - Compatibility validation result
   */
  async validateResourceCompatibility(resourceType, resourceData, projectContext) {
    if (!this.ai) {
      return {
        isCompatible: true,
        confidence: 0.5,
        warnings: ['AI validation unavailable'],
        suggestions: []
      };
    }

    try {
      const contextPrompt = await this.buildContextPrompt(projectContext, resourceType);
      const validationPrompt = this._buildValidationPrompt(resourceType, resourceData, contextPrompt);

      const response = await this.ai.run("@cf/meta/llama-3.1-8b-instruct", {
        messages: [
          {
            role: "system",
            content: "You are an expert at validating Claude Code project resources for compatibility and best practices. Analyze the resource and provide compatibility assessment."
          },
          {
            role: "user",
            content: validationPrompt
          }
        ],
        max_tokens: 1024,
        temperature: 0.2,
      });

      return this._parseValidationResponse(response.response);
    } catch (error) {
      console.error('AI validation failed:', error);
      return {
        isCompatible: true,
        confidence: 0.3,
        warnings: ['AI validation failed'],
        suggestions: []
      };
    }
  }

  /**
   * Get existing resources for context
   * @private
   */
  async _getExistingResources(projectId, resourceType) {
    try {
      let query, table;
      
      switch (resourceType) {
        case 'agent':
          table = 'agents';
          query = `
            SELECT a.name, a.description, a.role 
            FROM agents a
            JOIN project_resources pr ON pr.resource_id = a.id 
            WHERE pr.project_id = ? AND pr.resource_type = 'agent' AND a.is_active = 1
          `;
          break;
        case 'rule':
          table = 'agent_rules';
          query = `
            SELECT ar.name, ar.description, ar.category 
            FROM agent_rules ar
            JOIN project_resources pr ON pr.resource_id = ar.id 
            WHERE pr.project_id = ? AND pr.resource_type = 'rule' AND ar.is_active = 1
          `;
          break;
        case 'hook':
          table = 'hooks';
          query = `
            SELECT h.name, h.description, h.hook_type 
            FROM hooks h
            JOIN project_resources pr ON pr.resource_id = h.id 
            WHERE pr.project_id = ? AND pr.resource_type = 'hook' AND h.is_enabled = 1
          `;
          break;
        default:
          return [];
      }

      const result = await this.db.prepare(query).bind(projectId).all();
      return result.results || [];
    } catch (error) {
      console.error('Error getting existing resources:', error);
      return [];
    }
  }

  /**
   * Build enhancement prompt for AI
   * @private
   */
  _buildEnhancementPrompt(resourceType, resourceData, contextPrompt) {
    const basePrompt = `Project Context:\n${contextPrompt}\n\n`;
    
    switch (resourceType) {
      case 'agent':
        return basePrompt + `Suggest an AI agent for this project. ${resourceData.name ? `Name: ${resourceData.name}` : ''} ${resourceData.role ? `Role: ${resourceData.role}` : ''}\n\nProvide suggestions for name, role, description, and system prompt that would be helpful for this project context.`;
      
      case 'rule':
        return basePrompt + `Suggest a development rule for this project. ${resourceData.name ? `Name: ${resourceData.name}` : ''} ${resourceData.category ? `Category: ${resourceData.category}` : ''}\n\nProvide suggestions for name, description, and rule content that would be valuable for this project.`;
      
      case 'hook':
        return basePrompt + `Suggest an automation hook for this project. ${resourceData.name ? `Name: ${resourceData.name}` : ''} ${resourceData.hook_type ? `Type: ${resourceData.hook_type}` : ''}\n\nProvide suggestions for name, description, hook type, and command that would be useful for this project workflow.`;
      
      default:
        return basePrompt + `Suggest a ${resourceType} for this project context.`;
    }
  }

  /**
   * Build validation prompt for AI
   * @private
   */
  _buildValidationPrompt(resourceType, resourceData, contextPrompt) {
    return 'Project Context:\n' + contextPrompt + '\n\nResource to validate:\nType: ' + resourceType + 
           '\nData: ' + JSON.stringify(resourceData, null, 2) + 
           '\n\nAnalyze this resource for compatibility with the project context. Consider:\n' +
           '1. Does it fit the project\'s purpose?\n' +
           '2. Does it conflict with existing resources?\n' +
           '3. Are there any best practice violations?\n' +
           '4. What improvements could be made?\n\n' +
           'Respond with JSON format: {"isCompatible": true/false, "confidence": number between 0 and 1, "warnings": array of strings, "suggestions": array of strings}';
  }

  /**
   * Get system prompt for resource type
   * @private
   */
  _getSystemPrompt(resourceType) {
    const basePrompt = "You are an expert Claude Code project consultant. Provide practical, actionable suggestions based on the project context.";
    
    switch (resourceType) {
      case 'agent':
        return basePrompt + " Focus on creating AI agents that are well-suited for the project's development needs. Consider the project's technology stack, goals, and existing agents.";
      
      case 'rule':
        return basePrompt + " Focus on development rules that improve code quality, consistency, and team productivity. Consider the project's technology stack and existing rules.";
      
      case 'hook':
        return basePrompt + " Focus on automation hooks that streamline development workflows. Consider the project's toolchain and existing automation.";
      
      default:
        return basePrompt;
    }
  }

  /**
   * Parse AI enhancement response
   * @private
   */
  _parseEnhancementResponse(response, resourceType) {
    try {
      // Try to extract JSON if present
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          suggestions: parsed,
          confidence: 0.8,
          source: 'ai'
        };
      }
    } catch (error) {
      // Fall through to text parsing
    }

    // Parse as text and extract suggestions
    return {
      suggestions: this._extractTextSuggestions(response, resourceType),
      confidence: 0.6,
      source: 'ai_text'
    };
  }

  /**
   * Parse AI validation response
   * @private
   */
  _parseValidationResponse(response) {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      // Fall through to default
    }

    return {
      isCompatible: true,
      confidence: 0.5,
      warnings: ['Could not parse AI validation response'],
      suggestions: []
    };
  }

  /**
   * Extract suggestions from text response
   * @private
   */
  _extractTextSuggestions(response, resourceType) {
    const suggestions = {};
    
    // Basic text parsing for common patterns
    const lines = response.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.toLowerCase().includes('name:')) {
        suggestions.name = trimmed.split(':')[1]?.trim();
      } else if (trimmed.toLowerCase().includes('description:')) {
        suggestions.description = trimmed.split(':')[1]?.trim();
      } else if (resourceType === 'agent' && trimmed.toLowerCase().includes('role:')) {
        suggestions.role = trimmed.split(':')[1]?.trim();
      } else if (resourceType === 'rule' && trimmed.toLowerCase().includes('category:')) {
        suggestions.category = trimmed.split(':')[1]?.trim();
      }
    }

    return suggestions;
  }

  /**
   * Get fallback suggestions when AI is unavailable
   * @private
   */
  _getFallbackSuggestions(resourceType, resourceData) {
    const fallbacks = {
      agent: {
        name: resourceData.name || 'Project Assistant',
        role: resourceData.role || 'Development Assistant',
        description: 'AI assistant for project development tasks',
        system_prompt: 'You are a helpful development assistant for this project.'
      },
      rule: {
        name: resourceData.name || 'Code Quality Rule',
        description: 'Maintain code quality and consistency',
        rule_content: 'Follow established coding standards and best practices.',
        category: resourceData.category || 'general'
      },
      hook: {
        name: resourceData.name || 'Development Hook',
        description: 'Automation hook for development workflow',
        hook_type: resourceData.hook_type || 'PreToolUse',
        command: 'echo "Hook executed"'
      }
    };

    return {
      suggestions: fallbacks[resourceType] || {},
      confidence: 0.3,
      source: 'fallback'
    };
  }
}

// ============================================
// CLAUDE CODE EXPORTER CLASS
// ============================================

/**
 * ClaudeCodeExporter - Generates complete Claude Code project structures
 * Implements requirements 5.1, 5.2, 5.3, 5.4, 5.5
 */
class ClaudeCodeExporter {
  constructor(db) {
    this.db = db;
  }

  /**
   * Generate complete Claude Code project structure
   * @param {number} projectId - Project ID to export
   * @param {Object} options - Export options
   * @returns {Object} - Complete project structure with all files
   */
  async generateProjectStructure(projectId, options = {}) {
    const {
      includeAgents = true,
      includeRules = true,
      includeHooks = true,
      includeProjectSettings = true,
      includeClaudeMD = true,
      format = 'files' // 'files' or 'zip'
    } = options;

    // Get project details
    const project = await this._getProjectDetails(projectId);
    if (!project) {
      throw new Error('Project not found');
    }

    // Get all assigned resources
    const resources = await this._getProjectResources(projectId);

    // Validate required components using comprehensive validation
    const validator = new ProjectValidator(this.db);
    const validationResult = await validator.validateExportRequirements(project, resources);
    
    if (!validationResult.isValid) {
      throw new Error(`Export validation failed: ${validationResult.errors.join(', ')}`);
    }
    
    // Log warnings for user awareness
    if (validationResult.warnings.length > 0) {
      console.warn('Export validation warnings:', validationResult.warnings);
    }

    const structure = {
      project,
      files: {},
      metadata: {
        exportedAt: new Date().toISOString(),
        projectId,
        projectName: project.name,
        projectSlug: project.slug,
        totalFiles: 0,
        includedComponents: {
          agents: includeAgents,
          rules: includeRules,
          hooks: includeHooks,
          projectSettings: includeProjectSettings,
          claudeMD: includeClaudeMD
        }
      }
    };

    try {
      // Generate CLAUDE.md file
      if (includeClaudeMD) {
        structure.files['CLAUDE.md'] = await this.generateClaudeMD(project, resources);
        structure.metadata.totalFiles++;
      }

      // Generate .claude/project_settings.json
      if (includeProjectSettings) {
        structure.files['.claude/project_settings.json'] = await this.generateProjectSettings(project, resources);
        structure.metadata.totalFiles++;
      }

      // Generate individual agent files
      if (includeAgents) {
        const agentFiles = await this.generateAgentFiles(resources.agents || []);
        Object.assign(structure.files, agentFiles);
        structure.metadata.totalFiles += Object.keys(agentFiles).length;
      }

      // Generate rules file
      if (includeRules) {
        const rulesFile = await this.generateRulesFile(resources.rules || []);
        if (rulesFile) {
          structure.files['.claude/rules.md'] = rulesFile;
          structure.metadata.totalFiles++;
        }
      }

      // Generate hooks files
      if (includeHooks) {
        const hookFiles = await this.generateHookFiles(resources.hooks || []);
        Object.assign(structure.files, hookFiles);
        structure.metadata.totalFiles += Object.keys(hookFiles).length;
      }

      return structure;

    } catch (error) {
      throw new Error(`Export generation failed: ${error.message}`);
    }
  }

  /**
   * Generate CLAUDE.md file with project documentation
   * @param {Object} project - Project details
   * @param {Object} resources - Project resources
   * @returns {string} - CLAUDE.md content
   */
  async generateClaudeMD(project, resources) {
    const agents = resources.agents || [];
    const rules = resources.rules || [];
    const hooks = resources.hooks || [];

    let content = `# ${project.name}\n\n`;

    if (project.description) {
      content += `${project.description}\n\n`;
    }

    // Project information
    if (project.project_info) {
      content += `## Project Information\n\n${project.project_info}\n\n`;
    }

    // Project metadata
    content += `## Project Details\n\n`;
    content += `- **Status**: ${project.status}\n`;
    content += `- **Priority**: ${project.priority}\n`;
    if (project.category) {
      content += `- **Category**: ${project.category}\n`;
    }
    if (project.tags && project.tags.length > 0) {
      content += `- **Tags**: ${project.tags.join(', ')}\n`;
    }
    content += `- **Created**: ${new Date(project.created_at).toLocaleDateString()}\n`;
    content += `- **Last Updated**: ${new Date(project.updated_at).toLocaleDateString()}\n\n`;

    // AI Context Summary
    if (project.ai_context_summary) {
      content += `## AI Context\n\n${project.ai_context_summary}\n\n`;
    }

    // Agents section
    if (agents.length > 0) {
      content += `## Agents\n\n`;
      content += `This project includes ${agents.length} specialized agent${agents.length > 1 ? 's' : ''}:\n\n`;
      
      agents.forEach(agent => {
        content += `### ${agent.name}\n`;
        if (agent.role) {
          content += `**Role**: ${agent.role}\n\n`;
        }
        if (agent.description) {
          content += `${agent.description}\n\n`;
        }
        if (agent.is_primary) {
          content += `*This is the primary agent for this project.*\n\n`;
        }
      });
    }

    // Rules section
    if (rules.length > 0) {
      content += `## Development Rules\n\n`;
      content += `This project follows ${rules.length} development rule${rules.length > 1 ? 's' : ''}:\n\n`;
      
      rules.forEach(rule => {
        content += `### ${rule.name}\n`;
        if (rule.category) {
          content += `**Category**: ${rule.category}\n\n`;
        }
        if (rule.description) {
          content += `${rule.description}\n\n`;
        }
      });
    }

    // Hooks section
    if (hooks.length > 0) {
      content += `## Automation Hooks\n\n`;
      content += `This project includes ${hooks.length} automation hook${hooks.length > 1 ? 's' : ''}:\n\n`;
      
      hooks.forEach(hook => {
        content += `### ${hook.name}\n`;
        content += `**Type**: ${hook.hook_type}\n\n`;
        if (hook.description) {
          content += `${hook.description}\n\n`;
        }
      });
    }

    // Setup instructions
    content += `## Setup Instructions\n\n`;
    content += `1. Extract this project structure to your development directory\n`;
    content += `2. Open the project in Claude Code\n`;
    content += `3. The agents, rules, and hooks will be automatically loaded\n`;
    if (agents.length > 0) {
      const primaryAgent = agents.find(a => a.is_primary);
      if (primaryAgent) {
        content += `4. Start with the primary agent: **${primaryAgent.name}**\n`;
      }
    }
    content += `\n`;

    // Usage notes
    content += `## Usage Notes\n\n`;
    content += `- All project resources are configured and ready to use\n`;
    content += `- Agents are available in the .claude/agents/ directory\n`;
    if (rules.length > 0) {
      content += `- Development rules are defined in .claude/rules.md\n`;
    }
    if (hooks.length > 0) {
      content += `- Automation hooks are configured for this project\n`;
    }
    content += `- Project settings are configured in .claude/project_settings.json\n\n`;

    content += `---\n\n`;
    content += `*This project was exported from Semantic Prompt Workstation on ${new Date().toLocaleDateString()}*\n`;

    return content;
  }

  /**
   * Generate .claude/project_settings.json
   * @param {Object} project - Project details
   * @param {Object} resources - Project resources
   * @returns {string} - JSON content for project settings
   */
  async generateProjectSettings(project, resources) {
    const agents = resources.agents || [];
    const rules = resources.rules || [];
    const hooks = resources.hooks || [];

    const settings = {
      name: project.name,
      description: project.description || '',
      version: '1.0.0',
      
      // Agent configuration
      agents: agents.map(agent => ({
        id: agent.resource_id,
        name: agent.name,
        role: agent.role || '',
        isPrimary: Boolean(agent.is_primary),
        file: `.claude/agents/${this._sanitizeFilename(agent.name)}.md`,
        config: agent.config_overrides ? JSON.parse(agent.config_overrides) : {}
      })),

      // Rules configuration
      rules: {
        enabled: rules.length > 0,
        file: rules.length > 0 ? '.claude/rules.md' : null,
        categories: [...new Set(rules.map(r => r.category).filter(Boolean))]
      },

      // Hooks configuration
      hooks: hooks.map(hook => ({
        id: hook.resource_id,
        name: hook.name,
        type: hook.hook_type,
        enabled: Boolean(hook.is_enabled),
        command: hook.command || '',
        workingDirectory: hook.working_directory || null,
        timeout: hook.timeout_ms || 60000,
        toolMatcher: hook.tool_matcher ? JSON.parse(hook.tool_matcher) : null,
        sortOrder: hook.sort_order || 0
      })),

      // Project metadata
      metadata: {
        projectId: project.id,
        slug: project.slug,
        status: project.status,
        priority: project.priority,
        category: project.category || null,
        tags: project.tags || [],
        createdAt: project.created_at,
        updatedAt: project.updated_at,
        exportedAt: new Date().toISOString()
      },

      // AI context
      aiContext: {
        summary: project.ai_context_summary || '',
        includeInContext: Boolean(project.include_in_ai_context)
      }
    };

    return JSON.stringify(settings, null, 2);
  }

  /**
   * Generate individual agent files in .claude/agents/
   * @param {Array} agents - Array of agent resources
   * @returns {Object} - Object with filename keys and content values
   */
  async generateAgentFiles(agents) {
    const files = {};

    for (const agentResource of agents) {
      try {
        // Get full agent details
        const agent = await this.db.prepare('SELECT * FROM agents WHERE id = ?')
          .bind(agentResource.resource_id).first();

        if (!agent) {
          console.warn(`Agent ${agentResource.resource_id} not found`);
          continue;
        }

        const filename = `.claude/agents/${this._sanitizeFilename(agent.name)}.md`;
        
        let content = `# ${agent.name}\n\n`;
        
        if (agent.role) {
          content += `**Role**: ${agent.role}\n\n`;
        }

        if (agent.description) {
          content += `## Description\n\n${agent.description}\n\n`;
        }

        if (agent.style) {
          content += `## Style\n\n${agent.style}\n\n`;
        }

        // System prompt is the main content
        if (agent.system_prompt) {
          content += `## System Prompt\n\n${agent.system_prompt}\n\n`;
        }

        // Add project-specific configuration if any
        if (agentResource.config_overrides) {
          const config = JSON.parse(agentResource.config_overrides);
          content += `## Project Configuration\n\n`;
          content += `\`\`\`json\n${JSON.stringify(config, null, 2)}\n\`\`\`\n\n`;
        }

        if (agentResource.is_primary) {
          content += `---\n\n*This is the primary agent for this project.*\n`;
        }

        files[filename] = content;

      } catch (error) {
        console.error(`Error generating agent file for ${agentResource.resource_id}:`, error);
      }
    }

    return files;
  }

  /**
   * Generate .claude/rules.md file
   * @param {Array} rules - Array of rule resources
   * @returns {string|null} - Rules file content or null if no rules
   */
  async generateRulesFile(rules) {
    if (!rules || rules.length === 0) {
      return null;
    }

    let content = `# Development Rules\n\n`;
    content += `This document contains the development rules and guidelines for this project.\n\n`;

    // Group rules by category
    const rulesByCategory = {};
    const rulesWithDetails = [];

    for (const ruleResource of rules) {
      try {
        const rule = await this.db.prepare('SELECT * FROM agent_rules WHERE id = ?')
          .bind(ruleResource.resource_id).first();

        if (rule) {
          rulesWithDetails.push(rule);
          const category = rule.category || 'General';
          if (!rulesByCategory[category]) {
            rulesByCategory[category] = [];
          }
          rulesByCategory[category].push(rule);
        }
      } catch (error) {
        console.error(`Error loading rule ${ruleResource.resource_id}:`, error);
      }
    }

    // Generate content by category
    const categories = Object.keys(rulesByCategory).sort();
    
    for (const category of categories) {
      content += `## ${category}\n\n`;
      
      const categoryRules = rulesByCategory[category].sort((a, b) => (b.priority || 0) - (a.priority || 0));
      
      for (const rule of categoryRules) {
        content += `### ${rule.name}\n\n`;
        
        if (rule.description) {
          content += `${rule.description}\n\n`;
        }

        if (rule.rule_content) {
          content += `${rule.rule_content}\n\n`;
        }

        if (rule.priority && rule.priority > 0) {
          content += `*Priority: ${rule.priority}*\n\n`;
        }
      }
    }

    content += `---\n\n`;
    content += `*Generated from ${rulesWithDetails.length} rule${rulesWithDetails.length > 1 ? 's' : ''} on ${new Date().toLocaleDateString()}*\n`;

    return content;
  }

  /**
   * Generate hook files and configurations
   * @param {Array} hooks - Array of hook resources
   * @returns {Object} - Object with hook configuration files
   */
  async generateHookFiles(hooks) {
    const files = {};

    if (!hooks || hooks.length === 0) {
      return files;
    }

    // Generate hooks configuration file
    const hooksConfig = {
      hooks: []
    };

    for (const hookResource of hooks) {
      try {
        const hook = await this.db.prepare('SELECT * FROM hooks WHERE id = ?')
          .bind(hookResource.resource_id).first();

        if (!hook) {
          console.warn(`Hook ${hookResource.resource_id} not found`);
          continue;
        }

        const hookConfig = {
          name: hook.name,
          description: hook.description || '',
          type: hook.hook_type,
          enabled: Boolean(hook.is_enabled),
          command: hook.command,
          workingDirectory: hook.working_directory || null,
          timeout: hook.timeout_ms || 60000,
          sortOrder: hook.sort_order || 0
        };

        if (hook.tool_matcher) {
          try {
            hookConfig.toolMatcher = JSON.parse(hook.tool_matcher);
          } catch (e) {
            hookConfig.toolMatcher = hook.tool_matcher;
          }
        }

        hooksConfig.hooks.push(hookConfig);

      } catch (error) {
        console.error(`Error loading hook ${hookResource.resource_id}:`, error);
      }
    }

    // Sort hooks by sort order
    hooksConfig.hooks.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

    // Generate hooks.json file
    files['.claude/hooks.json'] = JSON.stringify(hooksConfig, null, 2);

    // Generate individual hook documentation
    let hooksDoc = `# Project Hooks\n\n`;
    hooksDoc += `This project includes ${hooksConfig.hooks.length} automation hook${hooksConfig.hooks.length > 1 ? 's' : ''}.\n\n`;

    for (const hook of hooksConfig.hooks) {
      hooksDoc += `## ${hook.name}\n\n`;
      hooksDoc += `**Type**: ${hook.type}\n\n`;
      
      if (hook.description) {
        hooksDoc += `${hook.description}\n\n`;
      }

      hooksDoc += `**Command**: \`${hook.command}\`\n\n`;

      if (hook.toolMatcher) {
        hooksDoc += `**Tool Matcher**: \`${JSON.stringify(hook.toolMatcher)}\`\n\n`;
      }

      if (hook.workingDirectory) {
        hooksDoc += `**Working Directory**: \`${hook.workingDirectory}\`\n\n`;
      }

      hooksDoc += `**Timeout**: ${hook.timeout}ms\n\n`;
      hooksDoc += `**Enabled**: ${hook.enabled ? 'Yes' : 'No'}\n\n`;
    }

    files['.claude/hooks.md'] = hooksDoc;

    return files;
  }

  /**
   * Get project details
   * @private
   */
  async _getProjectDetails(projectId) {
    try {
      const project = await this.db.prepare('SELECT * FROM projects WHERE id = ?').bind(projectId).first();
      
      if (!project) {
        return null;
      }

      return {
        ...project,
        tags: project.tags ? JSON.parse(project.tags) : []
      };
    } catch (error) {
      throw new Error(`Failed to get project details: ${error.message}`);
    }
  }

  /**
   * Get all resources assigned to a project
   * @private
   */
  async _getProjectResources(projectId) {
    try {
      // Get all resource assignments
      const assignments = await this.db.prepare(`
        SELECT pr.*, 
               CASE pr.resource_type
                 WHEN 'agent' THEN a.name
                 WHEN 'rule' THEN ar.name
                 WHEN 'hook' THEN h.name
               END as name,
               CASE pr.resource_type
                 WHEN 'agent' THEN a.description
                 WHEN 'rule' THEN ar.description
                 WHEN 'hook' THEN h.description
               END as description,
               CASE pr.resource_type
                 WHEN 'agent' THEN a.role
                 WHEN 'rule' THEN ar.category
                 WHEN 'hook' THEN h.hook_type
               END as metadata
        FROM project_resources pr
        LEFT JOIN agents a ON pr.resource_type = 'agent' AND pr.resource_id = a.id
        LEFT JOIN agent_rules ar ON pr.resource_type = 'rule' AND pr.resource_id = ar.id
        LEFT JOIN hooks h ON pr.resource_type = 'hook' AND pr.resource_id = h.id
        WHERE pr.project_id = ?
        ORDER BY pr.resource_type, pr.assignment_order, pr.created_at
      `).bind(projectId).all();

      const resources = {
        agents: [],
        rules: [],
        hooks: []
      };

      for (const assignment of assignments.results) {
        const resource = {
          ...assignment,
          config_overrides: assignment.config_overrides ? JSON.parse(assignment.config_overrides) : null,
          is_primary: Boolean(assignment.is_primary)
        };

        switch (assignment.resource_type) {
          case 'agent':
            resources.agents.push(resource);
            break;
          case 'rule':
            resources.rules.push(resource);
            break;
          case 'hook':
            resources.hooks.push(resource);
            break;
        }
      }

      return resources;
    } catch (error) {
      throw new Error(`Failed to get project resources: ${error.message}`);
    }
  }

  /**
   * Validate export requirements
   * @private
   */
  async _validateExportRequirements(project, resources) {
    const warnings = [];
    const errors = [];

    // Check if project has basic information
    if (!project.name || project.name.trim().length === 0) {
      errors.push('Project must have a name');
    }

    // Check if project has any resources
    const totalResources = (resources.agents?.length || 0) + 
                          (resources.rules?.length || 0) + 
                          (resources.hooks?.length || 0);

    if (totalResources === 0) {
      warnings.push('Project has no assigned resources (agents, rules, or hooks)');
    }

    // Check for primary agent
    const primaryAgents = resources.agents?.filter(a => a.is_primary) || [];
    if (resources.agents?.length > 0 && primaryAgents.length === 0) {
      warnings.push('No primary agent assigned - consider setting one agent as primary');
    }

    if (primaryAgents.length > 1) {
      warnings.push('Multiple primary agents found - only one should be primary');
    }

    if (errors.length > 0) {
      throw new Error(`Export validation failed: ${errors.join(', ')}`);
    }

    return { warnings, errors };
  }

  /**
   * Sanitize filename for file system compatibility
   * @private
   */
  _sanitizeFilename(name) {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single
      .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
  }
}

// ============================================
// PROJECT VALIDATOR CLASS
// ============================================

/**
 * ProjectValidator - Comprehensive validation system for Claude Code compatibility
 * Implements requirements 8.1, 8.2, 8.4
 */
class ProjectValidator {
  constructor(db, errorHandler = null) {
    this.db = db;
    this.errorHandler = errorHandler || new ErrorHandler();
  }

  /**
   * Validate resource definitions against Claude Code requirements
   * @param {string} resourceType - Type of resource ('agent', 'rule', 'hook')
   * @param {Object} resourceData - Resource data to validate
   * @returns {Object} - Validation result with errors and warnings
   */
  async validateResourceDefinition(resourceType, resourceData) {
    const result = {
      isValid: true,
      errors: [],
      warnings: [],
      recommendations: []
    };

    try {
      switch (resourceType) {
        case 'agent':
          await this._validateAgentDefinition(resourceData, result);
          break;
        case 'rule':
          await this._validateRuleDefinition(resourceData, result);
          break;
        case 'hook':
          await this._validateHookDefinition(resourceData, result);
          break;
        default:
          result.errors.push(`Invalid resource type: ${resourceType}`);
          result.isValid = false;
      }

      // Check for Claude Code best practices
      this._validateClaudeCodeBestPractices(resourceType, resourceData, result);

    } catch (error) {
      result.errors.push(`Validation error: ${error.message}`);
      result.isValid = false;
    }

    result.isValid = result.errors.length === 0;
    return result;
  }

  /**
   * Validate export requirements for complete project structure
   * @param {Object} project - Project data
   * @param {Object} resources - Project resources
   * @returns {Object} - Validation result
   */
  async validateExportRequirements(project, resources) {
    const result = {
      isValid: true,
      errors: [],
      warnings: [],
      recommendations: [],
      requiredComponents: {
        project: false,
        agents: false,
        rules: false,
        hooks: false,
        primaryAgent: false
      },
      missingComponents: []
    };

    try {
      // Validate project basic information
      await this._validateProjectBasics(project, result);

      // Validate resource presence and configuration
      await this._validateResourcePresence(resources, result);

      // Validate Claude Code specific requirements
      await this._validateClaudeCodeRequirements(project, resources, result);

      // Check for missing dependencies
      await this._validateDependencies(resources, result);

      // Validate file structure requirements
      await this._validateFileStructureRequirements(project, resources, result);

    } catch (error) {
      result.errors.push(`Export validation error: ${error.message}`);
      result.isValid = false;
    }

    result.isValid = result.errors.length === 0;
    return result;
  }

  /**
   * Validate dependency relationships and missing components
   * @param {Array} resourceList - List of resources to validate
   * @returns {Object} - Dependency validation result
   */
  async validateDependencies(resourceList) {
    const result = {
      isValid: true,
      errors: [],
      warnings: [],
      missingDependencies: [],
      circularDependencies: [],
      recommendations: []
    };

    try {
      const resourceMap = new Map();
      const dependencyGraph = new Map();

      // Build resource map and dependency graph
      for (const resource of resourceList) {
        const key = `${resource.resource_type}:${resource.resource_id}`;
        resourceMap.set(key, resource);
        dependencyGraph.set(key, []);
      }

      // Analyze dependencies for each resource
      for (const resource of resourceList) {
        const dependencies = await this._getResourceDependencies(
          resource.resource_type, 
          resource.resource_id
        );

        for (const dep of dependencies) {
          const depKey = `${dep.resource_type}:${dep.resource_id}`;
          const resourceKey = `${resource.resource_type}:${resource.resource_id}`;
          
          // Check if dependency exists in the resource list
          if (!resourceMap.has(depKey)) {
            result.missingDependencies.push({
              resource: resourceKey,
              missingDependency: depKey,
              dependencyType: dep.dependency_type,
              isCritical: dep.is_critical
            });

            if (dep.is_critical) {
              result.errors.push(
                `Critical dependency missing: ${resourceKey} requires ${depKey}`
              );
            } else {
              result.warnings.push(
                `Optional dependency missing: ${resourceKey} references ${depKey}`
              );
            }
          }

          // Add to dependency graph for circular dependency detection
          if (dependencyGraph.has(resourceKey)) {
            dependencyGraph.get(resourceKey).push(depKey);
          }
        }
      }

      // Check for circular dependencies
      const circularDeps = this._detectCircularDependencies(dependencyGraph);
      if (circularDeps.length > 0) {
        result.circularDependencies = circularDeps;
        result.warnings.push(`Circular dependencies detected: ${circularDeps.join(', ')}`);
      }

    } catch (error) {
      result.errors.push(`Dependency validation error: ${error.message}`);
      result.isValid = false;
    }

    result.isValid = result.errors.length === 0;
    return result;
  }

  /**
   * Validate agent definition against Claude Code requirements
   * @private
   */
  async _validateAgentDefinition(agentData, result) {
    const { name, role, system_prompt, output_format } = agentData;

    // Required fields validation
    if (!name || name.trim().length === 0) {
      result.errors.push('Agent name is required');
    } else if (name.length > 100) {
      result.errors.push('Agent name must be 100 characters or less');
    }

    if (!role || role.trim().length === 0) {
      result.errors.push('Agent role is required');
    } else if (role.length > 200) {
      result.errors.push('Agent role must be 200 characters or less');
    }

    if (!system_prompt || system_prompt.trim().length === 0) {
      result.errors.push('Agent system prompt is required');
    } else {
      // Validate system prompt quality
      if (system_prompt.length < 50) {
        result.warnings.push('System prompt is very short - consider adding more context');
      }
      if (system_prompt.length > 4000) {
        result.warnings.push('System prompt is very long - consider breaking into smaller sections');
      }
    }

    // Output format validation
    if (output_format) {
      try {
        JSON.parse(output_format);
      } catch (error) {
        result.errors.push('Output format must be valid JSON');
      }
    }

    // Claude Code specific validations
    if (system_prompt) {
      // Check for Claude-specific instructions
      const claudePatterns = [
        /claude/i,
        /assistant/i,
        /ai/i,
        /help/i,
        /task/i
      ];

      const hasClaudeContext = claudePatterns.some(pattern => 
        pattern.test(system_prompt)
      );

      if (!hasClaudeContext) {
        result.recommendations.push(
          'Consider adding Claude-specific context to the system prompt'
        );
      }

      // Check for XML structure awareness
      if (!system_prompt.includes('<') && !system_prompt.includes('XML')) {
        result.recommendations.push(
          'Consider mentioning XML structure handling in the system prompt'
        );
      }
    }
  }

  /**
   * Validate rule definition against Claude Code requirements
   * @private
   */
  async _validateRuleDefinition(ruleData, result) {
    const { title, description, rule_text, category, priority } = ruleData;

    // Required fields validation
    if (!title || title.trim().length === 0) {
      result.errors.push('Rule title is required');
    } else if (title.length > 200) {
      result.errors.push('Rule title must be 200 characters or less');
    }

    if (!rule_text || rule_text.trim().length === 0) {
      result.errors.push('Rule text is required');
    } else {
      if (rule_text.length < 20) {
        result.warnings.push('Rule text is very short - consider adding more detail');
      }
    }

    // Category validation
    const validCategories = [
      'behavior', 'formatting', 'constraints', 'guidelines', 
      'security', 'performance', 'style', 'workflow'
    ];
    
    if (category && !validCategories.includes(category)) {
      result.warnings.push(
        `Unusual category '${category}'. Consider using: ${validCategories.join(', ')}`
      );
    }

    // Priority validation
    const validPriorities = ['low', 'medium', 'high', 'critical'];
    if (priority && !validPriorities.includes(priority)) {
      result.errors.push(
        `Invalid priority '${priority}'. Must be one of: ${validPriorities.join(', ')}`
      );
    }

    // Claude Code specific validations
    if (rule_text) {
      // Check for actionable language
      const actionablePatterns = [
        /must|should|shall|will/i,
        /always|never|only/i,
        /when|if|unless/i
      ];

      const hasActionableLanguage = actionablePatterns.some(pattern => 
        pattern.test(rule_text)
      );

      if (!hasActionableLanguage) {
        result.recommendations.push(
          'Consider using more actionable language (must, should, when, if)'
        );
      }
    }
  }

  /**
   * Validate hook definition against Claude Code requirements
   * @private
   */
  async _validateHookDefinition(hookData, result) {
    const { name, description, trigger_event, command, is_enabled } = hookData;

    // Required fields validation
    if (!name || name.trim().length === 0) {
      result.errors.push('Hook name is required');
    } else if (name.length > 100) {
      result.errors.push('Hook name must be 100 characters or less');
    }

    if (!trigger_event || trigger_event.trim().length === 0) {
      result.errors.push('Hook trigger event is required');
    }

    if (!command || command.trim().length === 0) {
      result.errors.push('Hook command is required');
    }

    // Validate trigger event
    const validTriggers = [
      'on_message_send', 'on_agent_complete', 'on_session_create',
      'on_file_save', 'on_manual_trigger', 'on_project_open'
    ];

    if (trigger_event && !validTriggers.includes(trigger_event)) {
      result.warnings.push(
        `Unusual trigger event '${trigger_event}'. Consider using: ${validTriggers.join(', ')}`
      );
    }

    // Validate command safety
    if (command) {
      const dangerousPatterns = [
        /rm\s+-rf/i,
        /del\s+\/s/i,
        /format\s+c:/i,
        /sudo\s+rm/i,
        />\s*\/dev\/null/i
      ];

      const hasDangerousCommand = dangerousPatterns.some(pattern => 
        pattern.test(command)
      );

      if (hasDangerousCommand) {
        result.errors.push('Hook command contains potentially dangerous operations');
      }

      // Check for Claude Code compatibility
      if (!command.includes('claude') && !command.includes('kiro')) {
        result.recommendations.push(
          'Consider integrating hook command with Claude Code workflow'
        );
      }
    }
  }

  /**
   * Validate Claude Code best practices
   * @private
   */
  _validateClaudeCodeBestPractices(resourceType, resourceData, result) {
    // Check naming conventions
    const name = resourceData.name || resourceData.title;
    if (name) {
      // Check for descriptive naming
      if (name.length < 5) {
        result.recommendations.push('Consider using more descriptive names');
      }

      // Check for consistent naming patterns
      const hasConsistentNaming = /^[a-zA-Z][a-zA-Z0-9\s\-_]*$/.test(name);
      if (!hasConsistentNaming) {
        result.warnings.push('Name contains unusual characters - consider using alphanumeric characters, spaces, hyphens, or underscores');
      }
    }

    // Check for documentation
    const description = resourceData.description;
    if (!description || description.trim().length === 0) {
      result.recommendations.push('Consider adding a description for better documentation');
    } else if (description.length < 20) {
      result.recommendations.push('Consider expanding the description for clarity');
    }
  }

  /**
   * Validate project basic information
   * @private
   */
  async _validateProjectBasics(project, result) {
    if (!project) {
      result.errors.push('Project data is required');
      return;
    }

    result.requiredComponents.project = true;

    if (!project.name || project.name.trim().length === 0) {
      result.errors.push('Project name is required for export');
    }

    if (!project.description || project.description.trim().length === 0) {
      result.warnings.push('Project description is missing - consider adding one for better documentation');
    }

    // Check project status
    if (project.status === 'draft') {
      result.warnings.push('Project is in draft status - consider activating before export');
    }
  }

  /**
   * Validate resource presence and configuration
   * @private
   */
  async _validateResourcePresence(resources, result) {
    const agents = resources.agents || [];
    const rules = resources.rules || [];
    const hooks = resources.hooks || [];

    // Check for agents
    if (agents.length > 0) {
      result.requiredComponents.agents = true;
      
      // Check for primary agent
      const primaryAgents = agents.filter(a => a.is_primary);
      if (primaryAgents.length === 0) {
        result.warnings.push('No primary agent assigned - consider setting one agent as primary');
      } else if (primaryAgents.length > 1) {
        result.warnings.push('Multiple primary agents found - only one should be primary');
        result.requiredComponents.primaryAgent = false;
      } else {
        result.requiredComponents.primaryAgent = true;
      }
    } else {
      result.missingComponents.push('agents');
      result.warnings.push('No agents assigned to project - Claude Code projects typically include at least one agent');
    }

    // Check for rules
    if (rules.length > 0) {
      result.requiredComponents.rules = true;
    } else {
      result.missingComponents.push('rules');
      result.recommendations.push('Consider adding rules to guide agent behavior');
    }

    // Check for hooks
    if (hooks.length > 0) {
      result.requiredComponents.hooks = true;
    } else {
      result.missingComponents.push('hooks');
      result.recommendations.push('Consider adding hooks for workflow automation');
    }

    // Overall resource check
    const totalResources = agents.length + rules.length + hooks.length;
    if (totalResources === 0) {
      result.errors.push('Project has no assigned resources - cannot generate meaningful Claude Code export');
    }
  }

  /**
   * Validate Claude Code specific requirements
   * @private
   */
  async _validateClaudeCodeRequirements(project, resources, result) {
    const agents = resources.agents || [];
    
    // Validate agent system prompts for Claude compatibility
    for (const agent of agents) {
      if (agent.system_prompt) {
        // Check for XML awareness
        const hasXmlAwareness = agent.system_prompt.toLowerCase().includes('xml') ||
                               agent.system_prompt.includes('<') ||
                               agent.system_prompt.toLowerCase().includes('structured');
        
        if (!hasXmlAwareness) {
          result.recommendations.push(
            `Agent '${agent.name}' could benefit from XML structure awareness in system prompt`
          );
        }

        // Check for Claude-specific instructions
        const hasClaudeInstructions = agent.system_prompt.toLowerCase().includes('claude') ||
                                    agent.system_prompt.toLowerCase().includes('assistant');
        
        if (!hasClaudeInstructions) {
          result.recommendations.push(
            `Agent '${agent.name}' could benefit from Claude-specific context in system prompt`
          );
        }
      }
    }

    // Validate project structure for Claude Code compatibility
    if (project.name) {
      const hasValidProjectName = /^[a-zA-Z][a-zA-Z0-9\s\-_]*$/.test(project.name);
      if (!hasValidProjectName) {
        result.warnings.push('Project name contains special characters that may cause issues in file systems');
      }
    }
  }

  /**
   * Validate dependencies for resources
   * @private
   */
  async _validateDependencies(resources, result) {
    try {
      const allResources = [
        ...(resources.agents || []).map(a => ({ resource_type: 'agent', resource_id: a.id })),
        ...(resources.rules || []).map(r => ({ resource_type: 'rule', resource_id: r.id })),
        ...(resources.hooks || []).map(h => ({ resource_type: 'hook', resource_id: h.id }))
      ];

      const dependencyValidation = await this.validateDependencies(allResources);
      
      // Merge dependency validation results
      result.errors.push(...dependencyValidation.errors);
      result.warnings.push(...dependencyValidation.warnings);
      result.recommendations.push(...dependencyValidation.recommendations);

    } catch (error) {
      result.warnings.push(`Could not validate dependencies: ${error.message}`);
    }
  }

  /**
   * Validate file structure requirements
   * @private
   */
  async _validateFileStructureRequirements(project, resources, result) {
    // Check if project name is suitable for file system
    if (project.name) {
      const sanitizedName = project.name
        .replace(/[^a-zA-Z0-9\s\-_]/g, '')
        .trim();
      
      if (sanitizedName.length === 0) {
        result.errors.push('Project name contains only special characters - cannot create valid file structure');
      } else if (sanitizedName !== project.name) {
        result.warnings.push('Project name will be sanitized for file system compatibility');
      }
    }

    // Validate that we can generate all required files
    const requiredFiles = [
      'CLAUDE.md',
      '.claude/project_settings.json'
    ];

    const agents = resources.agents || [];
    if (agents.length > 0) {
      requiredFiles.push('.claude/agents/');
    }

    // Check for potential file naming conflicts
    const agentNames = agents.map(a => a.name);
    const duplicateNames = agentNames.filter((name, index) => 
      agentNames.indexOf(name) !== index
    );

    if (duplicateNames.length > 0) {
      result.warnings.push(
        `Duplicate agent names found: ${duplicateNames.join(', ')} - files may be overwritten`
      );
    }
  }

  /**
   * Get resource dependencies from database
   * @private
   */
  async _getResourceDependencies(resourceType, resourceId) {
    try {
      const result = await this.db.prepare(`
        SELECT target_resource_type as resource_type, target_resource_id as resource_id, 
               dependency_type, is_critical
        FROM resource_dependencies 
        WHERE source_resource_type = ? AND source_resource_id = ?
      `).bind(resourceType, resourceId).all();

      return result.results || [];
    } catch (error) {
      console.error('Error getting resource dependencies:', error);
      return [];
    }
  }

  /**
   * Detect circular dependencies in dependency graph
   * @private
   */
  _detectCircularDependencies(dependencyGraph) {
    const visited = new Set();
    const recursionStack = new Set();
    const circularDeps = [];

    const dfs = (node, path = []) => {
      if (recursionStack.has(node)) {
        // Found a cycle
        const cycleStart = path.indexOf(node);
        if (cycleStart !== -1) {
          circularDeps.push(path.slice(cycleStart).concat([node]).join(' -> '));
        }
        return;
      }

      if (visited.has(node)) {
        return;
      }

      visited.add(node);
      recursionStack.add(node);
      path.push(node);

      const dependencies = dependencyGraph.get(node) || [];
      for (const dep of dependencies) {
        dfs(dep, [...path]);
      }

      recursionStack.delete(node);
      path.pop();
    };

    for (const node of dependencyGraph.keys()) {
      if (!visited.has(node)) {
        dfs(node);
      }
    }

    return circularDeps;
  }
}

// ============================================
// WORKERS AI ENDPOINTS
// ============================================

// Generate project-aware prompt with context integration
app.post("/api/ai/generate-prompt", async (c) => {
  const db = c.env.DB;
  const ai = c.env.AI;

  const body = await c.req.json();
  const {
    task,
    context = "",
    format = "",
    outputRequirements = "",
    projectId = null,
    agentId = null,
    saveToProject = false,
    promptTitle = null,
    promptNotes = null
  } = body;

  if (!task) {
    return c.json({ error: "Task description is required" }, 400);
  }

  try {
    let projectContext = null;
    let agent = null;
    let projectRules = [];
    let projectAgents = [];

    // Get project context if projectId provided
    if (projectId) {
      const project = await db.prepare('SELECT * FROM projects WHERE id = ?').bind(projectId).first();
      if (project) {
        projectContext = {
          ...project,
          tags: project.tags ? JSON.parse(project.tags) : []
        };

        // Get project rules
        const rulesResult = await db.prepare(`
          SELECT ar.* FROM agent_rules ar
          JOIN project_resources pr ON pr.resource_id = ar.id
          WHERE pr.project_id = ? AND pr.resource_type = 'rule' AND ar.is_active = 1
          ORDER BY pr.is_primary DESC, pr.assignment_order
        `).bind(projectId).all();
        projectRules = rulesResult.results || [];

        // Get project agents for context
        const agentsResult = await db.prepare(`
          SELECT a.* FROM agents a
          JOIN project_resources pr ON pr.resource_id = a.id
          WHERE pr.project_id = ? AND pr.resource_type = 'agent' AND a.is_active = 1
          ORDER BY pr.is_primary DESC, pr.assignment_order
        `).bind(projectId).all();
        projectAgents = agentsResult.results || [];
      }
    }

    // Get specific agent if agentId provided
    if (agentId) {
      agent = await db.prepare('SELECT * FROM agents WHERE id = ? AND is_active = 1').bind(agentId).first();
      if (!agent && projectAgents.length === 0) {
        return c.json({ error: "Agent not found or not active" }, 404);
      }
    } else if (projectAgents.length > 0) {
      // Use primary agent from project if no specific agent selected
      agent = projectAgents.find(a => a.is_primary) || projectAgents[0];
    }

    if (!agent) {
      return c.json({ error: "No agent specified and no project agents available" }, 400);
    }

    // Build project-aware prompt
    let prompt = `${agent.role}\n\n`;

    // Add agent style
    if (agent.style) {
      prompt += `<agent_style>\n${agent.style}\n</agent_style>\n\n`;
    }

    // Add project context if available
    if (projectContext) {
      prompt += `<project_context>\n`;
      prompt += `Project: ${projectContext.name}\n`;
      if (projectContext.description) {
        prompt += `Description: ${projectContext.description}\n`;
      }
      if (projectContext.ai_context_summary) {
        prompt += `AI Context: ${projectContext.ai_context_summary}\n`;
      }
      if (projectContext.category) {
        prompt += `Category: ${projectContext.category}\n`;
      }
      if (projectContext.tags && projectContext.tags.length > 0) {
        prompt += `Tags: ${projectContext.tags.join(', ')}\n`;
      }
      prompt += `</project_context>\n\n`;
    }

    // Add project rules if available
    if (projectRules.length > 0) {
      prompt += `<project_rules>\n`;
      projectRules.forEach(rule => {
        prompt += `${rule.name}: ${rule.rule_content}\n`;
      });
      prompt += `</project_rules>\n\n`;
    }

    // Add user context
    prompt += `<context>\n${context || "No additional context provided."}\n</context>\n\n`;

    // Add task instruction
    prompt += `<task_instruction>\n${task}\n</task_instruction>\n\n`;

    // Add output format
    prompt += `<output_format>\n${format || "Best fit for the task."}\n</output_format>\n\n`;

    // Add output requirements
    prompt += `<output_requirements>\n${outputRequirements || "Best fit."}\n</output_requirements>`;

    // Save to project if requested
    let savedPrompt = null;
    if (saveToProject && projectId) {
      const promptId = generateId();
      await db.prepare(`
        INSERT INTO project_prompts (
          id, project_id, prompt_content, prompt_type, title, prompt_notes,
          agent_id, agent_name, context_used, constraints_used, output_format,
          output_requirements_content
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        promptId,
        projectId,
        prompt,
        'generated',
        promptTitle || `Generated prompt - ${new Date().toLocaleDateString()}`,
        promptNotes,
        agent.id,
        agent.name,
        context,
        projectRules.map(r => r.name).join(', '),
        format,
        outputRequirements
      ).run();

      savedPrompt = await db.prepare('SELECT * FROM project_prompts WHERE id = ?').bind(promptId).first();
    }

    return c.json({
      prompt,
      projectContext: projectContext ? {
        id: projectContext.id,
        name: projectContext.name,
        description: projectContext.description
      } : null,
      agent: {
        id: agent.id,
        name: agent.name,
        role: agent.role
      },
      projectRules: projectRules.map(r => ({ id: r.id, name: r.name, category: r.category })),
      savedPrompt,
      metadata: {
        generatedAt: new Date().toISOString(),
        hasProjectContext: !!projectContext,
        rulesApplied: projectRules.length
      }
    });

  } catch (error) {
    return c.json({ error: "Prompt generation failed", details: error.message }, 500);
  }
});

// Enhance/cleanup prompt text
app.post("/api/ai/enhance-prompt", async (c) => {
  const ai = c.env.AI;

  if (!ai) {
    return c.json({ error: "AI binding not configured" }, 500);
  }

  const body = await c.req.json();
  const { prompt, enhancementType = "general", projectId = null } = body;

  if (!prompt) {
    return c.json({ error: "Prompt text is required" }, 400);
  }

  // Get project context for enhancement if projectId provided
  let projectContext = "";
  if (projectId) {
    const db = c.env.DB;
    const project = await db.prepare('SELECT * FROM projects WHERE id = ?').bind(projectId).first();
    if (project) {
      projectContext = `\n\nProject Context: ${project.name}`;
      if (project.description) {
        projectContext += ` - ${project.description}`;
      }
      if (project.ai_context_summary) {
        projectContext += `\nAI Context: ${project.ai_context_summary}`;
      }
    }
  }

  const enhancementPrompts = {
    general: `Improve this prompt for clarity and effectiveness while preserving its intent. Make it more specific and actionable:${projectContext}\n\n${prompt}`,
    technical: `Enhance this technical prompt with precise terminology, clear requirements, and structured format:${projectContext}\n\n${prompt}`,
    creative: `Enhance this creative prompt to be more evocative and inspiring while maintaining clear direction:${projectContext}\n\n${prompt}`,
    concise: `Make this prompt more concise and direct while preserving all essential information:${projectContext}\n\n${prompt}`,
    claude_optimize: `Optimize this prompt specifically for Claude AI. Use clear XML-style structure, explicit constraints, and well-defined output requirements:${projectContext}\n\n${prompt}`,
  };

  const systemPrompt =
    enhancementPrompts[enhancementType] || enhancementPrompts.general;

  try {
    const response = await ai.run("@cf/meta/llama-3.1-8b-instruct", {
      messages: [
        {
          role: "system",
          content:
            "You are an expert prompt engineer. Your task is to improve prompts while preserving their original intent. Output only the improved prompt, no explanations.",
        },
        { role: "user", content: systemPrompt },
      ],
      max_tokens: 2048,
      temperature: 0.3,
    });

    return c.json({
      original: prompt,
      enhanced: response.response,
      enhancementType,
      projectContext: projectId ? { id: projectId } : null
    });
  } catch (error) {
    return c.json(
      { error: "AI enhancement failed", details: error.message },
      500,
    );
  }
});

// Get available projects and agents for prompt generation
app.get("/api/ai/prompt-context", async (c) => {
  const db = c.env.DB;

  try {
    // Get active projects
    const projectsResult = await db.prepare(`
      SELECT id, name, description, category, ai_context_summary
      FROM projects 
      WHERE status IN ('active', 'draft') 
      ORDER BY name
    `).all();

    // Get active agents
    const agentsResult = await db.prepare(`
      SELECT id, name, role, description
      FROM agents 
      WHERE is_active = 1 
      ORDER BY name
    `).all();

    // Get project-agent relationships
    const projectAgentsResult = await db.prepare(`
      SELECT pr.project_id, pr.resource_id as agent_id, pr.is_primary, a.name as agent_name
      FROM project_resources pr
      JOIN agents a ON a.id = pr.resource_id
      WHERE pr.resource_type = 'agent' AND a.is_active = 1
      ORDER BY pr.project_id, pr.is_primary DESC, pr.assignment_order
    `).all();

    // Group project agents by project
    const projectAgents = {};
    projectAgentsResult.results.forEach(pa => {
      if (!projectAgents[pa.project_id]) {
        projectAgents[pa.project_id] = [];
      }
      projectAgents[pa.project_id].push({
        id: pa.agent_id,
        name: pa.agent_name,
        isPrimary: Boolean(pa.is_primary)
      });
    });

    // Add agent info to projects
    const projects = projectsResult.results.map(project => ({
      ...project,
      agents: projectAgents[project.id] || [],
      tags: project.tags ? JSON.parse(project.tags) : []
    }));

    return c.json({
      projects,
      agents: agentsResult.results,
      projectAgents
    });

  } catch (error) {
    return c.json({ error: "Failed to get prompt context", details: error.message }, 500);
  }
});

// Get project-specific context for prompt generation
app.get("/api/projects/:id/prompt-context", async (c) => {
  const db = c.env.DB;
  const projectId = c.req.param("id");

  try {
    // Get project details
    const project = await db.prepare('SELECT * FROM projects WHERE id = ?').bind(projectId).first();
    if (!project) {
      return c.json({ error: "Project not found" }, 404);
    }

    // Get project agents
    const agentsResult = await db.prepare(`
      SELECT a.*, pr.is_primary, pr.assignment_order
      FROM agents a
      JOIN project_resources pr ON pr.resource_id = a.id
      WHERE pr.project_id = ? AND pr.resource_type = 'agent' AND a.is_active = 1
      ORDER BY pr.is_primary DESC, pr.assignment_order, a.name
    `).bind(projectId).all();

    // Get project rules
    const rulesResult = await db.prepare(`
      SELECT ar.*, pr.is_primary, pr.assignment_order
      FROM agent_rules ar
      JOIN project_resources pr ON pr.resource_id = ar.id
      WHERE pr.project_id = ? AND pr.resource_type = 'rule' AND ar.is_active = 1
      ORDER BY pr.is_primary DESC, pr.assignment_order, ar.name
    `).bind(projectId).all();

    // Get recent prompts for this project
    const recentPromptsResult = await db.prepare(`
      SELECT id, title, prompt_type, agent_name, created_at
      FROM project_prompts
      WHERE project_id = ?
      ORDER BY created_at DESC
      LIMIT 10
    `).bind(projectId).all();

    return c.json({
      project: {
        ...project,
        tags: project.tags ? JSON.parse(project.tags) : []
      },
      agents: agentsResult.results.map(agent => ({
        ...agent,
        isPrimary: Boolean(agent.is_primary)
      })),
      rules: rulesResult.results.map(rule => ({
        ...rule,
        isPrimary: Boolean(rule.is_primary)
      })),
      recentPrompts: recentPromptsResult.results
    });

  } catch (error) {
    return c.json({ error: "Failed to get project context", details: error.message }, 500);
  }
});

// Get improvement suggestions for a prompt
app.post("/api/ai/suggest-improvements", async (c) => {
  const ai = c.env.AI;

  if (!ai) {
    return c.json({ error: "AI binding not configured" }, 500);
  }

  const body = await c.req.json();
  const { prompt } = body;

  if (!prompt) {
    return c.json({ error: "Prompt text is required" }, 400);
  }

  try {
    const response = await ai.run("@cf/meta/llama-3.1-8b-instruct", {
      messages: [
        {
          role: "system",
          content:
            "You are a prompt engineering expert. Analyze prompts and provide actionable improvement suggestions. Always respond with valid JSON array format.",
        },
        {
          role: "user",
          content: `Analyze this prompt and provide 3-5 specific improvement suggestions. Return as JSON array with objects containing "suggestion" and "priority" (high/medium/low) fields only:\n\n${prompt}`,
        },
      ],
      max_tokens: 1024,
      temperature: 0.5,
    });

    // Try to parse the response as JSON
    let suggestions;
    try {
      // Extract JSON from the response
      const jsonMatch = response.response.match(/\[[\s\S]*\]/);
      suggestions = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
    } catch {
      // If parsing fails, return raw suggestions
      suggestions = [{ suggestion: response.response, priority: "medium" }];
    }

    return c.json({ suggestions });
  } catch (error) {
    return c.json(
      { error: "AI suggestion failed", details: error.message },
      500,
    );
  }
});

// Analyze prompt quality
app.post("/api/ai/analyze-prompt", async (c) => {
  const ai = c.env.AI;

  if (!ai) {
    return c.json({ error: "AI binding not configured" }, 500);
  }

  const body = await c.req.json();
  const { prompt } = body;

  if (!prompt) {
    return c.json({ error: "Prompt text is required" }, 400);
  }

  try {
    const response = await ai.run("@cf/meta/llama-3.1-8b-instruct", {
      messages: [
        {
          role: "system",
          content:
            "You are a prompt quality analyst. Score prompts on multiple dimensions and provide brief analysis. Always respond with valid JSON.",
        },
        {
          role: "user",
          content: `Analyze this prompt's quality. Return JSON with: clarity (1-10), specificity (1-10), structure (1-10), overall (1-10), and summary (brief text):\n\n${prompt}`,
        },
      ],
      max_tokens: 512,
      temperature: 0.2,
    });

    // Try to parse the response as JSON
    let analysis;
    try {
      const jsonMatch = response.response.match(/\{[\s\S]*\}/);
      analysis = jsonMatch
        ? JSON.parse(jsonMatch[0])
        : { overall: 5, summary: response.response };
    } catch {
      analysis = {
        clarity: 5,
        specificity: 5,
        structure: 5,
        overall: 5,
        summary: response.response,
      };
    }

    return c.json({ analysis });
  } catch (error) {
    return c.json({ error: "AI analysis failed", details: error.message }, 500);
  }
});

// ============================================
// AI ENHANCEMENT API ENDPOINTS
// Implements requirements 4.1, 4.2, 4.4, 4.5
// Provides AI-powered contextual suggestions and compatibility validation
// ============================================

// Enhance resource creation with contextual suggestions
app.post("/api/ai/enhance-resource", async (c) => {
  try {
    const ai = c.env.AI;
    const db = c.env.DB;

    if (!ai) {
      return c.json({ error: "AI binding not configured" }, 500);
    }

    const body = await c.req.json();
    const { 
      resource_type, 
      project_id, 
      resource_data = {},
      include_context = true 
    } = body;

    if (!resource_type) {
      return c.json({ error: "resource_type is required" }, 400);
    }

    const validTypes = ['agent', 'rule', 'hook'];
    if (!validTypes.includes(resource_type)) {
      return c.json({ 
        error: `Invalid resource_type. Must be one of: ${validTypes.join(', ')}` 
      }, 400);
    }

    const aiEngine = new AIEnhancementEngine(ai, db);
    
    // Build project context if project_id provided
    let projectContext = {};
    if (project_id && include_context) {
      projectContext = { projectId: project_id };
    }

    const enhancement = await aiEngine.enhanceResourceCreation(
      resource_type, 
      projectContext, 
      resource_data
    );

    return c.json({
      resource_type,
      project_id,
      enhancement,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('AI enhancement failed:', error);
    
    // Provide graceful fallback
    if (error.message.includes('AI service not available')) {
      return c.json({
        error: "AI service temporarily unavailable",
        fallback: true,
        suggestions: {
          message: "AI enhancement is currently unavailable. Please try again later or create the resource manually."
        }
      }, 503);
    }

    return c.json({ 
      error: "Enhancement failed", 
      details: error.message 
    }, 500);
  }
});

// Validate resource compatibility
app.post("/api/ai/validate-compatibility", async (c) => {
  try {
    const ai = c.env.AI;
    const db = c.env.DB;

    if (!ai) {
      return c.json({ 
        error: "AI binding not configured",
        fallback: true,
        validation: {
          isCompatible: true,
          confidence: 0.5,
          warnings: ['AI validation unavailable - manual review recommended'],
          suggestions: []
        }
      }, 200); // Return 200 with fallback instead of 500
    }

    const body = await c.req.json();
    const { 
      resource_type, 
      resource_data, 
      project_id,
      include_context = true 
    } = body;

    if (!resource_type || !resource_data) {
      return c.json({ 
        error: "resource_type and resource_data are required" 
      }, 400);
    }

    const validTypes = ['agent', 'rule', 'hook'];
    if (!validTypes.includes(resource_type)) {
      return c.json({ 
        error: `Invalid resource_type. Must be one of: ${validTypes.join(', ')}` 
      }, 400);
    }

    const aiEngine = new AIEnhancementEngine(ai, db);
    
    // Build project context if project_id provided
    let projectContext = {};
    if (project_id && include_context) {
      projectContext = { projectId: project_id };
    }

    const validation = await aiEngine.validateResourceCompatibility(
      resource_type, 
      resource_data, 
      projectContext
    );

    return c.json({
      resource_type,
      project_id,
      validation,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('AI validation failed:', error);
    
    // Provide graceful fallback for validation errors
    return c.json({
      error: "Validation failed",
      fallback: true,
      validation: {
        isCompatible: true,
        confidence: 0.3,
        warnings: ['AI validation failed - manual review recommended'],
        suggestions: [],
        error_details: error.message
      }
    }, 200); // Return 200 with fallback validation
  }
});

// Get AI context for a project (helper endpoint)
app.get("/api/ai/project-context/:projectId", async (c) => {
  try {
    const db = c.env.DB;
    const ai = c.env.AI;
    const projectId = parseInt(c.req.param("projectId"));

    if (!projectId) {
      return c.json({ error: "Invalid project ID" }, 400);
    }

    const aiEngine = new AIEnhancementEngine(ai, db);
    const context = await aiEngine.buildContextPrompt({ projectId }, 'general');

    return c.json({
      project_id: projectId,
      context,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Failed to get project context:', error);
    return c.json({ 
      error: "Failed to retrieve project context", 
      details: error.message 
    }, 500);
  }
});

// Batch enhance multiple resources
app.post("/api/ai/enhance-resources-batch", async (c) => {
  try {
    const ai = c.env.AI;
    const db = c.env.DB;

    if (!ai) {
      return c.json({ error: "AI binding not configured" }, 500);
    }

    const body = await c.req.json();
    const { resources, project_id, include_context = true } = body;

    if (!resources || !Array.isArray(resources)) {
      return c.json({ error: "resources array is required" }, 400);
    }

    if (resources.length > 10) {
      return c.json({ error: "Maximum 10 resources per batch" }, 400);
    }

    const aiEngine = new AIEnhancementEngine(ai, db);
    
    // Build project context once for efficiency
    let projectContext = {};
    if (project_id && include_context) {
      projectContext = { projectId: project_id };
    }

    const results = [];
    
    for (const resource of resources) {
      try {
        const { resource_type, resource_data = {} } = resource;
        
        if (!resource_type) {
          results.push({
            resource,
            error: "resource_type is required",
            success: false
          });
          continue;
        }

        const enhancement = await aiEngine.enhanceResourceCreation(
          resource_type, 
          projectContext, 
          resource_data
        );

        results.push({
          resource,
          enhancement,
          success: true
        });

      } catch (error) {
        results.push({
          resource,
          error: error.message,
          success: false
        });
      }
    }

    const successCount = results.filter(r => r.success).length;

    return c.json({
      project_id,
      results,
      summary: {
        total: resources.length,
        successful: successCount,
        failed: resources.length - successCount
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Batch enhancement failed:', error);
    return c.json({ 
      error: "Batch enhancement failed", 
      details: error.message 
    }, 500);
  }
});

// ============================================
// PLATFORM DETECTION API ENDPOINTS
// Implements requirements 1.1, 1.2, 1.4, 3.3
// ============================================

// Detect platforms from user input
app.post("/api/ai/detect-platforms", async (c) => {
  try {
    const db = c.env.DB;
    const body = await c.req.json();
    const { input, project_id = null } = body;

    if (!input || typeof input !== 'string') {
      return c.json({ error: "Input text is required" }, 400);
    }

    // Initialize platform detection engine
    const platformEngine = new PlatformDetectionEngine(db);
    
    // Detect platforms
    const detections = platformEngine.detectPlatforms(input);
    
    // Track AI usage
    if (detections.length > 0) {
      await db.prepare(`
        INSERT INTO ai_usage_tracking (request_type, project_id, success, request_context)
        VALUES (?, ?, ?, ?)
      `).bind(
        'detect_platform',
        project_id,
        1,
        JSON.stringify({ input_length: input.length, detections_count: detections.length })
      ).run();
    }

    return c.json({
      detections,
      input_analyzed: input.length,
      platforms_detected: detections.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Platform detection failed:', error);
    
    // Track failed usage
    try {
      const db = c.env.DB;
      await db.prepare(`
        INSERT INTO ai_usage_tracking (request_type, project_id, success, error_message)
        VALUES (?, ?, ?, ?)
      `).bind('detect_platform', null, 0, error.message).run();
    } catch (trackingError) {
      console.error('Failed to track usage:', trackingError);
    }

    return c.json({ 
      error: "Platform detection failed", 
      details: error.message 
    }, 500);
  }
});

// Get platform templates based on detected platforms
app.post("/api/ai/suggest-templates", async (c) => {
  try {
    const db = c.env.DB;
    const body = await c.req.json();
    const { 
      platforms = [], 
      project_id = null, 
      user_input = '',
      existing_rules = [],
      limit = 10 
    } = body;

    if (!platforms || !Array.isArray(platforms) || platforms.length === 0) {
      return c.json({ error: "Platforms array is required" }, 400);
    }

    // Initialize services
    const platformEngine = new PlatformDetectionEngine(db);
    const suggestionService = new TemplateSuggestionService(db, platformEngine);

    // Get templates for detected platforms
    const platformNames = platforms.map(p => typeof p === 'string' ? p : p.platform);
    const templates = await platformEngine.getPlatformTemplates(platformNames);

    // Get existing rules context if project_id provided
    let existingRulesContext = existing_rules;
    if (project_id && existingRulesContext.length === 0) {
      const rulesResult = await db.prepare(`
        SELECT ar.* FROM agent_rules ar
        JOIN project_resources pr ON ar.id = pr.resource_id
        WHERE pr.project_id = ? AND pr.resource_type = 'rule' AND ar.is_active = 1
      `).bind(project_id).all();
      existingRulesContext = rulesResult.results;
    }

    // Rank suggestions by relevance
    const rankedSuggestions = platformEngine.rankSuggestionsByRelevance(templates, {
      projectId: project_id,
      existingRules: existingRulesContext,
      detectedPlatforms: platforms,
      userInput: user_input
    });

    // Limit results
    const limitedSuggestions = rankedSuggestions.slice(0, limit);

    // Track usage
    await db.prepare(`
      INSERT INTO ai_usage_tracking (request_type, project_id, success, request_context)
      VALUES (?, ?, ?, ?)
    `).bind(
      'suggest_template',
      project_id,
      1,
      JSON.stringify({ 
        platforms_count: platforms.length, 
        templates_found: templates.length,
        suggestions_returned: limitedSuggestions.length
      })
    ).run();

    return c.json({
      suggestions: limitedSuggestions,
      total_templates: templates.length,
      platforms_analyzed: platforms.length,
      project_id,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Template suggestion failed:', error);
    
    // Track failed usage
    try {
      const db = c.env.DB;
      await db.prepare(`
        INSERT INTO ai_usage_tracking (request_type, project_id, success, error_message)
        VALUES (?, ?, ?, ?)
      `).bind('suggest_template', null, 0, error.message).run();
    } catch (trackingError) {
      console.error('Failed to track usage:', trackingError);
    }

    return c.json({ 
      error: "Template suggestion failed", 
      details: error.message 
    }, 500);
  }
});

// Analyze existing rules and suggest improvements
app.post("/api/ai/analyze-rules", async (c) => {
  try {
    const db = c.env.DB;
    const body = await c.req.json();
    const { project_id, rule_data = {} } = body;

    if (!project_id) {
      return c.json({ error: "Project ID is required" }, 400);
    }

    // Initialize services
    const platformEngine = new PlatformDetectionEngine(db);
    const suggestionService = new TemplateSuggestionService(db, platformEngine);

    // Analyze existing rules
    const patterns = await suggestionService.analyzeExistingRules(project_id);
    
    // Get improvement suggestions
    const improvements = suggestionService.suggestImprovements(rule_data, patterns);

    // Track usage
    await db.prepare(`
      INSERT INTO ai_usage_tracking (request_type, project_id, success, request_context)
      VALUES (?, ?, ?, ?)
    `).bind(
      'analyze_rules',
      project_id,
      1,
      JSON.stringify({ 
        patterns_found: patterns.length,
        improvements_suggested: improvements.length
      })
    ).run();

    return c.json({
      project_id,
      patterns,
      improvements,
      analysis_timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Rule analysis failed:', error);
    
    // Track failed usage
    try {
      const db = c.env.DB;
      await db.prepare(`
        INSERT INTO ai_usage_tracking (request_type, project_id, success, error_message)
        VALUES (?, ?, ?, ?)
      `).bind('analyze_rules', null, 0, error.message).run();
    } catch (trackingError) {
      console.error('Failed to track usage:', trackingError);
    }

    return c.json({ 
      error: "Rule analysis failed", 
      details: error.message 
    }, 500);
  }
});

// Get available platform categories and supported platforms
app.get("/api/ai/platform-info", async (c) => {
  try {
    const db = c.env.DB;
    const platformEngine = new PlatformDetectionEngine(db);

    const categories = platformEngine.getPlatformCategories();
    const platforms = platformEngine.getSupportedPlatforms();

    // Get template statistics
    const templateStats = await db.prepare(`
      SELECT 
        platform,
        category,
        COUNT(*) as template_count,
        AVG(success_rate) as avg_success_rate,
        SUM(usage_count) as total_usage
      FROM platform_templates 
      WHERE is_active = 1
      GROUP BY platform, category
      ORDER BY platform, category
    `).all();

    return c.json({
      categories,
      platforms,
      template_statistics: templateStats.results,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Failed to get platform info:', error);
    return c.json({ 
      error: "Failed to retrieve platform information", 
      details: error.message 
    }, 500);
  }
});

// ============================================
// CLAUDE CODE EXPORT ENDPOINTS
// ============================================

// Export prompt in Claude Code optimized format
app.post("/api/export/claude-code", async (c) => {
  const body = await c.req.json();
  const {
    agent,
    prompt,
    context = "",
    constraints = "",
    outputRequirements = "",
    includeSystemPrompt = true,
  } = body;

  if (!prompt) {
    return c.json({ error: "Prompt is required" }, 400);
  }

  // Build Claude Code optimized XML structure
  let userPrompt = "";

  if (context) {
    userPrompt += `<context>\n${context}\n</context>\n\n`;
  }

  userPrompt += `<instructions>\n${prompt}\n</instructions>\n`;

  if (constraints) {
    userPrompt += `\n<constraints>\n${constraints}\n</constraints>\n`;
  }

  if (outputRequirements) {
    userPrompt += `\n<output_requirements>\n${outputRequirements}\n</output_requirements>\n`;
  }

  // Generate system prompt from agent if provided
  let systemPrompt = null;
  if (includeSystemPrompt && agent) {
    systemPrompt = `You are ${agent.name}, ${agent.role}.`;
    if (agent.style) {
      systemPrompt += `\nStyle: ${agent.style}`;
    }
    if (agent.description) {
      systemPrompt += `\n${agent.description}`;
    }
  }

  return c.json({
    format: "claude-code",
    userPrompt: userPrompt.trim(),
    systemPrompt,
    metadata: {
      exportedAt: new Date().toISOString(),
      hasAgent: !!agent,
      hasConstraints: !!constraints,
      hasOutputRequirements: !!outputRequirements,
    },
  });
});

// Export as downloadable Claude Code file
app.post("/api/export/claude-code-file", async (c) => {
  const body = await c.req.json();
  const {
    agent,
    prompt,
    context = "",
    constraints = "",
    outputRequirements = "",
    projectName = "prompt",
  } = body;

  if (!prompt) {
    return c.json({ error: "Prompt is required" }, 400);
  }

  // Build the markdown file content
  let content = `# ${projectName}\n\n`;
  content += `> Generated by Semantic Prompt Workstation\n`;
  content += `> Optimized for Claude Code\n\n`;

  if (agent) {
    content += `## Agent\n\n`;
    content += `**${agent.name}** - ${agent.role}\n`;
    if (agent.style) content += `\n*Style: ${agent.style}*\n`;
    if (agent.description) content += `\n${agent.description}\n`;
    content += `\n---\n\n`;
  }

  content += `## Prompt\n\n`;
  content += "```xml\n";

  if (context) {
    content += `<context>\n${context}\n</context>\n\n`;
  }

  content += `<instructions>\n${prompt}\n</instructions>\n`;

  if (constraints) {
    content += `\n<constraints>\n${constraints}\n</constraints>\n`;
  }

  if (outputRequirements) {
    content += `\n<output_requirements>\n${outputRequirements}\n</output_requirements>\n`;
  }

  content += "```\n\n";

  content += `---\n\n`;
  content += `## Usage\n\n`;
  content += `1. Copy the XML prompt above\n`;
  content += `2. Paste into Claude Code or Claude chat\n`;
  content += `3. The structured format helps Claude parse your intent clearly\n`;

  return new Response(content, {
    headers: {
      "Content-Type": "text/markdown",
      "Content-Disposition": `attachment; filename="${projectName}-prompt.md"`,
    },
  });
});

// Generate CLAUDE.md project file
app.post("/api/export/claude-md", async (c) => {
  const body = await c.req.json();
  const {
    projectName = "Project",
    agent,
    constraints = "",
    codeStyle = "",
    testingRequirements = "",
    additionalContext = "",
  } = body;

  let content = `# ${projectName}\n\n`;

  if (agent) {
    content += `## AI Assistant Configuration\n\n`;
    content += `When working on this project, act as **${agent.name}**, ${agent.role}.\n`;
    if (agent.style) content += `\nCommunication style: ${agent.style}\n`;
    if (agent.description) content += `\n${agent.description}\n`;
    content += `\n`;
  }

  if (constraints) {
    content += `## Constraints\n\n`;
    content += `${constraints}\n\n`;
  }

  if (codeStyle) {
    content += `## Code Style\n\n`;
    content += `${codeStyle}\n\n`;
  }

  if (testingRequirements) {
    content += `## Testing Requirements\n\n`;
    content += `${testingRequirements}\n\n`;
  }

  if (additionalContext) {
    content += `## Additional Context\n\n`;
    content += `${additionalContext}\n\n`;
  }

  content += `---\n`;
  content += `*Generated by Semantic Prompt Workstation*\n`;

  return new Response(content, {
    headers: {
      "Content-Type": "text/markdown",
      "Content-Disposition": `attachment; filename="CLAUDE.md"`,
    },
  });
});

// ============================================
// CLAUDE CODE PROJECT EXPORT API ENDPOINTS
// Implements requirements 5.1, 5.2, 5.3, 5.4, 5.5
// ============================================

// Export complete Claude Code project structure
app.post("/api/export/claude-code/:projectId", async (c) => {
  try {
    const db = c.env.DB;
    const projectId = parseInt(c.req.param("projectId"));
    
    if (!projectId || isNaN(projectId)) {
      return c.json({ error: "Valid project ID is required" }, 400);
    }

    const body = await c.req.json().catch(() => ({}));
    const {
      format = 'json', // 'json' or 'zip'
      includeAgents = true,
      includeRules = true,
      includeHooks = true,
      includeProjectSettings = true,
      includeClaudeMD = true,
      exportNotes = null
    } = body;

    const exporter = new ClaudeCodeExporter(db);
    
    // Generate the complete project structure
    const projectStructure = await exporter.generateProjectStructure(projectId, {
      includeAgents,
      includeRules,
      includeHooks,
      includeProjectSettings,
      includeClaudeMD,
      format
    });

    // Record export in history
    const exportId = generateId();
    const exportRecord = {
      id: exportId,
      project_id: projectId,

      export_format: format,
      included_resources: JSON.stringify({
        agents: projectStructure.metadata.includedComponents.agents,
        rules: projectStructure.metadata.includedComponents.rules,
        hooks: projectStructure.metadata.includedComponents.hooks,
        projectSettings: projectStructure.metadata.includedComponents.projectSettings,
        claudeMD: projectStructure.metadata.includedComponents.claudeMD
      }),
      export_settings: JSON.stringify({
        format,
        totalFiles: projectStructure.metadata.totalFiles
      }),
      processing_started_at: new Date().toISOString(),
      processing_completed_at: new Date().toISOString(),
      export_notes: exportNotes,
      exported_by: 'api'
    };

    try {
      await db.prepare(`
        INSERT INTO export_history (
          id, project_id, export_format, included_resources,
          export_settings, processing_started_at, processing_completed_at,
          export_notes, exported_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        exportRecord.id,
        exportRecord.project_id,
        exportRecord.export_format,
        exportRecord.included_resources,
        exportRecord.export_settings,
        exportRecord.processing_started_at,
        exportRecord.processing_completed_at,
        exportRecord.export_notes,
        exportRecord.exported_by
      ).run();
    } catch (historyError) {
      console.warn('Failed to record export history:', historyError);
      // Continue with export even if history recording fails
    }

    if (format === 'zip') {
      // For ZIP format, we would need to implement ZIP generation
      // For now, return the structure with a note about ZIP implementation
      return c.json({
        ...projectStructure,
        exportId,
        note: "ZIP format not yet implemented. Use 'json' format to get file contents."
      });
    }

    // Return the complete project structure
    return c.json({
      ...projectStructure,
      exportId,
      success: true
    });

  } catch (error) {
    console.error('Claude Code export failed:', error);
    return c.json({ 
      error: "Export failed", 
      details: error.message 
    }, 500);
  }
});

// Get export history for a project
app.get("/api/export/history/:projectId", async (c) => {
  try {
    const db = c.env.DB;
    const projectId = parseInt(c.req.param("projectId"));
    
    if (!projectId || isNaN(projectId)) {
      return c.json({ error: "Valid project ID is required" }, 400);
    }

    const query = c.req.query();
    const limit = parseInt(query.limit) || 50;
    const offset = parseInt(query.offset) || 0;


    let whereClause = 'WHERE project_id = ?';
    const params = [projectId];



    // Get total count
    const countResult = await db.prepare(`
      SELECT COUNT(*) as total FROM export_history ${whereClause}
    `).bind(...params).first();

    // Get export history
    const historyQuery = `
      SELECT 
        id, project_id, export_format, included_resources,
        export_settings, file_size, processing_started_at, processing_completed_at,
        processing_duration_ms, exported_by, export_notes, download_count,
        last_downloaded_at, created_at
      FROM export_history 
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `;

    params.push(limit, offset);
    const historyResult = await db.prepare(historyQuery).bind(...params).all();

    const exports = historyResult.results.map(record => ({
      ...record,
      included_resources: record.included_resources ? JSON.parse(record.included_resources) : {},
      export_settings: record.export_settings ? JSON.parse(record.export_settings) : {}
    }));

    return c.json({
      exports,
      pagination: {
        total: countResult.total,
        limit,
        offset,
        hasMore: offset + limit < countResult.total
      }
    });

  } catch (error) {
    console.error('Failed to get export history:', error);
    return c.json({ 
      error: "Failed to get export history", 
      details: error.message 
    }, 500);
  }
});

// Validate project for export readiness with comprehensive validation
app.get("/api/export/validate/:projectId", async (c) => {
  try {
    const db = c.env.DB;
    const validator = c.get('projectValidator');
    const projectId = parseInt(c.req.param("projectId"));
    
    if (!projectId || isNaN(projectId)) {
      return c.json({ error: "Valid project ID is required" }, 400);
    }

    const exporter = new ClaudeCodeExporter(db);
    
    // Get project details and resources
    const project = await exporter._getProjectDetails(projectId);
    if (!project) {
      return c.json({ error: "Project not found" }, 404);
    }

    const resources = await exporter._getProjectResources(projectId);
    
    // Use comprehensive validation
    const validationResult = await validator.validateExportRequirements(project, resources);

    const summary = {
      projectId,
      projectName: project.name,
      isReady: validationResult.isValid,
      errors: validationResult.errors,
      warnings: validationResult.warnings,
      recommendations: validationResult.recommendations,
      requiredComponents: validationResult.requiredComponents,
      missingComponents: validationResult.missingComponents,
      resources: {
        agents: resources.agents?.length || 0,
        rules: resources.rules?.length || 0,
        hooks: resources.hooks?.length || 0,
        total: (resources.agents?.length || 0) + (resources.rules?.length || 0) + (resources.hooks?.length || 0)
      },
      claudeCodeCompatibility: {
        score: this._calculateCompatibilityScore(validationResult),
        issues: this._getCompatibilityIssues(validationResult),
        suggestions: this._getCompatibilitySuggestions(validationResult)
      }
    };

    return c.json(summary);

  } catch (error) {
    console.error('Export validation failed:', error);
    return c.json({ 
      error: "Validation failed", 
      details: error.message 
    }, 500);
  }
});

// Helper function to calculate compatibility score
function _calculateCompatibilityScore(validationResult) {
  let score = 100;
  
  // Deduct points for errors and warnings
  score -= validationResult.errors.length * 20;
  score -= validationResult.warnings.length * 5;
  
  // Bonus points for having required components
  if (validationResult.requiredComponents.project) score += 5;
  if (validationResult.requiredComponents.agents) score += 10;
  if (validationResult.requiredComponents.primaryAgent) score += 5;
  if (validationResult.requiredComponents.rules) score += 5;
  if (validationResult.requiredComponents.hooks) score += 5;
  
  return Math.max(0, Math.min(100, score));
}

// Helper function to get compatibility issues
function _getCompatibilityIssues(validationResult) {
  const issues = [];
  
  if (validationResult.missingComponents.length > 0) {
    issues.push(`Missing components: ${validationResult.missingComponents.join(', ')}`);
  }
  
  if (!validationResult.requiredComponents.primaryAgent && validationResult.requiredComponents.agents) {
    issues.push('No primary agent designated');
  }
  
  return issues;
}

// Helper function to get compatibility suggestions
function _getCompatibilitySuggestions(validationResult) {
  const suggestions = [];
  
  if (validationResult.missingComponents.includes('agents')) {
    suggestions.push('Add at least one agent to define AI behavior');
  }
  
  if (validationResult.missingComponents.includes('rules')) {
    suggestions.push('Add rules to guide agent behavior and ensure consistency');
  }
  
  if (validationResult.missingComponents.includes('hooks')) {
    suggestions.push('Add hooks to automate workflows and improve productivity');
  }
  
  return suggestions.concat(validationResult.recommendations);
}

// ============================================
// AGENTS API
// ============================================

// List all agents
app.get("/api/agents", async (c) => {
  const db = c.env.DB;
  const result = await db
    .prepare(
      "SELECT * FROM agents WHERE is_active = 1 ORDER BY created_at DESC",
    )
    .all();
  return c.json(result.results);
});

// Get single agent
app.get("/api/agents/:id", async (c) => {
  const db = c.env.DB;
  const id = c.req.param("id");
  const result = await db
    .prepare("SELECT * FROM agents WHERE id = ?")
    .bind(id)
    .first();

  if (!result) {
    return c.json({ error: "Agent not found" }, 404);
  }
  return c.json(result);
});

// Create agent
app.post("/api/agents", async (c) => {
  try {
    const db = c.env.DB;
    const validator = c.get('projectValidator');
    const body = await c.req.json();
    const { name, role, style, description, system_prompt } = body;

    // Basic validation
    if (!name || !role) {
      return c.json({ error: "Name and role are required" }, 400);
    }

    // Comprehensive validation using ProjectValidator
    const validationResult = await validator.validateResourceDefinition('agent', {
      name,
      role,
      style,
      description,
      system_prompt
    });

    if (!validationResult.isValid) {
      return c.json({ 
        error: "Agent validation failed", 
        details: validationResult.errors,
        warnings: validationResult.warnings,
        recommendations: validationResult.recommendations
      }, 400);
    }

    const id = generateId();
    await db
      .prepare(
        "INSERT INTO agents (id, name, role, style, description, system_prompt) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .bind(id, name, role, style || "", description || "", system_prompt || "")
      .run();

    const agent = await db
      .prepare("SELECT * FROM agents WHERE id = ?")
      .bind(id)
      .first();
    
    // Include validation feedback in response
    const response = {
      ...agent,
      validation: {
        warnings: validationResult.warnings,
        recommendations: validationResult.recommendations
      }
    };
    
    return c.json(response, 201);
  } catch (error) {
    console.error('Agent creation error:', error);
    return c.json({ error: "Failed to create agent", details: error.message }, 500);
  }
});

// Update agent
app.put("/api/agents/:id", async (c) => {
  try {
    const db = c.env.DB;
    const validator = c.get('projectValidator');
    const id = c.req.param("id");
    const body = await c.req.json();

    const existing = await db
      .prepare("SELECT * FROM agents WHERE id = ?")
      .bind(id)
      .first();

    if (!existing) {
      return c.json({ error: "Agent not found" }, 404);
    }

    // Prepare updated data for validation
    const updatedData = {
      name: body.name ?? existing.name,
      role: body.role ?? existing.role,
      style: body.style ?? existing.style,
      description: body.description ?? existing.description,
      system_prompt: body.system_prompt ?? existing.system_prompt ?? ""
    };

    // Comprehensive validation using ProjectValidator
    const validationResult = await validator.validateResourceDefinition('agent', updatedData);

    if (!validationResult.isValid) {
      return c.json({ 
        error: "Agent validation failed", 
        details: validationResult.errors,
        warnings: validationResult.warnings,
        recommendations: validationResult.recommendations
      }, 400);
    }

    await db
      .prepare(
        `UPDATE agents
         SET name = ?, role = ?, style = ?, description = ?, system_prompt = ?, is_active = ?
         WHERE id = ?`,
      )
      .bind(
        updatedData.name,
        updatedData.role,
        updatedData.style,
        updatedData.description,
        updatedData.system_prompt,
        body.is_active ?? existing.is_active,
        id,
      )
      .run();

    const agent = await db
      .prepare("SELECT * FROM agents WHERE id = ?")
      .bind(id)
      .first();
    
    // Include validation feedback in response
    const response = {
      ...agent,
      validation: {
        warnings: validationResult.warnings,
        recommendations: validationResult.recommendations
      }
    };
    
    return c.json(response);
  } catch (error) {
    console.error('Agent update error:', error);
    return c.json({ error: "Failed to update agent", details: error.message }, 500);
  }
});

// Delete agent (soft delete)
app.delete("/api/agents/:id", async (c) => {
  const db = c.env.DB;
  const id = c.req.param("id");

  const result = await db
    .prepare("UPDATE agents SET is_active = 0 WHERE id = ?")
    .bind(id)
    .run();

  if (result.meta.changes === 0) {
    return c.json({ error: "Agent not found" }, 404);
  }
  return c.json({ success: true });
});

// ============================================
// PROMPT TEMPLATES API
// ============================================

// List templates
app.get("/api/templates", async (c) => {
  const db = c.env.DB;
  const result = await db
    .prepare(
      "SELECT * FROM prompt_templates WHERE is_active = 1 ORDER BY usage_count DESC, created_at DESC",
    )
    .all();
  return c.json(result.results);
});

// Get single template
app.get("/api/templates/:id", async (c) => {
  const db = c.env.DB;
  const id = c.req.param("id");
  const result = await db
    .prepare("SELECT * FROM prompt_templates WHERE id = ?")
    .bind(id)
    .first();

  if (!result) {
    return c.json({ error: "Template not found" }, 404);
  }
  return c.json(result);
});

// Create template
app.post("/api/templates", async (c) => {
  const db = c.env.DB;
  const body = await c.req.json();
  const { name, description, template_content, placeholders, category, tags } =
    body;

  if (!name || !template_content) {
    return c.json({ error: "Name and template_content are required" }, 400);
  }

  const id = generateId();
  await db
    .prepare(
      `INSERT INTO prompt_templates
       (id, name, description, template_content, placeholders, category, tags)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      name,
      description || "",
      template_content,
      JSON.stringify(placeholders || []),
      category || null,
      JSON.stringify(tags || []),
    )
    .run();

  const template = await db
    .prepare("SELECT * FROM prompt_templates WHERE id = ?")
    .bind(id)
    .first();
  return c.json(template, 201);
});

// Update template
app.put("/api/templates/:id", async (c) => {
  const db = c.env.DB;
  const id = c.req.param("id");
  const body = await c.req.json();

  const existing = await db
    .prepare("SELECT * FROM prompt_templates WHERE id = ?")
    .bind(id)
    .first();

  if (!existing) {
    return c.json({ error: "Template not found" }, 404);
  }

  await db
    .prepare(
      `UPDATE prompt_templates
       SET name = ?, description = ?, template_content = ?,
           placeholders = ?, category = ?, tags = ?, is_active = ?
       WHERE id = ?`,
    )
    .bind(
      body.name ?? existing.name,
      body.description ?? existing.description,
      body.template_content ?? existing.template_content,
      body.placeholders
        ? JSON.stringify(body.placeholders)
        : existing.placeholders,
      body.category ?? existing.category,
      body.tags ? JSON.stringify(body.tags) : existing.tags,
      body.is_active ?? existing.is_active,
      id,
    )
    .run();

  const template = await db
    .prepare("SELECT * FROM prompt_templates WHERE id = ?")
    .bind(id)
    .first();
  return c.json(template);
});

// Delete template (soft delete)
app.delete("/api/templates/:id", async (c) => {
  const db = c.env.DB;
  const id = c.req.param("id");

  const result = await db
    .prepare("UPDATE prompt_templates SET is_active = 0 WHERE id = ?")
    .bind(id)
    .run();

  if (result.meta.changes === 0) {
    return c.json({ error: "Template not found" }, 404);
  }
  return c.json({ success: true });
});

// ============================================
// OUTPUT REQUIREMENTS API
// ============================================

// List output requirements
app.get("/api/output-requirements", async (c) => {
  const db = c.env.DB;
  const category = c.req.query("category");

  let query = "SELECT * FROM output_requirements WHERE is_active = 1";
  const params = [];

  if (category) {
    query += " AND category = ?";
    params.push(category);
  }

  query += " ORDER BY usage_count DESC, created_at DESC";

  const stmt = db.prepare(query);
  const result =
    params.length > 0 ? await stmt.bind(...params).all() : await stmt.all();
  return c.json(result.results);
});

// Get single output requirement
app.get("/api/output-requirements/:id", async (c) => {
  const db = c.env.DB;
  const id = c.req.param("id");
  const result = await db
    .prepare("SELECT * FROM output_requirements WHERE id = ?")
    .bind(id)
    .first();

  if (!result) {
    return c.json({ error: "Output requirement not found" }, 404);
  }
  return c.json(result);
});

// Create output requirement
app.post("/api/output-requirements", async (c) => {
  const db = c.env.DB;
  const body = await c.req.json();
  const { name, description, requirements_content, category, tags } = body;

  if (!name || !requirements_content) {
    return c.json({ error: "Name and requirements_content are required" }, 400);
  }

  const id = generateId();
  await db
    .prepare(
      `INSERT INTO output_requirements
       (id, name, description, requirements_content, category, tags)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      name,
      description || "",
      requirements_content,
      category || null,
      JSON.stringify(tags || []),
    )
    .run();

  const requirement = await db
    .prepare("SELECT * FROM output_requirements WHERE id = ?")
    .bind(id)
    .first();
  return c.json(requirement, 201);
});

// Update output requirement
app.put("/api/output-requirements/:id", async (c) => {
  const db = c.env.DB;
  const id = c.req.param("id");
  const body = await c.req.json();

  const existing = await db
    .prepare("SELECT * FROM output_requirements WHERE id = ?")
    .bind(id)
    .first();

  if (!existing) {
    return c.json({ error: "Output requirement not found" }, 404);
  }

  await db
    .prepare(
      `UPDATE output_requirements
       SET name = ?, description = ?, requirements_content = ?,
           category = ?, tags = ?, is_active = ?
       WHERE id = ?`,
    )
    .bind(
      body.name ?? existing.name,
      body.description ?? existing.description,
      body.requirements_content ?? existing.requirements_content,
      body.category ?? existing.category,
      body.tags ? JSON.stringify(body.tags) : existing.tags,
      body.is_active ?? existing.is_active,
      id,
    )
    .run();

  const requirement = await db
    .prepare("SELECT * FROM output_requirements WHERE id = ?")
    .bind(id)
    .first();
  return c.json(requirement);
});

// Delete output requirement (soft delete)
app.delete("/api/output-requirements/:id", async (c) => {
  const db = c.env.DB;
  const id = c.req.param("id");

  const result = await db
    .prepare("UPDATE output_requirements SET is_active = 0 WHERE id = ?")
    .bind(id)
    .run();

  if (result.meta.changes === 0) {
    return c.json({ error: "Output requirement not found" }, 404);
  }
  return c.json({ success: true });
});

// Increment usage count
app.post("/api/output-requirements/:id/use", async (c) => {
  const db = c.env.DB;
  const id = c.req.param("id");

  await db
    .prepare(
      "UPDATE output_requirements SET usage_count = usage_count + 1 WHERE id = ?",
    )
    .bind(id)
    .run();

  return c.json({ success: true });
});

// ============================================
// IDES API (read-only)
// ============================================

app.get("/api/ides", async (c) => {
  const db = c.env.DB;
  const result = await db
    .prepare("SELECT * FROM ides WHERE is_active = 1 ORDER BY display_name")
    .all();
  return c.json(result.results);
});

// ============================================
// AGENT RULES API
// ============================================

// List rules with optional filters
app.get("/api/rules", async (c) => {
  const db = c.env.DB;
  const ideId = c.req.query("ide_id");
  const agentId = c.req.query("agent_id");
  const category = c.req.query("category");

  let query = "SELECT * FROM agent_rules WHERE is_active = 1";
  const params = [];

  if (ideId) {
    query += " AND ide_id = ?";
    params.push(ideId);
  }
  if (agentId) {
    query += " AND agent_id = ?";
    params.push(agentId);
  }
  if (category) {
    query += " AND category = ?";
    params.push(category);
  }

  query += " ORDER BY priority DESC, created_at DESC";

  const stmt = db.prepare(query);
  const result =
    params.length > 0 ? await stmt.bind(...params).all() : await stmt.all();
  return c.json(result.results);
});

// Get single rule
app.get("/api/rules/:id", async (c) => {
  const db = c.env.DB;
  const id = c.req.param("id");
  const result = await db
    .prepare("SELECT * FROM agent_rules WHERE id = ?")
    .bind(id)
    .first();

  if (!result) {
    return c.json({ error: "Rule not found" }, 404);
  }
  return c.json(result);
});

// Create rule
app.post("/api/rules", async (c) => {
  try {
    const db = c.env.DB;
    const validator = c.get('projectValidator');
    const body = await c.req.json();
    const {
      name,
      description,
      rule_content,
      ide_id,
      agent_id,
      category,
      priority,
      tags,
    } = body;

    if (!name || !rule_content) {
      return c.json({ error: "Name and rule_content are required" }, 400);
    }

    // Comprehensive validation using ProjectValidator
    const validationResult = await validator.validateResourceDefinition('rule', {
      title: name,
      description,
      rule_text: rule_content,
      category,
      priority: priority === 0 ? 'low' : (priority === 1 ? 'medium' : (priority === 2 ? 'high' : 'critical'))
    });

    if (!validationResult.isValid) {
      return c.json({ 
        error: "Rule validation failed", 
        details: validationResult.errors,
        warnings: validationResult.warnings,
        recommendations: validationResult.recommendations
      }, 400);
    }

    const id = generateId();
    await db
      .prepare(
        `INSERT INTO agent_rules
         (id, name, description, rule_content, ide_id, agent_id, category, priority, tags)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        id,
        name,
        description || "",
        rule_content,
        ide_id || null,
        agent_id || null,
        category || null,
        priority || 0,
        JSON.stringify(tags || []),
      )
      .run();

    const rule = await db
      .prepare("SELECT * FROM agent_rules WHERE id = ?")
      .bind(id)
      .first();
    
    // Include validation feedback in response
    const response = {
      ...rule,
      validation: {
        warnings: validationResult.warnings,
        recommendations: validationResult.recommendations
      }
    };
    
    return c.json(response, 201);
  } catch (error) {
    console.error('Rule creation error:', error);
    return c.json({ error: "Failed to create rule", details: error.message }, 500);
  }
});

// Update rule
app.put("/api/rules/:id", async (c) => {
  const db = c.env.DB;
  const id = c.req.param("id");
  const body = await c.req.json();

  const existing = await db
    .prepare("SELECT * FROM agent_rules WHERE id = ?")
    .bind(id)
    .first();

  if (!existing) {
    return c.json({ error: "Rule not found" }, 404);
  }

  await db
    .prepare(
      `UPDATE agent_rules
       SET name = ?, description = ?, rule_content = ?, ide_id = ?,
           agent_id = ?, category = ?, priority = ?, tags = ?, is_active = ?
       WHERE id = ?`,
    )
    .bind(
      body.name ?? existing.name,
      body.description ?? existing.description,
      body.rule_content ?? existing.rule_content,
      body.ide_id !== undefined ? body.ide_id : existing.ide_id,
      body.agent_id !== undefined ? body.agent_id : existing.agent_id,
      body.category ?? existing.category,
      body.priority ?? existing.priority,
      body.tags ? JSON.stringify(body.tags) : existing.tags,
      body.is_active ?? existing.is_active,
      id,
    )
    .run();

  const rule = await db
    .prepare("SELECT * FROM agent_rules WHERE id = ?")
    .bind(id)
    .first();
  return c.json(rule);
});

// Delete rule (soft delete)
app.delete("/api/rules/:id", async (c) => {
  const db = c.env.DB;
  const id = c.req.param("id");

  const result = await db
    .prepare("UPDATE agent_rules SET is_active = 0 WHERE id = ?")
    .bind(id)
    .run();

  if (result.meta.changes === 0) {
    return c.json({ error: "Rule not found" }, 404);
  }
  return c.json({ success: true });
});

// ============================================
// PROJECT PLANS API
// ============================================

// List plans
app.get("/api/plans", async (c) => {
  const db = c.env.DB;
  const status = c.req.query("status");

  let query = "SELECT * FROM project_plans WHERE 1=1";
  const params = [];

  if (status) {
    query += " AND status = ?";
    params.push(status);
  }

  query += " ORDER BY created_at DESC";

  const stmt = db.prepare(query);
  const result =
    params.length > 0 ? await stmt.bind(...params).all() : await stmt.all();
  return c.json(result.results);
});

// Get plan with steps
app.get("/api/plans/:id", async (c) => {
  const db = c.env.DB;
  const id = c.req.param("id");

  const plan = await db
    .prepare("SELECT * FROM project_plans WHERE id = ?")
    .bind(id)
    .first();

  if (!plan) {
    return c.json({ error: "Plan not found" }, 404);
  }

  const steps = await db
    .prepare("SELECT * FROM plan_steps WHERE plan_id = ? ORDER BY step_number")
    .bind(id)
    .all();

  return c.json({ ...plan, steps: steps.results });
});

// Get plan with steps and linked prompts (full view)
app.get("/api/plans/:id/full", async (c) => {
  const db = c.env.DB;
  const id = c.req.param("id");

  const plan = await db
    .prepare("SELECT * FROM project_plans WHERE id = ?")
    .bind(id)
    .first();

  if (!plan) {
    return c.json({ error: "Plan not found" }, 404);
  }

  // Get steps with linked prompts
  const steps = await db
    .prepare(
      `
      SELECT
        ps.*,
        pt.name as prompt_name,
        pt.template_content as prompt_content
      FROM plan_steps ps
      LEFT JOIN prompt_templates pt ON ps.prompt_id = pt.id
      WHERE ps.plan_id = ?
      ORDER BY ps.step_number
    `,
    )
    .bind(id)
    .all();

  return c.json({
    ...plan,
    steps: steps.results.map((step) => ({
      ...step,
      linkedPrompt: step.prompt_id
        ? {
            id: step.prompt_id,
            name: step.prompt_name,
            content: step.prompt_content,
          }
        : null,
    })),
  });
});

// Create plan
app.post("/api/plans", async (c) => {
  const db = c.env.DB;
  const body = await c.req.json();
  const { title, description, raw_input, priority, tags } = body;

  if (!title || !raw_input) {
    return c.json({ error: "Title and raw_input are required" }, 400);
  }

  const id = generateId();
  await db
    .prepare(
      `INSERT INTO project_plans
       (id, title, description, raw_input, priority, tags)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      title,
      description || "",
      raw_input,
      priority || "medium",
      JSON.stringify(tags || []),
    )
    .run();

  const plan = await db
    .prepare("SELECT * FROM project_plans WHERE id = ?")
    .bind(id)
    .first();
  return c.json(plan, 201);
});

// Update plan
app.put("/api/plans/:id", async (c) => {
  const db = c.env.DB;
  const id = c.req.param("id");
  const body = await c.req.json();

  const existing = await db
    .prepare("SELECT * FROM project_plans WHERE id = ?")
    .bind(id)
    .first();

  if (!existing) {
    return c.json({ error: "Plan not found" }, 404);
  }

  await db
    .prepare(
      `UPDATE project_plans
       SET title = ?, description = ?, raw_input = ?, status = ?,
           priority = ?, estimated_complexity = ?, tags = ?,
           started_at = ?, completed_at = ?
       WHERE id = ?`,
    )
    .bind(
      body.title ?? existing.title,
      body.description ?? existing.description,
      body.raw_input ?? existing.raw_input,
      body.status ?? existing.status,
      body.priority ?? existing.priority,
      body.estimated_complexity ?? existing.estimated_complexity,
      body.tags ? JSON.stringify(body.tags) : existing.tags,
      body.started_at ?? existing.started_at,
      body.completed_at ?? existing.completed_at,
      id,
    )
    .run();

  const plan = await db
    .prepare("SELECT * FROM project_plans WHERE id = ?")
    .bind(id)
    .first();
  return c.json(plan);
});

// Delete plan (cascade deletes steps)
app.delete("/api/plans/:id", async (c) => {
  const db = c.env.DB;
  const id = c.req.param("id");

  const result = await db
    .prepare("DELETE FROM project_plans WHERE id = ?")
    .bind(id)
    .run();

  if (result.meta.changes === 0) {
    return c.json({ error: "Plan not found" }, 404);
  }
  return c.json({ success: true });
});

// ============================================
// PLAN STEPS API
// ============================================

// Create step for a plan
app.post("/api/plans/:planId/steps", async (c) => {
  const db = c.env.DB;
  const planId = c.req.param("planId");
  const body = await c.req.json();
  const {
    step_number,
    title,
    description,
    semantic_prompt,
    estimated_effort,
    depends_on,
  } = body;

  if (!title) {
    return c.json({ error: "Title is required" }, 400);
  }

  // Verify plan exists
  const plan = await db
    .prepare("SELECT id FROM project_plans WHERE id = ?")
    .bind(planId)
    .first();

  if (!plan) {
    return c.json({ error: "Plan not found" }, 404);
  }

  // Get next step number if not provided
  let stepNum = step_number;
  if (!stepNum) {
    const maxStep = await db
      .prepare(
        "SELECT MAX(step_number) as max_num FROM plan_steps WHERE plan_id = ?",
      )
      .bind(planId)
      .first();
    stepNum = (maxStep?.max_num || 0) + 1;
  }

  const id = generateId();
  await db
    .prepare(
      `INSERT INTO plan_steps
       (id, plan_id, step_number, title, description, semantic_prompt, estimated_effort, depends_on)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      planId,
      stepNum,
      title,
      description || "",
      semantic_prompt || "",
      estimated_effort || "medium",
      JSON.stringify(depends_on || []),
    )
    .run();

  const step = await db
    .prepare("SELECT * FROM plan_steps WHERE id = ?")
    .bind(id)
    .first();
  return c.json(step, 201);
});

// Update step
app.put("/api/steps/:id", async (c) => {
  const db = c.env.DB;
  const id = c.req.param("id");
  const body = await c.req.json();

  const existing = await db
    .prepare("SELECT * FROM plan_steps WHERE id = ?")
    .bind(id)
    .first();

  if (!existing) {
    return c.json({ error: "Step not found" }, 404);
  }

  await db
    .prepare(
      `UPDATE plan_steps
       SET step_number = ?, title = ?, description = ?, semantic_prompt = ?,
           status = ?, estimated_effort = ?, depends_on = ?, output_notes = ?,
           completed_at = ?, prompt_id = ?
       WHERE id = ?`,
    )
    .bind(
      body.step_number ?? existing.step_number,
      body.title ?? existing.title,
      body.description ?? existing.description,
      body.semantic_prompt ?? existing.semantic_prompt,
      body.status ?? existing.status,
      body.estimated_effort ?? existing.estimated_effort,
      body.depends_on ? JSON.stringify(body.depends_on) : existing.depends_on,
      body.output_notes ?? existing.output_notes,
      body.completed_at ?? existing.completed_at,
      body.prompt_id !== undefined ? body.prompt_id : existing.prompt_id,
      id,
    )
    .run();

  const step = await db
    .prepare("SELECT * FROM plan_steps WHERE id = ?")
    .bind(id)
    .first();
  return c.json(step);
});

// Link prompt to step
app.post("/api/steps/:stepId/link-prompt", async (c) => {
  const db = c.env.DB;
  const stepId = c.req.param("stepId");
  const body = await c.req.json();
  const { prompt_id } = body;

  const existing = await db
    .prepare("SELECT * FROM plan_steps WHERE id = ?")
    .bind(stepId)
    .first();

  if (!existing) {
    return c.json({ error: "Step not found" }, 404);
  }

  // Verify prompt exists if provided
  if (prompt_id) {
    const prompt = await db
      .prepare("SELECT id FROM prompt_templates WHERE id = ?")
      .bind(prompt_id)
      .first();

    if (!prompt) {
      return c.json({ error: "Prompt not found" }, 404);
    }
  }

  await db
    .prepare("UPDATE plan_steps SET prompt_id = ? WHERE id = ?")
    .bind(prompt_id || null, stepId)
    .run();

  const step = await db
    .prepare("SELECT * FROM plan_steps WHERE id = ?")
    .bind(stepId)
    .first();
  return c.json(step);
});

// Delete step
app.delete("/api/steps/:id", async (c) => {
  const db = c.env.DB;
  const id = c.req.param("id");

  const result = await db
    .prepare("DELETE FROM plan_steps WHERE id = ?")
    .bind(id)
    .run();

  if (result.meta.changes === 0) {
    return c.json({ error: "Step not found" }, 404);
  }
  return c.json({ success: true });
});

// ============================================
// PROJECTS API
// ============================================

// List all projects
app.get("/api/projects", async (c) => {
  try {
    const db = c.env.DB;
    const projectManager = new ProjectManager(db);
    
    // Extract query parameters
    const options = {
      status: c.req.query("status"),
      category: c.req.query("category"),
      priority: c.req.query("priority"),
      search: c.req.query("search"),
      sortBy: c.req.query("sort_by") || 'updated_at',
      sortOrder: c.req.query("sort_order") || 'DESC',
      limit: parseInt(c.req.query("limit")) || 50,
      offset: parseInt(c.req.query("offset")) || 0,
      includeInAiContext: c.req.query("include_in_ai_context") ? 
        c.req.query("include_in_ai_context") === 'true' : null
    };

    const includeRelated = c.req.query("include_related") === "true";

    const result = await projectManager.listProjects(options);

    // Optionally include related projects for each
    if (includeRelated && result.projects.length > 0) {
      const projectsWithRelations = await Promise.all(
        result.projects.map(async (project) => {
          const relations = await db
            .prepare(
              `
              SELECT pr.*, p.name as related_name, p.slug as related_slug
              FROM project_relationships pr
              JOIN projects p ON p.id = pr.related_project_id
              WHERE pr.source_project_id = ?
            `,
            )
            .bind(project.id)
            .all();
          return { ...project, relationships: relations.results };
        }),
      );
      return c.json({
        ...result,
        projects: projectsWithRelations
      });
    }

    return c.json(result);
  } catch (error) {
    console.error('Error in /api/projects:', error);
    return c.json({ 
      error: error.message,
      details: error.stack,
      timestamp: new Date().toISOString()
    }, 500);
  }
});

// Get project by slug (SEO-friendly URL)
app.get("/api/projects/by-slug/:slug", async (c) => {
  const db = c.env.DB;
  const slug = c.req.param("slug");

  try {
    const projectManager = new ProjectManager(db);
    const project = await projectManager.getProjectBySlug(slug);

    if (!project) {
      return c.json({ error: "Project not found" }, 404);
    }

    // Get related projects (with error handling)
    let relationships = { results: [] };
    try {
      relationships = await db
        .prepare(
          `
          SELECT pr.*, p.name as related_name, p.slug as related_slug, p.description as related_description, p.cover_image as related_cover_image
          FROM project_relationships pr
          JOIN projects p ON p.id = pr.related_project_id
          WHERE pr.source_project_id = ?
        `,
        )
        .bind(project.id)
        .all();
    } catch (e) {
      console.error("Error fetching relationships:", e);
    }

    // Get linked plans (with error handling)
    let plans = { results: [] };
    try {
      plans = await db
        .prepare(
          `
          SELECT pp.* FROM project_plans pp
          WHERE pp.id IN (SELECT plan_id FROM project_plans_link WHERE project_id = ?)
        `,
        )
        .bind(project.id)
        .all();
    } catch (e) {
      console.error("Error fetching plans:", e);
    }

    // Get assigned agents (with error handling)
    let agents = { results: [] };
    try {
      agents = await db
        .prepare(
          `
          SELECT a.*, pa.is_primary FROM agents a
          JOIN project_agents pa ON pa.agent_id = a.id
          WHERE pa.project_id = ? AND a.is_active = 1
        `,
        )
        .bind(project.id)
        .all();
    } catch (e) {
      console.error("Error fetching agents:", e);
    }

    return c.json({
      ...project,
      relationships: relationships.results,
      plans: plans.results,
      agents: agents.results,
    });
  } catch (error) {
    console.error("Error in get project by slug:", error);
    return c.json(
      { error: "Failed to load project", details: error.message },
      500,
    );
  }
});

// Get project by ID
app.get("/api/projects/:id", async (c) => {
  try {
    const db = c.env.DB;
    const projectManager = new ProjectManager(db);
    const id = parseInt(c.req.param("id"));

    const project = await projectManager.getProject(id);
    
    if (!project) {
      return c.json({ error: "Project not found" }, 404);
    }

    // Get related projects (keeping existing relationship functionality)
    const relationships = await db
      .prepare(
        `
        SELECT pr.*, p.name as related_name, p.slug as related_slug, p.description as related_description
        FROM project_relationships pr
        JOIN projects p ON p.id = pr.related_project_id
        WHERE pr.source_project_id = ?
      `,
      )
      .bind(id)
      .all();

    return c.json({
      ...project,
      relationships: relationships.results,
    });
  } catch (error) {
    return c.json({ error: error.message }, 500);
  }
});

// Create project
app.post("/api/projects", async (c) => {
  try {
    const projectManager = c.get('projectManager');
    const body = await c.req.json();

    const project = await projectManager.createProject(body);
    return c.json({ success: true, project }, 201);
  } catch (error) {
    const errorHandler = c.get('errorHandler');
    
    if (error instanceof SystemError) {
      const statusCode = error.code === 'VALIDATION_ERROR' ? 400 : 
                        error.code === 'CONFLICT_ERROR' ? 409 : 
                        error.code === 'RESOURCE_NOT_FOUND' ? 404 : 500;
      return c.json(error.toJSON(), statusCode);
    }
    
    const errorResponse = errorHandler.handleError(error, {
      operation: 'createProject',
      body
    });
    return c.json(errorResponse, 500);
  }
});

// Update project
app.put("/api/projects/:id", async (c) => {
  try {
    const db = c.env.DB;
    const projectManager = new ProjectManager(db);
    const id = parseInt(c.req.param("id"));
    const body = await c.req.json();

    const project = await projectManager.updateProject(id, body);
    return c.json(project);
  } catch (error) {
    if (error.message === 'Project not found') {
      return c.json({ error: error.message }, 404);
    }
    return c.json({ error: error.message }, 400);
  }
});

// Delete project
app.delete("/api/projects/:id", async (c) => {
  try {
    const projectManager = c.get('projectManager');
    const id = parseInt(c.req.param("id"));

    const result = await projectManager.deleteProject(id);
    return c.json(result);
  } catch (error) {
    const errorHandler = c.get('errorHandler');
    
    if (error instanceof SystemError) {
      const statusCode = error.code === 'RESOURCE_NOT_FOUND' ? 404 : 
                        error.code === 'TRANSACTION_ERROR' ? 500 : 400;
      return c.json(error.toJSON(), statusCode);
    }
    
    const errorResponse = errorHandler.handleError(error, {
      operation: 'deleteProject',
      projectId: id
    });
    return c.json(errorResponse, 500);
  }
});

// ============================================
// PROJECT RESOURCES API
// ============================================

// Assign resource to project with validation
app.post("/api/projects/:id/resources", async (c) => {
  try {
    const db = c.env.DB;
    const resourceManager = c.get('resourceManager');
    const validator = c.get('projectValidator');
    const projectId = parseInt(c.req.param("id"));
    const body = await c.req.json();

    const {
      resource_type,
      resource_id,
      is_primary = false,
      assignment_order = 0,
      config_overrides = null,
      assigned_by = null,
      assignment_reason = null
    } = body;

    if (!resource_type || !resource_id) {
      return c.json({ 
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'resource_type and resource_id are required',
          details: { resource_type, resource_id }
        }
      }, 400);
    }

    // Get resource data for validation
    let resourceData = null;
    try {
      switch (resource_type) {
        case 'agent':
          resourceData = await db.prepare('SELECT * FROM agents WHERE id = ?').bind(resource_id).first();
          break;
        case 'rule':
          resourceData = await db.prepare('SELECT * FROM agent_rules WHERE id = ?').bind(resource_id).first();
          break;
        case 'hook':
          resourceData = await db.prepare('SELECT * FROM hooks WHERE id = ?').bind(resource_id).first();
          break;
      }
    } catch (error) {
      console.warn('Could not fetch resource data for validation:', error);
    }

    // Perform resource validation if data is available
    let validationFeedback = null;
    if (resourceData) {
      try {
        const validationResult = await validator.validateResourceDefinition(resource_type, resourceData);
        validationFeedback = {
          warnings: validationResult.warnings,
          recommendations: validationResult.recommendations
        };
      } catch (error) {
        console.warn('Resource validation failed:', error);
      }
    }

    const assignment = await resourceManager.assignResource(projectId, resource_type, resource_id, {
      isPrimary: is_primary,
      assignmentOrder: assignment_order,
      configOverrides: config_overrides,
      assignedBy: assigned_by,
      assignmentReason: assignment_reason
    });

    const response = { 
      success: true, 
      assignment 
    };

    // Include validation feedback if available
    if (validationFeedback && (validationFeedback.warnings.length > 0 || validationFeedback.recommendations.length > 0)) {
      response.validation = validationFeedback;
    }

    return c.json(response, 201);
  } catch (error) {
    const errorHandler = c.get('errorHandler');
    
    if (error instanceof SystemError) {
      const statusCode = error.code === 'VALIDATION_ERROR' ? 400 : 
                        error.code === 'CONFLICT_ERROR' ? 409 : 
                        error.code === 'RESOURCE_NOT_FOUND' ? 404 : 
                        error.code === 'TRANSACTION_ERROR' ? 500 : 400;
      return c.json(error.toJSON(), statusCode);
    }
    
    const errorResponse = errorHandler.handleError(error, {
      operation: 'assignResource',
      projectId,
      body
    });
    return c.json(errorResponse, 500);
  }
});

// Unassign resource from project
app.delete("/api/projects/:id/resources/:resourceId", async (c) => {
  try {
    const db = c.env.DB;
    const resourceManager = new ResourceManager(db);
    const projectId = parseInt(c.req.param("id"));
    const resourceId = c.req.param("resourceId");
    const resourceType = c.req.query("resource_type");

    if (!resourceType) {
      return c.json({ error: "resource_type query parameter is required" }, 400);
    }

    const success = await resourceManager.unassignResource(projectId, resourceType, resourceId);
    
    if (!success) {
      return c.json({ error: "Resource assignment not found" }, 404);
    }

    return c.json({ success: true });
  } catch (error) {
    return c.json({ error: error.message }, 400);
  }
});

// List project resources
app.get("/api/projects/:id/resources", async (c) => {
  try {
    const db = c.env.DB;
    const resourceManager = new ResourceManager(db);
    const projectId = parseInt(c.req.param("id"));
    const resourceType = c.req.query("resource_type");

    const resources = await resourceManager.getProjectResources(projectId, resourceType);
    return c.json(resources);
  } catch (error) {
    return c.json({ error: error.message }, 500);
  }
});

// Get available resources for import
app.get("/api/projects/:id/available-resources", async (c) => {
  try {
    const db = c.env.DB;
    const resourceManager = new ResourceManager(db);
    const projectId = parseInt(c.req.param("id"));
    const resourceType = c.req.query("resource_type");

    const resources = await resourceManager.getAvailableResources(projectId, resourceType);
    return c.json(resources);
  } catch (error) {
    return c.json({ error: error.message }, 500);
  }
});

// Update resource assignment
app.put("/api/projects/:projectId/resources/:assignmentId", async (c) => {
  try {
    const db = c.env.DB;
    const resourceManager = new ResourceManager(db);
    const assignmentId = c.req.param("assignmentId"); // Keep as string
    const body = await c.req.json();

    const updates = {
      isPrimary: body.is_primary,
      assignmentOrder: body.assignment_order,
      configOverrides: body.config_overrides,
      assignmentReason: body.assignment_reason
    };

    const assignment = await resourceManager.updateResourceAssignment(assignmentId, updates);
    return c.json(assignment);
  } catch (error) {
    if (error.message.includes('not found')) {
      return c.json({ error: error.message }, 404);
    }
    return c.json({ error: error.message }, 400);
  }
});

// Get specific resource assignment
app.get("/api/projects/:projectId/resources/assignments/:assignmentId", async (c) => {
  try {
    const db = c.env.DB;
    const resourceManager = new ResourceManager(db);
    const assignmentId = c.req.param("assignmentId"); // Keep as string

    const assignment = await resourceManager.getResourceAssignment(assignmentId);
    
    if (!assignment) {
      return c.json({ error: "Resource assignment not found" }, 404);
    }

    return c.json(assignment);
  } catch (error) {
    return c.json({ error: error.message }, 500);
  }
});

// ============================================
// RESOURCE IMPORT API ENDPOINTS
// Implements requirements 3.1, 3.2, 3.4, 3.5
// Provides bulk resource import with dependency resolution
// ============================================

// Import resources into a project
app.post("/api/projects/:id/import", async (c) => {
  try {
    const db = c.env.DB;
    const projectManager = new ProjectManager(db);
    const projectId = parseInt(c.req.param("id"));
    const body = await c.req.json();

    const {
      resources = [],
      options = {}
    } = body;

    if (!Array.isArray(resources) || resources.length === 0) {
      return c.json({ error: "resources array is required and cannot be empty" }, 400);
    }

    if (resources.length > 50) {
      return c.json({ error: "Maximum 50 resources per import operation" }, 400);
    }

    // Validate resource structure
    for (const resource of resources) {
      if (!resource.resource_type || !resource.resource_id) {
        return c.json({ 
          error: "Each resource must have resource_type and resource_id" 
        }, 400);
      }

      const validTypes = ['agent', 'rule', 'hook'];
      if (!validTypes.includes(resource.resource_type)) {
        return c.json({ 
          error: `Invalid resource_type: ${resource.resource_type}. Must be one of: ${validTypes.join(', ')}` 
        }, 400);
      }
    }

    // Set default options
    const importOptions = {
      resolveDependencies: options.resolve_dependencies !== false,
      conflictResolution: options.conflict_resolution || 'skip',
      assignedBy: options.assigned_by || null,
      importReason: options.import_reason || 'api_import'
    };

    const result = await projectManager.importResources(projectId, resources, importOptions);
    return c.json(result);

  } catch (error) {
    console.error('Import operation failed:', error);
    
    if (error.message.includes('not found')) {
      return c.json({ error: error.message }, 404);
    }
    
    return c.json({ 
      error: "Import operation failed", 
      details: error.message 
    }, 500);
  }
});

// Get available resources for import (enhanced version)
app.get("/api/resources/available", async (c) => {
  try {
    const db = c.env.DB;
    const resourceManager = new ResourceManager(db);
    
    const projectId = c.req.query("project_id") ? parseInt(c.req.query("project_id")) : null;
    const resourceType = c.req.query("resource_type") || null;
    const includeAssigned = c.req.query("include_assigned") === 'true';
    const search = c.req.query("search") || null;
    const category = c.req.query("category") || null;

    let resources = [];

    if (projectId) {
      // Get resources with assignment status for specific project
      resources = await resourceManager.getAvailableResources(projectId, resourceType);
    } else {
      // Get all resources without project context
      const validTypes = resourceType ? [resourceType] : ['agent', 'rule', 'hook'];
      
      for (const type of validTypes) {
        let query, params = [];
        
        switch (type) {
          case 'agent':
            query = `
              SELECT 'agent' as resource_type, id as resource_id, name, role as metadata, 
                     description, 0 as is_assigned
              FROM agents 
              WHERE is_active = 1
            `;
            break;
          case 'rule':
            query = `
              SELECT 'rule' as resource_type, id as resource_id, name, category as metadata, 
                     description, 0 as is_assigned
              FROM agent_rules 
              WHERE is_active = 1
            `;
            break;
          case 'hook':
            query = `
              SELECT 'hook' as resource_type, id as resource_id, name, hook_type as metadata, 
                     description, 0 as is_assigned
              FROM hooks 
              WHERE is_enabled = 1
            `;
            break;
        }

        // Add search filter
        if (search) {
          query += ` AND (name LIKE ? OR description LIKE ?)`;
          params.push(`%${search}%`, `%${search}%`);
        }

        // Add category filter for rules
        if (category && type === 'rule') {
          query += ` AND category = ?`;
          params.push(category);
        }

        query += ` ORDER BY name`;

        const result = await db.prepare(query).bind(...params).all();
        resources.push(...result.results);
      }
    }

    // Filter out assigned resources if requested
    if (!includeAssigned && projectId) {
      resources = resources.filter(r => !r.is_assigned);
    }

    // Add dependency information for each resource
    const projectManager = new ProjectManager(db);
    const enhancedResources = [];
    for (const resource of resources) {
      const dependencies = await projectManager.getResourceDependencies(
        resource.resource_type, 
        resource.resource_id
      );
      
      enhancedResources.push({
        ...resource,
        dependencies_count: dependencies.length,
        critical_dependencies: dependencies.filter(d => d.is_critical).length,
        missing_dependencies: dependencies.filter(d => !d.exists).length
      });
    }

    return c.json({
      resources: enhancedResources,
      total: enhancedResources.length,
      filters: {
        project_id: projectId,
        resource_type: resourceType,
        include_assigned: includeAssigned,
        search,
        category
      }
    });

  } catch (error) {
    console.error('Failed to get available resources:', error);
    return c.json({ 
      error: "Failed to retrieve available resources", 
      details: error.message 
    }, 500);
  }
});

// Preview import operation
app.post("/api/projects/:id/import/preview", async (c) => {
  try {
    const db = c.env.DB;
    const projectManager = new ProjectManager(db);
    const projectId = parseInt(c.req.param("id"));
    const body = await c.req.json();

    const {
      resources = [],
      options = {}
    } = body;

    if (!Array.isArray(resources) || resources.length === 0) {
      return c.json({ error: "resources array is required and cannot be empty" }, 400);
    }

    // Validate resource structure
    for (const resource of resources) {
      if (!resource.resource_type || !resource.resource_id) {
        return c.json({ 
          error: "Each resource must have resource_type and resource_id" 
        }, 400);
      }
    }

    const previewOptions = {
      includeDependencies: options.include_dependencies !== false,
      checkCompatibility: options.check_compatibility !== false
    };

    const preview = await projectManager.previewImport(projectId, resources, previewOptions);
    return c.json(preview);

  } catch (error) {
    console.error('Import preview failed:', error);
    
    if (error.message.includes('not found')) {
      return c.json({ error: error.message }, 404);
    }
    
    return c.json({ 
      error: "Import preview failed", 
      details: error.message 
    }, 500);
  }
});

// Get resource dependencies
app.get("/api/resources/:resourceType/:resourceId/dependencies", async (c) => {
  try {
    const db = c.env.DB;
    const projectManager = new ProjectManager(db);
    
    const resourceType = c.req.param("resourceType");
    const resourceId = c.req.param("resourceId");

    const validTypes = ['agent', 'rule', 'hook'];
    if (!validTypes.includes(resourceType)) {
      return c.json({ 
        error: `Invalid resource_type: ${resourceType}. Must be one of: ${validTypes.join(', ')}` 
      }, 400);
    }

    const dependencies = await projectManager.getResourceDependencies(resourceType, resourceId);
    
    return c.json({
      resource_type: resourceType,
      resource_id: resourceId,
      dependencies,
      summary: {
        total: dependencies.length,
        critical: dependencies.filter(d => d.is_critical).length,
        missing: dependencies.filter(d => !d.exists).length,
        available: dependencies.filter(d => d.exists).length
      }
    });

  } catch (error) {
    console.error('Failed to get resource dependencies:', error);
    return c.json({ 
      error: "Failed to retrieve resource dependencies", 
      details: error.message 
    }, 500);
  }
});

// ============================================
// PROJECT RELATIONSHIPS API
// ============================================

// Add relationship between projects
app.post("/api/projects/:id/relationships", async (c) => {
  const db = c.env.DB;
  const sourceId = c.req.param("id");
  const body = await c.req.json();
  const {
    related_project_id,
    relationship_type,
    description,
    is_bidirectional,
  } = body;

  if (!related_project_id) {
    return c.json({ error: "related_project_id is required" }, 400);
  }

  if (sourceId === related_project_id) {
    return c.json({ error: "Cannot create relationship with itself" }, 400);
  }

  // Verify both projects exist
  const [source, related] = await Promise.all([
    db.prepare("SELECT id FROM projects WHERE id = ?").bind(sourceId).first(),
    db
      .prepare("SELECT id FROM projects WHERE id = ?")
      .bind(related_project_id)
      .first(),
  ]);

  if (!source) {
    return c.json({ error: "Source project not found" }, 404);
  }
  if (!related) {
    return c.json({ error: "Related project not found" }, 404);
  }

  const id = generateId();
  const relType = relationship_type || "related";

  try {
    await db
      .prepare(
        `
        INSERT INTO project_relationships
        (id, source_project_id, related_project_id, relationship_type, description, is_bidirectional)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      )
      .bind(
        id,
        sourceId,
        related_project_id,
        relType,
        description || null,
        is_bidirectional ? 1 : 0,
      )
      .run();

    // If bidirectional, create the reverse relationship
    if (is_bidirectional) {
      const reverseId = generateId();
      const reverseType =
        relType === "depends_on"
          ? "blocks"
          : relType === "blocks"
            ? "depends_on"
            : relType === "parent"
              ? "child"
              : relType === "child"
                ? "parent"
                : relType === "successor"
                  ? "predecessor"
                  : relType === "predecessor"
                    ? "successor"
                    : relType;

      await db
        .prepare(
          `
          INSERT OR IGNORE INTO project_relationships
          (id, source_project_id, related_project_id, relationship_type, description, is_bidirectional)
          VALUES (?, ?, ?, ?, ?, ?)
        `,
        )
        .bind(
          reverseId,
          related_project_id,
          sourceId,
          reverseType,
          description || null,
          1,
        )
        .run();
    }

    const relationship = await db
      .prepare("SELECT * FROM project_relationships WHERE id = ?")
      .bind(id)
      .first();

    return c.json(relationship, 201);
  } catch (error) {
    if (error.message?.includes("UNIQUE constraint")) {
      return c.json({ error: "Relationship already exists" }, 409);
    }
    throw error;
  }
});

// List relationships for a project
app.get("/api/projects/:id/relationships", async (c) => {
  const db = c.env.DB;
  const id = c.req.param("id");
  const type = c.req.query("type");

  let query = `
    SELECT pr.*, p.name as related_name, p.slug as related_slug,
           p.description as related_description, p.cover_image as related_cover_image,
           p.status as related_status
    FROM project_relationships pr
    JOIN projects p ON p.id = pr.related_project_id
    WHERE pr.source_project_id = ?
  `;
  const params = [id];

  if (type) {
    query += " AND pr.relationship_type = ?";
    params.push(type);
  }

  query += " ORDER BY pr.created_at DESC";

  const result = await db
    .prepare(query)
    .bind(...params)
    .all();
  return c.json(result.results);
});

// Delete relationship
app.delete("/api/projects/:id/relationships/:relationshipId", async (c) => {
  const db = c.env.DB;
  const projectId = c.req.param("id");
  const relationshipId = c.req.param("relationshipId");

  // Get the relationship to check for bidirectional
  const relationship = await db
    .prepare(
      "SELECT * FROM project_relationships WHERE id = ? AND source_project_id = ?",
    )
    .bind(relationshipId, projectId)
    .first();

  if (!relationship) {
    return c.json({ error: "Relationship not found" }, 404);
  }

  // Delete the relationship
  await db
    .prepare("DELETE FROM project_relationships WHERE id = ?")
    .bind(relationshipId)
    .run();

  // If bidirectional, delete the reverse too
  if (relationship.is_bidirectional) {
    await db
      .prepare(
        `
        DELETE FROM project_relationships
        WHERE source_project_id = ? AND related_project_id = ?
      `,
      )
      .bind(relationship.related_project_id, projectId)
      .run();
  }

  return c.json({ success: true });
});

// ============================================
// PROJECT AGENTS API
// ============================================

// Link agent to project
app.post("/api/projects/:id/agents", async (c) => {
  const db = c.env.DB;
  const projectId = c.req.param("id");
  const body = await c.req.json();
  const { agent_id, is_primary } = body;

  if (!agent_id) {
    return c.json({ error: "agent_id is required" }, 400);
  }

  const id = generateId();

  // If setting as primary, clear other primary flags
  if (is_primary) {
    await db
      .prepare("UPDATE project_agents SET is_primary = 0 WHERE project_id = ?")
      .bind(projectId)
      .run();
  }

  try {
    await db
      .prepare(
        `
        INSERT INTO project_agents (id, project_id, agent_id, is_primary)
        VALUES (?, ?, ?, ?)
      `,
      )
      .bind(id, projectId, agent_id, is_primary ? 1 : 0)
      .run();

    return c.json({ success: true, id }, 201);
  } catch (error) {
    if (error.message?.includes("UNIQUE constraint")) {
      return c.json({ error: "Agent already linked to project" }, 409);
    }
    throw error;
  }
});

// Remove agent from project
app.delete("/api/projects/:id/agents/:agentId", async (c) => {
  const db = c.env.DB;
  const projectId = c.req.param("id");
  const agentId = c.req.param("agentId");

  const result = await db
    .prepare("DELETE FROM project_agents WHERE project_id = ? AND agent_id = ?")
    .bind(projectId, agentId)
    .run();

  if (result.meta.changes === 0) {
    return c.json({ error: "Agent link not found" }, 404);
  }

  return c.json({ success: true });
});

// ============================================
// PROJECT AI CONTEXT API
// ============================================

// ============================================
// PROJECT PROMPTS API
// ============================================

// Save a generated prompt to a project with enhanced context
app.post("/api/projects/:id/prompts", async (c) => {
  const db = c.env.DB;
  const projectId = c.req.param("id");
  const body = await c.req.json();
  const {
    prompt_content,
    prompt_type = "general",
    title,
    prompt_notes,
    agent_id,
    agent_name,
    context_used,
    constraints_used,
    output_format,
    output_requirements_id,
    output_requirements_content,
    enhancement_type,
    is_primary = 0,
    task_description,
    project_rules_used,
    generation_metadata
  } = body;

  if (!prompt_content) {
    return c.json({ error: "prompt_content is required" }, 400);
  }

  // Verify project exists
  const project = await db
    .prepare("SELECT id, name FROM projects WHERE id = ?")
    .bind(projectId)
    .first();

  if (!project) {
    return c.json({ error: "Project not found" }, 404);
  }

  // If agent_id provided, verify it exists and get agent name
  let resolvedAgentName = agent_name;
  if (agent_id && !agent_name) {
    const agent = await db.prepare("SELECT name FROM agents WHERE id = ? AND is_active = 1")
      .bind(agent_id).first();
    if (agent) {
      resolvedAgentName = agent.name;
    }
  }

  const id = generateId();

  try {
    await db
      .prepare(
        `INSERT INTO project_prompts
         (id, project_id, prompt_content, prompt_type, title, prompt_notes,
          agent_id, agent_name, context_used, constraints_used, output_format,
          output_requirements_id, output_requirements_content, enhancement_type, is_primary)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        id,
        projectId,
        prompt_content,
        prompt_type,
        title || `Prompt for ${project.name} - ${new Date().toLocaleDateString()}`,
        prompt_notes || null,
        agent_id || null,
        resolvedAgentName || null,
        context_used || null,
        constraints_used || project_rules_used || null,
        output_format || null,
        output_requirements_id || null,
        output_requirements_content || null,
        enhancement_type || null,
        is_primary,
      )
      .run();

    const savedPrompt = await db
      .prepare("SELECT * FROM project_prompts WHERE id = ?")
      .bind(id)
      .first();

    // If this is marked as primary, update other prompts to not be primary
    if (is_primary) {
      await db.prepare(
        "UPDATE project_prompts SET is_primary = 0 WHERE project_id = ? AND id != ?"
      ).bind(projectId, id).run();
    }

    return c.json({
      ...savedPrompt,
      project: {
        id: project.id,
        name: project.name
      },
      metadata: generation_metadata || null
    }, 201);

  } catch (error) {
    return c.json({ error: "Failed to save prompt", details: error.message }, 500);
  }
});

// Get all prompts for a project with enhanced filtering
app.get("/api/projects/:id/prompts", async (c) => {
  const db = c.env.DB;
  const projectId = c.req.param("id");
  const limit = parseInt(c.req.query("limit") || "50");
  const offset = parseInt(c.req.query("offset") || "0");
  const promptType = c.req.query("type");
  const agentId = c.req.query("agent_id");
  const search = c.req.query("search");

  // Build WHERE clause with filters
  let whereClause = "WHERE project_id = ?";
  const params = [projectId];

  if (promptType) {
    whereClause += " AND prompt_type = ?";
    params.push(promptType);
  }

  if (agentId) {
    whereClause += " AND agent_id = ?";
    params.push(agentId);
  }

  if (search) {
    whereClause += " AND (title LIKE ? OR prompt_content LIKE ? OR prompt_notes LIKE ?)";
    const searchPattern = `%${search}%`;
    params.push(searchPattern, searchPattern, searchPattern);
  }

  // Add pagination params
  params.push(limit, offset);

  try {
    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM project_prompts ${whereClause}`;
    const countResult = await db.prepare(countQuery).bind(...params.slice(0, -2)).first();
    const total = countResult.total;

    // Get prompts with agent information
    const promptsQuery = `
      SELECT pp.*, a.name as agent_display_name, a.role as agent_role
      FROM project_prompts pp
      LEFT JOIN agents a ON pp.agent_id = a.id
      ${whereClause}
      ORDER BY pp.is_primary DESC, pp.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const prompts = await db.prepare(promptsQuery).bind(...params).all();

    return c.json({
      prompts: prompts.results,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      },
      filters: {
        type: promptType,
        agentId,
        search
      }
    });

  } catch (error) {
    return c.json({ error: "Failed to get prompts", details: error.message }, 500);
  }
});

// Get a single prompt
app.get("/api/projects/:projectId/prompts/:promptId", async (c) => {
  const db = c.env.DB;
  const promptId = c.req.param("promptId");

  const prompt = await db
    .prepare("SELECT * FROM project_prompts WHERE id = ?")
    .bind(promptId)
    .first();

  if (!prompt) {
    return c.json({ error: "Prompt not found" }, 404);
  }

  return c.json(prompt);
});

// Update prompt feedback/usefulness
app.put("/api/projects/:projectId/prompts/:promptId", async (c) => {
  const db = c.env.DB;
  const promptId = c.req.param("promptId");
  const body = await c.req.json();

  const existing = await db
    .prepare("SELECT * FROM project_prompts WHERE id = ?")
    .bind(promptId)
    .first();

  if (!existing) {
    return c.json({ error: "Prompt not found" }, 404);
  }

  await db
    .prepare(
      `UPDATE project_prompts SET
        was_useful = ?, feedback = ?, prompt_notes = ?
       WHERE id = ?`,
    )
    .bind(
      body.was_useful !== undefined ? body.was_useful : existing.was_useful,
      body.feedback ?? existing.feedback,
      body.prompt_notes ?? existing.prompt_notes,
      promptId,
    )
    .run();

  const updated = await db
    .prepare("SELECT * FROM project_prompts WHERE id = ?")
    .bind(promptId)
    .first();

  return c.json(updated);
});

// Delete a prompt from project
app.delete("/api/projects/:projectId/prompts/:promptId", async (c) => {
  const db = c.env.DB;
  const promptId = c.req.param("promptId");

  const result = await db
    .prepare("DELETE FROM project_prompts WHERE id = ?")
    .bind(promptId)
    .run();

  if (result.meta.changes === 0) {
    return c.json({ error: "Prompt not found" }, 404);
  }

  return c.json({ success: true });
});

// ============================================
// AI LEARNING FROM PROMPTS
// ============================================

// Generate prompt from template with project context
app.post("/api/projects/:id/generate-from-template", async (c) => {
  const db = c.env.DB;
  const projectId = c.req.param("id");
  const body = await c.req.json();
  const {
    templateId,
    agentId,
    variables = {},
    savePrompt = false,
    promptTitle,
    promptNotes
  } = body;

  if (!templateId) {
    return c.json({ error: "Template ID is required" }, 400);
  }

  try {
    // Get project details
    const project = await db.prepare('SELECT * FROM projects WHERE id = ?').bind(projectId).first();
    if (!project) {
      return c.json({ error: "Project not found" }, 404);
    }

    // Get template
    const template = await db.prepare('SELECT * FROM prompt_templates WHERE id = ?').bind(templateId).first();
    if (!template) {
      return c.json({ error: "Template not found" }, 404);
    }

    // Get agent (use project primary agent if not specified)
    let agent = null;
    if (agentId) {
      agent = await db.prepare('SELECT * FROM agents WHERE id = ? AND is_active = 1').bind(agentId).first();
    } else {
      // Get primary agent from project
      const primaryAgentResult = await db.prepare(`
        SELECT a.* FROM agents a
        JOIN project_resources pr ON pr.resource_id = a.id
        WHERE pr.project_id = ? AND pr.resource_type = 'agent' AND pr.is_primary = 1 AND a.is_active = 1
        LIMIT 1
      `).bind(projectId).all();
      
      if (primaryAgentResult.results.length > 0) {
        agent = primaryAgentResult.results[0];
      }
    }

    if (!agent) {
      return c.json({ error: "No agent specified and no primary agent found for project" }, 400);
    }

    // Get project rules
    const rulesResult = await db.prepare(`
      SELECT ar.* FROM agent_rules ar
      JOIN project_resources pr ON pr.resource_id = ar.id
      WHERE pr.project_id = ? AND pr.resource_type = 'rule' AND ar.is_active = 1
      ORDER BY pr.is_primary DESC, pr.assignment_order
    `).bind(projectId).all();

    // Process template with variables and project context
    let processedTemplate = template.template_content;
    
    // Replace project variables
    const projectVars = {
      PROJECT_NAME: project.name,
      PROJECT_DESCRIPTION: project.description || '',
      PROJECT_CATEGORY: project.category || '',
      PROJECT_AI_CONTEXT: project.ai_context_summary || '',
      AGENT_NAME: agent.name,
      AGENT_ROLE: agent.role,
      AGENT_STYLE: agent.style || ''
    };

    // Replace all variables
    const allVariables = { ...projectVars, ...variables };
    Object.entries(allVariables).forEach(([key, value]) => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      processedTemplate = processedTemplate.replace(regex, value || '');
    });

    // Build final prompt with project context
    let finalPrompt = `${agent.role}\n\n`;

    if (agent.style) {
      finalPrompt += `<agent_style>\n${agent.style}\n</agent_style>\n\n`;
    }

    // Add project context
    finalPrompt += `<project_context>\n`;
    finalPrompt += `Project: ${project.name}\n`;
    if (project.description) {
      finalPrompt += `Description: ${project.description}\n`;
    }
    if (project.ai_context_summary) {
      finalPrompt += `AI Context: ${project.ai_context_summary}\n`;
    }
    finalPrompt += `</project_context>\n\n`;

    // Add project rules if any
    if (rulesResult.results.length > 0) {
      finalPrompt += `<project_rules>\n`;
      rulesResult.results.forEach(rule => {
        finalPrompt += `${rule.name}: ${rule.rule_content}\n`;
      });
      finalPrompt += `</project_rules>\n\n`;
    }

    // Add processed template content
    finalPrompt += processedTemplate;

    // Save prompt if requested
    let savedPrompt = null;
    if (savePrompt) {
      const promptId = generateId();
      await db.prepare(`
        INSERT INTO project_prompts (
          id, project_id, prompt_content, prompt_type, title, prompt_notes,
          agent_id, agent_name, context_used, constraints_used
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        promptId,
        projectId,
        finalPrompt,
        'template_generated',
        promptTitle || `${template.name} - ${new Date().toLocaleDateString()}`,
        promptNotes,
        agent.id,
        agent.name,
        `Template: ${template.name}`,
        rulesResult.results.map(r => r.name).join(', ')
      ).run();

      savedPrompt = await db.prepare('SELECT * FROM project_prompts WHERE id = ?').bind(promptId).first();
    }

    return c.json({
      prompt: finalPrompt,
      template: {
        id: template.id,
        name: template.name
      },
      project: {
        id: project.id,
        name: project.name
      },
      agent: {
        id: agent.id,
        name: agent.name,
        role: agent.role
      },
      variablesUsed: allVariables,
      rulesApplied: rulesResult.results.length,
      savedPrompt
    });

  } catch (error) {
    return c.json({ error: "Template generation failed", details: error.message }, 500);
  }
});

// Learn from a prompt to update project context
app.post("/api/projects/:id/learn-from-prompt", async (c) => {
  const db = c.env.DB;
  const ai = c.env.AI;
  const projectId = c.req.param("id");
  const body = await c.req.json();
  const { prompt_content, task_description, context, agent_role } = body;

  if (!ai) {
    return c.json({ error: "AI binding not configured" }, 500);
  }

  // Get current project
  const project = await db
    .prepare("SELECT * FROM projects WHERE id = ?")
    .bind(projectId)
    .first();

  if (!project) {
    return c.json({ error: "Project not found" }, 404);
  }

  try {
    // Use AI to extract insights from the prompt
    const response = await ai.run("@cf/meta/llama-3.1-8b-instruct", {
      messages: [
        {
          role: "system",
          content: `You are an AI assistant that analyzes prompts to extract useful project context.
Your job is to identify key information that would help future AI interactions with this project.
Extract:
1. Technologies, frameworks, or tools mentioned
2. Key requirements or constraints
3. Important context about the project's goals
4. Any patterns in how tasks should be approached

Return a JSON object with:
- context_update: A brief summary (1-2 sentences) to add to the project's AI context
- technologies: Array of technology names mentioned
- requirements: Array of key requirements inferred
- should_update: Boolean - true if there's meaningful new context to add`,
        },
        {
          role: "user",
          content: `Current project: ${project.name}
Current project context: ${project.ai_context_summary || "None"}
Current project info: ${project.project_info || "None"}

New prompt generated for this project:
Task: ${task_description}
Context provided: ${context || "None"}
Agent role used: ${agent_role || "None"}

Full prompt:
${prompt_content}

Analyze this and extract any new useful context for the project.`,
        },
      ],
      max_tokens: 1024,
      temperature: 0.3,
    });

    // Try to parse the AI response
    let insights;
    try {
      const jsonMatch = response.response.match(/\{[\s\S]*\}/);
      insights = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    } catch {
      insights = null;
    }

    if (insights && insights.should_update && insights.context_update) {
      // Save the insight for review
      const insightId = generateId();
      await db
        .prepare(
          `INSERT INTO project_ai_insights
           (id, project_id, insight_type, insight_content, confidence, status)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          insightId,
          projectId,
          "context_update",
          JSON.stringify(insights),
          0.7,
          "pending",
        )
        .run();

      // Optionally auto-update the project context (append to existing)
      const currentContext = project.ai_context_summary || "";
      const newContext = currentContext
        ? `${currentContext} ${insights.context_update}`
        : insights.context_update;

      // Only update if the new context adds value
      if (newContext.length > currentContext.length) {
        await db
          .prepare("UPDATE projects SET ai_context_summary = ? WHERE id = ?")
          .bind(newContext.substring(0, 500), projectId) // Limit context length
          .run();
      }

      return c.json({
        success: true,
        insights_extracted: true,
        context_updated: true,
        insights,
      });
    }

    return c.json({
      success: true,
      insights_extracted: false,
      message: "No significant new context detected",
    });
  } catch (error) {
    console.error("AI learning failed:", error);
    return c.json({
      success: false,
      error: "AI analysis failed",
      details: error.message,
    });
  }
});

// Get AI insights for a project
app.get("/api/projects/:id/ai-insights", async (c) => {
  const db = c.env.DB;
  const projectId = c.req.param("id");
  const status = c.req.query("status");

  let query = "SELECT * FROM project_ai_insights WHERE project_id = ?";
  const params = [projectId];

  if (status) {
    query += " AND status = ?";
    params.push(status);
  }

  query += " ORDER BY created_at DESC";

  const insights = await db
    .prepare(query)
    .bind(...params)
    .all();

  return c.json(insights.results);
});

// Update insight status (accept/reject)
app.put("/api/projects/:id/ai-insights/:insightId", async (c) => {
  const db = c.env.DB;
  const insightId = c.req.param("insightId");
  const body = await c.req.json();
  const { status } = body;

  if (!["pending", "accepted", "rejected", "applied"].includes(status)) {
    return c.json({ error: "Invalid status" }, 400);
  }

  await db
    .prepare(
      `UPDATE project_ai_insights
       SET status = ?, reviewed_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
    )
    .bind(status, insightId)
    .run();

  const updated = await db
    .prepare("SELECT * FROM project_ai_insights WHERE id = ?")
    .bind(insightId)
    .first();

  return c.json(updated);
});

// ============================================
// PROJECT AI CONTEXT API
// ============================================

// Get AI context for all related projects (for cross-project awareness)
app.get("/api/projects/:id/ai-context", async (c) => {
  const db = c.env.DB;
  const id = c.req.param("id");

  const project = await db
    .prepare("SELECT * FROM projects WHERE id = ?")
    .bind(id)
    .first();

  if (!project) {
    return c.json({ error: "Project not found" }, 404);
  }

  // Get all related projects that are included in AI context
  const relatedProjects = await db
    .prepare(
      `
      SELECT p.id, p.name, p.slug, p.ai_context_summary, p.description, pr.relationship_type
      FROM project_relationships pr
      JOIN projects p ON p.id = pr.related_project_id
      WHERE pr.source_project_id = ? AND p.include_in_ai_context = 1
    `,
    )
    .bind(id)
    .all();

  // Build AI context summary
  const context = {
    currentProject: {
      id: project.id,
      name: project.name,
      slug: project.slug,
      description: project.description,
      ai_context_summary: project.ai_context_summary,
      project_info: project.project_info,
    },
    relatedProjects: relatedProjects.results.map((rp) => ({
      name: rp.name,
      slug: rp.slug,
      relationship: rp.relationship_type,
      context: rp.ai_context_summary || rp.description,
    })),
    contextPrompt: `You are working on the project "${project.name}". ${project.ai_context_summary || project.description || ""}
${
  relatedProjects.results.length > 0
    ? `
This project has relationships with:
${relatedProjects.results.map((rp) => `- ${rp.name} (${rp.relationship_type}): ${rp.ai_context_summary || rp.description || "No description"}`).join("\n")}

When making changes, consider how they might affect these related projects.`
    : ""
}`,
  };

  return c.json(context);
});

// ============================================
// RULE SETS API
// ============================================

// List all rule sets
app.get("/api/rule-sets", async (c) => {
  const db = c.env.DB;
  const projectId = c.req.query("project_id");

  let query = "SELECT * FROM rule_sets";
  const params = [];

  if (projectId) {
    query += " WHERE project_id = ?";
    params.push(projectId);
  }

  query += " ORDER BY updated_at DESC";

  const stmt = db.prepare(query);
  const result =
    params.length > 0 ? await stmt.bind(...params).all() : await stmt.all();

  // Parse rules JSON for each result
  const ruleSets = result.results.map((rs) => ({
    ...rs,
    rules: rs.rules ? JSON.parse(rs.rules) : [],
  }));

  return c.json(ruleSets);
});

// Get single rule set
app.get("/api/rule-sets/:id", async (c) => {
  const db = c.env.DB;
  const id = c.req.param("id");

  const result = await db
    .prepare("SELECT * FROM rule_sets WHERE id = ?")
    .bind(id)
    .first();

  if (!result) {
    return c.json({ error: "Rule set not found" }, 404);
  }

  return c.json({
    ...result,
    rules: result.rules ? JSON.parse(result.rules) : [],
  });
});

// Create rule set
app.post("/api/rule-sets", async (c) => {
  const db = c.env.DB;
  const body = await c.req.json();
  const { name, description, file_type, project_id, rules } = body;

  if (!name) {
    return c.json({ error: "Name is required" }, 400);
  }

  const id = generateId();
  const rulesJson = JSON.stringify(rules || []);
  const rulesCount = (rules || []).length;

  await db
    .prepare(
      `INSERT INTO rule_sets (id, name, description, file_type, project_id, rules, rules_count)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      name,
      description || "",
      file_type || "CLAUDE.md",
      project_id || null,
      rulesJson,
      rulesCount,
    )
    .run();

  const ruleSet = await db
    .prepare("SELECT * FROM rule_sets WHERE id = ?")
    .bind(id)
    .first();

  return c.json(
    {
      ...ruleSet,
      rules: ruleSet.rules ? JSON.parse(ruleSet.rules) : [],
    },
    201,
  );
});

// Update rule set
app.put("/api/rule-sets/:id", async (c) => {
  const db = c.env.DB;
  const id = c.req.param("id");
  const body = await c.req.json();

  const existing = await db
    .prepare("SELECT * FROM rule_sets WHERE id = ?")
    .bind(id)
    .first();

  if (!existing) {
    return c.json({ error: "Rule set not found" }, 404);
  }

  const rulesJson =
    body.rules !== undefined ? JSON.stringify(body.rules) : existing.rules;
  const rulesCount =
    body.rules !== undefined ? body.rules.length : existing.rules_count;

  await db
    .prepare(
      `UPDATE rule_sets SET
        name = ?, description = ?, file_type = ?, project_id = ?, rules = ?, rules_count = ?
       WHERE id = ?`,
    )
    .bind(
      body.name ?? existing.name,
      body.description ?? existing.description,
      body.file_type ?? existing.file_type,
      body.project_id !== undefined ? body.project_id : existing.project_id,
      rulesJson,
      rulesCount,
      id,
    )
    .run();

  const ruleSet = await db
    .prepare("SELECT * FROM rule_sets WHERE id = ?")
    .bind(id)
    .first();

  return c.json({
    ...ruleSet,
    rules: ruleSet.rules ? JSON.parse(ruleSet.rules) : [],
  });
});

// Delete rule set
app.delete("/api/rule-sets/:id", async (c) => {
  const db = c.env.DB;
  const id = c.req.param("id");

  const result = await db
    .prepare("DELETE FROM rule_sets WHERE id = ?")
    .bind(id)
    .run();

  if (result.meta.changes === 0) {
    return c.json({ error: "Rule set not found" }, 404);
  }

  return c.json({ success: true });
});

// Generate rules file content
app.post("/api/rule-sets/:id/generate", async (c) => {
  const db = c.env.DB;
  const id = c.req.param("id");
  const body = await c.req.json();
  const { argument_values } = body; // Optional: values for template arguments

  const ruleSet = await db
    .prepare("SELECT * FROM rule_sets WHERE id = ?")
    .bind(id)
    .first();

  if (!ruleSet) {
    return c.json({ error: "Rule set not found" }, 404);
  }

  const rules = ruleSet.rules ? JSON.parse(ruleSet.rules) : [];
  let content = "";

  if (ruleSet.file_type === "CLAUDE.md") {
    // Generate CLAUDE.md format
    content = `# ${ruleSet.name}\n\n`;
    if (ruleSet.description) {
      content += `${ruleSet.description}\n\n`;
    }

    // Group rules by priority
    const highPriority = rules.filter((r) => r.priority === "high");
    const mediumPriority = rules.filter((r) => r.priority === "medium");
    const lowPriority = rules.filter((r) => r.priority === "low");

    if (highPriority.length > 0) {
      content += `## Critical Rules\n\n`;
      highPriority.forEach((rule) => {
        content += `### ${rule.title}\n\n`;
        content += `${replaceArguments(rule.content, argument_values)}\n\n`;
      });
    }

    if (mediumPriority.length > 0) {
      content += `## Standard Rules\n\n`;
      mediumPriority.forEach((rule) => {
        content += `### ${rule.title}\n\n`;
        content += `${replaceArguments(rule.content, argument_values)}\n\n`;
      });
    }

    if (lowPriority.length > 0) {
      content += `## Guidelines\n\n`;
      lowPriority.forEach((rule) => {
        content += `### ${rule.title}\n\n`;
        content += `${replaceArguments(rule.content, argument_values)}\n\n`;
      });
    }

    content += `---\n*Generated by Semantic Prompt Workstation*\n`;
  } else {
    // Generate .claude/rules format (simple text format)
    content += `# ${ruleSet.name}\n`;
    if (ruleSet.description) {
      content += `# ${ruleSet.description}\n`;
    }
    content += `\n`;

    rules.forEach((rule) => {
      const priorityMarker =
        rule.priority === "high"
          ? "[CRITICAL] "
          : rule.priority === "medium"
            ? ""
            : "[OPTIONAL] ";
      content += `## ${priorityMarker}${rule.title}\n`;
      content += `${replaceArguments(rule.content, argument_values)}\n\n`;
    });
  }

  return c.json({
    content,
    file_type: ruleSet.file_type,
    filename:
      ruleSet.file_type === "CLAUDE.md"
        ? "CLAUDE.md"
        : `${ruleSet.name.toLowerCase().replace(/\s+/g, "-")}.md`,
  });
});

/**
 * Replaces template arguments in content with provided values
 * @param {string} content - The content with {ARGUMENT} placeholders
 * @param {object} values - Object mapping argument names to values
 * @returns {string} Content with arguments replaced
 */
function replaceArguments(content, values) {
  if (!values || typeof values !== "object") return content;

  return content.replace(/\{([A-Z_][A-Z0-9_]*)\}/g, (match, argName) => {
    return values[argName] !== undefined ? values[argName] : match;
  });
}

// ============================================
// RULE SET - PROJECT LINKING (MANY-TO-MANY)
// ============================================

// Get projects linked to a rule set
app.get("/api/rule-sets/:id/projects", async (c) => {
  const db = c.env.DB;
  const id = c.req.param("id");

  const result = await db
    .prepare(
      `SELECT p.*, rsp.is_primary, rsp.created_at as linked_at
       FROM projects p
       JOIN rule_set_projects rsp ON p.id = rsp.project_id
       WHERE rsp.rule_set_id = ?
       ORDER BY rsp.is_primary DESC, p.name ASC`
    )
    .bind(id)
    .all();

  return c.json(result.results || []);
});

// Link projects to a rule set
app.post("/api/rule-sets/:id/projects", async (c) => {
  const db = c.env.DB;
  const ruleSetId = c.req.param("id");
  const body = await c.req.json();
  const { project_ids, is_primary = false } = body;

  if (!project_ids || !Array.isArray(project_ids) || project_ids.length === 0) {
    return c.json({ error: "project_ids array is required" }, 400);
  }

  // Verify rule set exists
  const ruleSet = await db
    .prepare("SELECT id FROM rule_sets WHERE id = ?")
    .bind(ruleSetId)
    .first();

  if (!ruleSet) {
    return c.json({ error: "Rule set not found" }, 404);
  }

  const results = [];
  for (const projectId of project_ids) {
    const linkId = generateId();
    try {
      await db
        .prepare(
          `INSERT OR IGNORE INTO rule_set_projects (id, rule_set_id, project_id, is_primary)
           VALUES (?, ?, ?, ?)`
        )
        .bind(linkId, ruleSetId, projectId, is_primary ? 1 : 0)
        .run();
      results.push({ project_id: projectId, linked: true });
    } catch (error) {
      results.push({ project_id: projectId, linked: false, error: error.message });
    }
  }

  return c.json({ success: true, results });
});

// Unlink a project from a rule set
app.delete("/api/rule-sets/:id/projects/:projectId", async (c) => {
  const db = c.env.DB;
  const ruleSetId = c.req.param("id");
  const projectId = c.req.param("projectId");

  const result = await db
    .prepare("DELETE FROM rule_set_projects WHERE rule_set_id = ? AND project_id = ?")
    .bind(ruleSetId, projectId)
    .run();

  if (result.meta.changes === 0) {
    return c.json({ error: "Link not found" }, 404);
  }

  return c.json({ success: true });
});

// Get rule sets for a project
app.get("/api/projects/:id/rule-sets", async (c) => {
  const db = c.env.DB;
  const projectId = c.req.param("id");

  const result = await db
    .prepare(
      `SELECT rs.*, rsp.is_primary, rsp.created_at as linked_at
       FROM rule_sets rs
       JOIN rule_set_projects rsp ON rs.id = rsp.rule_set_id
       WHERE rsp.project_id = ?
       ORDER BY rsp.is_primary DESC, rs.name ASC`
    )
    .bind(projectId)
    .all();

  // Parse rules JSON for each result
  const ruleSets = (result.results || []).map((rs) => ({
    ...rs,
    rules: rs.rules ? JSON.parse(rs.rules) : [],
  }));

  return c.json(ruleSets);
});

// ============================================
// AI - NATURAL LANGUAGE TO XML CONVERSION
// ============================================

app.post("/api/ai/convert-to-xml", async (c) => {
  const ai = c.env.AI;

  if (!ai) {
    return c.json({ error: "AI binding not configured" }, 500);
  }

  const body = await c.req.json();
  const { prompt, task, context, constraints, format } = body;

  if (!prompt && !task) {
    return c.json({ error: "Prompt or task content is required" }, 400);
  }

  const inputContent = prompt || task;

  const systemPrompt = `You are an expert at structuring prompts for Claude AI. Convert the following natural language prompt into a well-structured XML format with these sections:

1. <context> - Background information and relevant context
2. <instructions> - The main task or request, clearly defined
3. <constraints> - Any limitations, requirements, or rules to follow
4. <output_requirements> - How the output should be formatted and what it should include

Rules:
- Extract implicit context and make it explicit in the <context> section
- Identify the core action/task for <instructions>
- Extract any mentioned constraints, best practices, or rules
- Infer appropriate output requirements if not explicitly stated
- Keep content concise but complete
- Output ONLY the XML structure, no explanations or additional text
- Ensure proper XML formatting with correct opening and closing tags`;

  const userPrompt = context || constraints || format
    ? `Input prompt:
${inputContent}

Additional context provided: ${context || "None"}
Constraints mentioned: ${constraints || "None"}
Output format preference: ${format || "Not specified"}

Convert to structured XML:`
    : `Input prompt:
${inputContent}

Convert to structured XML:`;

  try {
    const response = await ai.run("@cf/meta/llama-3.1-8b-instruct", {
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 2048,
      temperature: 0.2,
    });

    return c.json({
      original: inputContent,
      xml: response.response,
      sections: {
        context: extractXmlSection(response.response, "context"),
        instructions: extractXmlSection(response.response, "instructions"),
        constraints: extractXmlSection(response.response, "constraints"),
        output_requirements: extractXmlSection(response.response, "output_requirements"),
      },
    });
  } catch (error) {
    return c.json(
      { error: "XML conversion failed", details: error.message },
      500
    );
  }
});

// Helper function to extract XML sections
function extractXmlSection(xml, tagName) {
  const regex = new RegExp(`<${tagName}>([\\s\\S]*?)<\\/${tagName}>`, "i");
  const match = xml.match(regex);
  return match ? match[1].trim() : "";
}

// ============================================
// AI - RULE SUGGESTIONS
// ============================================

app.post("/api/ai/suggest-rules", async (c) => {
  const ai = c.env.AI;

  if (!ai) {
    return c.json({ error: "AI binding not configured" }, 500);
  }

  const body = await c.req.json();
  const { ruleName, ruleSetType = "CLAUDE.md", existingRules = [] } = body;

  if (!ruleName) {
    return c.json({ error: "Rule name is required" }, 400);
  }

  const systemPrompt = `You are an expert at creating development rules and guidelines for AI coding assistants. Generate practical, actionable rules that will help AI assistants write better code.

Rules should:
1. Be specific and actionable (not vague guidelines)
2. Use template arguments like {VARIABLE_NAME} for customizable values
3. Cover best practices relevant to the rule set name
4. Be organized by priority (high, medium, low)

Return a JSON array with objects containing:
- title: string (rule title, concise)
- content: string (rule content, detailed but not too long)
- priority: "high" | "medium" | "low"
- arguments: string[] (list of template argument names used, empty if none)

Output ONLY valid JSON array, no explanations.`;

  const userPrompt = existingRules.length > 0
    ? `Generate 5-8 practical rules for: "${ruleName}" (${ruleSetType} format)

Existing rules to avoid duplicating:
${existingRules.map((r) => `- ${r.title}`).join("\n")}

Generate new, complementary rules:`
    : `Generate 5-8 practical rules for: "${ruleName}" (${ruleSetType} format)`;

  try {
    const response = await ai.run("@cf/meta/llama-3.1-8b-instruct", {
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 2048,
      temperature: 0.4,
    });

    // Try to parse the JSON response
    let suggestedRules;
    try {
      // Clean up the response - remove markdown code blocks if present
      let cleanResponse = response.response.trim();
      if (cleanResponse.startsWith("```json")) {
        cleanResponse = cleanResponse.slice(7);
      }
      if (cleanResponse.startsWith("```")) {
        cleanResponse = cleanResponse.slice(3);
      }
      if (cleanResponse.endsWith("```")) {
        cleanResponse = cleanResponse.slice(0, -3);
      }
      suggestedRules = JSON.parse(cleanResponse.trim());
    } catch (parseError) {
      // If parsing fails, return a helpful error
      return c.json({
        error: "Failed to parse AI response",
        rawResponse: response.response,
      }, 500);
    }

    return c.json({
      ruleName,
      ruleSetType,
      suggestedRules,
    });
  } catch (error) {
    return c.json(
      { error: "Rule suggestion failed", details: error.message },
      500
    );
  }
});

// ============================================
// AI - BOOTSTRAP RULE TEMPLATES (DYNAMIC AI GENERATION)
// ============================================

// Comprehensive list of role/domain categories for bootstrap templates
const BOOTSTRAP_CATEGORIES = {
  // Software Development
  "frontend-development": {
    roles: [
      { id: "react-developer", name: "React Developer", keywords: "React, hooks, JSX, state management, Redux, Context API, component lifecycle" },
      { id: "vue-developer", name: "Vue.js Developer", keywords: "Vue 3, Composition API, Vuex, Pinia, Vue Router, single-file components" },
      { id: "angular-developer", name: "Angular Developer", keywords: "Angular, TypeScript, RxJS, NgRx, dependency injection, modules, services" },
      { id: "svelte-developer", name: "Svelte Developer", keywords: "Svelte, SvelteKit, stores, reactive declarations, transitions" },
      { id: "nextjs-developer", name: "Next.js Developer", keywords: "Next.js, SSR, SSG, ISR, API routes, App Router, Server Components" },
      { id: "web-developer", name: "Web Developer (General)", keywords: "HTML5, CSS3, JavaScript, responsive design, accessibility, SEO" },
      { id: "css-specialist", name: "CSS/Styling Specialist", keywords: "CSS architecture, Tailwind, Sass, CSS-in-JS, animations, responsive design" },
    ]
  },
  "backend-development": {
    roles: [
      { id: "nodejs-developer", name: "Node.js Developer", keywords: "Node.js, Express, Fastify, NestJS, async/await, streams, event loop" },
      { id: "python-developer", name: "Python Developer", keywords: "Python, FastAPI, Django, Flask, asyncio, type hints, virtual environments" },
      { id: "go-developer", name: "Go Developer", keywords: "Go, goroutines, channels, interfaces, error handling, standard library" },
      { id: "rust-developer", name: "Rust Developer", keywords: "Rust, ownership, borrowing, lifetimes, cargo, traits, async Rust" },
      { id: "java-developer", name: "Java Developer", keywords: "Java, Spring Boot, Maven, Gradle, JPA, microservices, streams API" },
      { id: "csharp-developer", name: "C#/.NET Developer", keywords: "C#, .NET Core, ASP.NET, Entity Framework, LINQ, dependency injection" },
      { id: "ruby-developer", name: "Ruby Developer", keywords: "Ruby, Rails, RSpec, ActiveRecord, gems, metaprogramming" },
      { id: "php-developer", name: "PHP Developer", keywords: "PHP 8, Laravel, Symfony, Composer, PSR standards, modern PHP" },
    ]
  },
  "mobile-development": {
    roles: [
      { id: "react-native-developer", name: "React Native Developer", keywords: "React Native, Expo, native modules, navigation, state management" },
      { id: "flutter-developer", name: "Flutter Developer", keywords: "Flutter, Dart, widgets, state management, platform channels" },
      { id: "ios-developer", name: "iOS Developer", keywords: "Swift, SwiftUI, UIKit, Core Data, Combine, App Store guidelines" },
      { id: "android-developer", name: "Android Developer", keywords: "Kotlin, Jetpack Compose, Android SDK, Room, Coroutines" },
    ]
  },
  "cloud-infrastructure": {
    roles: [
      { id: "aws-engineer", name: "AWS Engineer", keywords: "AWS, Lambda, EC2, S3, RDS, CloudFormation, IAM, VPC" },
      { id: "azure-engineer", name: "Azure Engineer", keywords: "Azure, Functions, App Service, Cosmos DB, ARM templates, AKS" },
      { id: "gcp-engineer", name: "GCP Engineer", keywords: "Google Cloud, Cloud Functions, GKE, BigQuery, Firestore, Pub/Sub" },
      { id: "cloudflare-developer", name: "Cloudflare Developer", keywords: "Cloudflare Workers, D1, R2, KV, Durable Objects, Pages" },
      { id: "devops-engineer", name: "DevOps Engineer", keywords: "CI/CD, Docker, Kubernetes, Terraform, monitoring, GitOps" },
      { id: "sre-engineer", name: "Site Reliability Engineer", keywords: "SRE, observability, incident response, SLOs, chaos engineering" },
      { id: "platform-engineer", name: "Platform Engineer", keywords: "Platform engineering, developer experience, internal tools, IaC" },
    ]
  },
  "data-ai": {
    roles: [
      { id: "data-scientist", name: "Data Scientist", keywords: "Python, pandas, scikit-learn, statistical analysis, feature engineering" },
      { id: "ml-engineer", name: "Machine Learning Engineer", keywords: "ML pipelines, model deployment, MLOps, TensorFlow, PyTorch" },
      { id: "data-engineer", name: "Data Engineer", keywords: "ETL, data pipelines, Spark, Airflow, data warehousing, dbt" },
      { id: "ai-engineer", name: "AI/LLM Engineer", keywords: "LLMs, prompt engineering, RAG, fine-tuning, embeddings, vector databases" },
      { id: "analytics-engineer", name: "Analytics Engineer", keywords: "dbt, SQL, data modeling, metrics, dashboards, data quality" },
    ]
  },
  "security": {
    roles: [
      { id: "security-engineer", name: "Security Engineer", keywords: "AppSec, OWASP, penetration testing, security audits, threat modeling" },
      { id: "devsecops-engineer", name: "DevSecOps Engineer", keywords: "Security automation, SAST, DAST, dependency scanning, secrets management" },
    ]
  },
  "specialized": {
    roles: [
      { id: "api-developer", name: "API Developer", keywords: "REST, GraphQL, OpenAPI, API design, versioning, rate limiting" },
      { id: "database-administrator", name: "Database Administrator", keywords: "SQL, PostgreSQL, MySQL, MongoDB, query optimization, replication" },
      { id: "blockchain-developer", name: "Blockchain Developer", keywords: "Solidity, smart contracts, Web3, DeFi, EVM, security" },
      { id: "game-developer", name: "Game Developer", keywords: "Unity, Unreal, game loops, physics, shaders, optimization" },
      { id: "embedded-developer", name: "Embedded Systems Developer", keywords: "C, C++, microcontrollers, RTOS, hardware interfaces" },
      { id: "qa-engineer", name: "QA/Test Engineer", keywords: "Testing strategies, automation, Cypress, Playwright, test design" },
      { id: "technical-writer", name: "Technical Writer", keywords: "Documentation, API docs, tutorials, style guides, markdown" },
    ]
  }
};

// Flatten categories into a single list for easy lookup
const ALL_BOOTSTRAP_ROLES = Object.values(BOOTSTRAP_CATEGORIES)
  .flatMap(cat => cat.roles);

app.get("/api/ai/bootstrap-templates", async (c) => {
  // Return categorized list of all available templates
  const categorized = Object.entries(BOOTSTRAP_CATEGORIES).map(([categoryId, category]) => ({
    id: categoryId,
    name: categoryId.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" "),
    roles: category.roles.map(r => ({
      id: r.id,
      name: r.name,
    }))
  }));

  return c.json({
    categories: categorized,
    totalTemplates: ALL_BOOTSTRAP_ROLES.length,
  });
});

app.post("/api/ai/bootstrap-rules", async (c) => {
  const ai = c.env.AI;
  const body = await c.req.json();
  const { templateType, customRole } = body;

  // If no templateType, return available templates
  if (!templateType && !customRole) {
    const categorized = Object.entries(BOOTSTRAP_CATEGORIES).map(([categoryId, category]) => ({
      id: categoryId,
      name: categoryId.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" "),
      roles: category.roles.map(r => ({
        id: r.id,
        name: r.name,
      }))
    }));

    return c.json({
      categories: categorized,
      totalTemplates: ALL_BOOTSTRAP_ROLES.length,
    });
  }

  // Check if AI is available
  if (!ai) {
    return c.json({ error: "AI binding not configured" }, 500);
  }

  // Find the role info
  let roleInfo = null;
  let roleName = customRole;
  let roleKeywords = "";

  if (templateType) {
    roleInfo = ALL_BOOTSTRAP_ROLES.find(r => r.id === templateType);
    if (roleInfo) {
      roleName = roleInfo.name;
      roleKeywords = roleInfo.keywords;
    } else {
      // Treat templateType as a custom role if not found
      roleName = templateType;
    }
  }

  // Generate comprehensive rules using AI
  const systemPrompt = `You are an expert software engineering consultant who creates comprehensive coding guidelines and rules for development teams. Your task is to generate a detailed, practical set of rules for a CLAUDE.md file that will guide an AI coding assistant.

Generate 10-15 high-quality rules covering:
1. Code style and conventions specific to the role
2. Best practices and patterns
3. Common pitfalls to avoid
4. Testing requirements
5. Documentation standards
6. Security considerations
7. Performance guidelines
8. Error handling patterns
9. Project structure recommendations
10. Tool and library preferences

Rules should be:
- Specific and actionable (not vague)
- Based on current industry best practices (2024-2025)
- Practical for day-to-day development
- Include template arguments like {VARIABLE_NAME} for customizable values where appropriate

Return a JSON object with this structure:
{
  "name": "Role Name",
  "description": "Brief description of this rule set",
  "rules": [
    {
      "title": "Rule Title",
      "content": "Detailed rule content...",
      "priority": "high|medium|low",
      "arguments": ["ARG1", "ARG2"]
    }
  ]
}

Priority guide:
- high: Critical rules that must always be followed
- medium: Important guidelines for most situations
- low: Nice-to-have preferences

Output ONLY valid JSON, no markdown code blocks or explanations.`;

  const userPrompt = roleKeywords
    ? `Generate comprehensive coding rules for: ${roleName}

Key technologies and concepts to cover: ${roleKeywords}

Focus on modern best practices, security, performance, and maintainability. Include specific examples where helpful.`
    : `Generate comprehensive coding rules for: ${roleName}

Research and include rules covering the most important technologies, patterns, and best practices for this role. Focus on modern best practices (2024-2025), security, performance, and maintainability.`;

  try {
    const response = await ai.run("@cf/meta/llama-3.1-8b-instruct", {
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 4096,
      temperature: 0.3,
    });

    // Parse the AI response
    let result;
    try {
      let cleanResponse = response.response.trim();
      // Remove markdown code blocks if present
      if (cleanResponse.startsWith("```json")) {
        cleanResponse = cleanResponse.slice(7);
      }
      if (cleanResponse.startsWith("```")) {
        cleanResponse = cleanResponse.slice(3);
      }
      if (cleanResponse.endsWith("```")) {
        cleanResponse = cleanResponse.slice(0, -3);
      }
      result = JSON.parse(cleanResponse.trim());
    } catch (parseError) {
      console.error("Failed to parse AI response:", response.response);
      return c.json({
        error: "Failed to parse AI-generated rules",
        rawResponse: response.response,
      }, 500);
    }

    // Validate and normalize the result
    if (!result.rules || !Array.isArray(result.rules)) {
      return c.json({ error: "Invalid rules format from AI" }, 500);
    }

    // Ensure all rules have required fields
    result.rules = result.rules.map((rule, index) => ({
      title: rule.title || `Rule ${index + 1}`,
      content: rule.content || "",
      priority: ["high", "medium", "low"].includes(rule.priority) ? rule.priority : "medium",
      arguments: Array.isArray(rule.arguments) ? rule.arguments : [],
    }));

    return c.json({
      template: {
        id: templateType || customRole.toLowerCase().replace(/\s+/g, "-"),
        name: result.name || roleName,
        description: result.description || `Comprehensive rules for ${roleName}`,
        rules: result.rules,
        generatedAt: new Date().toISOString(),
        isAIGenerated: true,
      },
    });
  } catch (error) {
    console.error("Bootstrap generation error:", error);
    return c.json(
      { error: "Failed to generate bootstrap rules", details: error.message },
      500
    );
  }
});

// ============================================
// ENHANCED CLAUDE.MD EXPORT WITH PROJECT CONTEXT
// ============================================

app.post("/api/export/claude-md-enhanced", async (c) => {
  const db = c.env.DB;
  const body = await c.req.json();
  const {
    ruleSetId,
    name,
    description,
    rules: providedRules,
    include_project_context = false,
    includeProjectContext = include_project_context,
    project_id,
    projectId = project_id,
    argumentValues = {},
  } = body;

  let ruleSet = null;
  let rules = [];

  // Option 1: Fetch from DB using ruleSetId
  if (ruleSetId) {
    ruleSet = await db
      .prepare("SELECT * FROM rule_sets WHERE id = ?")
      .bind(ruleSetId)
      .first();

    if (!ruleSet) {
      return c.json({ error: "Rule set not found" }, 404);
    }

    rules = ruleSet.rules ? JSON.parse(ruleSet.rules) : [];
  }
  // Option 2: Use provided rules directly (for unsaved rule sets)
  else if (providedRules && Array.isArray(providedRules)) {
    ruleSet = {
      name: name || "Untitled Rule Set",
      description: description || "",
    };
    rules = providedRules;
  } else {
    return c.json({ error: "Either ruleSetId or rules array is required" }, 400);
  }
  let content = "";

  // Generate CLAUDE.md content
  content += `# ${ruleSet.name}\n\n`;
  if (ruleSet.description) {
    content += `${ruleSet.description}\n\n`;
  }

  // Add project context if requested
  let projectContext = null;
  if (includeProjectContext && projectId) {
    const project = await db
      .prepare("SELECT name, description, ai_context_summary FROM projects WHERE id = ?")
      .bind(projectId)
      .first();

    if (project) {
      projectContext = project;
      content += `## Project Context\n\n`;
      content += `**Project:** ${project.name}\n\n`;
      if (project.description) {
        content += `${project.description}\n\n`;
      }
      if (project.ai_context_summary) {
        content += `**AI Context:**\n${project.ai_context_summary}\n\n`;
      }
      content += `---\n\n`;
    }
  }

  // Group rules by priority
  const highPriority = rules.filter((r) => r.priority === "high");
  const mediumPriority = rules.filter((r) => r.priority === "medium");
  const lowPriority = rules.filter((r) => r.priority === "low");

  if (highPriority.length > 0) {
    content += "## Critical Rules\n\n";
    for (const rule of highPriority) {
      let ruleContent = replaceArguments(rule.content, argumentValues);
      content += `### ${rule.title}\n${ruleContent}\n\n`;
    }
  }

  if (mediumPriority.length > 0) {
    content += "## Important Guidelines\n\n";
    for (const rule of mediumPriority) {
      let ruleContent = replaceArguments(rule.content, argumentValues);
      content += `### ${rule.title}\n${ruleContent}\n\n`;
    }
  }

  if (lowPriority.length > 0) {
    content += "## Best Practices\n\n";
    for (const rule of lowPriority) {
      let ruleContent = replaceArguments(rule.content, argumentValues);
      content += `### ${rule.title}\n${ruleContent}\n\n`;
    }
  }

  return c.json({
    content,
    filename: "CLAUDE.md",
    ruleSet: {
      id: ruleSet.id,
      name: ruleSet.name,
    },
    includedProjectContext: projectContext,
  });
});

// ============================================
// HOOKS API
// ============================================

// Get all hooks (optionally filtered by project)
app.get("/api/hooks", async (c) => {
  const db = c.env.DB;
  const projectId = c.req.query("project_id");

  let query = "SELECT * FROM hooks";
  let params = [];

  if (projectId) {
    query += " WHERE project_id = ?";
    params.push(projectId);
  }

  query += " ORDER BY sort_order ASC, created_at DESC";

  const result = await db.prepare(query).bind(...params).all();

  // Parse tool_matcher JSON for each hook
  const hooks = (result.results || []).map((hook) => ({
    ...hook,
    tool_matcher: hook.tool_matcher ? JSON.parse(hook.tool_matcher) : null,
  }));

  return c.json(hooks);
});

// Get a single hook
app.get("/api/hooks/:id", async (c) => {
  const db = c.env.DB;
  const id = c.req.param("id");

  const hook = await db.prepare("SELECT * FROM hooks WHERE id = ?").bind(id).first();

  if (!hook) {
    return c.json({ error: "Hook not found" }, 404);
  }

  return c.json({
    ...hook,
    tool_matcher: hook.tool_matcher ? JSON.parse(hook.tool_matcher) : null,
  });
});

// Create a new hook
app.post("/api/hooks", async (c) => {
  const db = c.env.DB;
  const body = await c.req.json();

  const {
    project_id,
    name,
    description,
    hook_type,
    tool_matcher,
    command,
    working_directory,
    timeout_ms = 60000,
    is_enabled = true,
    sort_order = 0,
  } = body;

  if (!name || !hook_type || !command) {
    return c.json({ error: "name, hook_type, and command are required" }, 400);
  }

  const validHookTypes = ["PreToolUse", "PostToolUse", "Notification", "Stop", "SubagentStop"];
  if (!validHookTypes.includes(hook_type)) {
    return c.json({ error: `hook_type must be one of: ${validHookTypes.join(", ")}` }, 400);
  }

  const id = generateId();
  const toolMatcherJson = tool_matcher ? JSON.stringify(tool_matcher) : null;

  await db
    .prepare(
      `INSERT INTO hooks (id, project_id, name, description, hook_type, tool_matcher, command, working_directory, timeout_ms, is_enabled, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(id, project_id || null, name, description || null, hook_type, toolMatcherJson, command, working_directory || null, timeout_ms, is_enabled ? 1 : 0, sort_order)
    .run();

  return c.json({
    id,
    project_id,
    name,
    description,
    hook_type,
    tool_matcher,
    command,
    working_directory,
    timeout_ms,
    is_enabled,
    sort_order,
  }, 201);
});

// Update a hook
app.put("/api/hooks/:id", async (c) => {
  const db = c.env.DB;
  const id = c.req.param("id");
  const body = await c.req.json();

  const existing = await db.prepare("SELECT id FROM hooks WHERE id = ?").bind(id).first();
  if (!existing) {
    return c.json({ error: "Hook not found" }, 404);
  }

  const {
    name,
    description,
    hook_type,
    tool_matcher,
    command,
    working_directory,
    timeout_ms,
    is_enabled,
    sort_order,
  } = body;

  const toolMatcherJson = tool_matcher !== undefined ? JSON.stringify(tool_matcher) : undefined;

  // Build dynamic update query
  const updates = [];
  const values = [];

  if (name !== undefined) { updates.push("name = ?"); values.push(name); }
  if (description !== undefined) { updates.push("description = ?"); values.push(description); }
  if (hook_type !== undefined) { updates.push("hook_type = ?"); values.push(hook_type); }
  if (toolMatcherJson !== undefined) { updates.push("tool_matcher = ?"); values.push(toolMatcherJson); }
  if (command !== undefined) { updates.push("command = ?"); values.push(command); }
  if (working_directory !== undefined) { updates.push("working_directory = ?"); values.push(working_directory); }
  if (timeout_ms !== undefined) { updates.push("timeout_ms = ?"); values.push(timeout_ms); }
  if (is_enabled !== undefined) { updates.push("is_enabled = ?"); values.push(is_enabled ? 1 : 0); }
  if (sort_order !== undefined) { updates.push("sort_order = ?"); values.push(sort_order); }

  updates.push("updated_at = CURRENT_TIMESTAMP");
  values.push(id);

  await db
    .prepare(`UPDATE hooks SET ${updates.join(", ")} WHERE id = ?`)
    .bind(...values)
    .run();

  return c.json({ success: true, id });
});

// Delete a hook
app.delete("/api/hooks/:id", async (c) => {
  const db = c.env.DB;
  const id = c.req.param("id");

  const result = await db.prepare("DELETE FROM hooks WHERE id = ?").bind(id).run();

  if (result.meta.changes === 0) {
    return c.json({ error: "Hook not found" }, 404);
  }

  return c.json({ success: true });
});

// Get hook templates
app.get("/api/hook-templates", async (c) => {
  const db = c.env.DB;
  const category = c.req.query("category");

  let query = "SELECT * FROM hook_templates";
  let params = [];

  if (category) {
    query += " WHERE category = ?";
    params.push(category);
  }

  query += " ORDER BY category, name";

  const result = await db.prepare(query).bind(...params).all();

  const templates = (result.results || []).map((t) => ({
    ...t,
    tool_matcher: t.tool_matcher ? JSON.parse(t.tool_matcher) : null,
    variables: t.variables ? JSON.parse(t.variables) : [],
  }));

  return c.json(templates);
});

// ============================================
// CUSTOM AGENTS/COMMANDS API
// ============================================

// Get all custom agents (optionally filtered by project)
app.get("/api/agents", async (c) => {
  const db = c.env.DB;
  const projectId = c.req.query("project_id");

  let query = "SELECT * FROM custom_agents";
  let params = [];

  if (projectId) {
    query += " WHERE project_id = ?";
    params.push(projectId);
  }

  query += " ORDER BY category, display_name";

  const result = await db.prepare(query).bind(...params).all();

  const agents = (result.results || []).map((agent) => ({
    ...agent,
    agent_config: agent.agent_config ? JSON.parse(agent.agent_config) : null,
  }));

  return c.json(agents);
});

// Get a single agent
app.get("/api/agents/:id", async (c) => {
  const db = c.env.DB;
  const id = c.req.param("id");

  const agent = await db.prepare("SELECT * FROM custom_agents WHERE id = ?").bind(id).first();

  if (!agent) {
    return c.json({ error: "Agent not found" }, 404);
  }

  return c.json({
    ...agent,
    agent_config: agent.agent_config ? JSON.parse(agent.agent_config) : null,
  });
});

// Create a new agent
app.post("/api/agents", async (c) => {
  const db = c.env.DB;
  const body = await c.req.json();

  const {
    project_id,
    name,
    display_name,
    description,
    prompt_content,
    agent_config,
    icon = "🤖",
    category = "custom",
    is_enabled = true,
  } = body;

  if (!name || !prompt_content) {
    return c.json({ error: "name and prompt_content are required" }, 400);
  }

  // Validate name format (should be slug-like for filename)
  const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  if (!slugRegex.test(name)) {
    return c.json({ error: "name must be lowercase with hyphens only (e.g., 'review-pr', 'write-tests')" }, 400);
  }

  const id = generateId();
  const agentConfigJson = agent_config ? JSON.stringify(agent_config) : null;

  await db
    .prepare(
      `INSERT INTO custom_agents (id, project_id, name, display_name, description, prompt_content, agent_config, icon, category, is_enabled)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(id, project_id || null, name, display_name || name, description || null, prompt_content, agentConfigJson, icon, category, is_enabled ? 1 : 0)
    .run();

  return c.json({
    id,
    project_id,
    name,
    display_name: display_name || name,
    description,
    prompt_content,
    agent_config,
    icon,
    category,
    is_enabled,
  }, 201);
});

// Update an agent
app.put("/api/agents/:id", async (c) => {
  const db = c.env.DB;
  const id = c.req.param("id");
  const body = await c.req.json();

  const existing = await db.prepare("SELECT id FROM custom_agents WHERE id = ?").bind(id).first();
  if (!existing) {
    return c.json({ error: "Agent not found" }, 404);
  }

  const {
    name,
    display_name,
    description,
    prompt_content,
    agent_config,
    icon,
    category,
    is_enabled,
  } = body;

  const agentConfigJson = agent_config !== undefined ? JSON.stringify(agent_config) : undefined;

  // Build dynamic update query
  const updates = [];
  const values = [];

  if (name !== undefined) { updates.push("name = ?"); values.push(name); }
  if (display_name !== undefined) { updates.push("display_name = ?"); values.push(display_name); }
  if (description !== undefined) { updates.push("description = ?"); values.push(description); }
  if (prompt_content !== undefined) { updates.push("prompt_content = ?"); values.push(prompt_content); }
  if (agentConfigJson !== undefined) { updates.push("agent_config = ?"); values.push(agentConfigJson); }
  if (icon !== undefined) { updates.push("icon = ?"); values.push(icon); }
  if (category !== undefined) { updates.push("category = ?"); values.push(category); }
  if (is_enabled !== undefined) { updates.push("is_enabled = ?"); values.push(is_enabled ? 1 : 0); }

  updates.push("updated_at = CURRENT_TIMESTAMP");
  values.push(id);

  await db
    .prepare(`UPDATE custom_agents SET ${updates.join(", ")} WHERE id = ?`)
    .bind(...values)
    .run();

  return c.json({ success: true, id });
});

// Delete an agent
app.delete("/api/agents/:id", async (c) => {
  const db = c.env.DB;
  const id = c.req.param("id");

  const result = await db.prepare("DELETE FROM custom_agents WHERE id = ?").bind(id).run();

  if (result.meta.changes === 0) {
    return c.json({ error: "Agent not found" }, 404);
  }

  return c.json({ success: true });
});

// Get agent templates
app.get("/api/agent-templates", async (c) => {
  const db = c.env.DB;
  const category = c.req.query("category");

  let query = "SELECT * FROM agent_templates";
  let params = [];

  if (category) {
    query += " WHERE category = ?";
    params.push(category);
  }

  query += " ORDER BY category, display_name";

  const result = await db.prepare(query).bind(...params).all();

  const templates = (result.results || []).map((t) => ({
    ...t,
    agent_config: t.agent_config ? JSON.parse(t.agent_config) : null,
    variables: t.variables ? JSON.parse(t.variables) : [],
  }));

  return c.json(templates);
});

// ============================================
// PROJECT EXPORT - COMPLETE .claude/ DIRECTORY
// ============================================

app.post("/api/projects/:id/export-claude-config", async (c) => {
  const db = c.env.DB;
  const projectId = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));
  const { includeRules = true, includeHooks = true, includeAgents = true } = body;

  // Get project
  const project = await db
    .prepare("SELECT * FROM projects WHERE id = ?")
    .bind(projectId)
    .first();

  if (!project) {
    return c.json({ error: "Project not found" }, 404);
  }

  const exportFiles = {};

  // Export hooks to settings.json
  if (includeHooks) {
    const hooksResult = await db
      .prepare("SELECT * FROM hooks WHERE project_id = ? AND is_enabled = 1 ORDER BY sort_order")
      .bind(projectId)
      .all();

    const hooks = hooksResult.results || [];

    if (hooks.length > 0) {
      const settingsJson = {
        hooks: {}
      };

      // Group hooks by type
      for (const hook of hooks) {
        const hookType = hook.hook_type;
        if (!settingsJson.hooks[hookType]) {
          settingsJson.hooks[hookType] = [];
        }

        const hookConfig = {
          command: hook.command,
        };

        if (hook.tool_matcher) {
          const matcher = JSON.parse(hook.tool_matcher);
          if (matcher.tool) hookConfig.matcher = matcher.tool;
          if (matcher.pattern) hookConfig.pattern = matcher.pattern;
        }

        if (hook.timeout_ms && hook.timeout_ms !== 60000) {
          hookConfig.timeout = hook.timeout_ms;
        }

        if (hook.working_directory) {
          hookConfig.workingDirectory = hook.working_directory;
        }

        settingsJson.hooks[hookType].push(hookConfig);
      }

      exportFiles[".claude/settings.json"] = JSON.stringify(settingsJson, null, 2);
    }
  }

  // Export custom agents/commands
  if (includeAgents) {
    const agentsResult = await db
      .prepare("SELECT * FROM custom_agents WHERE project_id = ? AND is_enabled = 1")
      .bind(projectId)
      .all();

    const agents = agentsResult.results || [];

    for (const agent of agents) {
      const filename = `.claude/commands/${agent.name}.md`;
      exportFiles[filename] = agent.prompt_content;
    }
  }

  // Export rules as CLAUDE.md
  if (includeRules) {
    const ruleSetsResult = await db
      .prepare(
        `SELECT rs.* FROM rule_sets rs
         JOIN rule_set_projects rsp ON rs.id = rsp.rule_set_id
         WHERE rsp.project_id = ?`
      )
      .bind(projectId)
      .all();

    const ruleSets = ruleSetsResult.results || [];

    if (ruleSets.length > 0) {
      let claudeMdContent = `# ${project.name} - Claude Code Rules\n\n`;

      if (project.description) {
        claudeMdContent += `${project.description}\n\n`;
      }

      claudeMdContent += `---\n\n`;

      for (const ruleSet of ruleSets) {
        const rules = ruleSet.rules ? JSON.parse(ruleSet.rules) : [];

        claudeMdContent += `## ${ruleSet.name}\n\n`;

        if (ruleSet.description) {
          claudeMdContent += `${ruleSet.description}\n\n`;
        }

        // Group by priority
        const highRules = rules.filter(r => r.priority === "high");
        const mediumRules = rules.filter(r => r.priority === "medium");
        const lowRules = rules.filter(r => r.priority === "low");

        if (highRules.length > 0) {
          claudeMdContent += `### Critical Rules\n\n`;
          for (const rule of highRules) {
            claudeMdContent += `#### ${rule.title}\n${rule.content}\n\n`;
          }
        }

        if (mediumRules.length > 0) {
          claudeMdContent += `### Guidelines\n\n`;
          for (const rule of mediumRules) {
            claudeMdContent += `#### ${rule.title}\n${rule.content}\n\n`;
          }
        }

        if (lowRules.length > 0) {
          claudeMdContent += `### Preferences\n\n`;
          for (const rule of lowRules) {
            claudeMdContent += `#### ${rule.title}\n${rule.content}\n\n`;
          }
        }
      }

      exportFiles["CLAUDE.md"] = claudeMdContent;
    }
  }

  return c.json({
    project: {
      id: project.id,
      name: project.name,
    },
    files: exportFiles,
    fileCount: Object.keys(exportFiles).length,
  });
});

// ============================================
// STATIC ASSETS HANDLER (CLEAN URLs)
// ============================================

// Root URL: / -> index.html (prompt builder)
app.get("/", async (c) => {
  const htmlRequest = new Request(new URL("/index.html", c.req.url).toString());
  const response = await c.env.ASSETS.fetch(htmlRequest);
  const newResponse = new Response(response.body, response);
  newResponse.headers.set(
    "Cache-Control",
    "public, max-age=0, must-revalidate",
  );
  return newResponse;
});

// Clean URL: /projects -> projects.html
app.get("/projects", async (c) => {
  const htmlRequest = new Request(
    new URL("/projects.html", c.req.url).toString(),
  );
  const response = await c.env.ASSETS.fetch(htmlRequest);
  const newResponse = new Response(response.body, response);
  newResponse.headers.set(
    "Cache-Control",
    "public, max-age=0, must-revalidate",
  );
  return newResponse;
});

// Clean URL: /project/:slug -> project.html (with slug parsing)
app.get("/project/:slug", async (c) => {
  try {
    const projectHtmlRequest = new Request(
      new URL("/project.html", c.req.url).toString(),
    );
    const response = await c.env.ASSETS.fetch(projectHtmlRequest);
    const newResponse = new Response(response.body, response);
    newResponse.headers.set(
      "Cache-Control",
      "public, max-age=0, must-revalidate",
    );
    return newResponse;
  } catch (error) {
    console.error("Error serving project page:", error);
    return c.text("Error loading project page: " + error.message, 500);
  }
});

// Clean URL: /builder -> index.html (prompt builder)
app.get("/builder", async (c) => {
  const htmlRequest = new Request(new URL("/index.html", c.req.url).toString());
  const response = await c.env.ASSETS.fetch(htmlRequest);
  const newResponse = new Response(response.body, response);
  newResponse.headers.set(
    "Cache-Control",
    "public, max-age=0, must-revalidate",
  );
  return newResponse;
});

// Clean URL: /rules -> rules.html
app.get("/rules", async (c) => {
  const htmlRequest = new Request(new URL("/rules.html", c.req.url).toString());
  const response = await c.env.ASSETS.fetch(htmlRequest);
  const newResponse = new Response(response.body, response);
  newResponse.headers.set(
    "Cache-Control",
    "public, max-age=0, must-revalidate",
  );
  return newResponse;
});

// Clean URL: /hooks -> hooks.html
app.get("/hooks", async (c) => {
  const htmlRequest = new Request(new URL("/hooks.html", c.req.url).toString());
  const response = await c.env.ASSETS.fetch(htmlRequest);
  const newResponse = new Response(response.body, response);
  newResponse.headers.set(
    "Cache-Control",
    "public, max-age=0, must-revalidate",
  );
  return newResponse;
});

// Clean URL: /agents -> agents.html
app.get("/agents", async (c) => {
  const htmlRequest = new Request(new URL("/agents.html", c.req.url).toString());
  const response = await c.env.ASSETS.fetch(htmlRequest);
  const newResponse = new Response(response.body, response);
  newResponse.headers.set(
    "Cache-Control",
    "public, max-age=0, must-revalidate",
  );
  return newResponse;
});

// Serve static assets for non-API routes
app.get("*", async (c) => {
  const url = new URL(c.req.url);
  const path = url.pathname;

  // Let the asset binding handle static file serving
  const response = await c.env.ASSETS.fetch(c.req.raw);

  // Clone response to modify headers
  const newResponse = new Response(response.body, response);

  // Set cache headers for static assets
  if (path.match(/\.(js|css|svg|png|jpg|jpeg|gif|ico|woff|woff2)$/)) {
    newResponse.headers.set(
      "Cache-Control",
      "public, max-age=31536000, immutable",
    );
  } else if (path === "/" || path.endsWith(".html")) {
    newResponse.headers.set(
      "Cache-Control",
      "public, max-age=0, must-revalidate",
    );
  }

  return newResponse;
});

// Export classes for testing
export { ProjectManager, ResourceManager, AIEnhancementEngine, ClaudeCodeExporter, ProjectValidator, PlatformDetectionEngine, TemplateSuggestionService };

export default app;
