/**
 * Client MCP Server
 * Helps clients generate certificates and coupons for use with the Main MCP Server.
 * Provides tools for certificate generation, coupon creation and communication with other servers.
 */
import { McpServer } from '../src/server/mcp.js';
import { WebSocketTransport } from '../src/shared/transport.js';
import { WebSocketServer } from 'ws';
import { createServer, IncomingMessage, ServerResponse } from 'http';
import { z } from 'zod';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import { Client } from '../src/client/index.js';
import WebSocket from 'ws';

// Import coupon-related utilities
import { generateCertificate } from '../src/coupon/sign.js';
import { createCoupon } from '../src/coupon/create.js';
import { Certificate, Coupon } from '../src/types/coupon.js';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure certs directory exists
const certsDir = path.join(__dirname, 'certs');
if (!fs.existsSync(certsDir)) {
  fs.mkdirSync(certsDir, { recursive: true });
}

/**
 * Client certificate information including private key and certificate data.
 */
interface ClientCertificateInfo {
  id: string;
  privateKey: string;
  certificate: Certificate;
  createdAt: string;
}

// In-memory store for client certificates
const clientCertificates: Map<string, ClientCertificateInfo> = new Map();

// Create server info
const serverInfo = {
  name: 'Client MCP Server',
  version: '1.0.0',
  vendor: 'MCP SDK Demo'
};

// Create HTTP server for the WebSocket
const httpServer = createServer((req: IncomingMessage, res: ServerResponse) => {
  if (req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
      <html>
        <head><title>Client MCP Server</title></head>
        <body>
          <h1>Client MCP Server</h1>
          <p>This server helps clients generate and manage coupons.</p>
          <p>Connect to the WebSocket endpoint at: ws://localhost:3001/mcp</p>
        </body>
      </html>
    `);
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

// Create WebSocket server
const wss = new WebSocketServer({ server: httpServer });

// Create MCP server
const mcpServer = new McpServer(serverInfo);

// Register tool to generate a client certificate
mcpServer.tool(
  'generateClientCertificate',
  'Generate a new client certificate for coupon creation',
  {
    commonName: z.string().min(1),
    organization: z.string().optional(),
    email: z.string().email().optional()
  },
  async (args) => {
    try {
      // Generate a new RSA key pair
      const privateKey = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: {
          type: 'spki',
          format: 'pem'
        },
        privateKeyEncoding: {
          type: 'pkcs8',
          format: 'pem'
        }
      }).privateKey;
      
      // Create certificate details
      const subjectInfo = {
        commonName: args.commonName,
        organization: args.organization || 'MCP Demo',
        organizationalUnit: 'Client',
        locality: 'Internet',
        state: 'Worldwide',
        country: 'US',
        emailAddress: args.email || `${args.commonName.toLowerCase().replace(/\s+/g, '.')}@example.com`
      };
      
      // Generate self-signed certificate
      const certificate = await generateCertificate({
        subject: subjectInfo,
        issuer: subjectInfo, // Self-signed
        privateKey,
        serialNumber: crypto.randomBytes(16).toString('hex'),
        validityDays: 365
      });
      
      // Store certificate
      const clientId = crypto.randomUUID();
      clientCertificates.set(clientId, {
        id: clientId,
        privateKey,
        certificate,
        createdAt: new Date().toISOString()
      });
      
      return {
        content: [
          {
            type: 'text',
            text: `Certificate generated successfully!\n\nYour Client ID: ${clientId}\n\nUse this ID to create coupons and send requests to the Main MCP Server.`
          }
        ]
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: 'text',
            text: `Error generating certificate: ${errorMessage}`
          }
        ],
        isError: true
      };
    }
  }
);

// Register tool to create a coupon
mcpServer.tool(
  'createCoupon',
  'Create a signed coupon for use with the Main MCP Server',
  {
    clientId: z.string().uuid(),
    recipient: z.string().min(1),
    purpose: z.string().optional(),
    expiresInMinutes: z.number().int().positive().optional()
  },
  async (args) => {
    try {
      // Get client certificate
      const clientInfo = clientCertificates.get(args.clientId);
      if (!clientInfo) {
        throw new Error(`Client ID ${args.clientId} not found. Generate a certificate first.`);
      }
      
      // Set expiry time
      const expiryMinutes = args.expiresInMinutes || 60; // Default 1 hour
      const expiresAt = new Date(Date.now() + (expiryMinutes * 60 * 1000)).toISOString();
      
      // Create coupon
      const couponInput = {
        issuer: {
          commonName: clientInfo.certificate.subject.commonName,
          organization: clientInfo.certificate.subject.organization,
          organizationalUnit: clientInfo.certificate.subject.organizationalUnit
        },
        recipient: {
          commonName: args.recipient,
          organization: 'Main MCP Server',
          organizationalUnit: 'Server'
        },
        issuerCertificate: clientInfo.certificate,
        expiresAt,
        data: {
          purpose: args.purpose || 'mcp-request',
          issuedBy: 'Client MCP Server',
          clientId: args.clientId,
          timestamp: new Date().toISOString()
        }
      };
      
      const coupon = await createCoupon(couponInput, clientInfo.privateKey);
      
      return {
        content: [
          {
            type: 'text',
            text: `Coupon created successfully!\n\n` +
                 `To use this coupon with the Main MCP Server, copy the following coupon object:\n\n` +
                 `\`\`\`json\n${JSON.stringify(coupon, null, 2)}\n\`\`\``
          }
        ]
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: 'text',
            text: `Error creating coupon: ${errorMessage}`
          }
        ],
        isError: true
      };
    }
  }
);

// Register tool to list client certificates
mcpServer.tool(
  'listClientCertificates',
  'List all client certificates generated by this server',
  async () => {
    const clients = Array.from(clientCertificates.entries()).map(([id, info]) => ({
      id,
      commonName: info.certificate.subject.commonName,
      organization: info.certificate.subject.organization,
      createdAt: info.createdAt
    }));
    
    return {
      content: [
        {
          type: 'text',
          text: `Client Certificates (${clients.length}):\n\n${JSON.stringify(clients, null, 2)}`
        }
      ]
    };
  }
);

// Register tool to send a request to the Main MCP Server
mcpServer.tool(
  'sendToMainServer', 
  'Send a request with a coupon to the Main MCP Server',
  {
    coupon: z.object({}).passthrough(),
    toolName: z.string().min(1),
    toolArgs: z.object({}).passthrough().optional()
  },
  async (args) => {
    try {
      const mainServerUrl = 'ws://localhost:3002/mcp';
      
      // Connect to the Main MCP Server
      const ws = new WebSocket(mainServerUrl);
      
      const result = await new Promise<any>((resolve, reject) => {
        // Handle connection error
        ws.on('error', (error) => {
          reject(`Failed to connect to Main MCP Server: ${error.message}`);
        });
        
        // Handle connection
        ws.on('open', () => {
          // Create MCP client
          const client = new Client();
          
          // Connect to the Main MCP Server
          client.connect({
            send: (data) => {
              ws.send(data);
            },
            onMessage: (callback) => {
              ws.on('message', (data) => {
                callback(data.toString());
              });
            },
            close: () => {
              ws.close();
            }
          }).then(() => {
            // Call the requested tool with the coupon
            client.callTool(args.toolName, args.toolArgs || {}, {
              coupon: args.coupon as Coupon
            }).then((response) => {
              // Close connection
              client.close();
              // Return the response
              resolve(response);
            }).catch((error) => {
              client.close();
              reject(`Error calling tool: ${error.message}`);
            });
          }).catch((error) => {
            ws.close();
            reject(`Error connecting to Main MCP Server: ${error.message}`);
          });
        });
        
        // Set timeout
        setTimeout(() => {
          if (ws.readyState !== WebSocket.OPEN) {
            reject('Connection to Main MCP Server timed out');
          }
        }, 5000);
      });
      
      return {
        content: [
          {
            type: 'text',
            text: `Request sent successfully!\n\nResponse from Main MCP Server:\n${JSON.stringify(result, null, 2)}`
          }
        ]
      };
    } catch (error) {
      const errorMessage = typeof error === 'string' ? error : 
        (error instanceof Error ? error.message : String(error));
      
      return {
        content: [
          {
            type: 'text',
            text: `Error sending request: ${errorMessage}`
          }
        ],
        isError: true
      };
    }
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
const PORT = 3001;
httpServer.listen(PORT, () => {
  console.log(`Client MCP Server running on http://localhost:${PORT}`);
  console.log(`WebSocket endpoint: ws://localhost:${PORT}/mcp`);
  console.log(`Use this server to generate client certificates and coupons`);
});