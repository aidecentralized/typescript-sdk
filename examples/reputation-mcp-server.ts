/**
 * Reputation MCP Server
 * Tracks and manages reputation data for coupon issuers and recipients.
 * Provides verification services and reputation metrics through REST API and WebSocket.
 */
import { McpServer } from '../src/server/mcp.js';
import { WebSocketTransport } from './shared/websocket-transport.js';
import { WebSocketServer } from 'ws';
import { createServer, IncomingMessage, ServerResponse } from 'http';
import { z } from 'zod';
import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import { fileURLToPath } from 'url';
import path from 'path';

// Import coupon verification utilities
import { verifyComprehensive } from '../src/coupon/verify.js';
import { Coupon, CouponVerificationResult, CouponVerifyOptions } from '../src/types/coupon.js';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Extended verification result that includes timestamp information.
 */
interface VerificationResultWithTimestamp extends CouponVerificationResult {
  verifiedAt: string;
}

interface ReputationData {
  entityName: string;
  totalCoupons: number;
  verifiedCoupons: number;
  unverifiedCoupons: number;
  trustScore: string;
  lastUpdated: string;
}

// Create server info
const serverInfo = {
  name: 'Reputation MCP Server',
  version: '1.0.0',
  vendor: 'MCP SDK Demo'
};

/**
 * Reputation data storage
 * In a production system, this would be a persistent database.
 */
// In a real system, this would be a database
const verificationResults: Map<string, VerificationResultWithTimestamp> = new Map();
const reputationStore: Map<string, ReputationData> = new Map();
const trustedIssuers: Set<string> = new Set([
  'Example Client',
  'TestCA'
]);

/**
 * Express REST API server implementation
 * Provides HTTP endpoints for coupon verification and reputation data.
 */
// Create Express app for REST API
const app = express();
app.use(express.json());
app.use(cors());

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Reputation MCP Server API',
    description: 'API for verifying coupons and managing reputation data',
    version: '1.0.0',
    endpoints: [
      { method: 'POST', path: '/verify', description: 'Verify a coupon' },
      { method: 'GET', path: '/verification-results', description: 'Get all verification results' },
      { method: 'GET', path: '/verification-results/:id', description: 'Get verification result for a specific coupon' },
      { method: 'GET', path: '/reputation/:commonName', description: 'Get reputation data for an entity' },
      { method: 'GET', path: '/reputation', description: 'Get all reputation data' },
      { method: 'GET', path: '/trusted-issuers', description: 'Get all trusted issuers' },
      { method: 'POST', path: '/trusted-issuers', description: 'Add a trusted issuer' },
      { method: 'DELETE', path: '/trusted-issuers/:commonName', description: 'Remove a trusted issuer' }
    ]
  });
});

// Endpoint to verify a coupon
app.post('/verify', async (req, res) => {
  try {
    const { coupon, options = {} } = req.body as { 
      coupon: Coupon;
      options?: CouponVerifyOptions;
    };
    
    if (!coupon || !coupon.id) {
      return res.status(400).json({
        success: false,
        error: 'Invalid coupon data. Please provide a valid coupon object.'
      });
    }
    
    console.log(`Received verification request for coupon ${coupon.id}`);
    
    // Convert trusted issuers array to a Set if provided
    let trustedIssuersSet: Set<string> | undefined;
    if (options.trustedIssuers) {
      trustedIssuersSet = new Set(options.trustedIssuers);
    } else if (options.checkTrustedIssuer) {
      trustedIssuersSet = trustedIssuers;
    }
    
    // Verify the coupon using the SDK's verification function
    const verificationOptions: CouponVerifyOptions = {
      ...options,
      trustedIssuers: trustedIssuersSet
    };
    
    const result = verifyComprehensive(coupon, verificationOptions);
    
    // Store the result
    verificationResults.set(coupon.id, {
      ...result,
      verifiedAt: new Date().toISOString()
    });
    
    // Update reputation data
    updateReputation(result);
    
    return res.json({
      success: true,
      verification: result
    });
  } catch (error) {
    console.error('Verification error:', error);
    return res.status(500).json({
      success: false,
      error: `Verification failed: ${error instanceof Error ? error.message : String(error)}`
    });
  }
});

// Endpoint to get all verification results
app.get('/verification-results', (req, res) => {
  // Convert the map to an array for the response
  const results = Array.from(verificationResults.values());
  
  res.json({
    success: true,
    count: results.length,
    results
  });
});

// Endpoint to get a specific verification result
app.get('/verification-results/:id', (req, res) => {
  const { id } = req.params;
  const result = verificationResults.get(id);
  
  if (!result) {
    return res.status(404).json({
      success: false,
      error: `No verification result found for coupon ID: ${id}`
    });
  }
  
  res.json({
    success: true,
    result
  });
});

/**
 * Updates reputation data based on a verification result.
 * Updates both issuer and recipient reputation metrics.
 * 
 * @param result - The verification result to process
 */
function updateReputation(result: CouponVerificationResult): void {
  // Update issuer reputation
  updateEntityReputation(result.issuer, result.verified);
  
  // Update recipient reputation
  updateEntityReputation(result.recipient, result.verified);
}

/**
 * Updates reputation data for a single entity.
 * Creates new reputation entries for entities not seen before.
 * 
 * @param commonName - The entity's common name
 * @param verified - Whether the verification was successful
 */
function updateEntityReputation(commonName: string, verified: boolean): void {
  const reputation = reputationStore.get(commonName) || {
    entityName: commonName,
    totalCoupons: 0,
    verifiedCoupons: 0,
    unverifiedCoupons: 0,
    trustScore: '0',
    lastUpdated: new Date().toISOString()
  };
  
  reputation.totalCoupons++;
  if (verified) {
    reputation.verifiedCoupons++;
  } else {
    reputation.unverifiedCoupons++;
  }
  
  reputation.trustScore = (reputation.verifiedCoupons / reputation.totalCoupons * 100).toFixed(2);
  reputation.lastUpdated = new Date().toISOString();
  
  reputationStore.set(commonName, reputation);
}

// Endpoint to get reputation data for an entity
app.get('/reputation/:commonName', (req, res) => {
  const { commonName } = req.params;
  const reputation = reputationStore.get(commonName);
  
  if (!reputation) {
    return res.status(404).json({
      success: false,
      error: `No reputation data found for entity: ${commonName}`
    });
  }
  
  res.json({
    success: true,
    reputation
  });
});

// Endpoint to get all reputation data
app.get('/reputation', (req, res) => {
  const allReputations = Array.from(reputationStore.values());
  
  res.json({
    success: true,
    count: allReputations.length,
    reputations: allReputations
  });
});

// Add a trusted issuer
app.post('/trusted-issuers', (req, res) => {
  const { commonName } = req.body as { commonName: string };
  
  if (!commonName) {
    return res.status(400).json({
      success: false,
      error: 'Common name is required'
    });
  }
  
  trustedIssuers.add(commonName);
  
  res.json({
    success: true,
    message: `Added '${commonName}' to trusted issuers`,
    trustedIssuers: Array.from(trustedIssuers)
  });
});

// Remove a trusted issuer
app.delete('/trusted-issuers/:commonName', (req, res) => {
  const { commonName } = req.params;
  
  if (trustedIssuers.has(commonName)) {
    trustedIssuers.delete(commonName);
    res.json({
      success: true,
      message: `Removed '${commonName}' from trusted issuers`,
      trustedIssuers: Array.from(trustedIssuers)
    });
  } else {
    res.status(404).json({
      success: false,
      error: `Issuer '${commonName}' not found in trusted issuers`
    });
  }
});

// Get all trusted issuers
app.get('/trusted-issuers', (req, res) => {
  res.json({
    success: true,
    trustedIssuers: Array.from(trustedIssuers)
  });
});

/**
 * WebSocket MCP server implementation
 * Provides real-time coupon verification and reputation services.
 */
// Create HTTP server for the WebSocket
const httpServer = createServer((req: IncomingMessage, res: ServerResponse) => {
  if (req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
      <html>
        <head><title>Reputation MCP Server</title></head>
        <body>
          <h1>Reputation MCP Server</h1>
          <p>This server tracks and manages reputation data.</p>
          <p>REST API is available at: http://localhost:3003/</p>
          <p>WebSocket endpoint for MCP: ws://localhost:3003/mcp</p>
        </body>
      </html>
    `);
  } else {
    // Forward all other requests to the Express app
    app(req, res);
  }
});

// Create WebSocket server
const wss = new WebSocketServer({ server: httpServer });

// Create MCP server
const mcpServer = new McpServer(serverInfo);

// Register a tool to verify a coupon
mcpServer.tool(
  'verifyCoupon',
  'Verify a coupon and get reputation data',
  {
    coupon: z.object({}).passthrough(),
    options: z.object({
      checkExpiry: z.boolean().optional(),
      verifySignature: z.boolean().optional(),
      validateFormat: z.boolean().optional(),
      checkTrustedIssuer: z.boolean().optional()
    }).optional()
  },
  async (args) => {
    try {
      const { coupon, options = {} } = args;
      
      // Verify the coupon
      const verificationOptions: CouponVerifyOptions = {
        checkExpiry: options.checkExpiry !== false,
        verifySignature: options.verifySignature !== false,
        validateFormat: options.validateFormat !== false,
        checkTrustedIssuer: options.checkTrustedIssuer === true,
        trustedIssuers: options.checkTrustedIssuer ? trustedIssuers : undefined
      };
      
      const result = verifyComprehensive(coupon as Coupon, verificationOptions);
      
      // Store the result
      verificationResults.set(result.id, {
        ...result,
        verifiedAt: new Date().toISOString()
      });
      
      // Update reputation data
      updateReputation(result);
      
      // Get reputation data for the issuer
      const issuerReputation = reputationStore.get(result.issuer);
      
      return {
        content: [
          {
            type: 'text',
            text: `Coupon Verification Result:\n\n` +
                  `${JSON.stringify(result, null, 2)}\n\n` +
                  `Issuer Reputation Data:\n\n` +
                  `${JSON.stringify(issuerReputation, null, 2)}`
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Verification error: ${error instanceof Error ? error.message : String(error)}`
          }
        ],
        isError: true
      };
    }
  }
);

// Register a tool to get reputation data
mcpServer.tool(
  'getReputation',
  'Get reputation data for an entity',
  {
    entity: z.string()
  },
  async (args) => {
    const reputation = reputationStore.get(args.entity);
    
    if (!reputation) {
      return {
        content: [
          {
            type: 'text',
            text: `No reputation data found for entity: ${args.entity}`
          }
        ],
        isError: true
      };
    }
    
    return {
      content: [
        {
          type: 'text',
          text: `Reputation Data for ${args.entity}:\n\n${JSON.stringify(reputation, null, 2)}`
        }
      ]
    };
  }
);

// Register a tool to fetch and verify coupons from other servers
mcpServer.tool(
  'fetchAndVerifyCoupons',
  'Fetch coupons from a server and verify them',
  {
    serverUrl: z.string().url()
  },
  async (args) => {
    try {
      const { serverUrl } = args;
      
      console.log(`Fetching coupons from ${serverUrl}/coupons`);
      
      // Fetch coupons from the server
      const couponsResponse = await fetch(`${serverUrl}/coupons`);
      
      if (!couponsResponse.ok) {
        return {
          content: [
            {
              type: 'text',
              text: `Failed to fetch coupons: ${couponsResponse.statusText}`
            }
          ],
          isError: true
        };
      }
      
      const data = await couponsResponse.json();
      const coupons = data.map((item: any) => item.coupon); // Extract the coupon objects
      
      if (!Array.isArray(coupons) || coupons.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: 'No coupons found or invalid response from server'
            }
          ],
          isError: true
        };
      }
      
      console.log(`Fetched ${coupons.length} coupons`);
      
      // Verify each coupon
      const results: Array<{
        couponId: string;
        verified?: boolean;
        issuer?: string;
        recipient?: string;
        error?: string;
      }> = [];
      
      for (const coupon of coupons) {
        try {
          const result = verifyComprehensive(coupon, {
            checkExpiry: true,
            verifySignature: true,
            validateFormat: true,
            checkTrustedIssuer: true,
            trustedIssuers
          });
          
          // Store the result
          verificationResults.set(coupon.id, {
            ...result,
            verifiedAt: new Date().toISOString()
          });
          
          // Update reputation data
          updateReputation(result);
          
          results.push({
            couponId: coupon.id,
            verified: result.verified,
            issuer: result.issuer,
            recipient: result.recipient
          });
        } catch (error) {
          results.push({
            couponId: coupon.id,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
      
      // Count the results
      const summary = {
        total: coupons.length,
        verified: results.filter(r => r.verified).length,
        failed: results.filter(r => !r.verified && !r.error).length,
        errors: results.filter(r => r.error).length
      };
      
      return {
        content: [
          {
            type: 'text',
            text: `Verification Summary:\n\n` +
                  `${JSON.stringify(summary, null, 2)}\n\n` +
                  `Results:\n\n` +
                  `${JSON.stringify(results, null, 2)}`
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error fetching and verifying coupons: ${error instanceof Error ? error.message : String(error)}`
          }
        ],
        isError: true
      };
    }
  }
);

// Register a tool to get all trusted issuers
mcpServer.tool(
  'getTrustedIssuers',
  'Get all trusted issuers',
  async () => {
    return {
      content: [
        {
          type: 'text',
          text: `Trusted Issuers:\n\n${Array.from(trustedIssuers).join('\n')}`
        }
      ]
    };
  }
);

// Register a tool to manage trusted issuers
mcpServer.tool(
  'manageTrustedIssuers',
  'Add or remove trusted issuers',
  {
    action: z.enum(['add', 'remove', 'list']),
    issuer: z.string().optional()
  },
  async (args) => {
    const { action, issuer } = args;
    
    if (action === 'list') {
      return {
        content: [
          {
            type: 'text',
            text: `Trusted issuers: ${Array.from(trustedIssuers).join(', ')}`
          }
        ]
      };
    }
    
    if (!issuer) {
      return {
        content: [
          {
            type: 'text',
            text: 'Issuer name is required for add/remove actions'
          }
        ],
        isError: true
      };
    }
    
    if (action === 'add') {
      trustedIssuers.add(issuer);
      return {
        content: [
          {
            type: 'text',
            text: `Added ${issuer} to trusted issuers`
          }
        ]
      };
    } else if (action === 'remove') {
      if (trustedIssuers.has(issuer)) {
        trustedIssuers.delete(issuer);
        return {
          content: [
            {
              type: 'text',
              text: `Removed ${issuer} from trusted issuers`
            }
          ]
        };
      } else {
        return {
          content: [
            {
              type: 'text',
              text: `Issuer ${issuer} not found in trusted issuers`
            }
          ],
          isError: true
        };
      }
    }
    
    return { content: [] }; // Should never reach here due to enum constraint
  }
);

// Handle WebSocket connections
wss.on('connection', (ws, req) => {
  console.log('Client connected');
  
  // Only handle connections to the MCP endpoint
  if (req.url !== '/mcp') {
    console.log('Connection rejected: wrong path');
    ws.close(1003, 'Connection path not supported');
    return;
  }
  
  // Create transport for this connection
  const transport = new WebSocketTransport(ws);
  
  // Connect the MCP server to this transport
  mcpServer.connect(transport)
    .catch((error) => {
      console.error('Error connecting to transport:', error);
      ws.close(1011, 'Server error');
    });
  
  // Handle disconnect
  ws.on('close', () => {
    console.log('Client disconnected');
  });
});

// Start the server
const PORT = 3003;
httpServer.listen(PORT, () => {
  console.log(`Reputation MCP Server running on http://localhost:${PORT}`);
  console.log(`REST API available at http://localhost:${PORT}/`);
  console.log(`WebSocket endpoint: ws://localhost:${PORT}/mcp`);
});