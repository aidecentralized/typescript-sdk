# Coupon System Code Examples

This document provides practical code examples for using the coupon system in various scenarios.

## Basic Usage

### Creating and Verifying a Coupon

```typescript
import { 
  createCoupon, 
  verifyCoupon,
  DistinguishedName, 
  Certificate 
} from '@typescript-sdk/sdk/coupon';

// Define identities
const issuer: DistinguishedName = {
  commonName: 'Example Issuer',
  organization: 'Example Org',
  country: 'US'
};

const recipient: DistinguishedName = {
  commonName: 'Example Recipient',
  organization: 'Example Corp',
  country: 'CA'
};

// Certificate would normally come from a CA
const certificate: Certificate = {
  serialNumber: '12345',
  issuer: {
    commonName: 'Example CA',
    organization: 'Example CA Org',
    country: 'US'
  },
  subject: issuer,
  issuedAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
  subjectPublicKey: '-----BEGIN PUBLIC KEY-----\n... key data ...\n-----END PUBLIC KEY-----',
  publicKeyAlgorithm: 'RSA',
  keyUsage: ['digitalSignature', 'keyEncipherment'],
  signature: 'base64-signature-data',
  signatureAlgorithm: 'SHA256withRSA',
  version: '3'
};

// Create a coupon
const coupon = createCoupon(
  issuer,
  recipient,
  certificate,
  privateKey, // Private key corresponding to certificate
  { purpose: 'example', context: 'documentation' }, // Optional data
  new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days expiry
);

console.log('Coupon created:', coupon.id);

// Verify the coupon
const isValid = verifyCoupon(coupon);
console.log('Coupon is valid:', isValid);
```

### Storing Coupons

```typescript
import { 
  createCoupon, 
  couponStorage, 
  FileCouponStorage 
} from '@typescript-sdk/sdk/coupon';

// Create a coupon
const coupon = createCoupon(/* ... */);

// Using in-memory storage
await couponStorage.storeCoupon(coupon);
const retrievedCoupon = await couponStorage.getCoupon(coupon.id);

// Using file-based storage
const fileStorage = new FileCouponStorage('./data/coupons.json');
await fileStorage.initialize(); // Load existing data if available
await fileStorage.storeCoupon(coupon);
await fileStorage.saveToFile(); // Explicit save (if autoSave is false)
```

### Filtering and Querying Coupons

```typescript
import { couponStorage, CouponFilter } from '@typescript-sdk/sdk/coupon';

// Filter by issuer
const issuerFilter: CouponFilter = {
  issuerCommonName: 'Example Issuer'
};
const issuerCoupons = await couponStorage.filterCoupons(issuerFilter);

// Filter by date range
const dateFilter: CouponFilter = {
  issuedAfter: '2023-01-01T00:00:00Z',
  issuedBefore: '2023-12-31T23:59:59Z'
};
const dateRangeCoupons = await couponStorage.filterCoupons(dateFilter);

// Paginated results
const page1 = await couponStorage.getPaginatedCoupons(1, 10, issuerFilter);
console.log(`Page 1 of ${page1.totalPages}, showing ${page1.coupons.length} of ${page1.total} results`);
```

### Exporting Coupons

```typescript
import { 
  exportCouponsToJsonFile, 
  exportCouponsToJsonString, 
  exportCouponsSummary 
} from '@typescript-sdk/sdk/coupon';

// Export to file
const count = await exportCouponsToJsonFile('./exports/all-coupons.json');
console.log(`Exported ${count} coupons`);

// Export filtered coupons to file
const filteredCount = await exportCouponsToJsonFile(
  './exports/filtered-coupons.json',
  { recipientCommonName: 'Example Recipient' }
);

// Get JSON string
const json = await exportCouponsToJsonString(undefined, true); // Pretty-printed

// Generate a summary
const summary = await exportCouponsSummary();
console.log('Total coupons:', summary.totalCount);
console.log('By issuer:', summary.byIssuer);
console.log('By status:', summary.byExpiryStatus);
```

## Client-Side Integration

### Client Class with Coupon Support

```typescript
import { Client } from '@typescript-sdk/sdk/client';
import { Coupon } from '@typescript-sdk/sdk/coupon';

// Create a client with coupon support
const client = new Client(
  { name: 'ExampleClient', version: '1.0.0' },
  {
    enableCoupons: true,
    clientDN: {
      commonName: 'Example Client',
      organization: 'Example Inc',
      country: 'US'
    },
    clientCertificate: myCertificate,
    clientPrivateKey: myPrivateKey
  }
);

// Create a coupon for a specific server
const coupon = client.createCoupon(
  {
    commonName: 'Target Server',
    organization: 'Server Org',
    country: 'CA'
  },
  { purpose: 'api-access', clientId: 'example-client-123' }
);

// Set as default coupon for all requests
client.setDefaultCoupon(coupon);

// Make a request that will automatically include the coupon
const result = await client.callTool({
  name: 'exampleTool',
  arguments: { param1: 'value1' }
});

// Manually attach a coupon to a specific request
const request = client.attachCouponToRequest(
  { method: 'tools/call', params: { name: 'specialTool' } },
  coupon
);
```

### Direct Client Integration

```typescript
import { 
  createCoupon, 
  createRequestWithCoupon 
} from '@typescript-sdk/sdk/coupon';

// Create a coupon
const coupon = createCoupon(/* ... */);

// Create a request with the coupon attached
const request = createRequestWithCoupon(
  'tools/call',
  { 
    name: 'exampleTool',
    arguments: { param1: 'value1' } 
  },
  coupon
);

// Send the request using your transport
const response = await sendRequest(request);
```

## Server-Side Integration

### Server Class with Coupon Support

```typescript
import { Server } from '@typescript-sdk/sdk/server';

// Create a server with coupon support
const server = new Server(
  { name: 'ExampleServer', version: '1.0.0' },
  { enableCoupons: true }
);

// Configure server identity
server.configureCouponIdentity(
  {
    commonName: 'Example Server',
    organization: 'Example Corp',
    country: 'US'
  },
  serverCertificate,
  serverPrivateKey
);

// Set a callback for when coupons are processed
server.oncoupon = (coupon) => {
  console.log('Processed valid coupon:', coupon.id);
  console.log('From:', coupon.issuer.commonName);
  console.log('Purpose:', coupon.data?.purpose);
};

// Issue a coupon for a client
const coupon = await server.issueCoupon(
  {
    commonName: 'Client App',
    organization: 'Client Inc',
    country: 'CA'
  },
  { purpose: 'authentication', scope: ['read', 'write'] }
);

// Get all stored coupons
const allCoupons = await server.getAllCoupons();
```

### Express Server Integration

```typescript
import express from 'express';
import { Server } from '@typescript-sdk/sdk/server';
import { addCouponsEndpoint } from '@typescript-sdk/sdk/coupon';

// Create Express app
const app = express();

// Create MCP server
const mcpServer = new Server(
  { name: 'ExpressServer', version: '1.0.0' },
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

// Custom route that issues coupons
app.post('/api/issue-coupon', async (req, res) => {
  try {
    const { clientName, clientOrg, clientCountry } = req.body;
    
    // Create client DN from request
    const clientDN = {
      commonName: clientName,
      organization: clientOrg,
      country: clientCountry
    };
    
    // Issue a coupon
    const coupon = await mcpServer.issueCoupon(
      clientDN,
      { 
        purpose: 'api-access',
        requestInfo: {
          ip: req.ip,
          timestamp: new Date().toISOString()
        }
      }
    );
    
    res.json({ success: true, coupon });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Route that uses the coupon from a request
app.post('/api/secured', async (req, res) => {
  const request = {
    method: req.path,
    params: {
      ...req.body,
      _meta: {
        coupon: req.body._meta?.coupon
      }
    }
  };
  
  // Try to extract and verify the coupon
  const coupon = await mcpServer.extractAndVerifyCoupon(request);
  
  if (!coupon) {
    return res.status(401).json({
      success: false,
      error: 'Valid coupon required'
    });
  }
  
  // Coupon is valid, process the request
  res.json({
    success: true,
    message: 'Authenticated with coupon',
    couponId: coupon.id,
    issuer: coupon.issuer.commonName
  });
});

// Start server
app.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

## Advanced Use Cases

### Batch Coupon Creation

```typescript
import { createCouponBatch } from '@typescript-sdk/sdk/coupon';

// Define issuer
const issuer = { 
  commonName: 'Batch Issuer',
  organization: 'Batch Inc',
  country: 'US'
};

// Define multiple recipients
const recipients = [
  { commonName: 'Recipient 1', organization: 'Org 1', country: 'CA' },
  { commonName: 'Recipient 2', organization: 'Org 2', country: 'UK' },
  { commonName: 'Recipient 3', organization: 'Org 3', country: 'AU' }
];

// Create batch of coupons
const coupons = createCouponBatch(
  issuer,
  recipients,
  issuerCertificate,
  privateKey,
  { purpose: 'batch-example' }
);

// Store all coupons
await couponStorage.storeCoupons(coupons);
```

### Auto-Expiry Management

```typescript
import { couponStorage } from '@typescript-sdk/sdk/coupon';

// Function to clean up expired coupons
async function cleanupExpiredCoupons() {
  const count = await couponStorage.removeExpiredCoupons();
  console.log(`Removed ${count} expired coupons`);
}

// Run cleanup on server start
cleanupExpiredCoupons();

// Schedule periodic cleanup (e.g., daily)
setInterval(cleanupExpiredCoupons, 24 * 60 * 60 * 1000);
```

### Custom Export Processing

```typescript
import { exportCouponsToCallback } from '@typescript-sdk/sdk/coupon';

// Custom callback for processing each coupon
async function processCoupon(coupon) {
  // Example: Send to analytics service
  await analytics.trackCoupon({
    id: coupon.id,
    issuer: coupon.issuer.commonName,
    recipient: coupon.recipient.commonName,
    issuedAt: new Date(coupon.issuedAt),
    purpose: coupon.data?.purpose
  });
  
  // Example: Log to external system
  console.log(`Processed coupon ${coupon.id} from ${coupon.issuer.commonName}`);
}

// Export and process all coupons
const count = await exportCouponsToCallback(processCoupon);
console.log(`Processed ${count} coupons`);
```

### Registry Integration

```typescript
import express from 'express';
import { couponStorage, CouponFilter } from '@typescript-sdk/sdk/coupon';

const app = express();

// Expose coupon API for registries to scrape
app.get('/api/coupons', async (req, res) => {
  try {
    // Parse query params for filtering
    const filter: CouponFilter = {};
    
    if (req.query.issuer) {
      filter.issuerCommonName = req.query.issuer as string;
    }
    
    if (req.query.recipient) {
      filter.recipientCommonName = req.query.recipient as string;
    }
    
    if (req.query.since) {
      filter.issuedAfter = req.query.since as string;
    }
    
    if (req.query.until) {
      filter.issuedBefore = req.query.until as string;
    }
    
    if (req.query.id) {
      filter.id = req.query.id as string;
    }
    
    // Parse pagination params
    const page = parseInt(req.query.page as string || '1', 10);
    const limit = parseInt(req.query.limit as string || '50', 10);
    
    // Get paginated results
    const result = await couponStorage.getPaginatedCoupons(
      page,
      Math.min(limit, 100), // Limit maximum page size
      Object.keys(filter).length > 0 ? filter : undefined
    );
    
    // Return with pagination metadata
    res.json({
      coupons: result.coupons,
      pagination: {
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
        totalPages: result.totalPages,
        hasMore: result.page < result.totalPages
      }
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to retrieve coupons',
      message: error.message
    });
  }
});

app.listen(3000, () => {
  console.log('Registry API available at http://localhost:3000/api/coupons');
});
```

## Testing and Development

### Creating Test Certificates

```typescript
import { 
  generateKeyPair, 
  createCertificate 
} from 'crypto';
import { promisify } from 'util';

// Generate a key pair for testing
async function generateTestKeyPair() {
  const generateKeyPairAsync = promisify(generateKeyPair);
  
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
}

// Create a self-signed test certificate
async function createTestCertificate(dn, privateKey, publicKey) {
  // In a real implementation, you would use a proper X.509 library
  // This is simplified for testing purposes
  
  const certificate = {
    serialNumber: Math.floor(Math.random() * 1000000).toString(),
    issuer: dn,
    subject: dn,
    issuedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    subjectPublicKey: publicKey,
    publicKeyAlgorithm: 'RSA',
    keyUsage: ['digitalSignature', 'keyEncipherment'],
    signature: 'test-signature-value',
    signatureAlgorithm: 'SHA256withRSA',
    version: '3'
  };
  
  return certificate;
}

// Usage
async function setupTestEnvironment() {
  const dn = {
    commonName: 'Test Certificate',
    organization: 'Test Org',
    country: 'US'
  };
  
  const { privateKey, publicKey } = await generateTestKeyPair();
  const certificate = await createTestCertificate(dn, privateKey, publicKey);
  
  return {
    dn,
    privateKey,
    publicKey,
    certificate
  };
}
```

### Mock Server for Testing

```typescript
import express from 'express';
import bodyParser from 'body-parser';
import { createCoupon, verifyCoupon } from '@typescript-sdk/sdk/coupon';

// Create a mock server for testing coupon functionality
function createMockServer(port = 3000) {
  const app = express();
  app.use(bodyParser.json());
  
  // Store test data
  const testData = {
    coupons: new Map()
  };
  
  // Endpoint to issue a coupon
  app.post('/issue', (req, res) => {
    try {
      const { issuer, recipient, certificate, data } = req.body;
      
      // In a real implementation, you would verify the request
      // This is simplified for testing
      
      const coupon = createCoupon(
        issuer,
        recipient,
        certificate,
        process.env.TEST_PRIVATE_KEY,
        data
      );
      
      // Store the coupon
      testData.coupons.set(coupon.id, coupon);
      
      res.json({ success: true, coupon });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });
  
  // Endpoint to verify a coupon
  app.post('/verify', (req, res) => {
    try {
      const { coupon } = req.body;
      
      const isValid = verifyCoupon(coupon);
      
      res.json({
        success: true,
        valid: isValid
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });
  
  // Start the server
  const server = app.listen(port, () => {
    console.log(`Mock server running on port ${port}`);
  });
  
  // Helper function to stop the server
  const stop = () => {
    server.close();
  };
  
  return { app, server, stop, testData };
}

// Usage
const { app, stop, testData } = createMockServer();

// Later, when done testing
stop();
```