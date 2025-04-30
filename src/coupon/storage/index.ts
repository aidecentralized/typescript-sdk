/**
 * In-memory storage for coupons with thread-safe operations.
 */

import { Coupon, CouponFilter } from '../../types/coupon.js';

/**
 * Thread-safe in-memory storage for coupons.
 */
export class CouponStorage {
  private coupons: Map<string, Coupon> = new Map();
  private lockPromise: Promise<void> | null = null;
  
  /**
   * Acquire a lock on the storage to ensure thread safety.
   * @private
   */
  private async acquireLock(): Promise<() => void> {
    // Wait for any existing operation to complete
    if (this.lockPromise) {
      await this.lockPromise;
    }
    
    // Create a new lock
    let releaseLock!: () => void;
    this.lockPromise = new Promise<void>(resolve => {
      releaseLock = resolve;
    });
    
    // Prepare the release function that will be returned
    return () => releaseLock();
  }
  
  /**
   * Store a coupon in the storage.
   * 
   * @param coupon - The coupon to store
   * @returns The ID of the stored coupon
   */
  async storeCoupon(coupon: Coupon): Promise<string> {
    const releaseLock = await this.acquireLock();
    try {
      this.coupons.set(coupon.id, coupon);
      return coupon.id;
    } finally {
      releaseLock();
    }
  }
  
  /**
   * Store multiple coupons in a batch operation.
   * 
   * @param coupons - The coupons to store
   * @returns An array of the stored coupon IDs
   */
  async storeCoupons(coupons: Coupon[]): Promise<string[]> {
    const releaseLock = await this.acquireLock();
    try {
      const ids: string[] = [];
      for (const coupon of coupons) {
        this.coupons.set(coupon.id, coupon);
        ids.push(coupon.id);
      }
      return ids;
    } finally {
      releaseLock();
    }
  }
  
  /**
   * Get a coupon by its ID.
   * 
   * @param id - The ID of the coupon to retrieve
   * @returns The coupon or undefined if not found
   */
  async getCoupon(id: string): Promise<Coupon | undefined> {
    const releaseLock = await this.acquireLock();
    try {
      return this.coupons.get(id);
    } finally {
      releaseLock();
    }
  }
  
  /**
   * Get all stored coupons.
   * 
   * @returns An array of all coupons
   */
  async getAllCoupons(): Promise<Coupon[]> {
    const releaseLock = await this.acquireLock();
    try {
      return Array.from(this.coupons.values());
    } finally {
      releaseLock();
    }
  }
  
  /**
   * Filter coupons based on various criteria.
   * 
   * @param filter - The filter to apply
   * @returns An array of matching coupons
   */
  async filterCoupons(filter: CouponFilter): Promise<Coupon[]> {
    const releaseLock = await this.acquireLock();
    try {
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
    } finally {
      releaseLock();
    }
  }
  
  /**
   * Get a paginated list of coupons.
   * 
   * @param page - The page number (1-based)
   * @param pageSize - The number of items per page
   * @param filter - Optional filter to apply
   * @returns A paginated result
   */
  async getPaginatedCoupons(
    page: number = 1,
    pageSize: number = 20,
    filter?: CouponFilter
  ): Promise<{
    coupons: Coupon[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    const releaseLock = await this.acquireLock();
    try {
      // Get filtered coupons if a filter is provided, otherwise get all
      const allCoupons = filter 
        ? await this.filterCoupons(filter)
        : Array.from(this.coupons.values());
      
      const total = allCoupons.length;
      const totalPages = Math.ceil(total / pageSize);
      const normalizedPage = Math.max(1, Math.min(page, totalPages || 1));
      
      const start = (normalizedPage - 1) * pageSize;
      const end = start + pageSize;
      const coupons = allCoupons.slice(start, end);
      
      return {
        coupons,
        total,
        page: normalizedPage,
        pageSize,
        totalPages
      };
    } finally {
      releaseLock();
    }
  }
  
  /**
   * Remove expired coupons from storage.
   * 
   * @returns The number of coupons removed
   */
  async removeExpiredCoupons(): Promise<number> {
    const releaseLock = await this.acquireLock();
    try {
      const now = new Date().getTime();
      let removedCount = 0;
      
      for (const [id, coupon] of this.coupons.entries()) {
        if (coupon.expiresAt && new Date(coupon.expiresAt).getTime() < now) {
          this.coupons.delete(id);
          removedCount++;
        }
      }
      
      return removedCount;
    } finally {
      releaseLock();
    }
  }
  
  /**
   * Clear all coupons from storage.
   */
  async clearStorage(): Promise<void> {
    const releaseLock = await this.acquireLock();
    try {
      this.coupons.clear();
    } finally {
      releaseLock();
    }
  }
}

// Create a singleton instance
export const couponStorage = new CouponStorage();

// Export default for easy importing
export default couponStorage;