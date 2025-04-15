import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import { couponStorage } from './storage.js';
import { createCoupon, extractAndVerifyCoupon } from './coupon.js';
import { DistinguishedName, Certificate, Coupon } from './types.js';
import { createIdentity } from './cert.js';

/**
 * Create a coupon server
 */
export async function createServer(port: number = 3000) {
  // Generate server identity
  console.log('Generating server identity...');
  const server = await createIdentity('Coupon Server', 'Example Org', 'US');
  
  // Create Express app
  const app = express();
  app.use(cors());
  app.use(bodyParser.json());
  
  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({ status: 'healthy', serverName: server.dn.commonName });
  });
  
  // Endpoint to get server identity
  app.get('/identity', (req, res) => {
    res.json({ 
      dn: server.dn,
      certificate: server.certificate
    });
  });
  
  // Endpoint to issue a coupon
  app.post('/issue-coupon', async (req, res) => {
    try {
      const { clientName, clientOrg, clientCountry, purpose } = req.body;
      
      // Create client identity
      const clientDN: DistinguishedName = {
        commonName: clientName || 'Unknown Client',
        organization: clientOrg || 'Unknown Org',
        country: clientCountry || 'US'
      };
      
      // Create expiry time (30 days from now)
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + 30);
      
      // Create coupon
      const coupon = createCoupon(
        server.dn,
        clientDN,
        server.certificate,
        server.privateKey,
        { purpose: purpose || 'api-access' },
        expiryDate.toISOString()
      );
      
      // Store the coupon
      await couponStorage.storeCoupon(coupon);
      
      res.json({ success: true, coupon });
    } catch (error) {
      console.error('Error issuing coupon:', error);
      res.status(500).json({ 
        success: false, 
        error: (error as Error).message 
      });
    }
  });
  
  // Endpoint to validate a coupon
  app.post('/validate-coupon', async (req, res) => {
    try {
      const request = {
        method: req.path,
        params: req.body
      };
      
      // Extract and verify the coupon
      const coupon = extractAndVerifyCoupon(request, true);
      
      if (!coupon) {
        return res.status(401).json({
          success: false,
          error: 'Valid coupon required'
        });
      }
      
      // Store the coupon if it's valid
      await couponStorage.storeCoupon(coupon);
      
      // Coupon is valid, return success response
      res.json({
        success: true,
        message: 'Coupon validated successfully',
        couponId: coupon.id,
        issuer: coupon.issuer.commonName,
        recipient: coupon.recipient.commonName,
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
  
  // Endpoint to get all coupons
  app.get('/coupons', async (req, res) => {
    try {
      // Parse query parameters for filtering
      const filter = {
        issuerCommonName: req.query.issuer as string,
        recipientCommonName: req.query.recipient as string,
        issuedAfter: req.query.since as string,
        issuedBefore: req.query.until as string,
        id: req.query.id as string
      };
      
      // If any filter is provided, use filtered query
      const coupons = Object.values(filter).some(v => v)
        ? await couponStorage.filterCoupons(filter)
        : await couponStorage.getAllCoupons();
      
      res.json({
        success: true,
        count: coupons.length,
        coupons
      });
    } catch (error) {
      console.error('Error retrieving coupons:', error);
      res.status(500).json({
        success: false,
        error: (error as Error).message
      });
    }
  });
  
  // Start the server
  const server_instance = app.listen(port, () => {
    console.log(`Coupon server running on port ${port}`);
    console.log(`Server identity: ${server.dn.commonName} (${server.dn.organization}, ${server.dn.country})`);
    console.log(`Health check: http://localhost:${port}/health`);
    console.log(`Coupons endpoint: http://localhost:${port}/coupons`);
  });
  
  return {
    server_instance,
    serverIdentity: server,
    
    // Clean shutdown method
    stop: () => {
      server_instance.close();
      console.log('Server stopped');
    }
  };
}