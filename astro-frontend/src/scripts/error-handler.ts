import type { ToastMessage } from '../types';
import { APIError, NetworkError, TimeoutError } from './api';
import { actions } from './state';

/**
 * Comprehensive Error Handling System
 * Provides centralized error handling, logging, and user notification
 */

export interface ErrorContext {
  component?: string;
  action?: string;
  userId?: string;
  timestamp?: Date;
  metadata?: Record<string, any>;
}

export interface ErrorReport {
  error: Error;
  context: ErrorContext;
  severity: 'low' | 'medium' | 'high' | 'critical';
  recoverable: boolean;
  userMessage: string;
  technicalMessage: string;
}

/**
 * Error classification and handling
 */
export class ErrorHandler {
  private static instance: ErrorHandler;
  private errorLog: ErrorReport[] = [];
  private maxLogSize = 100;

  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  /**
   * Main error handling method
   */
  handle(error: Error, context: ErrorContext = {}): ErrorReport {
    const report = this.classifyError(error, context);
    
    // Log the error
    this.logError(report);
    
    // Handle based on severity
    this.processError(report);
    
    return report;
  }

  /**
   * Classify error and create report
   */
  private classifyError(error: Error, context: ErrorContext): ErrorReport {
    const timestamp = new Date();
    const enhancedContext = { ...context, timestamp };

    // API Errors
    if (error instanceof APIError) {
      return this.handleAPIError(error, enhancedContext);
    }
    
    // Network Errors
    if (error instanceof NetworkError) {
      return this.handleNetworkError(error, enhancedContext);
    }
    
    // Timeout Errors
    if (error instanceof TimeoutError) {
      return this.handleTimeoutError(error, enhancedContext);
    }
    
    // Validation Errors
    if (error.name === 'ValidationError') {
      return this.handleValidationError(error, enhancedContext);
    }
    
    // Storage Errors
    if (error.message.includes('localStorage') || error.message.includes('storage')) {
      return this.handleStorageError(error, enhancedContext);
    }
    
    // Component Errors
    if (context.component) {
      return this.handleComponentError(error, enhancedContext);
    }
    
    // Generic Error
    return this.handleGenericError(error, enhancedContext);
  }

  /**
   * Handle API errors
   */
  private handleAPIError(error: APIError, context: ErrorContext): ErrorReport {
    const status = error.status || 0;
    
    if (status >= 500) {
      return {
        error,
        context,
        severity: 'high',
        recoverable: true,
        userMessage: 'Server error occurred. Please try again in a moment.',
        technicalMessage: `API Error ${status}: ${error.message}`
      };
    } else if (status === 429) {
      return {
        error,
        context,
        severity: 'medium',
        recoverable: true,
        userMessage: 'Too many requests. Please wait a moment before trying again.',
        technicalMessage: `Rate limited: ${error.message}`
      };
    } else if (status === 404) {
      return {
        error,
        context,
        severity: 'medium',
        recoverable: false,
        userMessage: 'The requested item could not be found. It may have been deleted or moved.',
        technicalMessage: `Not Found ${status}: ${error.message}`
      };
    } else if (status >= 400) {
      return {
        error,
        context,
        severity: 'medium',
        recoverable: false,
        userMessage: 'Invalid request. Please check your input and try again.',
        technicalMessage: `Client Error ${status}: ${error.message}`
      };
    } else {
      return {
        error,
        context,
        severity: 'medium',
        recoverable: true,
        userMessage: 'Request failed. Please try again.',
        technicalMessage: `API Error: ${error.message}`
      };
    }
  }

  /**
   * Handle network errors
   */
  private handleNetworkError(error: NetworkError, context: ErrorContext): ErrorReport {
    return {
      error,
      context,
      severity: 'high',
      recoverable: true,
      userMessage: 'Network connection failed. Please check your internet connection and try again.',
      technicalMessage: `Network Error: ${error.message}`
    };
  }

  /**
   * Handle timeout errors
   */
  private handleTimeoutError(error: TimeoutError, context: ErrorContext): ErrorReport {
    return {
      error,
      context,
      severity: 'medium',
      recoverable: true,
      userMessage: 'Request timed out. The server may be busy. Please try again.',
      technicalMessage: `Timeout Error: ${error.message}`
    };
  }

  /**
   * Handle validation errors
   */
  private handleValidationError(error: Error, context: ErrorContext): ErrorReport {
    return {
      error,
      context,
      severity: 'low',
      recoverable: false,
      userMessage: 'Please check your input and try again.',
      technicalMessage: `Validation Error: ${error.message}`
    };
  }

  /**
   * Handle storage errors
   */
  private handleStorageError(error: Error, context: ErrorContext): ErrorReport {
    return {
      error,
      context,
      severity: 'medium',
      recoverable: true,
      userMessage: 'Storage error occurred. Some data may not be saved locally.',
      technicalMessage: `Storage Error: ${error.message}`
    };
  }

  /**
   * Handle component errors
   */
  private handleComponentError(error: Error, context: ErrorContext): ErrorReport {
    return {
      error,
      context,
      severity: 'medium',
      recoverable: true,
      userMessage: `Error in ${context.component}. Please refresh the page if the problem persists.`,
      technicalMessage: `Component Error in ${context.component}: ${error.message}`
    };
  }

  /**
   * Handle generic errors
   */
  private handleGenericError(error: Error, context: ErrorContext): ErrorReport {
    return {
      error,
      context,
      severity: 'medium',
      recoverable: true,
      userMessage: 'An unexpected error occurred. Please try again.',
      technicalMessage: `Generic Error: ${error.message}`
    };
  }

  /**
   * Get recovery options for errors
   */
  private getRecoveryOptions(error: Error, context: ErrorContext): string[] {
    if (error instanceof APIError) {
      const status = error.status || 0;
      
      if (status === 404) {
        return [
          "Refresh the page to reload data",
          "Check if the item was deleted",
          "Verify the item ID is correct"
        ];
      } else if (status === 409) {
        return [
          "Use a different name",
          "Update the existing item instead",
          "Delete the conflicting item first"
        ];
      } else if (status >= 500) {
        return [
          "Try again in a few moments",
          "Check system status",
          "Contact support if the problem persists"
        ];
      } else if (status === 429) {
        return [
          "Wait a moment before retrying",
          "Reduce the frequency of requests"
        ];
      } else if (status >= 400) {
        return [
          "Review the highlighted fields",
          "Check the format requirements",
          "Verify all required fields are filled"
        ];
      }
    }
    
    if (error instanceof NetworkError) {
      return [
        "Check your internet connection",
        "Try refreshing the page",
        "Wait a moment and try again"
      ];
    }
    
    if (error.message.includes('localStorage') || error.message.includes('storage')) {
      return [
        "Clear browser cache and try again",
        "Check available storage space",
        "Try using a different browser"
      ];
    }
    
    return [
      "Try the action again",
      "Refresh the page if the problem persists",
      "Contact support if the issue continues"
    ];
  }

  /**
   * Process error based on severity
   */
  private processError(report: ErrorReport): void {
    // Always log to console in development
    if (import.meta.env.DEV) {
      console.error('Error Report:', report);
    }

    // Update error state
    this.updateErrorState(report);

    // Show user notification
    this.showUserNotification(report);

    // Handle critical errors
    if (report.severity === 'critical') {
      this.handleCriticalError(report);
    }
  }

  /**
   * Update application error state
   */
  private updateErrorState(report: ErrorReport): void {
    const { context } = report;
    
    // Determine which error state to update based on context
    if (context.action?.includes('agent')) {
      actions.setError('agents', report.userMessage);
    } else if (context.action?.includes('requirement')) {
      actions.setError('requirements', report.userMessage);
    } else if (context.action?.includes('project')) {
      actions.setError('projects', report.userMessage);
    } else if (report.error instanceof NetworkError || report.error instanceof TimeoutError) {
      actions.setError('network', report.userMessage);
    }
  }

  /**
   * Show user notification
   */
  private showUserNotification(report: ErrorReport): void {
    const recoveryOptions = this.getRecoveryOptions(report.error, report.context);
    
    const toast: ToastMessage = {
      message: report.userMessage,
      type: this.getToastType(report.severity),
      duration: this.getToastDuration(report.severity),
      recoveryOptions: recoveryOptions.slice(0, 2) // Show max 2 options in toast
    };

    // Add retry action for recoverable errors
    if (report.recoverable && report.context.action) {
      toast.action = {
        label: 'Retry',
        handler: () => this.retryAction(report.context)
      };
    }

    actions.addToast(toast);
  }

  /**
   * Get toast type based on severity
   */
  private getToastType(severity: string): 'success' | 'error' | 'info' | 'warning' {
    switch (severity) {
      case 'critical':
      case 'high':
        return 'error';
      case 'medium':
        return 'warning';
      case 'low':
        return 'info';
      default:
        return 'error';
    }
  }

  /**
   * Get toast duration based on severity
   */
  private getToastDuration(severity: string): number {
    switch (severity) {
      case 'critical':
        return 0; // Don't auto-dismiss critical errors
      case 'high':
        return 10000; // 10 seconds
      case 'medium':
        return 7000; // 7 seconds
      case 'low':
        return 5000; // 5 seconds
      default:
        return 5000;
    }
  }

  /**
   * Handle critical errors
   */
  private handleCriticalError(report: ErrorReport): void {
    // Log to external service in production
    if (import.meta.env.PROD) {
      this.logToExternalService(report);
    }

    // Consider showing a modal or redirecting to error page
    console.error('CRITICAL ERROR:', report);
  }

  /**
   * Retry action (placeholder for retry logic)
   */
  private retryAction(context: ErrorContext): void {
    // This would be implemented based on the specific action
    console.log('Retrying action:', context.action);
  }

  /**
   * Log error to internal log
   */
  private logError(report: ErrorReport): void {
    this.errorLog.unshift(report);
    
    // Maintain log size
    if (this.errorLog.length > this.maxLogSize) {
      this.errorLog = this.errorLog.slice(0, this.maxLogSize);
    }
  }

  /**
   * Log to external service (placeholder)
   */
  private logToExternalService(report: ErrorReport): void {
    // In production, this would send to an error tracking service
    console.log('Would log to external service:', report);
  }

  /**
   * Get error log
   */
  getErrorLog(): ErrorReport[] {
    return [...this.errorLog];
  }

  /**
   * Clear error log
   */
  clearErrorLog(): void {
    this.errorLog = [];
  }

  /**
   * Get error statistics
   */
  getErrorStats(): {
    total: number;
    bySeverity: Record<string, number>;
    byType: Record<string, number>;
    recent: number;
  } {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    const bySeverity: Record<string, number> = {};
    const byType: Record<string, number> = {};
    let recent = 0;

    this.errorLog.forEach(report => {
      // Count by severity
      bySeverity[report.severity] = (bySeverity[report.severity] || 0) + 1;
      
      // Count by type
      const type = report.error.constructor.name;
      byType[type] = (byType[type] || 0) + 1;
      
      // Count recent errors
      if (report.context.timestamp && report.context.timestamp > oneHourAgo) {
        recent++;
      }
    });

    return {
      total: this.errorLog.length,
      bySeverity,
      byType,
      recent
    };
  }
}

/**
 * Convenience functions for error handling
 */
export const errorHandler = ErrorHandler.getInstance();

export const handleError = (error: Error, context: ErrorContext = {}) => {
  return errorHandler.handle(error, context);
};

export const handleAPIError = (error: Error, action: string, component?: string) => {
  return handleError(error, { action, component });
};

export const handleComponentError = (error: Error, component: string, action?: string) => {
  return handleError(error, { component, action });
};

export const handleStorageError = (error: Error, action: string) => {
  return handleError(error, { action: `storage_${action}` });
};

/**
 * Error boundary for components
 */
export class ComponentErrorBoundary {
  private component: string;
  private fallbackRenderer?: (error: Error) => string;

  constructor(component: string, fallbackRenderer?: (error: Error) => string) {
    this.component = component;
    this.fallbackRenderer = fallbackRenderer;
  }

  /**
   * Wrap a function with error handling
   */
  wrap<T extends (...args: any[]) => any>(fn: T): T {
    return ((...args: any[]) => {
      try {
        const result = fn(...args);
        
        // Handle async functions
        if (result instanceof Promise) {
          return result.catch(error => {
            handleComponentError(error, this.component);
            return this.getFallback(error);
          });
        }
        
        return result;
      } catch (error) {
        handleComponentError(error as Error, this.component);
        return this.getFallback(error as Error);
      }
    }) as T;
  }

  /**
   * Get fallback content for errors
   */
  private getFallback(error: Error): any {
    if (this.fallbackRenderer) {
      return this.fallbackRenderer(error);
    }
    
    return `<div class="error-boundary">
      <p>Error in ${this.component}</p>
      <details>
        <summary>Error Details</summary>
        <pre>${error.message}</pre>
      </details>
    </div>`;
  }
}

/**
 * Async error handler for promises
 */
export const asyncErrorHandler = <T>(
  promise: Promise<T>,
  context: ErrorContext = {}
): Promise<T | null> => {
  return promise.catch(error => {
    handleError(error, context);
    return null;
  });
};

/**
 * Retry wrapper with exponential backoff
 */
export const withRetry = async <T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  baseDelay: number = 1000,
  context: ErrorContext = {}
): Promise<T> => {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === maxAttempts) {
        handleError(lastError, { ...context, metadata: { attempts: attempt } });
        throw lastError;
      }
      
      // Wait before retry with exponential backoff
      const delay = baseDelay * Math.pow(2, attempt - 1);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
};

export default errorHandler;