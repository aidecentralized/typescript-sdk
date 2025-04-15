import { Client } from '../../../src/client/index.js';
import { createRequestWithCoupon } from '../../../src/coupon/client.js';
import { createCoupon } from '../../../src/coupon/create.js';
import { Coupon, DistinguishedName, Certificate } from '../../../src/types/coupon.js';
import { setupTestEnvironment } from '../shared/generate-certificates.js';
import axios from 'axios';

/**
 * Creates an MCP client with coupon support
 */
export async function createMCPClient(
  serverBaseUrl: string,
  serverDN: DistinguishedName,
  serverCertificate: Certificate
): Promise<{
  makeSecureRequest: (data: any, purpose?: string) => Promise<any>;
  requestCoupon: (purpose?: string) => Promise<Coupon>;
  clientDN: DistinguishedName;
  clientCertificate: Certificate;
  clientPrivateKey: string;
}> {
  // Generate client identity
  const { dn: clientDN, certificate: clientCertificate, privateKey: clientPrivateKey } = 
    await setupTestEnvironment('MCP Client', 'MCP Client Org', 'US');

  // Create MCP client with coupons enabled
  const mcpClient = new Client(
    { name: 'MCPCouponClient', version: '1.0.0' },
    {
      enableCoupons: true,
      clientDN,
      clientCertificate,
      clientPrivateKey
    }
  );
  
  /**
   * Request a coupon from the server
   */
  const requestCoupon = async (purpose = 'api-access'): Promise<Coupon> => {
    try {
      const response = await axios.post(`${serverBaseUrl}/api/issue-coupon`, {
        clientName: clientDN.commonName,
        clientOrg: clientDN.organization,
        clientCountry: clientDN.country,
        purpose
      });
      
      if (response.data && response.data.success && response.data.coupon) {
        console.log(`✅ Received coupon: ${response.data.coupon.id}`);
        return response.data.coupon;
      } else {
        throw new Error('Failed to get coupon from server');
      }
    } catch (error) {
      console.error('Error requesting coupon:', error);
      throw error;
    }
  };

  /**
   * Create a coupon directly (without server)
   */
  const createClientCoupon = (purpose = 'api-access'): Coupon => {
    try {
      return createCoupon(
        clientDN,
        serverDN,
        clientCertificate,
        clientPrivateKey,
        { purpose },
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
      );
    } catch (error) {
      console.error('Error creating coupon:', error);
      throw error;
    }
  };

  /**
   * Make a request with a coupon attached
   */
  const makeSecureRequest = async (data: any, purpose = 'api-access'): Promise<any> => {
    try {
      // Get a coupon for this request
      const coupon = createClientCoupon(purpose);
      
      // Create a request with the coupon
      const request = createRequestWithCoupon('validate-request', data, coupon);
      
      // Send the request
      const response = await axios.post(`${serverBaseUrl}/api/validate-coupon`, request.params);
      
      return response.data;
    } catch (error) {
      console.error('Error making secure request:', error);
      throw error;
    }
  };

  return {
    makeSecureRequest,
    requestCoupon,
    clientDN,
    clientCertificate,
    clientPrivateKey
  };
}