/**
 * Information about a validated access token, provided to request handlers.
 */
export interface AuthInfo {
  /**
   * The access token.
   */
  token: string;

  /**
   * The client ID associated with this token.
   */
  clientId: string;

  /**
   * Scopes associated with this token.
   */
  scopes: string[];

  /**
   * When the token expires (in seconds since epoch).
   */
  expiresAt?: number;

  /**
   * Client tracking identifier that can be used to trace client activity
   * across multiple sessions. This is a unique digest generated from client characteristics.
   */
  trackingId?: string;
}

/**
 * Interface defining client activity tracking operations
 */
export interface ClientTrackingStore {
  /**
   * Adds a client activity entry to the store
   */
  recordActivity(
    clientId: string, 
    trackingId: string, 
    activity: ClientActivity
  ): Promise<void>;

  /**
   * Gets all recorded activities for a client by trackingId
   */
  getActivities(trackingId: string, options?: ActivityQueryOptions): Promise<ClientActivity[]>;
  
  /**
   * Gets activity statistics for a client
   */
  getActivityStats(trackingId: string): Promise<ActivityStats>;
}

/**
 * Options for querying client activities
 */
export interface ActivityQueryOptions {
  /**
   * Start time for the query (timestamp)
   */
  startTime?: number;
  
  /**
   * End time for the query (timestamp)
   */
  endTime?: number;
  
  /**
   * Maximum number of activities to return
   */
  limit?: number;
  
  /**
   * Types of activities to include
   */
  types?: string[];
  
  /**
   * Sort order for activities
   */
  sort?: 'asc' | 'desc';
}

/**
 * Represents a client activity that has been recorded
 */
export interface ClientActivity {
  /**
   * Timestamp when the activity occurred
   */
  timestamp: number;
  
  /**
   * Type of activity (e.g., 'tool/call', 'resource/read', etc.)
   */
  type: string;
  
  /**
   * Method name associated with the activity
   */
  method: string;
  
  /**
   * Optional metadata about the activity
   */
  metadata?: Record<string, unknown>;
  
  /**
   * Optional result status (e.g., 'success', 'error')
   */
  status?: 'success' | 'error';
  
  /**
   * Optional error information if status is 'error'
   */
  error?: {
    code: number;
    message: string;
  };
}

/**
 * Statistical data about client activities
 */
export interface ActivityStats {
  /**
   * Total number of activities recorded
   */
  totalActivities: number;
  
  /**
   * Number of successful activities
   */
  successCount: number;
  
  /**
   * Number of error activities
   */
  errorCount: number;
  
  /**
   * Activity counts grouped by type
   */
  typeBreakdown: Record<string, number>;
  
  /**
   * Time of first recorded activity
   */
  firstActivityTime: number;
  
  /**
   * Time of most recent activity
   */
  lastActivityTime: number;
  
  /**
   * Average activities per hour (over the last 24 hours)
   */
  averageHourlyRate: number;
  
  /**
   * Additional metrics calculated by the implementation
   */
  metrics?: Record<string, number>;
}