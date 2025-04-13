/**
 * Zod schemas for coupon types.
 */

import { z } from 'zod';

/**
 * Schema for X.500 Distinguished Name structure.
 */
export const DistinguishedNameSchema = z.object({
  commonName: z.string(),
  organization: z.string().optional(),
  organizationalUnit: z.string().optional(),
  locality: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  emailAddress: z.string().optional()
});

/**
 * Schema for Certificate.
 */
export const CertificateSchema = z.object({
  serialNumber: z.string(),
  issuer: DistinguishedNameSchema,
  subject: DistinguishedNameSchema,
  issuedAt: z.string().datetime({ offset: true }),
  expiresAt: z.string().datetime({ offset: true }),
  subjectPublicKey: z.string(),
  publicKeyAlgorithm: z.string(),
  keyUsage: z.array(z.string()),
  extendedKeyUsage: z.array(z.string()).optional(),
  crlDistributionPoint: z.string().optional(),
  ocspUrl: z.string().optional(),
  signature: z.string(),
  signatureAlgorithm: z.string(),
  version: z.string()
});

/**
 * Schema for Coupon.
 */
export const CouponSchema = z.object({
  id: z.string(),
  issuer: DistinguishedNameSchema,
  recipient: DistinguishedNameSchema,
  issuedAt: z.string().datetime({ offset: true }),
  expiresAt: z.string().datetime({ offset: true }).optional(),
  issuerCertificate: CertificateSchema,
  protocolVersion: z.string(),
  data: z.record(z.any()).optional(),
  signature: z.string(),
  signatureAlgorithm: z.string(),
  canonicalizationMethod: z.string()
});

/**
 * Schema for Certificate Chain.
 */
export const CertificateChainSchema = z.object({
  endEntityCertificate: CertificateSchema,
  intermediateCertificates: z.array(CertificateSchema),
  rootCertificate: CertificateSchema.optional()
});

/**
 * Schema for Coupon Input.
 */
export const CouponInputSchema = z.object({
  issuer: DistinguishedNameSchema,
  recipient: DistinguishedNameSchema,
  issuerCertificate: CertificateSchema,
  expiresAt: z.string().datetime({ offset: true }).optional(),
  data: z.record(z.any()).optional()
});

/**
 * Schema for Coupon Filter.
 */
export const CouponFilterSchema = z.object({
  issuerCommonName: z.string().optional(),
  recipientCommonName: z.string().optional(),
  issuedAfter: z.string().datetime({ offset: true }).optional(),
  issuedBefore: z.string().datetime({ offset: true }).optional(),
  id: z.string().optional()
});