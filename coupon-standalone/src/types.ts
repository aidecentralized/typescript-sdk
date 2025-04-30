/**
 * Types for the coupon system
 */

export interface DistinguishedName {
  commonName: string;
  organization?: string;
  organizationalUnit?: string;
  locality?: string;
  state?: string;
  country?: string;
  emailAddress?: string;
}

export interface Certificate {
  serialNumber: string;
  issuer: DistinguishedName;
  subject: DistinguishedName;
  issuedAt: string;
  expiresAt: string;
  subjectPublicKey: string;
  publicKeyAlgorithm: string;
  keyUsage: string[];
  extendedKeyUsage?: string[];
  crlDistributionPoint?: string;
  ocspUrl?: string;
  signature: string;
  signatureAlgorithm: string;
  version: string;
}

export interface Coupon {
  id: string;
  issuer: DistinguishedName;
  recipient: DistinguishedName;
  issuedAt: string;
  expiresAt?: string;
  issuerCertificate: Certificate;
  protocolVersion: string;
  data?: Record<string, any>;
  signature: string;
  signatureAlgorithm: string;
  canonicalizationMethod: string;
}

export interface CouponStorage {
  storeCoupon(coupon: Coupon): Promise<string>;
  getCoupon(id: string): Promise<Coupon | undefined>;
  getAllCoupons(): Promise<Coupon[]>;
  filterCoupons(filter: CouponFilter): Promise<Coupon[]>;
}

export interface CouponFilter {
  issuerCommonName?: string;
  recipientCommonName?: string;
  issuedAfter?: string;
  issuedBefore?: string;
  id?: string;
}