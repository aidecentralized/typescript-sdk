/**
 * MCP Client with Coupon Support Example
 * Demonstrates a client that connects to an MCP server with coupon support.
 * Handles certificate generation, coupon creation, and authenticated requests.
 */
import { Client } from '../src/client/index.js';
import WebSocket from 'ws';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import readline from 'readline';

// Import types
import { Coupon, Certificate, DistinguishedName, CertificateGenerationOptions } from '../src/types/coupon.js';

// Import coupon creation utilities
import { generateCertificate } from './shared/certificate-utils.js';
import { createCoupon } from '../src/coupon/create.js';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Ensures the certificates directory exists.
 * Creates it if necessary.
 * 
 * @returns Path to the certificates directory
 */
function ensureCertsDirectory(): string {
  const certsDir = path.join(__dirname, 'certs');
  if (!fs.existsSync(certsDir)) {
    fs.mkdirSync(certsDir);
  }
  return certsDir;
}

/**
 * Sets up the client certificate.
 * Either loads an existing certificate or generates a new one.
 * 
 * @returns Object containing private key and certificate
 */
async function setupClientCertificate(): Promise<{ privateKey: string, certificate: Certificate }> {
  const certsDir = ensureCertsDirectory();
  const privateKeyPath = path.join(certsDir, 'client.key');
  const certificatePath = path.join(certsDir, 'client.cert.json');
  
  let privateKey: string, certificate: Certificate;
  
  // Check if certificate files already exist
  if (fs.existsSync(privateKeyPath) && fs.existsSync(certificatePath)) {
    console.log('Loading existing client certificate...');
    privateKey = fs.readFileSync(privateKeyPath, 'utf8');
    certificate = JSON.parse(fs.readFileSync(certificatePath, 'utf8'));
  } else {
    console.log('Generating new client certificate...');
    // Generate a new RSA key pair
    privateKey = crypto.generateKeyPairSync('rsa', {
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
    
    // Create a self-signed certificate
    const clientName: DistinguishedName = {
      commonName: 'Example Client',
      organization: 'Example Org',
      organizationalUnit: 'Development',
      locality: 'San Francisco',
      state: 'CA',
      country: 'US',
      emailAddress: 'client@example.com'
    };
    
    const certOptions: CertificateGenerationOptions = {
      subject: clientName,
      issuer: clientName, // Self-signed
      privateKey,
      serialNumber: crypto.randomBytes(16).toString('hex'),
      validityDays: 365
    };
    
    certificate = await generateCertificate(certOptions);
    
    // Save the private key and certificate
    fs.writeFileSync(privateKeyPath, privateKey, 'utf8');
    fs.writeFileSync(certificatePath, JSON.stringify(certificate, null, 2), 'utf8');
  }
  
  return { privateKey, certificate };
}

/**
 * Creates a coupon for the current request.
 * 
 * @param clientCert - The client's certificate
 * @param privateKey - The client's private key
 * @param serverName - The server's name
 * @returns A coupon for use with MCP requests
 */
async function createRequestCoupon(clientCert: Certificate, privateKey: string, serverName: string): Promise<Coupon> {
  const couponInput = {
    issuer: {
      commonName: clientCert.subject.commonName,
      organization: clientCert.subject.organization,
      organizationalUnit: clientCert.subject.organizationalUnit
    },
    recipient: {
      commonName: serverName,
      organization: 'Server Org',
      organizationalUnit: 'MCP Server'
    },
    issuerCertificate: clientCert,
    // Set expiry to 1 hour from now
    expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
    // Optional additional data
    data: {
      purpose: 'mcp-api-request',
      timestamp: new Date().toISOString(),
      requestId: crypto.randomUUID()
    }
  };
  
  return createCoupon(couponInput, privateKey);
}

// Create a readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

/**
 * Server implementation information from the MCP server.
 */
interface ServerImplementationInfo {
  name: string;
  version: string;
  vendor?: string;
}

/**
 * Tool information from the MCP server.
 */
interface ToolInfo {
  name: string;
  description?: string;
  parameters?: Record<string, unknown>;
  returns?: Record<string, unknown>;
}

/**
 * Tool response from the MCP server.
 */
interface ToolResponse {
  content?: Array<{
    type: string;
    text?: string;
    [key: string]: unknown;
  }>;
  isError?: boolean;
  [key: string]: unknown;
}

/**
 * Main client function that handles connection and command execution.
 */
async function main(): Promise<void> {
  try {
    // Set up client certificate
    const { privateKey, certificate } = await setupClientCertificate();
    
    // Connect to MCP server
    const serverUrl = 'ws://localhost:3050/mcp';
    console.log(`Connecting to MCP server at ${serverUrl}...`);
    
    const ws = new WebSocket(serverUrl);
    
    // Set up the client
    const client = new Client();
    
    // Wait for WebSocket connection
    await new Promise<void>((resolve, reject) => {
      ws.on('open', () => resolve());
      ws.on('error', (err) => reject(err));
    });
    
    console.log('Connected to MCP server');
    
    // Connect the client to the WebSocket
    await client.connect({
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
    });
    
    console.log('MCP Client connected');
    
    // Get server info
    const implementation = await client.implementation() as ServerImplementationInfo;
    console.log('Connected to:', implementation);
    
    // Get available tools
    const { tools } = await client.listTools() as { tools: ToolInfo[] };
    console.log('\nAvailable tools:');
    tools.forEach(tool => {
      console.log(`- ${tool.name}: ${tool.description || 'No description'}`);
    });
    
    /**
     * Executes a command with a coupon for authentication.
     * 
     * @param command - The command to execute
     */
    async function executeWithCoupon(command: string): Promise<void> {
      try {
        // Create a coupon for this request
        const coupon = await createRequestCoupon(
          certificate, 
          privateKey, 
          implementation.name
        );
        
        // Parse the command
        const [toolName, ...args] = command.split(' ');
        
        // Parse arguments (simple parsing for demo)
        const toolArgs: Record<string, unknown> = {};
        for (const arg of args) {
          const parts = arg.split('=');
          if (parts.length === 2) {
            toolArgs[parts[0]] = parts[1];
          } else if (arg === 'coupon' && toolName === 'verifyCoupon') {
            // Special case for verifyCoupon command
            toolArgs.coupon = coupon;
          }
        }
        
        // For the verifyCoupon command, use the generated coupon as the parameter
        if (toolName === 'verifyCoupon' && !toolArgs.coupon) {
          toolArgs.coupon = coupon;
        }
        
        console.log(`Calling ${toolName} with coupon...`);
        
        // Call the tool with the coupon
        const result = await client.callTool(toolName, toolArgs, {
          coupon: coupon
        }) as ToolResponse;
        
        // Display the result
        console.log('\nResult:');
        if (result.content) {
          result.content.forEach(item => {
            if (item.type === 'text') {
              console.log(item.text);
            } else {
              console.log(item);
            }
          });
        } else {
          console.log(result);
        }
      } catch (error) {
        console.error('Error:', (error as Error).message || error);
      }
    }
    
    /**
     * Executes a command without a coupon.
     * 
     * @param command - The command to execute
     */
    async function executeWithoutCoupon(command: string): Promise<void> {
      try {
        // Parse the command
        const [toolName, ...args] = command.split(' ');
        
        // Parse arguments (simple parsing for demo)
        const toolArgs: Record<string, unknown> = {};
        for (const arg of args) {
          const parts = arg.split('=');
          if (parts.length === 2) {
            toolArgs[parts[0]] = parts[1];
          } else if (arg === 'coupon' && toolName === 'verifyCoupon') {
            // Special case for verifyCoupon command
            const coupon = await createRequestCoupon(
              certificate, 
              privateKey, 
              implementation.name
            );
            toolArgs.coupon = coupon;
          }
        }
        
        console.log(`Calling ${toolName} without coupon...`);
        
        // Call the tool without a coupon
        const result = await client.callTool(toolName, toolArgs) as ToolResponse;
        
        // Display the result
        console.log('\nResult:');
        if (result.content) {
          result.content.forEach(item => {
            if (item.type === 'text') {
              console.log(item.text);
            } else {
              console.log(item);
            }
          });
        } else {
          console.log(result);
        }
      } catch (error) {
        console.error('Error:', (error as Error).message || error);
      }
    }
    
    // Interactive command prompt
    console.log('\nInteractive MCP Client');
    console.log('======================');
    console.log('Available commands:');
    console.log('- verifyCoupon - Verify a coupon');
    console.log('- protected.verifyWithReputation - Verify a coupon with reputation data (requires valid coupon)');
    console.log('- listVerifiedCoupons - List all verified coupons');
    console.log('- manageTrustedIssuers action=list|add|remove [issuer=name] - Manage trusted issuers');
    console.log('- nocoupon <command> - Execute without attaching a coupon');
    console.log('- exit - Exit the client');
    
    function promptForCommand(): void {
      rl.question('\n> ', async (input) => {
        const command = input.trim();
        
        if (command === 'exit') {
          console.log('Disconnecting...');
          client.close();
          rl.close();
          process.exit(0);
        } else if (command.startsWith('nocoupon ')) {
          // Execute without a coupon
          await executeWithoutCoupon(command.substring(9));
          promptForCommand();
        } else {
          // Execute with a coupon
          await executeWithCoupon(command);
          promptForCommand();
        }
      });
    }
    
    promptForCommand();
    
  } catch (error) {
    console.error('Client error:', error);
    process.exit(1);
  }
}

// Run the client
main();