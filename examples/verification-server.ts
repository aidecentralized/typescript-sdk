/**
 * Verification Server
 * A microservice for verifying coupons and maintaining reputation data.
 * Provides HTTP API endpoints for coupon verification and reputation tracking.
 */
import express from 'express';
import fetch from 'node-fetch';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import { Request, Response } from 'express';

// Import types
import { Coupon, CouponVerificationResult } from '../src/types/coupon.js';

// Import verification functions from the SDK
// In a production environment, you would import from the built SDK:
// import { verifyComprehensive, isCouponExpired, isIssuerTrusted } from '@modelcontextprotocol/sdk/coupon';
const { verifyComprehensive } = await import('../src/coupon/verify.js');

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create an Express app
const app = express();
app.use(express.json());

/**
 * Trusted issuer registry
 * In a production system, this would be stored in a database.
 */
const trustedIssuers = new Set([
  'Example Server',
  'Example Client'
]);

/**
 * Store for verification results
 * Maps coupon IDs to verification results with timestamps.
 */
const verificationResults = new Map<string, VerificationResultWithTimestamp>();

/**
 * Store for reputation data
 * Maps entity common names to their reputation data.
 */
const reputationStore = new Map<string, ReputationData>();

/**
 * Verification result with added timestamp information.
 */
interface VerificationResultWithTimestamp extends CouponVerificationResult {
  verifiedAt: string;
}

/**
 * Reputation data for an entity.
 */
interface ReputationData {
  entityName: string;
  totalCoupons: number;
  verifiedCoupons: number;
  unverifiedCoupons: number;
  trustScore: string;
  lastUpdated: string;
}

// Add CORS headers to allow cross-origin requests
app.use((req: Request, res: Response, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

/**
 * Endpoint to verify a coupon directly.
 * Accepts a coupon object and returns detailed verification results.
 */
app.post('/verify', async (req: Request, res: Response) => {
  try {
    const coupon = req.body as Coupon;
    
    if (!coupon || !coupon.id) {
      return res.status(400).json({
        success: false,
        error: 'Invalid coupon data. Please provide a valid coupon object.'
      });
    }
    
    console.log(`Received verification request for coupon ${coupon.id}`);
    
    // Verify the coupon using the SDK's verification function
    // Pass our trusted issuers as a parameter
    const result = verifyComprehensive(coupon, {
      checkExpiry: true,
      verifySignature: true,
      validateFormat: true,
      checkTrustedIssuer: true,
      trustedIssuers
    });
    
    // Store the result
    verificationResults.set(coupon.id, {
      ...result,
      verifiedAt: new Date().toISOString()
    });
    
    // Update reputation data for the issuer
    updateReputation(result);
    
    return res.json({
      success: true,
      verification: result
    });
  } catch (error) {
    console.error('Verification error:', error);
    return res.status(500).json({
      success: false,
      error: `Verification failed: ${(error as Error).message}`
    });
  }
});

/**
 * Endpoint to fetch and verify coupons from a server.
 * Fetches coupons from a specified server and verifies them in batch.
 */
app.post('/fetch-and-verify', async (req: Request, res: Response) => {
  try {
    const { serverUrl } = req.body as { serverUrl?: string };
    
    if (!serverUrl) {
      return res.status(400).json({
        success: false,
        error: 'Server URL is required'
      });
    }
    
    console.log(`Fetching coupons from ${serverUrl}/coupons`);
    
    // Fetch coupons from the server
    const couponsResponse = await fetch(`${serverUrl}/coupons`);
    
    if (!couponsResponse.ok) {
      return res.status(502).json({
        success: false,
        error: `Failed to fetch coupons: ${couponsResponse.statusText}`
      });
    }
    
    const coupons = await couponsResponse.json() as Coupon[];
    
    if (!Array.isArray(coupons)) {
      return res.status(502).json({
        success: false,
        error: 'Invalid response from coupon server. Expected an array of coupons.'
      });
    }
    
    console.log(`Fetched ${coupons.length} coupons`);
    
    // Verify each coupon using the SDK's verification function
    const verificationPromises = coupons.map(coupon => 
      verifyComprehensive(coupon, {
        checkExpiry: true,
        verifySignature: true,
        validateFormat: true,
        checkTrustedIssuer: true,
        trustedIssuers
      })
    );
    
    const results = await Promise.all(verificationPromises);
    
    // Store the results
    for (const result of results) {
      verificationResults.set(result.id, {
        ...result,
        verifiedAt: new Date().toISOString()
      });
      
      // Update reputation data
      updateReputation(result);
    }
    
    // Count the results
    const summary = {
      total: coupons.length,
      verified: results.filter(r => r.verified).length,
      failed: results.filter(r => !r.verified).length
    };
    
    return res.json({
      success: true,
      summary,
      verifications: results
    });
  } catch (error) {
    console.error('Fetch and verify error:', error);
    return res.status(500).json({
      success: false,
      error: `Operation failed: ${(error as Error).message}`
    });
  }
});

/**
 * Endpoint to add a trusted issuer.
 */
app.post('/trusted-issuers', (req: Request, res: Response) => {
  const { commonName } = req.body as { commonName?: string };
  
  if (!commonName) {
    return res.status(400).json({
      success: false,
      error: 'Common name is required'
    });
  }
  
  trustedIssuers.add(commonName);
  
  res.json({
    success: true,
    message: `Added '${commonName}' to trusted issuers`,
    trustedIssuers: Array.from(trustedIssuers)
  });
});

/**
 * Endpoint to remove a trusted issuer.
 */
app.delete('/trusted-issuers/:commonName', (req: Request, res: Response) => {
  const { commonName } = req.params;
  
  if (trustedIssuers.has(commonName)) {
    trustedIssuers.delete(commonName);
    res.json({
      success: true,
      message: `Removed '${commonName}' from trusted issuers`,
      trustedIssuers: Array.from(trustedIssuers)
    });
  } else {
    res.status(404).json({
      success: false,
      error: `Issuer '${commonName}' not found in trusted issuers`
    });
  }
});

/**
 * Endpoint to get all trusted issuers.
 */
app.get('/trusted-issuers', (req: Request, res: Response) => {
  res.json({
    success: true,
    trustedIssuers: Array.from(trustedIssuers)
  });
});

/**
 * Endpoint to get all verification results.
 */
app.get('/verification-results', (req: Request, res: Response) => {
  // Convert the map to an array for the response
  const results = Array.from(verificationResults.values());
  
  res.json({
    success: true,
    count: results.length,
    results
  });
});

/**
 * Endpoint to get a specific verification result.
 */
app.get('/verification-results/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const result = verificationResults.get(id);
  
  if (!result) {
    return res.status(404).json({
      success: false,
      error: `No verification result found for coupon ID: ${id}`
    });
  }
  
  res.json({
    success: true,
    result
  });
});

/**
 * Updates reputation data based on a verification result.
 * Updates both issuer and recipient reputation metrics.
 * 
 * @param result - The verification result to process
 */
function updateReputation(result: CouponVerificationResult): void {
  // Update issuer reputation
  updateEntityReputation(result.issuer, result.verified);
  
  // Update recipient reputation
  updateEntityReputation(result.recipient, result.verified);
}

/**
 * Updates reputation data for a single entity.
 * Creates new reputation entries for entities not seen before.
 * 
 * @param commonName - The entity's common name
 * @param verified - Whether the verification was successful
 */
function updateEntityReputation(commonName: string, verified: boolean): void {
  const reputation = reputationStore.get(commonName) || {
    entityName: commonName,
    totalCoupons: 0,
    verifiedCoupons: 0,
    unverifiedCoupons: 0,
    trustScore: '0',
    lastUpdated: new Date().toISOString()
  };
  
  reputation.totalCoupons++;
  if (verified) {
    reputation.verifiedCoupons++;
  } else {
    reputation.unverifiedCoupons++;
  }
  
  reputation.trustScore = (reputation.verifiedCoupons / reputation.totalCoupons * 100).toFixed(2);
  reputation.lastUpdated = new Date().toISOString();
  
  reputationStore.set(commonName, reputation);
}

/**
 * Endpoint to get reputation data for an entity.
 */
app.get('/reputation/:commonName', (req: Request, res: Response) => {
  const { commonName } = req.params;
  const reputation = reputationStore.get(commonName);
  
  if (!reputation) {
    return res.status(404).json({
      success: false,
      error: `No reputation data found for entity: ${commonName}`
    });
  }
  
  res.json({
    success: true,
    reputation
  });
});

/**
 * Endpoint to get all reputation data.
 */
app.get('/reputation', (req: Request, res: Response) => {
  const allReputations = Array.from(reputationStore.values());
  
  res.json({
    success: true,
    count: allReputations.length,
    reputations: allReputations
  });
});

/**
 * Root endpoint with usage information.
 */
app.get('/', (req: Request, res: Response) => {
  res.json({
    name: "Coupon Verification Service",
    description: "A microservice for verifying MCP coupons",
    endpoints: [
      { method: "POST", path: "/verify", description: "Verify a single coupon" },
      { method: "POST", path: "/fetch-and-verify", description: "Fetch and verify coupons from a server" },
      { method: "GET", path: "/verification-results", description: "Get all verification results" },
      { method: "GET", path: "/verification-results/:id", description: "Get verification result for a specific coupon" },
      { method: "GET", path: "/reputation/:commonName", description: "Get reputation data for an entity" },
      { method: "GET", path: "/reputation", description: "Get all reputation data" },
      { method: "GET", path: "/trusted-issuers", description: "Get all trusted issuers" },
      { method: "POST", path: "/trusted-issuers", description: "Add a trusted issuer" },
      { method: "DELETE", path: "/trusted-issuers/:commonName", description: "Remove a trusted issuer" }
    ],
    version: "1.0.0"
  });
});

// Start the server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Verification server running on port ${PORT}`);
  console.log(`
Available endpoints:
  - POST /verify - Verify a single coupon
  - POST /fetch-and-verify - Fetch and verify coupons from a server
  - GET /verification-results - Get all verification results
  - GET /verification-results/:id - Get verification result for a specific coupon
  - GET /reputation/:commonName - Get reputation data for an entity
  - GET /reputation - Get all reputation data
  - GET /trusted-issuers - Get all trusted issuers
  - POST /trusted-issuers - Add a trusted issuer
  - DELETE /trusted-issuers/:commonName - Remove a trusted issuer
  `);
});