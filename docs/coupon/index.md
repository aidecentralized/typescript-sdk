# Coupon System Documentation

The coupon system provides a secure way to create, sign, verify, and manage verifiable tokens (coupons) that establish trust and facilitate reputation in the MCP ecosystem.

## Overview

Coupons are cryptographically signed tokens that prove the legitimacy of interactions between clients and servers. Each coupon contains:

- Unique identifier
- Issuer and recipient information
- Timestamps (issuance and optional expiry)
- Digital signature
- Additional contextual data

These coupons enable service providers to demonstrate legitimate traffic and build reputation within registries and verification systems.

## Importing the Coupon System

```typescript
// Import specific functions
import { createCoupon, verifyCoupon } from '@typescript-sdk/sdk/coupon';

// Import specific types
import { Coupon, Certificate, DistinguishedName } from '@typescript-sdk/sdk/coupon';

// Import storage system
import { couponStorage, FileCouponStorage } from '@typescript-sdk/sdk/coupon';

// Import server integration
import { extractAndVerifyCoupon, issueCouponForRequest } from '@typescript-sdk/sdk/coupon';
```

## Core Components

The coupon system consists of several core components:

1. **Type Definitions**: Interfaces for Coupon, Certificate, and DistinguishedName
2. **Canonicalization**: Utils for JSON canonicalization per RFC 8785
3. **Coupon Creation**: Functions to create and sign coupons
4. **Verification**: Tools to validate coupon signatures 
5. **Storage**: In-memory and file-based storage options
6. **Client Integration**: Utilities for attaching coupons to requests
7. **Server Integration**: Functions for processing, verifying, and issuing coupons
8. **Export**: Tools for exporting and filtering coupons

## API Reference

### Type Definitions

```typescript
interface DistinguishedName {
  commonName: string;           // CN
  organization?: string;        // O
  organizationalUnit?: string;  // OU
  locality?: string;            // L
  state?: string;               // ST
  country?: string;             // C
  emailAddress?: string;        // E
}

interface Certificate {
  serialNumber: string;
  issuer: DistinguishedName;
  subject: DistinguishedName;
  issuedAt: string;            // ISO format
  expiresAt: string;           // ISO format
  subjectPublicKey: string;    // PEM format
  publicKeyAlgorithm: string;  // e.g., "RSA"
  keyUsage: string[];
  extendedKeyUsage?: string[];
  crlDistributionPoint?: string;
  ocspUrl?: string;
  signature: string;           // base64 format
  signatureAlgorithm: string;  // e.g., "SHA256withRSA"
  version: string;             // e.g., "3"
}

interface Coupon {
  id: string;
  issuer: DistinguishedName;
  recipient: DistinguishedName;
  issuedAt: string;            // ISO format
  expiresAt?: string;          // ISO format
  issuerCertificate: Certificate;
  protocolVersion: string;     // e.g., "2025-03-26"
  data?: Record<string, any>;  // Additional metadata
  signature: string;           // base64 format
  signatureAlgorithm: string;  // e.g., "SHA256withRSA"
  canonicalizationMethod: string; // e.g., "JSON-canonicalize + SHA256"
}
```

### Coupon Creation

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
function createCoupon(
  issuer: DistinguishedName,
  recipient: DistinguishedName,
  issuerCertificate: Certificate,
  privateKeyPem: string,
  data?: Record<string, any>,
  expiresAt?: string
): Coupon;

/**
 * Generates a batch of coupons with the same issuer and private key but different recipients.
 */
function createCouponBatch(
  issuer: DistinguishedName,
  recipients: DistinguishedName[],
  issuerCertificate: Certificate,
  privateKeyPem: string,
  data?: Record<string, any>,
  expiresAt?: string
): Coupon[];
```

### Signature and Verification

```typescript
/**
 * Sign the coupon data with the provided private key.
 */
function signCouponData(
  couponData: Omit<Coupon, 'signature' | 'signatureAlgorithm' | 'canonicalizationMethod'>, 
  privateKeyPem: string
): string;

/**
 * Verify a coupon's signature using the issuer's certificate.
 */
function verifyCoupon(coupon: Coupon): boolean;
```

### Client-Side Integration

```typescript
/**
 * Creates a request object with a coupon attached to the _meta field.
 */
function createRequestWithCoupon(
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

/**
 * Creates a JSON-RPC request with a new coupon attached.
 */
function createRequestWithNewCoupon(
  method: string,
  params: Record<string, any> = {},
  issuer: DistinguishedName,
  recipient: DistinguishedName,
  issuerCertificate: Certificate,
  privateKeyPem: string,
  data?: Record<string, any>
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

### Server-Side Integration

```typescript
/**
 * Extract and verify a coupon from a request.
 */
async function extractAndVerifyCoupon(
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

/**
 * Issue a coupon for a client request and store it.
 */
async function issueCouponForRequest(
  clientDN: DistinguishedName,
  serverDN: DistinguishedName,
  serverCertificate: Certificate,
  privateKeyPem: string,
  requestData?: Record<string, any>,
  expiryDays?: number
): Promise<Coupon>;

/**
 * Add the coupons endpoint to an Express app.
 */
function addCouponsEndpoint(
  app: any,
  path?: string
): void;
```

### Storage

```typescript
/**
 * Thread-safe in-memory storage for coupons.
 */
class CouponStorage {
  // Store a coupon
  async storeCoupon(coupon: Coupon): Promise<string>;
  
  // Store multiple coupons
  async storeCoupons(coupons: Coupon[]): Promise<string[]>;
  
  // Get a coupon by ID
  async getCoupon(id: string): Promise<Coupon | undefined>;
  
  // Get all stored coupons
  async getAllCoupons(): Promise<Coupon[]>;
  
  // Filter coupons based on criteria
  async filterCoupons(filter: CouponFilter): Promise<Coupon[]>;
  
  // Get paginated list of coupons
  async getPaginatedCoupons(
    page?: number,
    pageSize?: number,
    filter?: CouponFilter
  ): Promise<{
    coupons: Coupon[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }>;
  
  // Remove expired coupons
  async removeExpiredCoupons(): Promise<number>;
  
  // Clear all coupons
  async clearStorage(): Promise<void>;
}

/**
 * File-based storage implementation for coupons.
 */
class FileCouponStorage extends CouponStorage {
  constructor(filePath: string, autoSave?: boolean);
  
  // Initialize storage from file
  async initialize(): Promise<void>;
  
  // Save current state to file
  async saveToFile(): Promise<void>;
  
  // Load coupons from file
  async loadFromFile(): Promise<void>;
}
```

### Export

```typescript
/**
 * Export coupons to a JSON file.
 */
async function exportCouponsToJsonFile(
  filePath: string,
  filter?: CouponFilter
): Promise<number>;

/**
 * Generate a JSON string of coupons.
 */
async function exportCouponsToJsonString(
  filter?: CouponFilter,
  pretty?: boolean
): Promise<string>;

/**
 * Export coupons to a callback function.
 */
async function exportCouponsToCallback(
  callback: (coupon: Coupon) => Promise<void> | void,
  filter?: CouponFilter
): Promise<number>;

/**
 * Export coupons to a summary format with counts per issuer/recipient.
 */
async function exportCouponsSummary(
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

## Client SDK Integration

The coupon system is integrated directly into the MCP client SDK:

```typescript
import { Client } from '@typescript-sdk/sdk/client';

// Create a client with coupons enabled
const client = new Client(
  {
    name: 'MyClient',
    version: '1.0.0'
  },
  {
    enableCoupons: true,
    clientDN: {
      commonName: 'My Client',
      organization: 'My Organization',
      country: 'US'
    },
    clientCertificate: myCertificate,
    clientPrivateKey: myPrivateKey
  }
);

// Create a coupon for a specific server
const coupon = client.createCoupon({
  commonName: 'Target Server',
  organization: 'Server Org',
  country: 'CA'
});

// Set as default coupon for all requests
client.setDefaultCoupon(coupon);

// Make a request with the default coupon
const result = await client.callTool({
  name: 'exampleTool',
  arguments: { param1: 'value1' }
});

// Or manually attach a coupon to a specific request
const request = client.attachCouponToRequest(
  { method: 'tools/call', params: { name: 'specialTool' } },
  coupon
);
```

## Server SDK Integration

The coupon system is also integrated into the MCP server SDK:

```typescript
import { Server } from '@typescript-sdk/sdk/server';

// Create a server with coupons enabled
const server = new Server(
  {
    name: 'MyServer',
    version: '1.0.0'
  },
  {
    enableCoupons: true
  }
);

// Configure the server's identity
server.configureCouponIdentity(
  {
    commonName: 'My Server',
    organization: 'My Org',
    country: 'US'
  },
  serverCertificate,
  serverPrivateKey
);

// Set a callback for when coupons are processed
server.oncoupon = (coupon) => {
  console.log(`Processed coupon: ${coupon.id}`);
};

// Issue a coupon for a client
const coupon = await server.issueCoupon(
  {
    commonName: 'Client App',
    organization: 'Client Org',
    country: 'CA'
  },
  { purpose: 'verification', context: 'api-call' }
);

// Get all stored coupons
const allCoupons = await server.getAllCoupons();
```

## Example: Complete Flow with Express

```typescript
import express from 'express';
import { Server } from '@typescript-sdk/sdk/server';
import { createCoupon, addCouponsEndpoint } from '@typescript-sdk/sdk/coupon';

// Create Express app
const app = express();

// Create MCP server with coupons enabled
const mcpServer = new Server(
  { name: 'CouponExample', version: '1.0.0' },
  { enableCoupons: true }
);

// Configure server identity
mcpServer.configureCouponIdentity(
  serverDN,
  serverCertificate,
  serverPrivateKey
);

// Add coupons endpoint to Express
addCouponsEndpoint(app);

// Add custom endpoint that issues coupons
app.post('/issue-coupon', async (req, res) => {
  try {
    const { clientName, clientOrg } = req.body;
    
    const clientDN = {
      commonName: clientName,
      organization: clientOrg,
      country: 'US'
    };
    
    const coupon = await mcpServer.issueCoupon(
      clientDN,
      { purpose: 'api-access', timestamp: new Date().toISOString() }
    );
    
    res.json({ success: true, coupon });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Start server
app.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

## Best Practices

1. **Certificate Management**
   - Keep private keys secure and never expose them
   - Use proper PKI practices for certificate issuance
   - Regularly rotate certificates and keys

2. **Coupon Lifecycle**
   - Set appropriate expiration times for coupons
   - Regularly clean up expired coupons
   - Include sufficient context in the `data` field

3. **Storage**
   - For production, use persistent storage
   - Implement backup procedures for coupon data
   - Consider database storage for high-volume applications

4. **Registry Integration**
   - Expose coupons at a consistent endpoint
   - Support filtering for efficient registry crawling
   - Include pagination support for large coupon collections

5. **Security**
   - Always verify signatures before trusting coupons
   - Validate certificate chains when possible
   - Check expiration dates of both coupons and certificates