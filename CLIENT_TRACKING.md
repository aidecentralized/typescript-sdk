 # Client Tracking Implementation
  ## Overview

  Added client tracking to help developers monitor how clients interact with their server. The system tracks activities, stores them with a consistent client ID, and gives tools to analyze the data. The implementation was focused on collecting useful information, not so much any specific reputation logic so you can build whatever system makes sense for your needs.

  ## Key Components

  ### 1. Client Identification

  **File: `/src/server/auth/clients.ts`**

  The `generateClientTrackingId` function creates stable IDs for clients based on their characteristics:

    ```typescript
    export function generateClientTrackingId(
      clientInfo: OAuthClientInformationFull,
      seed?: string
    ): string {
      // Creates a hash from stable client characteristics
      // Returns a unique tracking ID that persists across sessions
    } 
    ```
  Lets you track clients across multiple sessions without requiring personal information.

  You can provide your own seed value to customize how IDs are generated, or completely replace the ID generation by overriding the generateTrackingId method in your provider.

  ### 2. Activity Tracking Interfaces

  **`File: /src/server/auth/types.ts`**

  Core interfaces for activity tracking:

  ```typescript
  export interface ClientTrackingStore {
    recordActivity(clientId: string, trackingId: string, activity: ClientActivity):
  Promise<void>;
    getActivities(trackingId: string, options?: ActivityQueryOptions):
  Promise<ClientActivity[]>;
    getActivityStats(trackingId: string): Promise<ActivityStats>;
  }
  

  export interface ClientActivity {
    timestamp: number;
    type: string;
    method: string;
    metadata?: Record<string, unknown>;
    status?: 'success' | 'error';
    error?: { code: number; message: string };
  }

  export interface ActivityStats {
    totalActivities: number;
    successCount: number;
    errorCount: number;
    typeBreakdown: Record<string, number>;
    firstActivityTime: number;
    lastActivityTime: number;
    averageHourlyRate: number;
    metrics?: Record<string, number>;
  }
  ```

  These interfaces define how activities are recorded and retrieved.

  The metadata field in ClientActivity and metrics in ActivityStats are 
  "open-ended" objects where you can store any custom data.

  ### 3. In-Memory Store Implementation

  **`File: /src/server/auth/clients.ts`**

  InMemoryClientTrackingStore provides a reference implementation:

  ```typescript
  export class InMemoryClientTrackingStore implements ClientTrackingStore {
    private activities: Map<string, ClientActivity[]> = new Map();

    // Methods for recording activities and calculating statistics
  }
  ```

  This implementation stores everything in memory and has methods for querying with various filters.

  This works fine for development, but developers will probably want to make your their implementation backed by a real database. This allows them to implement the same interface with a storage solution of their choice.

  ### 4. OAuth Server Integration

  **`File: /src/server/auth/provider.ts`**

  Extended the OAuth provider to support tracking:

  ```typescript
  export interface OAuthServerProvider {
    // Existing methods...

    get trackingStore(): ClientTrackingStore | undefined;
    get clientTrackingEnabled(): boolean;
    generateTrackingId?(client: OAuthClientInformationFull): string;
    recordActivity?(activity: {...}): Promise<void>;
  }
  ```

  This connects authentication with client tracking.

  If someone has a custom OAuth provider, they can plug in their own tracking ID generation algorithm or storage implementation.

  ### 5. Express Middleware

  **`File: /src/server/auth/middleware/clientTracking.ts`**

  Middleware for Express apps:

  ```typescript
  export function clientTrackingMiddleware(
    provider: OAuthServerProvider,
    options: ClientTrackingOptions = {}
  ) {
    // Adds tracking IDs to requests
    // Records client activities
    // Makes tracking information available to handlers
  }
  ```

  This makes it easy to track HTTP requests and responses.

  You can configure what gets tracked through options, disable activity recording or control how tracking IDs are exposed to your application.

  ### 6. McpServer Integration

  **`File: /src/server/mcp.ts`**

  Added tracking to the MCP server:

  ```typescript
  export interface McpServerOptions extends ServerOptions {
    enableClientTracking?: boolean;
    clientTrackingStore?: ClientTrackingStore;
  }
  ```

  The server now records activities for all client interactions automatically.

  You can pass your own storage implementation in the options to completely control how data is stored and accessed.

  ### 7. Client-Facing Activity Tool

  **`File: /src/server/mcp.ts`**

  Tool that lets clients see their own activity:

  ```typescript
  registerClientActivityTool() {
    // Provides a tool for clients to view their history and stats
  }
  ```

  Figured this should be added for some transparency if wanted.

  You can replace this with your own implementation if you want to customize what clients can see.

  ## What Gets Tracked

  The system tracks these interaction points:

  ### 1. Tool Interactions:
    - Tool listing
    - Tool calls with arguments and results

  ### 2. Resource Interactions:
    - Resource listing
    - Resource template listing
    - Resource reading

  ### 3. Prompt Interactions:
    - Prompt listing
    - Prompt retrieval

  ### 4. Completion Requests:
    - Completions for prompts and resources

  Each tracking point includes performance metrics. 
  
  You can extend this by adding custom metadata at specific tracking points in your handler implementations.

  ## How It Works

  ### 1. Client authenticates via OAuth

  ### 2. We generate a tracking ID based on client characteristics

  ### 3. This ID gets attached to the AuthInfo object

  ### 4. Each client interaction is recorded with:
    - Timestamp
    - Activity type
    - Method name
    - Relevant metadata
    - Success/error status
    - Performance metrics (duration)

  ### 5. You can access activity history and statistics

  ### 6. Clients can see their own data via the activity tool

  ## Quick Start

  ```typescript
  // Server setup with tracking
  const server = new McpServer(
    { name: "ExampleServer", version: "1.0.0" },
    { enableClientTracking: true }
  );

  // Express middleware integration
  app.use(clientTrackingMiddleware(oauthProvider));

  // Register activity tool for client transparency
  server.registerClientActivityTool();
  ```

  Should you want to use your own storage, just pass it in the options: 

  ```typescript
  { enableClientTracking: true, clientTrackingStore: myCustomStore }
  ```