/**
 * Enhanced coupon verification utilities.
 * Provides comprehensive verification of coupons beyond basic signature validation.
 * These functions are stateless and can be used by services that maintain their own state.
 */

import { Coupon, CouponVerificationResult, CouponVerifyOptions } from '../types/coupon.js';
import { verifyCoupon as verifySignature } from './sign.js';

/**
 * Check if a coupon is expired.
 * 
 * @param coupon - The coupon to check
 * @returns True if the coupon is expired, false otherwise
 */
export function isCouponExpired(coupon: Coupon): boolean {
  if (!coupon.expiresAt) return false;
  return new Date(coupon.expiresAt).getTime() < Date.now();
}

/**
 * Check if a coupon issuer is trusted.
 * 
 * @param coupon - The coupon to check
 * @param trustedIssuers - Set of trusted issuer common names
 * @returns True if the issuer is trusted or if trustedIssuers is empty
 */
export function isIssuerTrusted(coupon: Coupon, trustedIssuers?: Set<string>): boolean {
  // If no trusted issuers defined, consider all issuers trusted
  if (!trustedIssuers || trustedIssuers.size === 0) return true;
  
  // Check if the issuer is in the trusted list
  return trustedIssuers.has(coupon.issuer.commonName);
}

/**
 * Validate the format of a coupon.
 * Checks that all required fields are present and properly formatted.
 * 
 * @param coupon - The coupon to validate
 * @returns Validation result with success flag and error message
 */
export function validateCouponFormat(coupon: Coupon): { valid: boolean; error?: string } {
  // Required fields
  const requiredFields = [
    'id', 'issuer', 'recipient', 'issuedAt', 
    'issuerCertificate', 'protocolVersion', 'signature', 
    'signatureAlgorithm', 'canonicalizationMethod'
  ];
  
  for (const field of requiredFields) {
    if (!coupon[field as keyof Coupon]) {
      return {
        valid: false,
        error: `Missing required field: ${field}`
      };
    }
  }
  
  // Check issuer and recipient format
  if (!coupon.issuer.commonName) {
    return {
      valid: false,
      error: 'Issuer missing commonName'
    };
  }
  
  if (!coupon.recipient.commonName) {
    return {
      valid: false, 
      error: 'Recipient missing commonName'
    };
  }
  
  // Check certificate format
  const certificate = coupon.issuerCertificate;
  const certificateFields = [
    'serialNumber', 'issuer', 'subject', 'issuedAt',
    'expiresAt', 'subjectPublicKey', 'publicKeyAlgorithm',
    'signature', 'signatureAlgorithm'
  ];
  
  for (const field of certificateFields) {
    if (!certificate[field as keyof typeof certificate]) {
      return {
        valid: false,
        error: `Certificate missing field: ${field}`
      };
    }
  }
  
  return { valid: true };
}

/**
 * Comprehensively verify a coupon with multiple checks.
 * This function is stateless - any required state like trusted issuers
 * should be passed in via the options parameter.
 * 
 * @param coupon - The coupon to verify
 * @param options - Verification options
 * @returns A detailed verification result
 */
export function verifyComprehensive(
  coupon: Coupon,
  options: CouponVerifyOptions = {}
): CouponVerificationResult {
  const {
    checkExpiry = true,
    verifySignature: checkSignature = true,
    validateFormat: checkFormat = true,
    checkTrustedIssuer = false,
    trustedIssuers
  } = options;
  
  const result: CouponVerificationResult = {
    id: coupon.id,
    issuer: coupon.issuer.commonName,
    recipient: coupon.recipient.commonName,
    issuedAt: coupon.issuedAt,
    verified: false,
    checks: {}
  };
  
  // Format validation
  if (checkFormat) {
    const formatResult = validateCouponFormat(coupon);
    result.checks.format = {
      passed: formatResult.valid,
      error: formatResult.error
    };
    
    if (!formatResult.valid) {
      return { ...result, verified: false };
    }
  }
  
  // Expiry check
  if (checkExpiry) {
    const expired = isCouponExpired(coupon);
    result.checks.expiry = {
      passed: !expired,
      error: expired ? 'Coupon has expired' : undefined
    };
    
    if (expired) {
      return { ...result, verified: false };
    }
  }
  
  // Trusted issuer check
  if (checkTrustedIssuer) {
    const trusted = isIssuerTrusted(coupon, trustedIssuers);
    result.checks.trustedIssuer = {
      passed: trusted,
      error: trusted ? undefined : 'Issuer is not trusted'
    };
    
    if (!trusted) {
      return { ...result, verified: false };
    }
  }
  
  // Signature verification
  if (checkSignature) {
    try {
      const signatureValid = verifySignature(coupon);
      result.checks.signature = {
        passed: signatureValid,
        error: signatureValid ? undefined : 'Invalid signature'
      };
      
      if (!signatureValid) {
        return { ...result, verified: false };
      }
    } catch (error) {
      result.checks.signature = {
        passed: false,
        error: `Signature verification error: ${(error as Error).message}`
      };
      
      return { ...result, verified: false };
    }
  }
  
  // If we get here, all checks passed
  return { ...result, verified: true };
}

/**
 * Batch verify multiple coupons.
 * 
 * @param coupons - Array of coupons to verify
 * @param options - Verification options
 * @returns Array of verification results
 */
export function batchVerify(
  coupons: Coupon[],
  options: CouponVerifyOptions = {}
): CouponVerificationResult[] {
  return coupons.map(coupon => verifyComprehensive(coupon, options));
}