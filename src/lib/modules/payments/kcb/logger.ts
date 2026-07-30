/**
 * Structured Logger for KCB Payment Operations
 * Handles masked sensitive data and correlation IDs
 */

import { LOGGER_CONFIG } from './constants';

export interface LogContext {
  [key: string]: any;
}

export interface LogEntry {
  timestamp: string;
  level: string;
  module: string;
  correlationId?: string;
  message: string;
  context?: LogContext;
  error?: {
    code: string;
    message: string;
    stack?: string;
  };
}

class Logger {
  private module: string;
  private correlationId: string | null = null;

  constructor(module: string) {
    this.module = module;
  }

  /**
   * Set correlation ID for request tracking
   */
  setCorrelationId(id: string): void {
    this.correlationId = id;
  }

  /**
   * Clear correlation ID
   */
  clearCorrelationId(): void {
    this.correlationId = null;
  }

  /**
   * Log error level message
   */
  error(message: string, context?: LogContext, error?: Error): void {
    this.log('ERROR', message, context, error);
  }

  /**
   * Log warning level message
   */
  warn(message: string, context?: LogContext): void {
    this.log('WARN', message, context);
  }

  /**
   * Log info level message
   */
  info(message: string, context?: LogContext): void {
    this.log('INFO', message, context);
  }

  /**
   * Log debug level message
   */
  debug(message: string, context?: LogContext): void {
    this.log('DEBUG', message, context);
  }

  /**
   * Internal log method
   */
  private log(
    level: string,
    message: string,
    context?: LogContext,
    error?: Error
  ): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      module: this.module,
      correlationId: this.correlationId || undefined,
      message,
      context: context ? this.maskSensitiveData(context) : undefined,
    };

    if (error) {
      entry.error = {
        code: (error as any).code || 'UNKNOWN',
        message: error.message,
        stack: error.stack,
      };
    }

    // Log based on environment and level
    const isDev = import.meta.env.DEV;
    const logMethod = this.getLogMethod(level);

    if (isDev) {
      logMethod(`[${this.module}] ${message}`, context || error);
    } else {
      // In production, send to logging service
      this.sendToLoggingService(entry);
    }
  }

  /**
   * Mask sensitive data in context
   */
  private maskSensitiveData(context: LogContext): LogContext {
    const masked = { ...context };

    for (const field of LOGGER_CONFIG.MASK_FIELDS) {
      if (field in masked) {
        masked[field] = '***MASKED***';
      }
    }

    return masked;
  }

  /**
   * Get appropriate console method
   */
  private getLogMethod(level: string): typeof console.log {
    switch (level) {
      case 'ERROR':
        return console.error;
      case 'WARN':
        return console.warn;
      case 'INFO':
        return console.info;
      case 'DEBUG':
        return console.debug;
      default:
        return console.log;
    }
  }

  /**
   * Send log entry to external logging service
   * Can be extended to send to CloudWatch, DataDog, etc.
   */
  private sendToLoggingService(entry: LogEntry): void {
    // Implementation depends on your logging provider
    // For now, just log to console in production
    console.log(JSON.stringify(entry));
  }
}

/**
 * Create a logger instance for a module
 */
export function createLogger(module: string): Logger {
  return new Logger(module);
}

// Export singleton logger instance for shared use
export { Logger };
