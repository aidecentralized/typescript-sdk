/**
 * Coupon Server Example
 * Demonstrates working with manual coupon processing.
 * Handles coupon verification and storage in a typical server environment.
 */
import express from 'express';
import fs from 'fs';
import path from 'path';
import { createHash, generateKeyPairSync } from 'crypto';
import { fileURLToPath } from 'url';
import { Request, Response } from 'express';

// Import types
import { Certificate, Coupon } from '../src/types/coupon.js'; 
import { Server } from '../src/server/index.js';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Since we're using ES modules, we need to use dynamic imports
const { addCouponsEndpoint, extractAndVerifyCoupon } = await import('../src/coupon/server.js');
const { createCoupon } = await import('../src/coupon/create.js');
const couponStorage = (await import('../src/coupon/storage/index.js')).default;

/**
 * Generates a cryptographically secure RSA key pair.
 * 
 * @returns An object containing the private and public keys in PEM format
 */
function generateProperKeyPair(): { privateKey: string, publicKey: string } {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
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
  
  return { privateKey, publicKey };
}

/**
 * Creates a self-signed certificate for testing purposes.
 * This is a placeholder for a real certificate process.
 * 
 * @param publicKey - The public key to include in the certificate
 * @returns A certificate object
 */
function generateDummyCertificate(publicKey: string): Certificate {
  // This is a placeholder for a real certificate
  const now = new Date();
  const expiryDate = new Date(now);
  expiryDate.setFullYear(now.getFullYear() + 1);
  
  // Generate a dummy signature
  const signature = createHash('sha256').update('server-certificate').digest('base64');
  
  return {
    serialNumber: '01',
    issuer: {
      commonName: 'Example Server',
      organization: 'Example Org',
      country: 'US'
    },
    subject: {
      commonName: 'Example Server',
      organization: 'Example Org',
      country: 'US'
    },
    issuedAt: now.toISOString(),
    expiresAt: expiryDate.toISOString(),
    subjectPublicKey: publicKey,
    publicKeyAlgorithm: 'RSA',
    keyUsage: ['digitalSignature', 'keyEncipherment'],
    signature: signature,
    signatureAlgorithm: 'SHA256withRSA',
    version: '3'
  };
}

// Create the certificates directory if it doesn't exist
const certsDir = path.join(__dirname, 'certs');
if (!fs.existsSync(certsDir)) {
  fs.mkdirSync(certsDir, { recursive: true });
}

// Generate proper key pair
console.log('Generating cryptographic key pair...');
const { privateKey: serverPrivateKey, publicKey: serverPublicKey } = generateProperKeyPair();

// Generate certificate for the server
const serverCertificate = generateDummyCertificate(serverPublicKey);

// Write keys to file for future reference
fs.writeFileSync(path.join(certsDir, 'server.key'), serverPrivateKey);
fs.writeFileSync(path.join(certsDir, 'server.pub'), serverPublicKey);
console.log('Saved keys to certs directory');

// Create the server identity
const serverDN = {
  commonName: 'Example Server',
  organization: 'Example Org',
  country: 'US'
};

// Create Express app to expose API endpoints
const app = express();

// Add CORS headers to allow cross-origin requests
app.use((req: Request, res: Response, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, X-Coupon');
  next();
});

/**
 * Endpoint to retrieve coupons from storage.
 * Supports filtering by various coupon properties.
 */
app.get('/coupons', async (req: Request, res: Response) => {
  try {
    // Parse query parameters for filtering
    const filter = {
      issuerCommonName: req.query.issuer as string | undefined,
      recipientCommonName: req.query.recipient as string | undefined,
      issuedAfter: req.query.since as string | undefined,
      issuedBefore: req.query.until as string | undefined,
      id: req.query.id as string | undefined
    };
    
    // Parse pagination parameters
    const page = parseInt(req.query.page as string || '1', 10);
    const pageSize = parseInt(req.query.limit as string || '20', 10);
    
    // For simple requests without pagination
    const coupons = Object.values(filter).some(v => v)
      ? await couponStorage.filterCoupons(filter)
      : await couponStorage.getAllCoupons();
    
    res.json(coupons);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to retrieve coupons',
      message: (error as Error).message
    });
  }
});

/**
 * Test endpoint that handles coupon verification.
 * Extracts a coupon from request headers, verifies it, and stores it.
 */
app.get('/test', async (req: Request, res: Response) => {
  console.log('Received test request');

  // Extract coupon from request headers if present
  const couponHeader = req.headers['x-coupon'] as string;
  if (couponHeader) {
    try {
      const coupon = JSON.parse(couponHeader) as Coupon;
      console.log('Received coupon in request:', coupon.id);
      
      // Manually verify the coupon
      console.log('Verifying received coupon...');
      const verifiedCoupon = await extractAndVerifyCoupon({
        method: 'test',
        params: {
          _meta: {
            coupon
          }
        }
      });
      
      if (verifiedCoupon) {
        console.log('Coupon verified successfully');
        
        // Store the coupon
        await couponStorage.storeCoupon(coupon);
        console.log('Coupon stored successfully');
        
        // Create a response coupon
        try {
          // Create a response coupon manually
          const responseCoupon = createCoupon(
            serverDN,                 // Server as issuer
            coupon.issuer,            // Client as recipient
            serverCertificate,        // Server certificate
            serverPrivateKey,         // Server private key
            { 
              purpose: 'test-response',
              requestId: Math.random().toString(36).substring(2, 15)
            }
          );
          
          // Store the response coupon
          await couponStorage.storeCoupon(responseCoupon);
          console.log('Issued response coupon:', responseCoupon.id);
        } catch (error) {
          console.error('Error creating response coupon:', error);
        }
      } else {
        console.log('Coupon verification failed');
      }
    } catch (error) {
      console.error('Error processing coupon:', error);
    }
  }

  res.json({ 
    message: 'Server is running!',
    timestamp: new Date().toISOString()
  });
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('Coupon support enabled');
  console.log('Test endpoint: http://localhost:' + PORT + '/test');
  console.log('Coupons endpoint: http://localhost:' + PORT + '/coupons');
});