import { Server } from '../../src/server/index.js';
import { Client } from '../../src/client/index.js';
import { createCoupon } from '../../src/coupon/create.js';
import { verifyCoupon } from '../../src/coupon/sign.js';
import { couponStorage } from '../../src/coupon/storage/index.js';
import fs from 'fs';
import * as crypto from 'crypto';
import { promisify } from 'util';
import { Certificate, DistinguishedName } from '../../src/types/coupon.js';
import express from 'express';
import cors from 'cors';
import { Protocol } from '../../src/shared/protocol.js';
import { extractAndVerifyCoupon } from '../../src/coupon/server.js';

// Output file
const outputFile = 'mcp-coupon-demo-output.txt';
const outputStream = fs.createWriteStream(outputFile, { flags: 'w' });

// Helper to log to console and file
function log(message: string) {
  console.log(message);
  outputStream.write(message + '\n');
}

// Certificate generation utilities
const generateKeyPairAsync = promisify(crypto.generateKeyPair);

async function generateKeyPair(): Promise<{ privateKey: string; publicKey: string }> {
  try {
    const result = await generateKeyPairAsync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
      }
    });
    
    return result as { privateKey: string; publicKey: string };
  } catch (error) {
    console.error('Error generating key pair:', error);
    throw error;
  }
}

function createCertificate(dn: DistinguishedName, publicKey: string): Certificate {
  const now = new Date();
  const expiry = new Date(now);
  expiry.setFullYear(expiry.getFullYear() + 1); // Valid for 1 year
  
  return {
    serialNumber: Math.floor(Math.random() * 1000000).toString(),
    issuer: dn, // Self-signed, so issuer = subject
    subject: dn,
    issuedAt: now.toISOString(),
    expiresAt: expiry.toISOString(),
    subjectPublicKey: publicKey,
    publicKeyAlgorithm: 'RSA',
    keyUsage: ['digitalSignature', 'keyEncipherment'],
    signature: 'test-signature', // Simplified for demo
    signatureAlgorithm: 'SHA256withRSA',
    version: '3'
  };
}

/**
 * Create an MCP server with coupon support
 */
async function createMCPServer(port: number) {
  // Generate server identity
  log('📡 Generating server identity...');
  const serverKeyPair = await generateKeyPair();
  const serverDN: DistinguishedName = {
    commonName: 'MCP Server',
    organization: 'MCP Demo Organization',
    country: 'US'
  };
  const serverCertificate = createCertificate(serverDN, serverKeyPair.publicKey);
  log(`Server identity created: ${serverDN.commonName} (${serverDN.organization})`);

  // Create Express app
  const app = express();
  app.use(cors());
  app.use(express.json());

  // Create the MCP server with coupons enabled
  const mcpServer = new Server(
    { name: 'MCPCouponServer', version: '1.0.0' },
    { enableCoupons: true }
  );

  // Configure server identity for coupons
  mcpServer.configureCouponIdentity(
    serverDN,
    serverCertificate,
    serverKeyPair.privateKey
  );
  log('Server configured with coupon identity');

  // Set up coupon callback
  mcpServer.oncoupon = (coupon) => {
    log(`✓ Server received valid coupon: ${coupon.id}`);
    log(`  From: ${coupon.issuer.commonName}`);
    log(`  Purpose: ${coupon.data?.purpose || 'not specified'}`);
    return true;
  };

  // Add a special endpoint to access coupons
  app.get('/coupons', async (req, res) => {
    try {
      const allCoupons = await couponStorage.getAllCoupons();
      res.json({
        success: true,
        count: allCoupons.length,
        coupons: allCoupons
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: (error as Error).message
      });
    }
  });

  // Add endpoint to get server identity
  app.get('/identity', (req, res) => {
    res.json({
      dn: serverDN,
      certificate: serverCertificate
    });
  });

  // Add endpoint to issue coupons to clients
  app.post('/issue-coupon', async (req, res) => {
    try {
      const { clientName, clientOrg, clientCountry, purpose } = req.body;
      
      // Create client DN from request data
      const clientDN: DistinguishedName = {
        commonName: clientName || 'Unknown Client',
        organization: clientOrg || 'Unknown Org',
        country: clientCountry || 'US'
      };
      
      // Issue a coupon from the server
      const coupon = await mcpServer.issueCoupon(
        clientDN,
        { purpose: purpose || 'api-access', timestamp: new Date().toISOString() },
        30 // Expire in 30 days
      );
      
      log(`Server issued coupon to ${clientDN.commonName}: ${coupon.id}`);
      res.json({ success: true, coupon });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: (error as Error).message
      });
    }
  });

  // Add endpoint to validate coupon-attached requests
  app.post('/validate-coupon', async (req, res) => {
    try {
      // Create a request format that can be validated
      const request = {
        method: req.path,
        params: req.body
      };
      
      // Extract and verify the coupon
      const coupon = await extractAndVerifyCoupon(request);
      
      if (!coupon) {
        return res.status(401).json({
          success: false,
          error: 'Invalid or missing coupon'
        });
      }
      
      // Coupon is valid
      log(`Server validated coupon: ${coupon.id} from ${coupon.issuer.commonName}`);
      res.json({
        success: true,
        message: 'Coupon validated successfully',
        couponId: coupon.id,
        issuer: coupon.issuer.commonName,
        recipient: coupon.recipient.commonName,
        data: coupon.data
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: (error as Error).message
      });
    }
  });

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({ status: 'healthy', server: 'MCPCouponServer' });
  });

  // Start the server
  const server = app.listen(port, () => {
    log(`MCP server with coupons listening on port ${port}`);
    log(`Health check: http://localhost:${port}/health`);
    log(`Coupons endpoint: http://localhost:${port}/coupons`);
  });

  return {
    server,
    mcpServer,
    serverIdentity: {
      dn: serverDN,
      certificate: serverCertificate,
      privateKey: serverKeyPair.privateKey
    },
    stop: () => {
      server.close();
      log('Server stopped');
    }
  };
}

/**
 * Create an MCP client with coupon support
 */
async function createMCPClient(serverUrl: string) {
  // Generate client identity
  log('💻 Generating client identity...');
  const clientKeyPair = await generateKeyPair();
  const clientDN: DistinguishedName = {
    commonName: 'MCP Client',
    organization: 'MCP Client Organization',
    country: 'US'
  };
  const clientCertificate = createCertificate(clientDN, clientKeyPair.publicKey);
  log(`Client identity created: ${clientDN.commonName} (${clientDN.organization})`);

  // Fetch server identity
  log('Fetching server identity...');
  let serverDN: DistinguishedName;
  let serverCertificate: Certificate;
  
  try {
    const response = await fetch(`${serverUrl}/identity`);
    const data = await response.json();
    serverDN = data.dn;
    serverCertificate = data.certificate;
    log(`Connected to server: ${serverDN.commonName}`);
  } catch (error) {
    console.error('Error fetching server identity:', error);
    throw error;
  }

  // Create an MCP client with coupons enabled
  const mcpClient = new Client(
    { name: 'MCPCouponClient', version: '1.0.0' },
    {
      enableCoupons: true,
      clientDN,
      clientCertificate,
      clientPrivateKey: clientKeyPair.privateKey
    }
  );
  log('Client created with coupon support');

  // Function to request a coupon from the server
  const requestCoupon = async (purpose = 'api-access') => {
    try {
      const response = await fetch(`${serverUrl}/issue-coupon`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName: clientDN.commonName,
          clientOrg: clientDN.organization,
          clientCountry: clientDN.country,
          purpose
        })
      });
      
      const data = await response.json();
      
      if (data.success && data.coupon) {
        log(`Received server-issued coupon: ${data.coupon.id}`);
        return data.coupon;
      } else {
        throw new Error('Failed to get coupon from server');
      }
    } catch (error) {
      console.error('Error requesting coupon:', error);
      throw error;
    }
  };

  // Function to create a client-issued coupon
  const createClientCoupon = (purpose = 'api-access') => {
    try {
      // Create expiry time (30 days from now)
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + 30);
      
      const coupon = createCoupon(
        clientDN,
        serverDN,
        clientCertificate,
        clientKeyPair.privateKey,
        { purpose, timestamp: new Date().toISOString() },
        expiryDate.toISOString()
      );
      
      log(`Created client-issued coupon: ${coupon.id}`);
      return coupon;
    } catch (error) {
      console.error('Error creating coupon:', error);
      throw error;
    }
  };

  // Function to validate a coupon with the server
  const validateCoupon = async (coupon: any) => {
    try {
      // Create a request with the coupon attached
      const request = {
        data: { message: 'Hello, secure world!', timestamp: new Date().toISOString() },
        _meta: { coupon }
      };
      
      // Send the request to the validation endpoint
      const response = await fetch(`${serverUrl}/validate-coupon`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request)
      });
      
      return await response.json();
    } catch (error) {
      console.error('Error validating coupon:', error);
      throw error;
    }
  };

  return {
    mcpClient,
    clientIdentity: { dn: clientDN, certificate: clientCertificate, privateKey: clientKeyPair.privateKey },
    serverIdentity: { dn: serverDN, certificate: serverCertificate },
    requestCoupon,
    createClientCoupon,
    validateCoupon
  };
}

/**
 * Main function to run the demo
 */
async function runMCPCouponDemo() {
  log('🚀 Starting MCP Coupon Demo');
  log('==============================');

  try {
    // Start the MCP server
    log('\n[1] Creating and starting MCP server...');
    const port = 3000;
    const { stop, serverIdentity } = await createMCPServer(port);
    
    // Let the server start up
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Create an MCP client
    log('\n[2] Creating MCP client...');
    const serverUrl = `http://localhost:${port}`;
    const {
      clientIdentity,
      requestCoupon,
      createClientCoupon,
      validateCoupon
    } = await createMCPClient(serverUrl);
    
    // Request a coupon from the server
    log('\n[3] Requesting a coupon from the server...');
    const serverIssuedCoupon = await requestCoupon('server-issued-demo');
    log(`Received coupon with ID: ${serverIssuedCoupon.id}`);
    
    // Create a client-issued coupon
    log('\n[4] Creating a client-issued coupon...');
    const clientIssuedCoupon = createClientCoupon('client-issued-demo');
    log(`Created coupon with ID: ${clientIssuedCoupon.id}`);
    
    // Validate the client-issued coupon with the server
    log('\n[5] Validating client-issued coupon with server...');
    const validationResult = await validateCoupon(clientIssuedCoupon);
    log('Validation result:');
    log(JSON.stringify(validationResult, null, 2));
    
    // List all coupons in storage
    log('\n[6] Listing all coupons in storage...');
    const response = await fetch(`${serverUrl}/coupons`);
    const { coupons } = await response.json();
    
    log(`Found ${coupons.length} coupons:`);
    for (const coupon of coupons) {
      log(`\n- ID: ${coupon.id}`);
      log(`  Issuer: ${coupon.issuer.commonName} (${coupon.issuer.organization})`);
      log(`  Recipient: ${coupon.recipient.commonName} (${coupon.recipient.organization})`);
      log(`  Issued at: ${new Date(coupon.issuedAt).toLocaleString()}`);
      if (coupon.expiresAt) {
        log(`  Expires at: ${new Date(coupon.expiresAt).toLocaleString()}`);
      }
      log(`  Purpose: ${coupon.data?.purpose || 'not specified'}`);
    }
    
    // Clean up
    log('\n✨ Demo completed successfully');
    stop();
    outputStream.end();
    console.log(`Output saved to ${outputFile}`);
  } catch (error) {
    log(`\n❌ Error: ${(error as Error).message}`);
    console.error(error);
    outputStream.end();
  }
}

// Run the demo
runMCPCouponDemo();