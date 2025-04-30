import axios from 'axios';
import { Coupon, DistinguishedName, Certificate } from './types.js';
import { createCoupon, createRequestWithCoupon } from './coupon.js';
import { createIdentity } from './cert.js';

/**
 * Create a coupon client
 */
export async function createClient(serverUrl: string) {
  // Generate client identity
  console.log('Generating client identity...');
  const client = await createIdentity('Coupon Client', 'Example Client Org', 'US');
  
  // Server identity (to be fetched from server)
  let serverDN: DistinguishedName = { commonName: 'Unknown Server' };
  let serverCertificate: Certificate | null = null;
  
  /**
   * Fetch server identity
   */
  const fetchServerIdentity = async (): Promise<{
    dn: DistinguishedName;
    certificate: Certificate;
  }> => {
    try {
      const response = await axios.get(`${serverUrl}/identity`);
      serverDN = response.data.dn;
      serverCertificate = response.data.certificate;
      return response.data;
    } catch (error) {
      console.error('Error fetching server identity:', error);
      throw error;
    }
  };
  
  /**
   * Request a coupon from the server
   */
  const requestCoupon = async (purpose = 'api-access'): Promise<Coupon> => {
    try {
      const response = await axios.post(`${serverUrl}/issue-coupon`, {
        clientName: client.dn.commonName,
        clientOrg: client.dn.organization,
        clientCountry: client.dn.country,
        purpose
      });
      
      if (response.data && response.data.success && response.data.coupon) {
        console.log(`Received coupon: ${response.data.coupon.id}`);
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
   * Create a coupon without server interaction
   */
  const createClientCoupon = (serverIdentity: { dn: DistinguishedName; certificate: Certificate }, purpose = 'api-access'): Coupon => {
    // Create expiry time (30 days from now)
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 30);
    
    // Create the coupon
    return createCoupon(
      client.dn,
      serverIdentity.dn,
      client.certificate,
      client.privateKey,
      { purpose },
      expiryDate.toISOString()
    );
  };
  
  /**
   * Make a secure request with a coupon attached
   */
  const makeSecureRequest = async (data: any, purpose = 'api-access'): Promise<any> => {
    // Make sure we have server identity
    if (!serverDN || !serverCertificate) {
      const identity = await fetchServerIdentity();
      serverDN = identity.dn;
      serverCertificate = identity.certificate;
    }
    
    // Create a coupon
    const coupon = createClientCoupon({ dn: serverDN, certificate: serverCertificate }, purpose);
    
    // Create a request with the coupon
    const request = createRequestWithCoupon('validate', data, coupon);
    
    // Send the request
    try {
      const response = await axios.post(`${serverUrl}/validate-coupon`, request.params);
      return response.data;
    } catch (error) {
      console.error('Error making secure request:', error);
      throw error;
    }
  };
  
  /**
   * Get all coupons from the server
   */
  const getAllCoupons = async (): Promise<Coupon[]> => {
    try {
      const response = await axios.get(`${serverUrl}/coupons`);
      return response.data.coupons;
    } catch (error) {
      console.error('Error fetching coupons:', error);
      throw error;
    }
  };
  
  // Initialize by fetching server identity
  try {
    await fetchServerIdentity();
    console.log(`Connected to server: ${serverDN.commonName}`);
  } catch (error) {
    console.error('Failed to connect to server:', error);
  }
  
  return {
    clientIdentity: client,
    serverIdentity: { dn: serverDN, certificate: serverCertificate },
    requestCoupon,
    makeSecureRequest,
    getAllCoupons
  };
}