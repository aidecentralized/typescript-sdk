import { Response } from "express";
import { OAuthRegisteredClientsStore, generateClientTrackingId } from "./clients.js";
import { OAuthClientInformationFull, OAuthTokenRevocationRequest, OAuthTokens } from "../../shared/auth.js";
import { AuthInfo, ClientTrackingStore } from "./types.js";

export type AuthorizationParams = {
  state?: string;
  scopes?: string[];
  codeChallenge: string;
  redirectUri: string;
};

/**
 * Configuration options for the OAuth server provider
 */
export interface OAuthServerProviderOptions {
  /**
   * Optional client tracking store to use for tracking client activity
   */
  trackingStore?: ClientTrackingStore;
  
  /**
   * Whether to enable client tracking
   * @default false
   */
  enableClientTracking?: boolean;
  
  /**
   * Optional seed to use when generating client tracking IDs
   */
  trackingIdSeed?: string;
}

/**
 * Implements an end-to-end OAuth server.
 */
export interface OAuthServerProvider {
  /**
   * A store used to read information about registered OAuth clients.
   */
  get clientsStore(): OAuthRegisteredClientsStore;
  
  /**
   * Optional store used for client activity tracking
   */
  get trackingStore(): ClientTrackingStore | undefined;
  
  /**
   * Whether client tracking is enabled for this provider
   */
  get clientTrackingEnabled(): boolean;

  /**
   * Begins the authorization flow, which can either be implemented by this server itself or via redirection to a separate authorization server. 
   * 
   * This server must eventually issue a redirect with an authorization response or an error response to the given redirect URI. Per OAuth 2.1:
   * - In the successful case, the redirect MUST include the `code` and `state` (if present) query parameters.
   * - In the error case, the redirect MUST include the `error` query parameter, and MAY include an optional `error_description` query parameter.
   */
  authorize(client: OAuthClientInformationFull, params: AuthorizationParams, res: Response): Promise<void>;

  /**
   * Returns the `codeChallenge` that was used when the indicated authorization began.
   */
  challengeForAuthorizationCode(client: OAuthClientInformationFull, authorizationCode: string): Promise<string>;

  /**
   * Exchanges an authorization code for an access token.
   */
  exchangeAuthorizationCode(client: OAuthClientInformationFull, authorizationCode: string): Promise<OAuthTokens>;

  /**
   * Exchanges a refresh token for an access token.
   */
  exchangeRefreshToken(client: OAuthClientInformationFull, refreshToken: string, scopes?: string[]): Promise<OAuthTokens>;

  /**
   * Verifies an access token and returns information about it.
   */
  verifyAccessToken(token: string): Promise<AuthInfo>;

  /**
   * Revokes an access or refresh token. If unimplemented, token revocation is not supported (not recommended).
   * 
   * If the given token is invalid or already revoked, this method should do nothing.
   */
  revokeToken?(client: OAuthClientInformationFull, request: OAuthTokenRevocationRequest): Promise<void>;

  /**
   * Generates a tracking ID for a client. This is used to identify a client across sessions.
   */
  generateTrackingId?(client: OAuthClientInformationFull): string;
  
  /**
   * Records client activity if tracking is enabled
   */
  recordActivity?(activity: {
    clientId: string;
    trackingId: string;
    type: string;
    method: string;
    metadata?: Record<string, unknown>;
    status?: 'success' | 'error';
    error?: { code: number; message: string };
  }): Promise<void>;
}

/**
 * Base implementation of OAuthServerProvider that includes client tracking functionality
 */
export abstract class BaseOAuthServerProvider implements OAuthServerProvider {
  private _trackingStore?: ClientTrackingStore;
  private _enableClientTracking: boolean;
  private _trackingIdSeed?: string;

  constructor(
    private _clientsStore: OAuthRegisteredClientsStore,
    options?: OAuthServerProviderOptions
  ) {
    this._trackingStore = options?.trackingStore;
    this._enableClientTracking = options?.enableClientTracking ?? false;
    this._trackingIdSeed = options?.trackingIdSeed;
  }

  get clientsStore(): OAuthRegisteredClientsStore {
    return this._clientsStore;
  }
  
  get trackingStore(): ClientTrackingStore | undefined {
    return this._trackingStore;
  }
  
  get clientTrackingEnabled(): boolean {
    return this._enableClientTracking && !!this._trackingStore;
  }

  abstract authorize(client: OAuthClientInformationFull, params: AuthorizationParams, res: Response): Promise<void>;
  abstract challengeForAuthorizationCode(client: OAuthClientInformationFull, authorizationCode: string): Promise<string>;
  abstract exchangeAuthorizationCode(client: OAuthClientInformationFull, authorizationCode: string): Promise<OAuthTokens>;
  abstract exchangeRefreshToken(client: OAuthClientInformationFull, refreshToken: string, scopes?: string[]): Promise<OAuthTokens>;
  abstract verifyAccessToken(token: string): Promise<AuthInfo>;
  
  /**
   * Generates a tracking ID for a client based on its characteristics
   */
  generateTrackingId(client: OAuthClientInformationFull): string {
    return generateClientTrackingId(client, this._trackingIdSeed);
  }
  
  /**
   * Records client activity if tracking is enabled
   */
  async recordActivity(activity: {
    clientId: string;
    trackingId: string;
    type: string;
    method: string;
    metadata?: Record<string, unknown>;
    status?: 'success' | 'error';
    error?: { code: number; message: string };
  }): Promise<void> {
    if (!this.clientTrackingEnabled || !this._trackingStore) {
      return;
    }
    
    await this._trackingStore.recordActivity(
      activity.clientId,
      activity.trackingId,
      {
        timestamp: Date.now(),
        type: activity.type,
        method: activity.method,
        metadata: activity.metadata,
        status: activity.status,
        error: activity.error
      }
    );
  }
}