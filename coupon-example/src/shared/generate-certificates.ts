import { generateKeyPair } from 'crypto';
import { promisify } from 'util';
import { DistinguishedName, Certificate } from '../../../src/types/coupon.js';

// Promisify the generateKeyPair function
const generateKeyPairAsync = promisify(generateKeyPair);

/**
 * Generate RSA key pair for testing
 */
export async function generateTestKeyPair(): Promise<{ privateKey: string; publicKey: string }> {
  try {
    const { privateKey, publicKey } = await generateKeyPairAsync('rsa', {
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
  } catch (error) {
    console.error('Error generating key pair:', error);
    throw error;
  }
}

/**
 * Create a self-signed test certificate
 */
export function createTestCertificate(
  dn: DistinguishedName,
  publicKey: string
): Certificate {
  // Create a simple self-signed certificate for testing
  return {
    serialNumber: Math.floor(Math.random() * 1000000).toString(),
    issuer: dn,
    subject: dn,
    issuedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    subjectPublicKey: publicKey,
    publicKeyAlgorithm: 'RSA',
    keyUsage: ['digitalSignature', 'keyEncipherment'],
    signature: 'test-signature-value', // Placeholder for testing
    signatureAlgorithm: 'SHA256withRSA',
    version: '3'
  };
}

/**
 * Setup test environment with certificates
 */
export async function setupTestEnvironment(
  commonName: string,
  organization: string,
  country: string
): Promise<{
  dn: DistinguishedName;
  privateKey: string;
  publicKey: string;
  certificate: Certificate;
}> {
  const dn: DistinguishedName = {
    commonName,
    organization,
    country
  };
  
  const { privateKey, publicKey } = await generateTestKeyPair();
  const certificate = createTestCertificate(dn, publicKey);
  
  return {
    dn,
    privateKey,
    publicKey,
    certificate
  };
}