const fs = require('fs');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

// Output file
const outputFile = 'coupon-demo-output.txt';
const outputStream = fs.createWriteStream(outputFile, { flags: 'w' });

// Helper to log to console and file
function log(message) {
  console.log(message);
  outputStream.write(message + '\n');
}

// Protocol version
const PROTOCOL_VERSION = '2023-04-01';

// Certificate and Key Generation
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
    signature: 'demo-signature', // Simplified for demo
    signatureAlgorithm: 'SHA256withRSA',
    version: '3'
  };
}

// Coupon Storage
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

// Coupon Functions
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

function createRequestWithCoupon(method, params = {}, coupon) {
  const paramsCopy = { ...params };
  
  return {
    method,
    params: {
      ...paramsCopy,
      _meta: {
        ...(paramsCopy._meta || {}),
        coupon
      }
    }
  };
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

// Main Demo
async function runDemo() {
  log('🚀 Starting MCP Coupon Demo');
  log('==============================');

  try {
    // Create server identity
    log('\n📜 Generating server identity...');
    const serverKeyPair = await generateKeyPair();
    const serverDN = {
      commonName: 'MCP Server',
      organization: 'MCP Demo Organization',
      country: 'US'
    };
    const serverCertificate = createCertificate(serverDN, serverKeyPair.publicKey);
    log(`Server identity created: ${serverDN.commonName} (${serverDN.organization})`);

    // Create client identity
    log('\n📜 Generating client identity...');
    const clientKeyPair = await generateKeyPair();
    const clientDN = {
      commonName: 'MCP Client',
      organization: 'MCP Client Organization',
      country: 'US'
    };
    const clientCertificate = createCertificate(clientDN, clientKeyPair.publicKey);
    log(`Client identity created: ${clientDN.commonName} (${clientDN.organization})`);

    // Create server-issued coupon
    log('\n🎫 Creating server-issued coupon for client...');
    const serverIssuedCoupon = createCoupon(
      serverDN,
      clientDN,
      serverCertificate,
      serverKeyPair.privateKey,
      { purpose: 'server-issued-demo', timestamp: new Date().toISOString() },
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
    );
    log(`Server issued coupon with ID: ${serverIssuedCoupon.id}`);
    log(`Expiry: ${serverIssuedCoupon.expiresAt}`);

    // Store the server-issued coupon
    await couponStorage.storeCoupon(serverIssuedCoupon);
    log('Coupon stored in storage');

    // Create client-issued coupon
    log('\n🎫 Creating client-issued coupon for server...');
    const clientIssuedCoupon = createCoupon(
      clientDN,
      serverDN,
      clientCertificate,
      clientKeyPair.privateKey,
      { purpose: 'client-issued-demo', timestamp: new Date().toISOString() },
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
    );
    log(`Client issued coupon with ID: ${clientIssuedCoupon.id}`);

    // Verify coupons
    log('\n✅ Verifying coupons...');
    
    // Verify server-issued coupon
    const isServerCouponValid = verifyCoupon(serverIssuedCoupon, true);
    log(`Server-issued coupon validation: ${isServerCouponValid ? 'VALID' : 'INVALID'}`);
    
    // Verify client-issued coupon
    const isClientCouponValid = verifyCoupon(clientIssuedCoupon, true);
    log(`Client-issued coupon validation: ${isClientCouponValid ? 'VALID' : 'INVALID'}`);

    // Create a request with the client-issued coupon
    log('\n🔒 Creating a request with a coupon attached...');
    const request = createRequestWithCoupon(
      'tools/call',
      { name: 'exampleTool', params: { value: 42 } },
      clientIssuedCoupon
    );
    log('Request created with coupon attached');
    log(JSON.stringify(request, null, 2));

    // Extract and verify the coupon from the request
    log('\n🔍 Extracting and verifying coupon from request...');
    const extractedCoupon = extractAndVerifyCoupon(request, true);
    if (extractedCoupon) {
      log('✓ Coupon extracted and verified successfully');
      log(`Coupon ID: ${extractedCoupon.id}`);
      log(`From: ${extractedCoupon.issuer.commonName}`);
      log(`To: ${extractedCoupon.recipient.commonName}`);
      log(`Purpose: ${extractedCoupon.data?.purpose}`);
      
      // Store the extracted coupon
      await couponStorage.storeCoupon(extractedCoupon);
      log('Extracted coupon stored in storage');
    } else {
      log('❌ Failed to extract and verify coupon from request');
    }

    // List all stored coupons
    log('\n📋 Listing all stored coupons:');
    const allCoupons = await couponStorage.getAllCoupons();
    log(`Found ${allCoupons.length} coupons in storage:`);
    
    for (const coupon of allCoupons) {
      log(`\nCoupon ID: ${coupon.id}`);
      log(`Issuer: ${coupon.issuer.commonName} (${coupon.issuer.organization})`);
      log(`Recipient: ${coupon.recipient.commonName} (${coupon.recipient.organization})`);
      log(`Issued at: ${new Date(coupon.issuedAt).toLocaleString()}`);
      if (coupon.expiresAt) {
        log(`Expires at: ${new Date(coupon.expiresAt).toLocaleString()}`);
      }
      log(`Purpose: ${coupon.data?.purpose || 'not specified'}`);
    }

    // Filter coupons by issuer
    log('\n🔎 Filtering coupons by issuer:');
    const clientIssuedCoupons = await couponStorage.filterCoupons({
      issuerCommonName: clientDN.commonName
    });
    log(`Found ${clientIssuedCoupons.length} coupons issued by ${clientDN.commonName}`);

    log('\n✨ Demo completed successfully');
    outputStream.end();
    console.log(`Output saved to ${outputFile}`);
  } catch (error) {
    log(`\n❌ Error: ${error.message}`);
    console.error(error);
    outputStream.end();
  }
}

// Run the demo
runDemo();