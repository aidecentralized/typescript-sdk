import * as crypto from 'crypto';
import { promisify } from 'util';
import { Certificate, DistinguishedName } from './types.js';

// Promisify the generateKeyPair function
const generateKeyPairAsync = promisify(crypto.generateKeyPair);

/**
 * Generate an RSA key pair for testing
 */
export async function generateTestKeyPair(): Promise<{ privateKey: string; publicKey: string }> {
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

/**
 * Create a self-signed certificate for testing
 */
export function createCertificate(dn: DistinguishedName, publicKey: string): Certificate {
  const now = new Date();
  const expiry = new Date(now);
  expiry.setFullYear(expiry.getFullYear() + 1); // 1 year validity
  
  return {
    serialNumber: Math.floor(Math.random() * 1000000).toString(),
    issuer: dn, // Self-signed
    subject: dn,
    issuedAt: now.toISOString(),
    expiresAt: expiry.toISOString(),
    subjectPublicKey: publicKey,
    publicKeyAlgorithm: 'RSA',
    keyUsage: ['digitalSignature', 'keyEncipherment'],
    signature: 'test-signature', // Placeholder for testing
    signatureAlgorithm: 'SHA256withRSA',
    version: '3'
  };
}

/**
 * Create an identity with certificate and keys
 */
export async function createIdentity(name: string, org: string, country: string): Promise<{
  dn: DistinguishedName;
  certificate: Certificate;
  publicKey: string;
  privateKey: string;
}> {
  // Create distinguished name
  const dn: DistinguishedName = {
    commonName: name,
    organization: org,
    country
  };
  
  // Generate key pair
  const { publicKey, privateKey } = await generateTestKeyPair();
  
  // Create certificate
  const certificate = createCertificate(dn, publicKey);
  
  return {
    dn,
    certificate,
    publicKey,
    privateKey
  };
}