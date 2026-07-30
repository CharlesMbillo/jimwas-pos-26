/**
 * KCB OAuth Token Management
 * Handles token acquisition, caching, and automatic refresh
 */

import type { OAuthTokenResponse, CachedToken } from './types';
import { KCBPaymentError, ErrorCode } from './types';
import { getKCBConfig } from './config';
import { KCB_API_DEFAULTS } from './constants';
import { Logger } from './logger';

const logger = new Logger('OAuth');

class OAuthTokenManager {
  private cachedToken: CachedToken | null = null;
  private tokenPromise: Promise<string> | null = null;

  /**
   * Get a valid access token
   * Uses cached token if valid, otherwise requests a new one
   */
  async getToken(): Promise<string> {
    // If token refresh is in progress, wait for it
    if (this.tokenPromise) {
      return this.tokenPromise;
    }

    // Check if cached token is still valid
    if (this.cachedToken && this.isTokenValid(this.cachedToken)) {
      logger.debug('Using cached token', {
        expiresIn: Math.round((this.cachedToken.expires_at - Date.now()) / 1000),
      });
      return this.cachedToken.access_token;
    }

    // Request new token
    this.tokenPromise = this.requestToken();

    try {
      const token = await this.tokenPromise;
      return token;
    } finally {
      this.tokenPromise = null;
    }
  }

  /**
   * Request a new access token from KCB
   */
  private async requestToken(): Promise<string> {
    const config = getKCBConfig();

    try {
      logger.debug('Requesting new OAuth token');

      const response = await fetch(
        `${config.baseUrl}${KCB_API_DEFAULTS.TOKEN_ENDPOINT}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json',
          },
          body: new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: config.clientId,
            client_secret: config.clientSecret,
          }).toString(),
          signal: AbortSignal.timeout(config.requestTimeout),
        }
      );

      if (!response.ok) {
        throw new KCBPaymentError(
          ErrorCode.TOKEN_FAILED,
          `Token request failed with status ${response.status}`,
          response.status
        );
      }

      const data: OAuthTokenResponse = await response.json();

      if (!data.access_token || !data.expires_in) {
        throw new KCBPaymentError(
          ErrorCode.INVALID_RESPONSE,
          'Invalid token response: missing access_token or expires_in'
        );
      }

      // Cache the token
      this.cachedToken = {
        access_token: data.access_token,
        expires_at: Date.now() + (data.expires_in * 1000),
        cached_at: Date.now(),
      };

      logger.info('New token acquired', {
        expiresIn: data.expires_in,
        scope: data.scope,
      });

      return data.access_token;
    } catch (error) {
      if (error instanceof KCBPaymentError) {
        throw error;
      }

      if (error instanceof TypeError && error.name === 'AbortError') {
        throw new KCBPaymentError(
          ErrorCode.NETWORK_ERROR,
          'Token request timeout'
        );
      }

      throw new KCBPaymentError(
        ErrorCode.NETWORK_ERROR,
        error instanceof Error ? error.message : 'Failed to request token'
      );
    }
  }

  /**
   * Check if cached token is still valid
   * Considers token expired if less than REFRESH_BEFORE_EXPIRY seconds remain
   */
  private isTokenValid(token: CachedToken): boolean {
    const refreshThreshold =
      token.expires_at - KCB_API_DEFAULTS.TOKEN_REFRESH_BEFORE_EXPIRY * 1000;
    return Date.now() < refreshThreshold;
  }

  /**
   * Clear cached token (useful for testing or manual refresh)
   */
  clearCache(): void {
    this.cachedToken = null;
    logger.debug('Token cache cleared');
  }

  /**
   * Get cached token info (for debugging)
   */
  getCacheInfo(): {
    hasCachedToken: boolean;
    expiresAt?: number;
    expiresIn?: number;
    cached?: boolean;
  } {
    if (!this.cachedToken) {
      return { hasCachedToken: false };
    }

    const expiresIn = Math.round((this.cachedToken.expires_at - Date.now()) / 1000);

    return {
      hasCachedToken: true,
      expiresAt: this.cachedToken.expires_at,
      expiresIn: expiresIn > 0 ? expiresIn : 0,
      cached: this.isTokenValid(this.cachedToken),
    };
  }
}

// Export singleton instance
export const oauthTokenManager = new OAuthTokenManager();

/**
 * Get a valid access token
 */
export async function getAccessToken(): Promise<string> {
  return oauthTokenManager.getToken();
}

/**
 * Clear cached token
 */
export function clearTokenCache(): void {
  oauthTokenManager.clearCache();
}

/**
 * Get token cache info (debugging)
 */
export function getTokenCacheInfo() {
  return oauthTokenManager.getCacheInfo();
}
