/**
 * Server-side utilities for handling and issuing coupons.
 */

import { Coupon, DistinguishedName, Certificate } from '../types/coupon.js';
import { createCoupon } from './create.js';
import { verifyCoupon } from './sign.js';
import couponStorage from './storage/index.js';

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
): Promise<Coupon | undefined> {
  // Extract the coupon if present
  const coupon = request.params?._meta?.coupon;
  
  // No coupon found
  if (!coupon) {
    return undefined;
  }
  
  // Verify the coupon
  const isValid = verifyCoupon(coupon);
  
  // Check if it's expired
  const isExpired = coupon.expiresAt && 
    new Date(coupon.expiresAt).getTime() < Date.now();
  
  // Return the coupon if it's valid and not expired
  return (isValid && !isExpired) ? coupon : undefined;
}

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
): Promise<Coupon> {
  // Calculate expiry date if requested
  const expiresAt = expiryDays 
    ? new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toISOString()
    : undefined;
  
  // Create the coupon
  const coupon = createCoupon(
    serverDN,
    clientDN,
    serverCertificate,
    privateKeyPem,
    requestData,
    expiresAt
  );
  
  // Store the coupon
  await couponStorage.storeCoupon(coupon);
  
  return coupon;
}

/**
 * Create an HTTP response handler for the /coupons endpoint.
 * 
 * @param req - The HTTP request object
 * @param res - The HTTP response object
 */
export async function couponsEndpointHandler(
  req: any,
  res: any
): Promise<void> {
  try {
    // Parse query parameters for filtering
    const filter = {
      issuerCommonName: req.query.issuer,
      recipientCommonName: req.query.recipient,
      issuedAfter: req.query.since,
      issuedBefore: req.query.until,
      id: req.query.id
    };
    
    // Parse pagination parameters
    const page = parseInt(req.query.page || '1', 10);
    const pageSize = parseInt(req.query.limit || '20', 10);
    
    // Handle pagination if requested
    if (req.query.page || req.query.limit) {
      const paginatedResult = await couponStorage.getPaginatedCoupons(
        page,
        pageSize,
        Object.values(filter).some(v => v) ? filter : undefined
      );
      
      res.json({
        data: paginatedResult.coupons,
        pagination: {
          page: paginatedResult.page,
          pageSize: paginatedResult.pageSize,
          total: paginatedResult.total,
          totalPages: paginatedResult.totalPages
        }
      });
      return;
    }
    
    // For simple requests without pagination
    const coupons = Object.values(filter).some(v => v)
      ? await couponStorage.filterCoupons(filter)
      : await couponStorage.getAllCoupons();
    
    res.json(coupons);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to retrieve coupons',
      message: (error as Error).message
    });
  }
}

/**
 * Add the coupons endpoint to an Express app.
 * 
 * @param app - The Express app
 * @param path - The path for the endpoint (default: '/coupons')
 */
export function addCouponsEndpoint(
  app: any,
  path: string = '/coupons'
): void {
  app.get(path, couponsEndpointHandler);
}