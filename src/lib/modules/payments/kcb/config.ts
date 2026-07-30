/**
 * KCB Configuration Manager
 * Loads and validates environment configuration
 */

import type { KCBConfig } from './types';
import { KCB_API_DEFAULTS } from './constants';

class ConfigManager {
  private config: KCBConfig | null = null;
  private validated = false;

  /**
   * Get the current KCB configuration
   * Validates and caches configuration on first call
   */
  getConfig(): KCBConfig {
    if (this.config && this.validated) {
      return this.config;
    }

    this.config = {
      baseUrl: this.getEnv('KCB_BASE_URL'),
      clientId: this.getEnv('KCB_CLIENT_ID'),
      clientSecret: this.getEnv('KCB_CLIENT_SECRET'),
      routeCode: this.getEnv('KCB_ROUTE_CODE', '207'),
      sharedShortcode: this.getEnv('KCB_SHARED_SHORTCODE', 'true') === 'true',
      orgShortcode: this.getEnv('KCB_ORG_SHORTCODE'),
      orgPasskey: this.getEnv('KCB_ORG_PASSKEY'),
      callbackUrl: this.getEnv('KCB_CALLBACK_URL'),
      publicCertPath: this.getEnv('KCB_PUBLIC_CERT_PATH'),
      tokenCacheTTL: KCB_API_DEFAULTS.TOKEN_CACHE_TTL,
      requestTimeout: KCB_API_DEFAULTS.REQUEST_TIMEOUT,
      maxRetries: KCB_API_DEFAULTS.MAX_RETRIES,
      retryDelay: KCB_API_DEFAULTS.RETRY_DELAY,
    };

    this.validateConfig();
    this.validated = true;

    return this.config;
  }

  /**
   * Get a single environment variable with optional default
   */
  private getEnv(key: string, defaultValue?: string): string {
    const value = import.meta.env[`VITE_${key}`] || process.env[key];

    if (!value && !defaultValue) {
      throw new Error(`Missing required environment variable: ${key}`);
    }

    return value || defaultValue || '';
  }

  /**
   * Validate configuration values
   */
  private validateConfig(): void {
    if (!this.config) {
      throw new Error('Configuration not initialized');
    }

    const errors: string[] = [];

    if (!this.config.baseUrl) {
      errors.push('KCB_BASE_URL is required');
    } else if (!this.isValidUrl(this.config.baseUrl)) {
      errors.push('KCB_BASE_URL must be a valid URL');
    }

    if (!this.config.clientId || this.config.clientId.length < 10) {
      errors.push('KCB_CLIENT_ID is required and must be at least 10 characters');
    }

    if (!this.config.clientSecret || this.config.clientSecret.length < 10) {
      errors.push('KCB_CLIENT_SECRET is required and must be at least 10 characters');
    }

    if (!this.config.orgShortcode) {
      errors.push('KCB_ORG_SHORTCODE is required');
    }

    if (!this.config.orgPasskey) {
      errors.push('KCB_ORG_PASSKEY is required');
    }

    if (!this.config.callbackUrl) {
      errors.push('KCB_CALLBACK_URL is required');
    } else if (!this.isValidUrl(this.config.callbackUrl)) {
      errors.push('KCB_CALLBACK_URL must be a valid URL');
    }

    if (!this.config.publicCertPath) {
      errors.push('KCB_PUBLIC_CERT_PATH is required');
    }

    if (errors.length > 0) {
      throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
    }
  }

  /**
   * Check if string is a valid URL
   */
  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if configuration is valid without throwing
   */
  isValid(): boolean {
    try {
      this.getConfig();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Reset cached configuration (useful for testing)
   */
  reset(): void {
    this.config = null;
    this.validated = false;
  }
}

// Export singleton instance
export const configManager = new ConfigManager();

/**
 * Convenience function to get config
 */
export function getKCBConfig(): KCBConfig {
  return configManager.getConfig();
}

/**
 * Check if KCB is properly configured
 */
export function isKCBConfigured(): boolean {
  return configManager.isValid();
}
