/**
 * Canonicalization utility for coupon signatures.
 * Implements RFC 8785 standard for JSON Canonicalization.
 */

import { createHash } from 'crypto';

/**
 * Canonicalizes a JavaScript object according to RFC 8785.
 * For implementation simplicity, we're using a basic version of canonicalization.
 * In a production environment, use a proper RFC 8785 implementation.
 * 
 * @param data - The data object to canonicalize
 * @returns The canonicalized string representation
 */
export function canonicalizeData(data: Record<string, any>): string {
  try {
    // Simple canonicalization - in production use a proper library
    return JSON.stringify(data, Object.keys(data).sort());
  } catch (error) {
    console.error('Error in canonicalization:', error);
    return '';
  }
}

/**
 * Creates a SHA-256 hash of canonicalized data.
 * 
 * @param data - The data object to hash
 * @returns The SHA-256 hash as a hex string
 */
export function hashCanonicalData(data: Record<string, any>): string {
  const canonicalizedData = canonicalizeData(data);
  return createHash('sha256').update(canonicalizedData).digest('hex');
}

/**
 * Prepares an object for signing by canonicalizing it.
 * 
 * @param data - The data object to prepare for signing
 * @returns The canonicalized string ready for signing
 */
export function prepareForSigning(data: Record<string, any>): string {
  return canonicalizeData(data);
}