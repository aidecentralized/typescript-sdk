# Coupon API Reference

This document provides detailed API references for the coupon system.

## Contents

- [Types](#types)
- [Coupon Creation](#coupon-creation)
- [Signature and Verification](#signature-and-verification)
- [Client Integration](#client-integration)
- [Server Integration](#server-integration)
- [Storage](#storage)
- [Export](#export)
- [Utilities](#utilities)

## Types

### DistinguishedName

```typescript
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
```

### Certificate

```typescript
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
```

### Coupon

```typescript
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
```

### CouponInput

```typescript
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
```

### CouponFilter

```typescript
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
```

## Coupon Creation

### createCoupon

```typescript
/**
 * Creates a new coupon with the provided information.
 * 
 * @param issuer - The issuer's distinguished name
 * @param recipient - The recipient's distinguished name
 * @param issuerCertificate - The issuer's certificate
 * @param privateKeyPem - The private key for signing (in PEM format)
 * @param data - Optional additional data to include
 * @param expiresAt - Optional expiration date/time
 * @returns A fully formed and signed coupon
 */
export function createCoupon(
  issuer: DistinguishedName,
  recipient: DistinguishedName,
  issuerCertificate: Certificate,
  privateKeyPem: string,
  data: Record<string, any> = {},
  expiresAt?: string
): Coupon;
```

### createCouponFromInput

```typescript
/**
 * Creates a new coupon from a structured input object.
 * 
 * @param input - The input parameters
 * @param privateKeyPem - The private key for signing (in PEM format)
 * @returns A fully formed and signed coupon
 */
export function createCouponFromInput(
  input: CouponInput,
  privateKeyPem: string
): Coupon;
```

### createCouponBatch

```typescript
/**
 * Generates a batch of coupons with the same issuer and private key but different recipients.
 * 
 * @param issuer - The issuer's distinguished name
 * @param recipients - An array of recipient distinguished names
 * @param issuerCertificate - The issuer's certificate
 * @param privateKeyPem - The private key for signing (in PEM format)
 * @param data - Optional additional data to include for all coupons
 * @param expiresAt - Optional expiration date/time for all coupons
 * @returns An array of fully formed and signed coupons
 */
export function createCouponBatch(
  issuer: DistinguishedName,
  recipients: DistinguishedName[],
  issuerCertificate: Certificate,
  privateKeyPem: string,
  data: Record<string, any> = {},
  expiresAt?: string
): Coupon[];
```

## Signature and Verification

### signCouponData

```typescript
/**
 * Sign the coupon data with the provided private key.
 * 
 * @param couponData - The coupon data to sign (without signature fields)
 * @param privateKeyPem - The private key to use for signing in PEM format
 * @returns The signature as a base64 string
 */
export function signCouponData(
  couponData: Omit<Coupon, 'signature' | 'signatureAlgorithm' | 'canonicalizationMethod'>, 
  privateKeyPem: string
): string;
```

### signCoupon

```typescript
/**
 * Adds signature to a coupon and returns the complete signed coupon.
 * 
 * @param couponData - The coupon data to sign (without signature fields)
 * @param privateKeyPem - The private key to use for signing in PEM format
 * @returns The complete signed coupon
 */
export function signCoupon(
  couponData: Omit<Coupon, 'signature' | 'signatureAlgorithm' | 'canonicalizationMethod'>, 
  privateKeyPem: string
): Coupon;
```

### verifyCoupon

```typescript
/**
 * Verify a coupon's signature using the issuer's certificate.
 * 
 * @param coupon - The coupon to verify
 * @returns Whether the signature is valid
 */
export function verifyCoupon(coupon: Coupon): boolean;
```

## Client Integration

### createRequestWithCoupon

```typescript
/**
 * Creates a request object with a coupon attached to the _meta field.
 * 
 * @param method - The JSON-RPC method name
 * @param params - The parameters for the request
 * @param coupon - The coupon to attach
 * @returns A JSON-RPC request object with the coupon attached
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
};
```

### createRequestWithNewCoupon

```typescript
/**
 * Creates a JSON-RPC request with a new coupon attached.
 * 
 * @param method - The JSON-RPC method name
 * @param params - The parameters for the request
 * @param issuer - The issuer's distinguished name
 * @param recipient - The recipient's distinguished name
 * @param issuerCertificate - The issuer's certificate
 * @param privateKeyPem - The private key for signing
 * @param data - Optional additional data for the coupon
 * @returns A JSON-RPC request object with a newly created coupon attached
 */
export function createRequestWithNewCoupon(
  method: string,
  params: Record<string, any> = {},
  issuer: DistinguishedName,
  recipient: DistinguishedName,
  issuerCertificate: Certificate,
  privateKeyPem: string,
  data: Record<string, any> = {}
): {
  method: string;
  params: {
    _meta: {
      coupon: Coupon;
    };
    [key: string]: any;
  };
};
```

### extractCouponFromRequest

```typescript
/**
 * Extract coupon from a request if present.
 * 
 * @param request - The request object to extract from
 * @returns The coupon if found, undefined otherwise
 */
export function extractCouponFromRequest(
  request: {
    method: string;
    params?: {
      _meta?: {
        coupon?: Coupon;
      };
      [key: string]: any;
    };
  }
): Coupon | undefined;
```

## Server Integration

### extractAndVerifyCoupon

```typescript
/**
 * Extract and verify a coupon from a request.
 * 
 * @param request - The request object to extract from
 * @returns The verified coupon if found and valid, undefined otherwise
 */
export async function extractAndVerifyCoupon(
  request: {
    method: string;
    params?: {
      _meta?: {
        coupon?: Coupon;
      };
      [key: string]: any;
    };
  }
): Promise<Coupon | undefined>;
```

### issueCouponForRequest

```typescript
/**
 * Issue a coupon for a client request and store it.
 * 
 * @param clientDN - The client's distinguished name (extracted from request/auth)
 * @param serverDN - The server's distinguished name
 * @param serverCertificate - The server's certificate
 * @param privateKeyPem - The server's private key for signing
 * @param requestData - Optional data about the request to include in the coupon
 * @param expiryDays - Optional number of days until expiry (default: 30)
 * @returns The issued coupon
 */
export async function issueCouponForRequest(
  clientDN: DistinguishedName,
  serverDN: DistinguishedName,
  serverCertificate: Certificate,
  privateKeyPem: string,
  requestData: Record<string, any> = {},
  expiryDays: number = 30
): Promise<Coupon>;
```

### couponsEndpointHandler

```typescript
/**
 * Create an HTTP response handler for the /coupons endpoint.
 * 
 * @param req - The HTTP request object
 * @param res - The HTTP response object
 */
export async function couponsEndpointHandler(
  req: any,
  res: any
): Promise<void>;
```

### addCouponsEndpoint

```typescript
/**
 * Add the coupons endpoint to an Express app.
 * 
 * @param app - The Express app
 * @param path - The path for the endpoint (default: '/coupons')
 */
export function addCouponsEndpoint(
  app: any,
  path: string = '/coupons'
): void;
```

## Storage

### CouponStorage (In-Memory)

```typescript
/**
 * Thread-safe in-memory storage for coupons.
 */
export class CouponStorage {
  /**
   * Store a coupon in the storage.
   * 
   * @param coupon - The coupon to store
   * @returns The ID of the stored coupon
   */
  async storeCoupon(coupon: Coupon): Promise<string>;
  
  /**
   * Store multiple coupons in a batch operation.
   * 
   * @param coupons - The coupons to store
   * @returns An array of the stored coupon IDs
   */
  async storeCoupons(coupons: Coupon[]): Promise<string[]>;
  
  /**
   * Get a coupon by its ID.
   * 
   * @param id - The ID of the coupon to retrieve
   * @returns The coupon or undefined if not found
   */
  async getCoupon(id: string): Promise<Coupon | undefined>;
  
  /**
   * Get all stored coupons.
   * 
   * @returns An array of all coupons
   */
  async getAllCoupons(): Promise<Coupon[]>;
  
  /**
   * Filter coupons based on various criteria.
   * 
   * @param filter - The filter to apply
   * @returns An array of matching coupons
   */
  async filterCoupons(filter: CouponFilter): Promise<Coupon[]>;
  
  /**
   * Get a paginated list of coupons.
   * 
   * @param page - The page number (1-based)
   * @param pageSize - The number of items per page
   * @param filter - Optional filter to apply
   * @returns A paginated result
   */
  async getPaginatedCoupons(
    page: number = 1,
    pageSize: number = 20,
    filter?: CouponFilter
  ): Promise<{
    coupons: Coupon[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }>;
  
  /**
   * Remove expired coupons from storage.
   * 
   * @returns The number of coupons removed
   */
  async removeExpiredCoupons(): Promise<number>;
  
  /**
   * Clear all coupons from storage.
   */
  async clearStorage(): Promise<void>;
}
```

### FileCouponStorage

```typescript
/**
 * File-based storage implementation for coupons.
 * Extends the in-memory storage with file persistence.
 */
export class FileCouponStorage extends CouponStorage {
  /**
   * Create a new file-based coupon storage.
   * 
   * @param filePath - The path to store the coupons file
   * @param autoSave - Whether to automatically save after each change
   */
  constructor(filePath: string, autoSave: boolean = true);
  
  /**
   * Initialize the storage by loading from the file if it exists.
   */
  async initialize(): Promise<void>;
  
  /**
   * Save the current state to the file.
   */
  async saveToFile(): Promise<void>;
  
  /**
   * Load coupons from the file.
   */
  async loadFromFile(): Promise<void>;
}
```

## Export

### exportCouponsToJsonFile

```typescript
/**
 * Export coupons to a JSON file.
 * 
 * @param filePath - The path to save the file
 * @param filter - Optional filter to apply
 * @returns The number of coupons exported
 */
export async function exportCouponsToJsonFile(
  filePath: string,
  filter?: CouponFilter
): Promise<number>;
```

### exportCouponsToJsonString

```typescript
/**
 * Generate a JSON string of coupons.
 * 
 * @param filter - Optional filter to apply
 * @param pretty - Whether to prettify the JSON output
 * @returns The JSON string representation of the coupons
 */
export async function exportCouponsToJsonString(
  filter?: CouponFilter,
  pretty: boolean = false
): Promise<string>;
```

### exportCouponsToCallback

```typescript
/**
 * Export coupons to a callback function.
 * Useful for streaming or custom processing.
 * 
 * @param callback - The callback function to process each coupon
 * @param filter - Optional filter to apply
 * @returns The number of coupons processed
 */
export async function exportCouponsToCallback(
  callback: (coupon: Coupon) => Promise<void> | void,
  filter?: CouponFilter
): Promise<number>;
```

### exportCouponsSummary

```typescript
/**
 * Export coupons to a summary format with counts per issuer/recipient.
 * 
 * @param filter - Optional filter to apply
 * @returns A summary object with counts
 */
export async function exportCouponsSummary(
  filter?: CouponFilter
): Promise<{
  totalCount: number;
  byIssuer: Record<string, number>;
  byRecipient: Record<string, number>;
  byExpiryStatus: {
    valid: number;
    expired: number;
    noExpiry: number;
  };
}>;
```

## Utilities

### canonicalizeData

```typescript
/**
 * Canonicalizes a JavaScript object according to RFC 8785.
 * 
 * @param data - The data object to canonicalize
 * @returns The canonicalized string representation
 */
export function canonicalizeData(data: Record<string, any>): string;
```

### hashCanonicalData

```typescript
/**
 * Creates a SHA-256 hash of canonicalized data.
 * 
 * @param data - The data object to hash
 * @returns The SHA-256 hash as a hex string
 */
export function hashCanonicalData(data: Record<string, any>): string;
```

### prepareForSigning

```typescript
/**
 * Prepares an object for signing by canonicalizing it.
 * 
 * @param data - The data object to prepare for signing
 * @returns The canonicalized string ready for signing
 */
export function prepareForSigning(data: Record<string, any>): string;
```