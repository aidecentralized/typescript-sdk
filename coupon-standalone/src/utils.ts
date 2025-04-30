import * as crypto from 'crypto';
import { promisify } from 'util';
import { Certificate, DistinguishedName } from '../../src/types/coupon.js';

// Promisify the crypto.generateKeyPair function
const generateKeyPairAsync = promisify(crypto.generateKeyPair);

/**
 * Generate an RSA key pair for testing
 */
export async function createKeyPair(): Promise<{ privateKey: string; publicKey: string }> {
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
export function createSelfSignedCertificate(
  dn: DistinguishedName,
  publicKey: string,
  privateKey: string
): Certificate {
  const now = new Date();
  const expiry = new Date(now);
  expiry.setFullYear(expiry.getFullYear() + 1); // Valid for 1 year
  
  const certificate: Certificate = {
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
  
  return certificate;
}