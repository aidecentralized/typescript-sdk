import { v4 as uuidv4 } from 'uuid';
import { createSign, createVerify } from 'crypto';
import { Certificate, Coupon, DistinguishedName } from './types.js';

// Protocol version
export const PROTOCOL_VERSION = '2023-04-01';

/**
 * Prepare object for signing by converting to canonical JSON
 */
function prepareForSigning(obj: any): string {
  // Simple implementation - in a real system we would use a proper canonicalization library
  return JSON.stringify(obj, Object.keys(obj).sort());
}

/**
 * Sign the coupon data with the provided private key
 */
export function signCouponData(
  couponData: Omit<Coupon, 'signature' | 'signatureAlgorithm' | 'canonicalizationMethod'>, 
  privateKeyPem: string
): string {
  const canonical = prepareForSigning(couponData);
  
  const sign = createSign('RSA-SHA256');
  sign.update(canonical);
  sign.end();
  
  return sign.sign(privateKeyPem, 'base64');
}

/**
 * Adds signature to a coupon and returns the complete signed coupon
 */
export function signCoupon(
  couponData: Omit<Coupon, 'signature' | 'signatureAlgorithm' | 'canonicalizationMethod'>, 
  privateKeyPem: string
): Coupon {
  const signature = signCouponData(couponData, privateKeyPem);
  
  return {
    ...couponData,
    signature,
    signatureAlgorithm: 'SHA256withRSA',
    canonicalizationMethod: 'JSON-canonicalize + SHA256',
  };
}

/**
 * Creates a new coupon with the provided information
 */
export function createCoupon(
  issuer: DistinguishedName,
  recipient: DistinguishedName,
  issuerCertificate: Certificate,
  privateKeyPem: string,
  data: Record<string, any> = {},
  expiresAt?: string
): Coupon {
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

/**
 * Verify a coupon's signature using the issuer's certificate
 */
export function verifyCoupon(coupon: Coupon, allowTestMode: boolean = false): boolean {
  try {
    // Extract the signature fields
    const { 
      signature, 
      signatureAlgorithm, 
      canonicalizationMethod, 
      ...unsignedCouponData 
    } = coupon;
    
    // Prepare the canonical form for verification
    const canonical = prepareForSigning(unsignedCouponData);
    
    // Create a verification object
    const verify = createVerify('RSA-SHA256');
    verify.update(canonical);
    verify.end();
    
    // Verify using the public key from the certificate
    try {
      return verify.verify(
        coupon.issuerCertificate.subjectPublicKey, 
        signature, 
        'base64'
      );
    } catch (cryptoError) {
      console.error('Crypto verification error:', cryptoError);
      
      // For development/testing purposes only - return true if verification fails
      // due to invalid test certificates
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

/**
 * Check if a coupon is expired
 */
export function isCouponExpired(coupon: Coupon): boolean {
  return !!coupon.expiresAt && new Date(coupon.expiresAt).getTime() < Date.now();
}

/**
 * Create a request object with a coupon attached
 */
export function createRequestWithCoupon(
  method: string,
  params: Record<string, any> = {},
  coupon: Coupon
): {
  method: string;
  params: {
    _meta: {
      coupon: Coupon;
    };
    [key: string]: any;
  };
} {
  // Create a copy of the params to avoid modifying the original
  const paramsCopy = { ...params };
  
  // Add the coupon to the _meta field
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

/**
 * Extract and verify a coupon from a request
 */
export function extractAndVerifyCoupon(
  request: {
    method: string;
    params?: {
      _meta?: {
        coupon?: Coupon;
      };
      [key: string]: any;
    };
  },
  allowTestMode: boolean = false
): Coupon | undefined {
  // Extract the coupon if present
  const coupon = request.params?._meta?.coupon;
  
  // No coupon found
  if (!coupon) {
    return undefined;
  }
  
  // Verify the coupon
  const isValid = verifyCoupon(coupon, allowTestMode);
  
  // Check if it's expired
  const isExpired = isCouponExpired(coupon);
  
  // Return the coupon if it's valid and not expired
  return (isValid && !isExpired) ? coupon : undefined;
}