import express from 'express';
import bodyParser from 'body-parser';
import { Server } from '../../../src/server/index.js';
import { Coupon, DistinguishedName, Certificate } from '../../../src/types/coupon.js';
import { addCouponsEndpoint, extractAndVerifyCoupon } from '../../../src/coupon/server.js';
import { setupTestEnvironment } from '../shared/generate-certificates.js';
import { couponStorage } from '../../../src/coupon/storage/index.js';
import cors from 'cors';

/**
 * Creates an MCP server with coupon validation
 */
export async function createMCPServer(port = 3000): Promise<{ 
  start: () => void; 
  stop: () => void;
  serverDN: DistinguishedName;
  serverCertificate: Certificate;
  serverPrivateKey: string;
}> {
  // Generate server identity
  const { dn: serverDN, certificate: serverCertificate, privateKey: serverPrivateKey } = 
    await setupTestEnvironment('MCP Server', 'MCP Example Org', 'US');

  // Create Express app
  const app = express();
  app.use(cors());
  app.use(bodyParser.json());

  // Create MCP server with coupons enabled
  const mcpServer = new Server(
    { name: 'MCPCouponServer', version: '1.0.0' },
    { enableCoupons: true }
  );

  // Configure server's coupon identity
  mcpServer.configureCouponIdentity(
    serverDN,
    serverCertificate,
    serverPrivateKey
  );

  // Set up coupon callback
  mcpServer.oncoupon = (coupon: Coupon) => {
    console.log('✅ Received valid coupon:', coupon.id);
    console.log('   From:', coupon.issuer.commonName);
    console.log('   Purpose:', coupon.data?.purpose);
    return true;
  };

  // Add the /coupons endpoint
  addCouponsEndpoint(app);

  // Endpoint to issue coupons
  app.post('/api/issue-coupon', async (req, res) => {
    try {
      const { clientName, clientOrg, clientCountry, purpose } = req.body;
      
      // Create client distinguished name from request
      const clientDN: DistinguishedName = {
        commonName: clientName || 'Unknown Client',
        organization: clientOrg || 'Unknown Org',
        country: clientCountry || 'US'
      };
      
      // Issue a coupon
      const coupon = await mcpServer.issueCoupon(
        clientDN,
        { 
          purpose: purpose || 'api-access',
          requestInfo: {
            ip: req.ip,
            timestamp: new Date().toISOString()
          }
        }
      );
      
      res.json({ success: true, coupon });
    } catch (error) {
      console.error('Error issuing coupon:', error);
      res.status(500).json({ 
        success: false, 
        error: (error as Error).message 
      });
    }
  });

  // Endpoint that validates coupons
  app.post('/api/validate-coupon', async (req, res) => {
    try {
      const request = {
        method: req.path,
        params: {
          ...req.body,
          _meta: req.body._meta
        }
      };
      
      // Extract and verify the coupon
      const coupon = await extractAndVerifyCoupon(request);
      
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
        issuer: coupon.issuer.commonName,
        data: coupon.data
      });
    } catch (error) {
      console.error('Error validating coupon:', error);
      res.status(500).json({
        success: false,
        error: (error as Error).message
      });
    }
  });

  // Endpoint to get all stored coupons
  app.get('/api/coupons', async (req, res) => {
    try {
      const allCoupons = await couponStorage.getAllCoupons();
      res.json({
        success: true,
        count: allCoupons.length,
        coupons: allCoupons
      });
    } catch (error) {
      console.error('Error retrieving coupons:', error);
      res.status(500).json({
        success: false,
        error: (error as Error).message
      });
    }
  });

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({ status: 'healthy' });
  });

  // Create server object
  let server: any;

  // Start function
  const start = () => {
    server = app.listen(port, () => {
      console.log(`MCP Server with coupon validation running on port ${port}`);
      console.log(`Health check: http://localhost:${port}/health`);
      console.log(`Coupons endpoint: http://localhost:${port}/coupons`);
    });
  };

  // Stop function
  const stop = () => {
    if (server) {
      server.close();
      console.log('MCP Server stopped');
    }
  };

  return { 
    start, 
    stop,
    serverDN,
    serverCertificate,
    serverPrivateKey
  };
}