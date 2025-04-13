/**
 * Functions for exporting coupons to various formats.
 */

import fs from 'fs/promises';
import path from 'path';
import { Coupon, CouponFilter } from '../../types/coupon.js';
import couponStorage from '../storage/index.js';

/**
 * Export coupons to a JSON file.
 * 
 * @param filePath - The path to save the file
 * @param filter - Optional filter to apply
 * @returns The number of coupons exported
 */
export async function exportCouponsToJsonFile(
  filePath: string,
  filter?: CouponFilter
): Promise<number> {
  // Get coupons, filtered if requested
  const coupons = filter 
    ? await couponStorage.filterCoupons(filter)
    : await couponStorage.getAllCoupons();
  
  // Ensure directory exists
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  
  // Write to file
  await fs.writeFile(
    filePath,
    JSON.stringify(coupons, null, 2),
    'utf-8'
  );
  
  return coupons.length;
}

/**
 * Generate a JSON string of coupons.
 * 
 * @param filter - Optional filter to apply
 * @param pretty - Whether to prettify the JSON output
 * @returns The JSON string representation of the coupons
 */
export async function exportCouponsToJsonString(
  filter?: CouponFilter,
  pretty: boolean = false
): Promise<string> {
  // Get coupons, filtered if requested
  const coupons = filter 
    ? await couponStorage.filterCoupons(filter)
    : await couponStorage.getAllCoupons();
  
  return pretty
    ? JSON.stringify(coupons, null, 2)
    : JSON.stringify(coupons);
}

/**
 * Export coupons to a callback function.
 * Useful for streaming or custom processing.
 * 
 * @param callback - The callback function to process each coupon
 * @param filter - Optional filter to apply
 * @returns The number of coupons processed
 */
export async function exportCouponsToCallback(
  callback: (coupon: Coupon) => Promise<void> | void,
  filter?: CouponFilter
): Promise<number> {
  // Get coupons, filtered if requested
  const coupons = filter 
    ? await couponStorage.filterCoupons(filter)
    : await couponStorage.getAllCoupons();
  
  // Process each coupon with the callback
  for (const coupon of coupons) {
    await callback(coupon);
  }
  
  return coupons.length;
}

/**
 * Export coupons to a summary format with counts per issuer/recipient.
 * 
 * @param filter - Optional filter to apply
 * @returns A summary object with counts
 */
export async function exportCouponsSummary(
  filter?: CouponFilter
): Promise<{
  totalCount: number;
  byIssuer: Record<string, number>;
  byRecipient: Record<string, number>;
  byExpiryStatus: {
    valid: number;
    expired: number;
    noExpiry: number;
  };
}> {
  // Get coupons, filtered if requested
  const coupons = filter 
    ? await couponStorage.filterCoupons(filter)
    : await couponStorage.getAllCoupons();
  
  const summary = {
    totalCount: coupons.length,
    byIssuer: {} as Record<string, number>,
    byRecipient: {} as Record<string, number>,
    byExpiryStatus: {
      valid: 0,
      expired: 0,
      noExpiry: 0
    }
  };
  
  const now = new Date();
  
  // Generate the summary counts
  for (const coupon of coupons) {
    // Count by issuer
    const issuerName = coupon.issuer.commonName;
    summary.byIssuer[issuerName] = (summary.byIssuer[issuerName] || 0) + 1;
    
    // Count by recipient
    const recipientName = coupon.recipient.commonName;
    summary.byRecipient[recipientName] = (summary.byRecipient[recipientName] || 0) + 1;
    
    // Count by expiry status
    if (!coupon.expiresAt) {
      summary.byExpiryStatus.noExpiry++;
    } else if (new Date(coupon.expiresAt) > now) {
      summary.byExpiryStatus.valid++;
    } else {
      summary.byExpiryStatus.expired++;
    }
  }
  
  return summary;
}