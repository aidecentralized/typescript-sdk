/**
 * Functions for creating coupons.
 */

import { v4 as uuidv4 } from 'uuid';
import { Coupon, CouponInput, DistinguishedName, Certificate } from '../types/coupon.js';
import { signCoupon } from './sign.js';
import { LATEST_PROTOCOL_VERSION } from '../types.js';

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
export function createCoupon(
  issuer: DistinguishedName,
  recipient: DistinguishedName,
  issuerCertificate: Certificate,
  privateKeyPem: string,
  data: Record<string, any> = {},
  expiresAt?: string
): Coupon {
  const now = new Date().toISOString();
  
  const baseCoupon = {
    id: uuidv4(),
    issuer,
    recipient,
    issuedAt: now,
    issuerCertificate,
    protocolVersion: LATEST_PROTOCOL_VERSION,
    data,
    ...(expiresAt ? { expiresAt } : {})
  };
  
  return signCoupon(baseCoupon, privateKeyPem);
}

/**
 * Creates a new coupon from a structured input object.
 * 
 * @param input - The input parameters
 * @param privateKeyPem - The private key for signing (in PEM format)
 * @returns A fully formed and signed coupon
 */
export function createCouponFromInput(
  input: CouponInput,
  privateKeyPem: string
): Coupon {
  return createCoupon(
    input.issuer,
    input.recipient,
    input.issuerCertificate,
    privateKeyPem,
    input.data,
    input.expiresAt
  );
}

/**
 * Generates a batch of coupons with the same issuer and private key but different recipients.
 * 
 * @param issuer - The issuer's distinguished name
 * @param recipients - An array of recipient distinguished names
 * @param issuerCertificate - The issuer's certificate
 * @param privateKeyPem - The private key for signing (in PEM format)
 * @param data - Optional additional data to include for all coupons
 * @param expiresAt - Optional expiration date/time for all coupons
 * @returns An array of fully formed and signed coupons
 */
export function createCouponBatch(
  issuer: DistinguishedName,
  recipients: DistinguishedName[],
  issuerCertificate: Certificate,
  privateKeyPem: string,
  data: Record<string, any> = {},
  expiresAt?: string
): Coupon[] {
  return recipients.map(recipient => 
    createCoupon(issuer, recipient, issuerCertificate, privateKeyPem, data, expiresAt)
  );
}