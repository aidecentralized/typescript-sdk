/**
 * Coupon Verification Service
 * A class for verifying coupons with comprehensive checks.
 */
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

// Import types
import { Coupon, CouponVerificationResult, Certificate } from '../src/types/coupon.js';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import verification functions from the SDK
const { verifyCoupon } = await import('../src/coupon/sign.js');

/**
 * Options for configuring the CouponVerifier
 */
export interface CouponVerifierOptions {
  checkExpiry?: boolean;
  verifySignature?: boolean;
  validateFormat?: boolean;
  trustedIssuers?: Set<string>;
}

/**
 * Validation result from format checking
 */
interface FormatValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Check result for individual verification steps
 */
interface VerificationCheck {
  passed: boolean;
  error?: string | null;
}

/**
 * Internal verification result stored in the verifier
 */
interface StoredVerificationResult extends CouponVerificationResult {
  checks: Record<string, VerificationCheck>;
}

/**
 * Comprehensive coupon verification service
 * Performs multiple checks on a coupon to validate it
 */
export class CouponVerifier {
  private options: Required<Omit<CouponVerifierOptions, 'trustedIssuers'>>;
  private trustedIssuers: Set<string>;
  private verificationStore: Map<string, StoredVerificationResult>;

  /**
   * Create a new CouponVerifier
   * 
   * @param options - Configuration options
   */
  constructor(options: CouponVerifierOptions = {}) {
    this.options = {
      checkExpiry: options.checkExpiry ?? true,
      verifySignature: options.verifySignature ?? true,
      validateFormat: options.validateFormat ?? true,
    };
    
    this.trustedIssuers = options.trustedIssuers || new Set();
    this.verificationStore = new Map(); // Store verification results by coupon ID
  }
  
  /**
   * Add a trusted issuer
   * 
   * @param commonName - CommonName of the trusted issuer
   */
  public addTrustedIssuer(commonName: string): void {
    this.trustedIssuers.add(commonName);
  }
  
  /**
   * Remove a trusted issuer
   * 
   * @param commonName - CommonName of the issuer to remove
   */
  public removeTrustedIssuer(commonName: string): void {
    this.trustedIssuers.delete(commonName);
  }
  
  /**
   * Check if a coupon is from a trusted issuer
   * 
   * @param coupon - The coupon to check
   * @returns True if the issuer is trusted or if no trusted issuers configured
   */
  public isTrustedIssuer(coupon: Coupon): boolean {
    // If no trusted issuers defined, consider all issuers trusted
    if (this.trustedIssuers.size === 0) return true;
    
    // Check if the issuer is in the trusted list
    return this.trustedIssuers.has(coupon.issuer.commonName);
  }
  
  /**
   * Validate the format of a coupon
   * 
   * @param coupon - The coupon to validate
   * @returns Validation result with success flag and error message
   */
  public validateCouponFormat(coupon: Coupon): FormatValidationResult {
    // Required fields
    const requiredFields = [
      'id', 'issuer', 'recipient', 'issuedAt', 
      'issuerCertificate', 'signature', 'signatureAlgorithm'
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
      if (!certificate[field as keyof Certificate]) {
        return {
          valid: false,
          error: `Certificate missing field: ${field}`
        };
      }
    }
    
    return { valid: true };
  }
  
  /**
   * Check if a coupon is expired
   * 
   * @param coupon - The coupon to check
   * @returns True if the coupon is expired
   */
  public isExpired(coupon: Coupon): boolean {
    if (!coupon.expiresAt) return false;
    return new Date(coupon.expiresAt).getTime() < Date.now();
  }
  
  /**
   * Verify a coupon comprehensively
   * 
   * @param coupon - The coupon to verify
   * @returns Verification result with success flag and details
   */
  public async verifyCoupon(coupon: Coupon): Promise<StoredVerificationResult> {
    // Check if we already verified this coupon
    if (this.verificationStore.has(coupon.id)) {
      return this.verificationStore.get(coupon.id)!;
    }
    
    const result: StoredVerificationResult = {
      id: coupon.id,
      issuer: coupon.issuer.commonName,
      recipient: coupon.recipient.commonName,
      issuedAt: coupon.issuedAt,
      verified: false,
      checks: {}
    };
    
    // Format validation
    if (this.options.validateFormat) {
      const formatResult = this.validateCouponFormat(coupon);
      result.checks.format = {
        passed: formatResult.valid,
        error: formatResult.error
      };
      
      if (!formatResult.valid) {
        result.verified = false;
        this.verificationStore.set(coupon.id, result);
        return result;
      }
    }
    
    // Expiry check
    if (this.options.checkExpiry) {
      const expired = this.isExpired(coupon);
      result.checks.expiry = {
        passed: !expired,
        error: expired ? 'Coupon has expired' : null
      };
      
      if (expired) {
        result.verified = false;
        this.verificationStore.set(coupon.id, result);
        return result;
      }
    }
    
    // Trusted issuer check
    const trusted = this.isTrustedIssuer(coupon);
    result.checks.trustedIssuer = {
      passed: trusted,
      error: !trusted ? 'Issuer is not trusted' : null
    };
    
    // Signature verification
    if (this.options.verifySignature) {
      try {
        const signatureValid = verifyCoupon(coupon);
        result.checks.signature = {
          passed: signatureValid,
          error: !signatureValid ? 'Invalid signature' : null
        };
        
        if (!signatureValid) {
          result.verified = false;
          this.verificationStore.set(coupon.id, result);
          return result;
        }
      } catch (error) {
        result.checks.signature = {
          passed: false,
          error: `Signature verification error: ${(error as Error).message}`
        };
        
        result.verified = false;
        this.verificationStore.set(coupon.id, result);
        return result;
      }
    }
    
    // If we get here, all checks passed
    result.verified = true;
    this.verificationStore.set(coupon.id, result);
    return result;
  }
  
  /**
   * Get verifier status and statistics
   * 
   * @returns Status information about verification operations
   */
  public getStatus(): {
    totalVerified: number;
    totalFailed: number;
    trustedIssuers: string[];
    options: Required<Omit<CouponVerifierOptions, 'trustedIssuers'>>;
  } {
    let verified = 0;
    let failed = 0;
    
    for (const result of this.verificationStore.values()) {
      if (result.verified) verified++;
      else failed++;
    }
    
    return {
      totalVerified: verified,
      totalFailed: failed,
      trustedIssuers: Array.from(this.trustedIssuers),
      options: this.options
    };
  }
}

/**
 * Example usage of the CouponVerifier
 */
async function demoVerifier(): Promise<void> {
  console.log('Coupon Verifier Demo');
  
  // Create a verifier
  const verifier = new CouponVerifier({
    trustedIssuers: new Set(['Example Server', 'Example Client'])
  });
  
  // Create a valid coupon structure (normally would come from client/server)
  const validCoupon: Coupon = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    issuer: {
      commonName: 'Example Client',
      organization: 'Example Org',
      country: 'US'
    },
    recipient: {
      commonName: 'Example Server',
      organization: 'Example Org',
      country: 'US'
    },
    issuedAt: new Date().toISOString(),
    issuerCertificate: {
      serialNumber: '01',
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
      issuedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 365*24*60*60*1000).toISOString(),
      subjectPublicKey: 'dummyPublicKey',
      publicKeyAlgorithm: 'RSA',
      keyUsage: ['digitalSignature'],
      signature: 'dummySignature',
      signatureAlgorithm: 'SHA256withRSA',
      version: '3'
    },
    signature: 'dummySignature',
    signatureAlgorithm: 'SHA256withRSA',
    canonicalizationMethod: 'JSON-canonicalize + SHA256',
    protocolVersion: '2023-05-19'
  };
  
  // Create an expired coupon
  const expiredCoupon: Coupon = {
    ...validCoupon,
    id: '223e4567-e89b-12d3-a456-426614174001',
    expiresAt: new Date(Date.now() - 1000 * 60 * 60).toISOString()
  };
  
  // Create a coupon with missing fields
  const invalidFormatCoupon = {
    id: '323e4567-e89b-12d3-a456-426614174002',
    issuer: {
      commonName: 'Example Client'
    },
    // Missing recipient
    issuedAt: new Date().toISOString()
    // Missing other required fields
  } as Coupon;
  
  // Create a coupon from untrusted issuer
  const untrustedCoupon: Coupon = {
    ...validCoupon,
    id: '423e4567-e89b-12d3-a456-426614174003',
    issuer: {
      commonName: 'Untrusted Issuer',
      organization: 'Unknown Org',
      country: 'XX'
    }
  };
  
  // Verify the coupons
  console.log('Verifying valid coupon:');
  const validResult = await verifier.verifyCoupon(validCoupon);
  console.log(JSON.stringify(validResult, null, 2));
  
  console.log('\nVerifying expired coupon:');
  const expiredResult = await verifier.verifyCoupon(expiredCoupon);
  console.log(JSON.stringify(expiredResult, null, 2));
  
  console.log('\nVerifying invalid format coupon:');
  const invalidFormatResult = await verifier.verifyCoupon(invalidFormatCoupon);
  console.log(JSON.stringify(invalidFormatResult, null, 2));
  
  console.log('\nVerifying untrusted issuer coupon:');
  const untrustedResult = await verifier.verifyCoupon(untrustedCoupon);
  console.log(JSON.stringify(untrustedResult, null, 2));
  
  console.log('\nVerifier status:');
  console.log(verifier.getStatus());
}

// Run the demo if this file is executed directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  demoVerifier();
}