# Coupon System for MCP SDK

This module provides a system for creating, signing, verifying, and managing coupons in the MCP SDK.

## Overview

Coupons are verifiable tokens that prove the legitimacy of requests between clients and servers. They help establish trust and reputation in a decentralized system.

When a client makes a request to a server, the server issues a verifiable `Coupon`, which proves:
- The request occurred
- The issuer's identity
- The recipient's identity
- The legitimacy of the interaction

## Usage Examples

### Server-side (Creating coupons)

```typescript
import { Server } from '@modelcontextprotocol/sdk/server';
import { couponStorage } from '@modelcontextprotocol/sdk/coupon';

// Create a server with coupons enabled
const server = new Server({
  name: 'MyServer',
  version: '1.0.0',
  enableCoupons: true
});

// Configure the server's identity for coupon issuance
server.configureCouponIdentity(
  {
    commonName: 'Example Server',
    organization: 'Example Org',
    country: 'US'
  },
  myServerCertificate,
  myServerPrivateKey
);

// Set up a coupon callback
server.oncoupon = (coupon) => {
  console.log('Received coupon:', coupon.id);
};

// Issue a coupon for a client
const coupon = await server.issueCoupon(
  {
    commonName: 'Example Client',
    organization: 'Client Org',
    country: 'CA'
  },
  { purpose: 'example-tool-call' }
);

// Get all stored coupons
const allCoupons = await server.getAllCoupons();
```

### Exposing coupons via endpoints

```typescript
import express from 'express';
import { addCouponsEndpoint } from '@modelcontextprotocol/sdk/coupon';

const app = express();

// Add a /coupons endpoint to your Express app
addCouponsEndpoint(app);

// Start the server
app.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

### Client-side (Attaching coupons to requests)

```typescript
import { Client } from '@modelcontextprotocol/sdk/client';

// Create a client with coupons enabled
const client = new Client(
  {
    name: 'MyClient',
    version: '1.0.0'
  },
  {
    enableCoupons: true,
    clientDN: {
      commonName: 'Example Client',
      organization: 'Client Org',
      country: 'CA'
    },
    clientCertificate: myClientCertificate,
    clientPrivateKey: myClientPrivateKey
  }
);

// Create a coupon for a specific server
const coupon = client.createCoupon(
  {
    commonName: 'Example Server',
    organization: 'Server Org',
    country: 'US'
  },
  { purpose: 'example-tool-call' }
);

// Set a default coupon for all requests
client.setDefaultCoupon(coupon);

// Enable automatic coupon attachment
client.enableAutomaticCouponAttachment();

// Make a request (will automatically attach the default coupon)
const result = await client.callTool({
  name: 'exampleTool',
  arguments: { param1: 'value1' }
});

// Manually attach a coupon to a request
const request = client.attachCouponToRequest(
  { method: 'tools/call', params: { name: 'exampleTool' } },
  coupon
);
```

## Certificate Generation (for testing)

For testing purposes, you can generate self-signed certificates using OpenSSL:

```bash
# Generate a private key
openssl genrsa -out private.key 2048

# Generate a self-signed certificate
openssl req -new -x509 -key private.key -out cert.pem -days 365
```

## Storing Coupons

The SDK provides multiple storage options:

```typescript
import { couponStorage, FileCouponStorage } from '@modelcontextprotocol/sdk/coupon';

// Use the default in-memory storage
couponStorage.storeCoupon(coupon);

// Or create a file-based storage
const fileStorage = new FileCouponStorage('./coupons.json');
await fileStorage.initialize();
await fileStorage.storeCoupon(coupon);
```

## Exporting Coupons

```typescript
import { exportCouponsToJsonFile } from '@modelcontextprotocol/sdk/coupon';

// Export all coupons to a file
await exportCouponsToJsonFile('./exported-coupons.json');

// Export filtered coupons
await exportCouponsToJsonFile('./filtered-coupons.json', {
  issuerCommonName: 'Example Issuer',
  issuedAfter: '2023-01-01T00:00:00Z'
});
```