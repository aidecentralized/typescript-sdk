import { Coupon, CouponFilter, CouponStorage } from './types.js';

/**
 * In-memory storage for coupons
 */
export class MemoryCouponStorage implements CouponStorage {
  private coupons: Map<string, Coupon> = new Map();
  
  /**
   * Store a coupon
   */
  async storeCoupon(coupon: Coupon): Promise<string> {
    this.coupons.set(coupon.id, coupon);
    return coupon.id;
  }
  
  /**
   * Get a coupon by ID
   */
  async getCoupon(id: string): Promise<Coupon | undefined> {
    return this.coupons.get(id);
  }
  
  /**
   * Get all stored coupons
   */
  async getAllCoupons(): Promise<Coupon[]> {
    return Array.from(this.coupons.values());
  }
  
  /**
   * Filter coupons by various criteria
   */
  async filterCoupons(filter: CouponFilter): Promise<Coupon[]> {
    let result = Array.from(this.coupons.values());
    
    // Filter by ID if provided
    if (filter.id) {
      result = result.filter(c => c.id === filter.id);
    }
    
    // Filter by issuer common name if provided
    if (filter.issuerCommonName) {
      result = result.filter(c => 
        c.issuer.commonName === filter.issuerCommonName
      );
    }
    
    // Filter by recipient common name if provided
    if (filter.recipientCommonName) {
      result = result.filter(c => 
        c.recipient.commonName === filter.recipientCommonName
      );
    }
    
    // Filter by issued after date if provided
    if (filter.issuedAfter) {
      const afterDate = new Date(filter.issuedAfter).getTime();
      result = result.filter(c => 
        new Date(c.issuedAt).getTime() >= afterDate
      );
    }
    
    // Filter by issued before date if provided
    if (filter.issuedBefore) {
      const beforeDate = new Date(filter.issuedBefore).getTime();
      result = result.filter(c => 
        new Date(c.issuedAt).getTime() <= beforeDate
      );
    }
    
    return result;
  }
  
  /**
   * Remove expired coupons
   */
  async removeExpiredCoupons(): Promise<number> {
    const now = new Date().getTime();
    let removedCount = 0;
    
    for (const [id, coupon] of this.coupons.entries()) {
      if (coupon.expiresAt && new Date(coupon.expiresAt).getTime() < now) {
        this.coupons.delete(id);
        removedCount++;
      }
    }
    
    return removedCount;
  }
  
  /**
   * Clear all coupons
   */
  async clearStorage(): Promise<void> {
    this.coupons.clear();
  }
}

// Create a singleton instance
export const couponStorage = new MemoryCouponStorage();