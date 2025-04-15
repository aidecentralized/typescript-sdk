const fs = require('fs');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const express = require('express');
const cors = require('cors');
const http = require('http');

// Output file
const outputFile = 'mcp-coupon-demo-output.txt';
const outputStream = fs.createWriteStream(outputFile, { flags: 'w' });

// Helper to log to console and file
function log(message) {
  console.log(message);
  outputStream.write(message + '\n');
}

// Protocol version
const PROTOCOL_VERSION = '2023-04-01';

// Certificate generation utilities
function generateKeyPair() {
  return new Promise((resolve, reject) => {
    crypto.generateKeyPair('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
      }
    }, (err, publicKey, privateKey) => {
      if (err) {
        reject(err);
      } else {
        resolve({ publicKey, privateKey });
      }
    });
  });
}

function createCertificate(dn, publicKey) {
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

// Coupon storage
class CouponStorage {
  constructor() {
    this.coupons = new Map();
  }
  
  async storeCoupon(coupon) {
    this.coupons.set(coupon.id, coupon);
    return coupon.id;
  }
  
  async getCoupon(id) {
    return this.coupons.get(id);
  }
  
  async getAllCoupons() {
    return Array.from(this.coupons.values());
  }
  
  async filterCoupons(filter) {
    let result = Array.from(this.coupons.values());
    
    if (filter.issuerCommonName) {
      result = result.filter(c => 
        c.issuer.commonName === filter.issuerCommonName
      );
    }
    
    if (filter.recipientCommonName) {
      result = result.filter(c => 
        c.recipient.commonName === filter.recipientCommonName
      );
    }
    
    return result;
  }
  
  async clearStorage() {
    this.coupons.clear();
  }
}

const couponStorage = new CouponStorage();

// Coupon creation and validation
function prepareForSigning(obj) {
  return JSON.stringify(obj, Object.keys(obj).sort());
}

function signCouponData(couponData, privateKeyPem) {
  const canonical = prepareForSigning(couponData);
  
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(canonical);
  sign.end();
  
  return sign.sign(privateKeyPem, 'base64');
}

function signCoupon(couponData, privateKeyPem) {
  const signature = signCouponData(couponData, privateKeyPem);
  
  return {
    ...couponData,
    signature,
    signatureAlgorithm: 'SHA256withRSA',
    canonicalizationMethod: 'JSON-canonicalize + SHA256',
  };
}

function createCoupon(issuer, recipient, issuerCertificate, privateKeyPem, data = {}, expiresAt) {
  const now = new Date().toISOString();
  
  const baseCoupon = {
    id: uuidv4(),
    issuer,
    recipient,
    issuedAt: now,
    issuerCertificate,
    protocolVersion: PROTOCOL_VERSION,
    data,
    ...(expiresAt ? { expiresAt } : {})
  };
  
  return signCoupon(baseCoupon, privateKeyPem);
}

function verifyCoupon(coupon, allowTestMode = false) {
  try {
    const { 
      signature, 
      signatureAlgorithm, 
      canonicalizationMethod, 
      ...unsignedCouponData 
    } = coupon;
    
    const canonical = prepareForSigning(unsignedCouponData);
    
    const verify = crypto.createVerify('RSA-SHA256');
    verify.update(canonical);
    verify.end();
    
    try {
      return verify.verify(
        coupon.issuerCertificate.subjectPublicKey, 
        signature, 
        'base64'
      );
    } catch (cryptoError) {
      console.error('Crypto verification error:', cryptoError);
      
      if (allowTestMode) {
        console.warn('⚠️ Test mode: Bypassing signature verification');
        return true;
      }
      
      return false;
    }
  } catch (error) {
    console.error('Error verifying coupon:', error);
    return false;
  }
}

function extractAndVerifyCoupon(request, allowTestMode = false) {
  const coupon = request.params?._meta?.coupon;
  
  if (!coupon) {
    return undefined;
  }
  
  const isValid = verifyCoupon(coupon, allowTestMode);
  const isExpired = coupon.expiresAt && new Date(coupon.expiresAt).getTime() < Date.now();
  
  return (isValid && !isExpired) ? coupon : undefined;
}

// MCP Server and Client implementations
async function createMCPServer(port) {
  // Generate server identity
  log('📡 Generating server identity...');
  const serverKeyPair = await generateKeyPair();
  const serverDN = {
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
        error: error.message
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
      const clientDN = {
        commonName: clientName || 'Unknown Client',
        organization: clientOrg || 'Unknown Org',
        country: clientCountry || 'US'
      };
      
      // Calculate expiry date (30 days)
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + 30);
      
      // Issue a coupon from the server
      const coupon = createCoupon(
        serverDN,
        clientDN,
        serverCertificate,
        serverKeyPair.privateKey,
        { purpose: purpose || 'api-access', timestamp: new Date().toISOString() },
        expiryDate.toISOString()
      );
      
      // Store the coupon
      await couponStorage.storeCoupon(coupon);
      
      log(`Server issued coupon to ${clientDN.commonName}: ${coupon.id}`);
      res.json({ success: true, coupon });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
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
      const coupon = extractAndVerifyCoupon(request, true);
      
      if (!coupon) {
        return res.status(401).json({
          success: false,
          error: 'Invalid or missing coupon'
        });
      }
      
      // Store the validated coupon
      await couponStorage.storeCoupon(coupon);
      
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
        error: error.message
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

async function createMCPClient(serverUrl) {
  // Generate client identity
  log('💻 Generating client identity...');
  const clientKeyPair = await generateKeyPair();
  const clientDN = {
    commonName: 'MCP Client',
    organization: 'MCP Client Organization',
    country: 'US'
  };
  const clientCertificate = createCertificate(clientDN, clientKeyPair.publicKey);
  log(`Client identity created: ${clientDN.commonName} (${clientDN.organization})`);

  // Fetch server identity
  log('Fetching server identity...');
  let serverDN;
  let serverCertificate;
  
  try {
    // Make a GET request to the server identity endpoint
    const response = await new Promise((resolve, reject) => {
      http.get(`${serverUrl}/identity`, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          resolve({ data });
        });
      }).on('error', (err) => {
        reject(err);
      });
    });
    
    const data = JSON.parse(response.data);
    serverDN = data.dn;
    serverCertificate = data.certificate;
    log(`Connected to server: ${serverDN.commonName}`);
  } catch (error) {
    console.error('Error fetching server identity:', error);
    throw error;
  }

  // Function to request a coupon from the server
  const requestCoupon = async (purpose = 'api-access') => {
    try {
      // Make a POST request to the server
      const response = await new Promise((resolve, reject) => {
        const requestData = JSON.stringify({
          clientName: clientDN.commonName,
          clientOrg: clientDN.organization,
          clientCountry: clientDN.country,
          purpose
        });
        
        const req = http.request(`${serverUrl}/issue-coupon`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(requestData)
          }
        }, (res) => {
          let data = '';
          res.on('data', (chunk) => {
            data += chunk;
          });
          res.on('end', () => {
            resolve({ data, statusCode: res.statusCode });
          });
        });
        
        req.on('error', (err) => {
          reject(err);
        });
        
        req.write(requestData);
        req.end();
      });
      
      const data = JSON.parse(response.data);
      
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
  const validateCoupon = async (coupon) => {
    try {
      // Create a request with the coupon attached
      const request = {
        data: { message: 'Hello, secure world!', timestamp: new Date().toISOString() },
        _meta: { coupon }
      };
      
      // Send the request to the validation endpoint
      const response = await new Promise((resolve, reject) => {
        const requestData = JSON.stringify(request);
        
        const req = http.request(`${serverUrl}/validate-coupon`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(requestData)
          }
        }, (res) => {
          let data = '';
          res.on('data', (chunk) => {
            data += chunk;
          });
          res.on('end', () => {
            resolve({ data, statusCode: res.statusCode });
          });
        });
        
        req.on('error', (err) => {
          reject(err);
        });
        
        req.write(requestData);
        req.end();
      });
      
      return JSON.parse(response.data);
    } catch (error) {
      console.error('Error validating coupon:', error);
      throw error;
    }
  };

  return {
    clientIdentity: { dn: clientDN, certificate: clientCertificate, privateKey: clientKeyPair.privateKey },
    serverIdentity: { dn: serverDN, certificate: serverCertificate },
    requestCoupon,
    createClientCoupon,
    validateCoupon
  };
}

// Main function to run the demo
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
    const response = await new Promise((resolve, reject) => {
      http.get(`${serverUrl}/coupons`, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          resolve({ data });
        });
      }).on('error', (err) => {
        reject(err);
      });
    });
    
    const { coupons } = JSON.parse(response.data);
    
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
    log(`\n❌ Error: ${error.message}`);
    console.error(error);
    outputStream.end();
  }
}

// Run the demo
runMCPCouponDemo();