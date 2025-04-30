/**
 * Client-side utilities for attaching coupons to requests.
 */

import { Coupon, DistinguishedName, Certificate } from '../types/coupon.js';
import { createCoupon } from './create.js';

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
} {
  // Create a copy of the params to avoid modifying the original
  const paramsCopy = { ...params };
  
  // Add the coupon to the _meta field
  return {
    method,
    params: {
      ...paramsCopy,
      _meta: {
        ...(paramsCopy._meta || {}),
        coupon
      }
    }
  };
}

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
} {
  // Create a new coupon
  const coupon = createCoupon(
    issuer,
    recipient,
    issuerCertificate,
    privateKeyPem,
    data
  );
  
  // Create the request with the coupon attached
  return createRequestWithCoupon(method, params, coupon);
}

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
): Coupon | undefined {
  return request.params?._meta?.coupon;
}