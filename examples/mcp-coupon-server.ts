/**
 * MCP Server with Coupon Support Example
 * Demonstrates a server that verifies and processes coupons for authentication.
 * Provides secure API endpoints protected by coupon verification.
 */
import { McpServer } from '../src/server/mcp.js';
import { Server } from '../src/server/index.js';
import { WebSocketTransport } from '../src/shared/transport.js';
import { WebSocketServer } from 'ws';
import { z } from 'zod';
import { createServer, IncomingMessage, ServerResponse } from 'http';
import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import crypto from 'crypto';
import WebSocket from 'ws';

// Import types
import { Coupon, CouponVerificationResult } from '../src/types/coupon.js';
import { JsonRpcRequest } from '../src/shared/protocol.js';

// Import coupon verification functions
import { verifyComprehensive } from '../src/coupon/verify.js';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Information about a verified coupon
 */
interface VerifiedCouponInfo {
  coupon: Coupon;
  verificationResult: CouponVerificationResult;
  timestamp: string;
}

/**
 * Create a set of trusted issuers
 * This would typically be configured based on your environment
 */
const trustedIssuers = new Set([
  'Example Client',  // Add your client's common name here
  'TestCA'
]);

/**
 * Track coupons and their verification results 
 * In a real system this would be a database
 */
const verifiedCoupons: Map<string, VerifiedCouponInfo> = new Map();

// Create an HTTP server
const httpServer = createServer((req: IncomingMessage, res: ServerResponse) => {
  if (req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
      <html>
        <head><title>MCP Coupon Server</title></head>
        <body>
          <h1>MCP Coupon Server</h1>
          <p>MCP WebSocket server is running. Connect to ws://localhost:3050/mcp</p>
          <p>HTTP endpoints:</p>
          <ul>
            <li><a href="/coupons">/coupons</a> - List all verified coupons</li>
            <li><a href="/trusted-issuers">/trusted-issuers</a> - List trusted issuers</li>
          </ul>
        </body>
      </html>
    `);
  } else if (req.url === '/coupons') {
    // Return all verified coupons as JSON
    res.writeHead(200, { 'Content-Type': 'application/json' });
    const couponsArray = Array.from(verifiedCoupons.values());
    res.end(JSON.stringify(couponsArray));
  } else if (req.url === '/trusted-issuers') {
    // Return trusted issuers as JSON
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(Array.from(trustedIssuers)));
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

// Create a WebSocket server
const wss = new WebSocketServer({ server: httpServer });

// Create our MCP server information
const mcpServerInfo = {
  name: 'MCP Coupon Example Server',
  version: '1.0.0',
  vendor: 'Example Org',
};

// Keep track of connected clients
const connectedClients = new Set<WebSocket>();

// Create the MCP Server
const mcpServer = new McpServer(mcpServerInfo);

/**
 * Installs coupon extraction and verification middleware.
 * This middleware intercepts all requests to verify coupons before processing.
 * 
 * @param server - The MCP server to modify
 */
function installCouponMiddleware(server: McpServer): void {
  const originalConnect = server.server.connect.bind(server.server);
  
  server.server.connect = async (transport) => {
    // Override the process method to extract and verify coupons
    const originalProcess = transport.process?.bind(transport);
    
    if (originalProcess) {
      transport.process = async (request: JsonRpcRequest) => {
        console.log(`Processing request: ${request.method}`);
        
        // Look for coupon in the request headers
        const coupon = request.headers?.coupon as Coupon | undefined;
        
        if (coupon) {
          console.log(`Coupon found in request: ${coupon.id}`);
          
          // Verify the coupon
          const verificationResult = verifyComprehensive(coupon, {
            checkExpiry: true,
            verifySignature: true,
            validateFormat: true,
            checkTrustedIssuer: true,
            trustedIssuers
          });
          
          // Store the verification result
          verifiedCoupons.set(coupon.id, {
            coupon,
            verificationResult,
            timestamp: new Date().toISOString()
          });
          
          // Attach verification result to the request for handlers
          (request as any)._couponVerification = verificationResult;
          
          // Log verification result
          console.log(`Coupon verification result: ${verificationResult.verified ? 'VALID' : 'INVALID'}`);
          
          // For demonstration - reject if the coupon verification failed and method is protected
          // In a real system, you might use roles/permissions from the coupon
          if (!verificationResult.verified && request.method.startsWith('protected.')) {
            return {
              id: request.id,
              error: {
                code: -32602, // Invalid params
                message: "Valid coupon required for protected methods"
              }
            };
          }
        } else if (request.method.startsWith('protected.')) {
          // Reject protected methods without a coupon
          console.log(`Protected method called without coupon: ${request.method}`);
          return {
            id: request.id,
            error: {
              code: -32602, // Invalid params
              message: "Valid coupon required for protected methods"
            }
          };
        }
        
        // Continue normal processing
        return originalProcess(request);
      };
    }
    
    // Continue with original connect
    return await originalConnect(transport);
  };
}

// Install the coupon middleware
installCouponMiddleware(mcpServer);

/**
 * A tool to verify coupons.
 * Allows clients to test coupon verification.
 */
mcpServer.tool(
  'verifyCoupon',
  'Verify a coupon and return details of the verification',
  {
    coupon: z.object({}).passthrough()
  },
  async (args) => {
    try {
      const coupon = args.coupon as Coupon;
      
      // Verify the coupon
      const verificationResult = verifyComprehensive(coupon, {
        checkExpiry: true,
        verifySignature: true,
        validateFormat: true,
        checkTrustedIssuer: true,
        trustedIssuers
      });
      
      // Store the verification result
      verifiedCoupons.set(coupon.id, {
        coupon,
        verificationResult,
        timestamp: new Date().toISOString()
      });
      
      return {
        content: [
          {
            type: 'text',
            text: `Coupon Verification Result:\n\n${JSON.stringify(verificationResult, null, 2)}`
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Verification error: ${(error as Error).message}`
          }
        ],
        isError: true
      };
    }
  }
);

/**
 * A protected tool that verifies coupons with reputation data.
 * This endpoint requires a valid coupon to access.
 */
mcpServer.tool(
  'protected.verifyWithReputation',
  'Verify a coupon and include reputation data (requires valid coupon)',
  {
    coupon: z.object({}).passthrough()
  },
  async (args, extra) => {
    const verificationResult = (extra.request as any)._couponVerification as CouponVerificationResult | undefined;
    
    // This should never happen due to our middleware, but double-check anyway
    if (!verificationResult || !verificationResult.verified) {
      return {
        content: [
          {
            type: 'text',
            text: 'Access denied: Valid coupon required'
          }
        ],
        isError: true
      };
    }
    
    try {
      const coupon = args.coupon as Coupon;
      
      // Verify the coupon
      const newVerificationResult = verifyComprehensive(coupon, {
        checkExpiry: true,
        verifySignature: true,
        validateFormat: true,
        checkTrustedIssuer: true,
        trustedIssuers
      });
      
      // Generate mock reputation data
      const reputationScore = Math.floor(Math.random() * 100);
      const trustLevel = reputationScore > 75 ? 'High' : 
                         reputationScore > 50 ? 'Medium' : 
                         reputationScore > 25 ? 'Low' : 'Untrusted';
      
      const reputationData = {
        entityName: coupon.issuer.commonName,
        reputationScore,
        trustLevel,
        verifiedCoupons: Math.floor(Math.random() * 100),
        totalTransactions: Math.floor(Math.random() * 1000),
        lastUpdated: new Date().toISOString()
      };
      
      return {
        content: [
          {
            type: 'text',
            text: `Verification with Reputation:\n\n` +
                 `Verification Result:\n${JSON.stringify(newVerificationResult, null, 2)}\n\n` +
                 `Reputation Data:\n${JSON.stringify(reputationData, null, 2)}`
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Verification error: ${(error as Error).message}`
          }
        ],
        isError: true
      };
    }
  }
);

/**
 * A tool to view all verified coupons.
 */
mcpServer.tool(
  'listVerifiedCoupons',
  'List all verified coupons and their verification results',
  async () => {
    const couponsArray = Array.from(verifiedCoupons.values());
    
    return {
      content: [
        {
          type: 'text',
          text: `Total verified coupons: ${couponsArray.length}\n\n` +
                `${JSON.stringify(couponsArray, null, 2)}`
        }
      ]
    };
  }
);

/**
 * A tool to manage trusted issuers.
 */
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
    
    // This should never happen due to the enum constraint
    return { content: [] };
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
  
  connectedClients.add(ws);
  
  // Create a transport for this WebSocket
  const transport = new WebSocketTransport(ws);
  
  // Connect the MCP server to this transport
  mcpServer.connect(transport)
    .catch((error) => {
      console.error('Error connecting to transport:', error);
      ws.close(1011, 'Server error');
    });
  
  // Handle disconnection
  ws.on('close', () => {
    console.log('Client disconnected');
    connectedClients.delete(ws);
  });
});

// Start the server
const PORT = 3050;
httpServer.listen(PORT, () => {
  console.log(`MCP Coupon server running at http://localhost:${PORT}`);
  console.log(`WebSocket endpoint: ws://localhost:${PORT}/mcp`);
  console.log(`HTTP endpoints:`);
  console.log(`  - http://localhost:${PORT}/coupons - List all verified coupons`);
  console.log(`  - http://localhost:${PORT}/trusted-issuers - List trusted issuers`);
});