/**
 * Coupon Client Example
 * Demonstrates working with manual coupon attachment.
 * Creates certificates, generates coupons, and makes authenticated requests.
 */
import fs from 'fs';
import path from 'path';
import { createHash, generateKeyPairSync } from 'crypto';
import { fileURLToPath } from 'url';
import http from 'http';

// Import types
import { Certificate, Coupon } from '../src/types/coupon.js';
import { Client } from '../src/client/index.js';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Since we're using ES modules, we need to use dynamic imports
const { createCoupon } = await import('../src/coupon/create.js');
const { createRequestWithCoupon } = await import('../src/coupon/client.js');

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
  const signature = createHash('sha256').update('client-certificate').digest('base64');
  
  return {
    serialNumber: '02',
    issuer: {
      commonName: 'Example Client',
      organization: 'Example Org',
      country: 'US'
    },
    subject: {
      commonName: 'Example Client',
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
const { privateKey: clientPrivateKey, publicKey: clientPublicKey } = generateProperKeyPair();

// Generate certificate for the client
const clientCertificate = generateDummyCertificate(clientPublicKey);

// Write keys to file for future reference
fs.writeFileSync(path.join(certsDir, 'client.key'), clientPrivateKey);
fs.writeFileSync(path.join(certsDir, 'client.pub'), clientPublicKey);
console.log('Saved keys to certs directory');

// Create client with basic configuration
const client = new Client(
  {
    name: 'MCPClient',
    version: '1.0.0'
  }
);

console.log('Client setup complete');

/**
 * Makes a test connection to the server with a coupon.
 * Creates a coupon, attaches it to a request, and sends it to the server.
 */
async function testConnection(): Promise<void> {
  try {
    // Server identity for coupon
    const serverDN = {
      commonName: 'Example Server',
      organization: 'Example Org',
      country: 'US'
    };
    
    // Client's identity
    const clientDN = {
      commonName: 'Example Client',
      organization: 'Example Org',
      country: 'US'
    };
    
    console.log('Creating test coupon...');
    
    // Create a test coupon
    const coupon = createCoupon(
      clientDN,                   // Client DN as issuer
      serverDN,                   // Server DN as recipient
      clientCertificate,          // Client certificate
      clientPrivateKey,           // Client private key
      { purpose: 'test-connection' } // Additional data
    );
    
    console.log('Created test coupon:', coupon.id);
    console.log('Coupon issuer:', coupon.issuer.commonName);
    console.log('Coupon recipient:', coupon.recipient.commonName);
    
    // Create a JSON-RPC style request with the coupon attached
    const jsonRpcWithCoupon = createRequestWithCoupon(
      'test',             // Method name
      { hello: 'world' }, // Parameters
      coupon              // Coupon object
    );
    
    console.log('Created request with attached coupon');
    
    // Prepare HTTP request options
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/test',
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Coupon': JSON.stringify(coupon)
      }
    };
    
    console.log('Sending request to server...');
    
    // Use promises with http.request
    const makeRequest = (requestOptions: http.RequestOptions): Promise<{ statusCode: number, data: string }> => {
      return new Promise((resolve, reject) => {
        const req = http.request(requestOptions, (res) => {
          let data = '';
          
          res.on('data', (chunk) => {
            data += chunk;
          });
          
          res.on('end', () => {
            try {
              data = data.toString();
              resolve({ statusCode: res.statusCode || 0, data });
            } catch (e) {
              reject(e);
            }
          });
        });
        
        req.on('error', (error) => {
          reject(error);
        });
        
        req.end();
      });
    };
    
    try {
      // Make the test request
      const response = await makeRequest(options);
      console.log('Response status:', response.statusCode);
      console.log('Server response:', response.data);
      
      // Fetch all coupons from server
      console.log('Fetching coupons from server...');
      const couponOptions = {
        hostname: 'localhost',
        port: 3000,
        path: '/coupons',
        method: 'GET'
      };
      
      const couponResponse = await makeRequest(couponOptions);
      try {
        const coupons = JSON.parse(couponResponse.data) as Coupon[];
        console.log('Server coupons:', coupons.length > 0 ? 
                    `${coupons.length} coupons found` : 
                    'No coupons found');
        
        if (coupons.length > 0) {
          console.log('First coupon ID:', coupons[0].id);
          console.log('Coupon details:', {
            issuer: coupons[0].issuer.commonName,
            recipient: coupons[0].recipient.commonName,
            issuedAt: coupons[0].issuedAt,
            purpose: coupons[0].data?.purpose
          });
        }
      } catch (error) {
        console.error('Error parsing coupon data:', (error as Error).message);
        console.log('Raw data:', couponResponse.data);
      }
    } catch (error) {
      console.error('HTTP request error:', (error as Error).message);
    }
  } catch (error) {
    console.error('Error in test connection:', error);
  }
}

// Run the test
await testConnection();

// Export the client for potential reuse
export default client;