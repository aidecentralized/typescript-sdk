/**
 * Type definitions for the coupon system in the SDK.
 * Based on the protocol specification.
 */

/**
 * X.500 Distinguished Name structure for identifying entities.
 */
export interface DistinguishedName {
  commonName: string;           // CN
  organization?: string;        // O
  organizationalUnit?: string;  // OU
  locality?: string;            // L
  state?: string;               // ST
  country?: string;             // C
  emailAddress?: string;        // E
}

/**
 * A certificate is a verifiable token that binds an identity to a public key.
 * It is issued by a certification authority and can be used to establish trust
 * between parties. The certificate follows X.509 standards and contains
 * information about the subject, issuer, validity period, and cryptographic details.
 */
export interface Certificate {
  /**
   * Unique serial number assigned by the issuing CA.
   * Used for certificate revocation and identification.
   */
  serialNumber: string;

  /**
   * The issuer of the certificate (the CA).
   * Represented as an X.500 Distinguished Name.
   */
  issuer: DistinguishedName;

  /**
   * The subject (recipient/owner) of the certificate.
   * Represented as an X.500 Distinguished Name.
   */
  subject: DistinguishedName;

  /**
   * The date and time when the certificate was issued.
   * This is a string in ISO 8601 format.
   */
  issuedAt: string;

  /**
   * The date and time when the certificate expires.
   * This is a string in ISO 8601 format.
   */
  expiresAt: string;

  /**
   * The public key belonging to the subject (recipient).
   * This is a string in PEM format.
   */
  subjectPublicKey: string;

  /**
   * The algorithm used for the subject's public key.
   * E.g., "RSA", "ECDSA", "Ed25519"
   */
  publicKeyAlgorithm: string;

  /**
   * Key usage constraints (e.g., "digitalSignature", "keyEncipherment")
   * Specifies the permitted uses of the certificate's public key.
   */
  keyUsage: string[];

  /**
   * Extended key usage (e.g., "serverAuth", "clientAuth")
   * Specifies the purposes for which the certificate can be used.
   */
  extendedKeyUsage?: string[];

  /**
   * URL where certificate revocation information can be checked.
   */
  crlDistributionPoint?: string;

  /**
   * URL for Online Certificate Status Protocol (OCSP) checking.
   */
  ocspUrl?: string;

  /**
   * Digital signature created by the issuer's private key.
   * Signs the TBSCertificate (To-Be-Signed Certificate) portion.
   * This is a string in base64 format.
   */
  signature: string;

  /**
   * The algorithm used to create the signature.
   * E.g., "SHA256withRSA", "SHA384withECDSA"
   */
  signatureAlgorithm: string;

  /**
   * Version of the X.509 standard used (typically "3").
   */
  version: string;
}

/**
 * A coupon is a verifiable token from a service requester to a service provider.
 * It establishes the legitimacy of the request and the identity of the requester.
 * The coupon can be used by the service provider to verify the request and potentially
 * gain reputation by demonstrating legitimate traffic.
 */
export interface Coupon {
  /**
   * Unique identifier for the coupon.
   */
  id: string;

  /**
   * The issuer of the coupon (service requester).
   * Represented as an X.500 Distinguished Name.
   */
  issuer: DistinguishedName;

  /**
   * The recipient of the coupon (service provider).
   * Represented as an X.500 Distinguished Name.
   */
  recipient: DistinguishedName;

  /**
   * The date and time when the coupon was issued.
   * This is a string in ISO 8601 format.
   */
  issuedAt: string;

  /**
   * The date and time when the coupon expires (optional).
   * This is a string in ISO 8601 format.
   */
  expiresAt?: string;

  /**
   * Certificate of the issuer.
   * This certificate establishes the identity of the issuer.
   */
  issuerCertificate: Certificate;

  /**
   * Version of the protocol used to create the coupon.
   * This is a string in the format YYYY-MM-DD.
   */
  protocolVersion: string;

  /**
   * Additional data associated with this coupon.
   * Can include purpose, permissions, or other context.
   */
  data?: Record<string, any>;

  /**
   * Digital signature created by the issuer's private key.
   * Signs a canonical representation of all the above fields.
   * This is a string in base64 format.
   */
  signature: string;

  /**
   * The algorithm used to create the signature.
   * Should match the algorithm specified in the issuer's certificate.
   */
  signatureAlgorithm: string;

  /**
   * Description of the canonical format used for creating the signature.
   * E.g., "JSON-canonicalize + SHA256"
   */
  canonicalizationMethod: string;
}

/**
 * Optional: Certificate Chain to support hierarchical PKI
 */
export interface CertificateChain {
  /**
   * The end-entity (leaf) certificate.
   */
  endEntityCertificate: Certificate;

  /**
   * Array of intermediate CA certificates (if any).
   * Should be in order from the certificate that signed the end-entity
   * certificate up to (but not including) the root certificate.
   */
  intermediateCertificates: Certificate[];

  /**
   * The root certificate (optional).
   * Usually, root certificates are distributed out-of-band and
   * pre-installed in trust stores.
   */
  rootCertificate?: Certificate;
}

/**
 * Input parameters for creating a new coupon
 */
export interface CouponInput {
  /**
   * The issuer of the coupon
   */
  issuer: DistinguishedName;
  
  /**
   * The recipient of the coupon
   */
  recipient: DistinguishedName;
  
  /**
   * The certificate of the issuer
   */
  issuerCertificate: Certificate;
  
  /**
   * Optional expiration date/time in ISO format
   */
  expiresAt?: string;
  
  /**
   * Additional data to include in the coupon
   */
  data?: Record<string, any>;
}

/**
 * Options for filtering coupons when retrieving them
 */
export interface CouponFilter {
  /**
   * Filter by issuer common name
   */
  issuerCommonName?: string;
  
  /**
   * Filter by recipient common name
   */
  recipientCommonName?: string;
  
  /**
   * Filter coupons issued after this date/time
   */
  issuedAfter?: string;
  
  /**
   * Filter coupons issued before this date/time
   */
  issuedBefore?: string;
  
  /**
   * Filter by coupon ID
   */
  id?: string;
}

/**
 * Result of a verification check
 */
export interface VerificationCheck {
  /**
   * Whether the check passed
   */
  passed: boolean;
  
  /**
   * Error message if the check failed
   */
  error?: string;
}

/**
 * Result of comprehensive coupon verification
 */
export interface CouponVerificationResult {
  /**
   * Coupon ID
   */
  id: string;
  
  /**
   * Issuer common name
   */
  issuer: string;
  
  /**
   * Recipient common name
   */
  recipient: string;
  
  /**
   * Issuance date
   */
  issuedAt: string;
  
  /**
   * Overall verification result
   */
  verified: boolean;
  
  /**
   * Individual verification checks
   */
  checks: {
    /**
     * Format validation check
     */
    format?: VerificationCheck;
    
    /**
     * Expiry check
     */
    expiry?: VerificationCheck;
    
    /**
     * Trusted issuer check
     */
    trustedIssuer?: VerificationCheck;
    
    /**
     * Cryptographic signature verification
     */
    signature?: VerificationCheck;
    
    /**
     * Additional custom checks
     */
    [key: string]: VerificationCheck | undefined;
  };
}

/**
 * Options for coupon verification
 */
export interface CouponVerifyOptions {
  /**
   * Whether to check if the coupon is expired
   */
  checkExpiry?: boolean;
  
  /**
   * Whether to verify the coupon's signature
   */
  verifySignature?: boolean;
  
  /**
   * Whether to validate the coupon's format
   */
  validateFormat?: boolean;
  
  /**
   * Whether to check if the issuer is trusted
   */
  checkTrustedIssuer?: boolean;
  
  /**
   * Set of trusted issuer common names
   * Only used if checkTrustedIssuer is true
   */
  trustedIssuers?: Set<string>;
}