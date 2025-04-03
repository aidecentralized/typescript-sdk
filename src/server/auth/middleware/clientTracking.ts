import { Request, Response, NextFunction } from 'express';
import { OAuthServerProvider } from '../provider.js';
import { AuthInfo } from '../types.js';

/**
 * Options for the client tracking middleware
 */
export interface ClientTrackingOptions {
  /**
   * Whether to record all client activities with the tracking store
   * @default true
   */
  recordAllActivities?: boolean;
  
  /**
   * Whether to add trackingId to the request object for use in handlers
   * @default true
   */
  addTrackingInfo?: boolean;
}

/**
 * Middleware that handles client tracking by attaching IDs and recording activities.
 */
export function clientTrackingMiddleware(
  provider: OAuthServerProvider,
  options: ClientTrackingOptions = {}
) {
  // Set default options
  const {
    recordAllActivities = true,
    addTrackingInfo = true
  } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Skip if provider doesn't support tracking or it's disabled
      if (!provider.clientTrackingEnabled || !provider.trackingStore) {
        return next();
      }

      // Get authentication info from the request
      // Assumes auth middleware has already run and set req.auth
      const authInfo = req.auth as AuthInfo | undefined;
      if (!authInfo) {
        return next();
      }
      
      // If there's no tracking ID yet, try to generate one
      if (!authInfo.trackingId && provider.generateTrackingId) {
        // Get client information to generate tracking ID
        const client = await provider.clientsStore.getClient(authInfo.clientId);
        if (client) {
          // Add tracking ID to auth info
          (authInfo as AuthInfo).trackingId = provider.generateTrackingId(client);
        }
      }
      
      // Skip the rest if we still don't have a tracking ID
      if (!authInfo.trackingId) {
        return next();
      }
      
      // Add tracking ID to request if enabled
      if (addTrackingInfo) {
        (req as unknown as Record<string, string>).trackingId = authInfo.trackingId;
      }
      
      // Note: We'll record the activity after the request finishes in a closure
      if (recordAllActivities && provider.recordActivity) {
        // Store the original end method
        const originalEnd = res.end;
        
        // Override end method to record activity when response is sent
        res.end = function(this: Response, ...args: unknown[]) {
          // Restore original end method
          res.end = originalEnd;
          
          // Call original end
          // Use type assertion for Express Response.end's complex signature
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const result = originalEnd.apply(this, args as any);
          
          // Record activity async after response is sent
          setTimeout(async () => {
            try {
              const success = res.statusCode >= 200 && res.statusCode < 400;
              await provider.recordActivity?.({
                clientId: authInfo.clientId,
                trackingId: authInfo.trackingId!,
                type: 'http',
                method: req.method,
                metadata: {
                  path: req.path,
                  statusCode: res.statusCode
                },
                status: success ? 'success' : 'error',
                ...(success ? {} : {
                  error: {
                    code: res.statusCode,
                    message: 'Request failed'
                  }
                })
              });
            } catch (error) {
              // Don't let recording errors affect the response
              console.error('Error recording client activity:', error);
            }
          }, 0);
          
          return result;
        };
      }
      
      next();
    } catch (error) {
      next(error);
    }
  };
}