/**
 * Main MCP Server
 * Verifies coupons and provides access to protected resources.
 * Acts as the central verification point for coupon-based authentication.
 */
import { McpServer } from '../src/server/mcp.js';
import { WebSocketTransport } from './shared/websocket-transport.js';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { z } from 'zod';
import fetch from 'node-fetch';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import path from 'path';
// Import coupon verification utilities
import { verifyComprehensive } from '../src/coupon/verify.js';
// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Create a set of trusted issuers (initialized with common test values)
const trustedIssuers = new Set([
    'Example Client',
    'TestCA'
]);
// Track processed coupons
const processedCoupons = new Map();
// Create server info
const serverInfo = {
    name: 'Main MCP Server',
    version: '1.0.0',
    vendor: 'MCP SDK Demo'
};
// Create HTTP server for the WebSocket
const httpServer = createServer((req, res) => {
    if (req.url === '/') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
      <html>
        <head><title>Main MCP Server</title></head>
        <body>
          <h1>Main MCP Server</h1>
          <p>This server verifies coupons and provides protected resources.</p>
          <p>Connect to the WebSocket endpoint at: ws://localhost:3002/mcp</p>
        </body>
      </html>
    `);
    }
    else if (req.url === '/coupons') {
        // Return processed coupons
        res.writeHead(200, { 'Content-Type': 'application/json' });
        const couponsArray = Array.from(processedCoupons.values());
        res.end(JSON.stringify(couponsArray));
    }
    else if (req.url === '/trusted-issuers') {
        // Return trusted issuers
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(Array.from(trustedIssuers)));
    }
    else {
        res.writeHead(404);
        res.end('Not found');
    }
});
// Create WebSocket server
const wss = new WebSocketServer({ server: httpServer });
// Create MCP server
const mcpServer = new McpServer(serverInfo);
/**
 * Installs middleware to verify coupons on all incoming requests.
 * This intercepts requests, extracts coupons, and verifies them before processing.
 *
 * @param server - The MCP server to modify
 */
function installCouponMiddleware(server) {
    const originalConnect = server.server.connect.bind(server.server);
    server.server.connect = async (transport) => {
        // Override the transport's process method to intercept requests
        const originalProcess = transport.process?.bind(transport);
        if (originalProcess) {
            transport.process = async (request) => {
                console.log(`Processing request: ${request.method}`);
                // Look for coupon in the request headers
                const coupon = request.headers?.coupon;
                if (coupon) {
                    console.log(`Coupon found in request: ${coupon.id}`);
                    try {
                        // Verify with the Reputation MCP Server
                        const verificationResult = await verifyWithReputationServer(coupon);
                        // Store the verification result
                        processedCoupons.set(coupon.id, {
                            coupon,
                            verificationResult,
                            processedAt: new Date().toISOString()
                        });
                        // Attach verification result to the request for handlers
                        request._couponVerification = verificationResult;
                        // Log verification result
                        if (verificationResult.verified) {
                            console.log(`Coupon verification SUCCESS: ${coupon.id}`);
                        }
                        else {
                            console.log(`Coupon verification FAILED: ${coupon.id}`);
                            console.log(`Reason: ${JSON.stringify(verificationResult.checks)}`);
                        }
                        // For demonstration - reject if the coupon verification failed and method is protected
                        if (!verificationResult.verified && request.method.startsWith('protected.')) {
                            return {
                                id: request.id,
                                error: {
                                    code: -32602, // Invalid params
                                    message: "Valid coupon required for protected methods"
                                }
                            };
                        }
                    }
                    catch (error) {
                        console.error('Error during coupon verification:', error);
                        // If verification fails and the endpoint is protected, reject
                        if (request.method.startsWith('protected.')) {
                            return {
                                id: request.id,
                                error: {
                                    code: -32602, // Invalid params
                                    message: `Coupon verification error: ${error instanceof Error ? error.message : String(error)}`
                                }
                            };
                        }
                    }
                }
                else if (request.method.startsWith('protected.')) {
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
/**
 * Verifies a coupon by sending it to the Reputation MCP Server.
 * Falls back to local verification if the reputation server is unavailable.
 *
 * @param coupon - The coupon to verify
 * @returns Verification result with detailed check information
 */
async function verifyWithReputationServer(coupon) {
    try {
        const reputationServerUrl = 'http://localhost:3003/verify';
        const response = await fetch(reputationServerUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                coupon,
                options: {
                    checkExpiry: true,
                    verifySignature: true,
                    validateFormat: true,
                    checkTrustedIssuer: true,
                    trustedIssuers: Array.from(trustedIssuers)
                }
            })
        });
        if (!response.ok) {
            const errorData = await response.text();
            throw new Error(`Reputation server error: ${response.status} ${errorData}`);
        }
        const result = await response.json();
        return result.verification;
    }
    catch (error) {
        console.error('Error connecting to Reputation MCP Server:', error);
        // Fall back to local verification if reputation server is unreachable
        console.log('Falling back to local verification...');
        return verifyComprehensive(coupon, {
            checkExpiry: true,
            verifySignature: true,
            validateFormat: true,
            checkTrustedIssuer: true,
            trustedIssuers
        });
    }
}
// Install the coupon middleware
installCouponMiddleware(mcpServer);
// Register a public tool to check server status
mcpServer.tool('serverStatus', 'Get the status of the Main MCP Server', async () => {
    return {
        content: [
            {
                type: 'text',
                text: `Server Status: OPERATIONAL\n` +
                    `Server Time: ${new Date().toISOString()}\n` +
                    `Processed Coupons: ${processedCoupons.size}\n` +
                    `Trusted Issuers: ${Array.from(trustedIssuers).join(', ')}`
            }
        ]
    };
});
// Register a protected tool that requires a valid coupon
mcpServer.tool('protected.getData', 'Access protected data (requires valid coupon)', {
    dataId: z.string().optional()
}, async (args, extra) => {
    const verificationResult = extra.request._couponVerification;
    // This should never happen due to middleware, but check anyway
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
    const dataId = args.dataId || 'default';
    // Get some "protected" data
    const protectedData = {
        id: dataId,
        value: crypto.randomBytes(8).toString('hex'),
        timestamp: new Date().toISOString(),
        accessGrantedTo: verificationResult.issuer,
        couponId: verificationResult.id
    };
    return {
        content: [
            {
                type: 'text',
                text: `Access granted to protected data!\n\n` +
                    `${JSON.stringify(protectedData, null, 2)}`
            }
        ]
    };
});
// Register a tool to manage trusted issuers
mcpServer.tool('manageTrustedIssuers', 'Manage the list of trusted issuers', {
    action: z.enum(['add', 'remove', 'list']),
    issuer: z.string().optional()
}, async (args) => {
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
    }
    else if (action === 'remove') {
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
        }
        else {
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
});
// Register a tool to check coupon verification status
mcpServer.tool('checkProcessedCoupon', 'Check if a coupon has been processed and its verification result', {
    couponId: z.string()
}, async (args) => {
    const couponInfo = processedCoupons.get(args.couponId);
    if (!couponInfo) {
        return {
            content: [
                {
                    type: 'text',
                    text: `Coupon ID ${args.couponId} not found in processed coupons`
                }
            ],
            isError: true
        };
    }
    return {
        content: [
            {
                type: 'text',
                text: `Coupon Verification Result:\n\n${JSON.stringify(couponInfo, null, 2)}`
            }
        ]
    };
});
// Register a protected tool that shows reputation data
mcpServer.tool('protected.getReputationData', 'Get reputation data for an entity (requires valid coupon)', {
    entity: z.string().optional()
}, async (args, extra) => {
    const verificationResult = extra.request._couponVerification;
    // This should never happen due to middleware, but check anyway
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
        // Get entity, defaulting to the coupon issuer
        const entity = args.entity || verificationResult.issuer;
        // Get reputation data from the Reputation MCP Server
        const response = await fetch(`http://localhost:3003/reputation/${encodeURIComponent(entity)}`);
        if (!response.ok) {
            if (response.status === 404) {
                return {
                    content: [
                        {
                            type: 'text',
                            text: `No reputation data found for entity: ${entity}`
                        }
                    ],
                    isError: true
                };
            }
            throw new Error(`Reputation server error: ${response.status}`);
        }
        const reputationData = await response.json();
        return {
            content: [
                {
                    type: 'text',
                    text: `Reputation Data for ${entity}:\n\n${JSON.stringify(reputationData.reputation, null, 2)}`
                }
            ]
        };
    }
    catch (error) {
        return {
            content: [
                {
                    type: 'text',
                    text: `Error fetching reputation data: ${error instanceof Error ? error.message : String(error)}`
                }
            ],
            isError: true
        };
    }
});
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
const PORT = 3002;
httpServer.listen(PORT, () => {
    console.log(`Main MCP Server running on http://localhost:${PORT}`);
    console.log(`WebSocket endpoint: ws://localhost:${PORT}/mcp`);
    console.log(`HTTP endpoints:`);
    console.log(`  - http://localhost:${PORT}/coupons - List processed coupons`);
    console.log(`  - http://localhost:${PORT}/trusted-issuers - List trusted issuers`);
});
