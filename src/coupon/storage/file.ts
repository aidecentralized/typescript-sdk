/**
 * File-based storage for coupons to provide persistence.
 */

import fs from 'fs/promises';
import path from 'path';
import { Coupon, CouponFilter } from '../../types/coupon.js';
import { CouponStorage } from './index.js';

/**
 * File-based storage implementation for coupons.
 * Extends the in-memory storage with file persistence.
 */
export class FileCouponStorage extends CouponStorage {
  private filePath: string;
  private autoSave: boolean;
  
  /**
   * Create a new file-based coupon storage.
   * 
   * @param filePath - The path to store the coupons file
   * @param autoSave - Whether to automatically save after each change
   */
  constructor(filePath: string, autoSave: boolean = true) {
    super();
    this.filePath = filePath;
    this.autoSave = autoSave;
  }
  
  /**
   * Initialize the storage by loading from the file if it exists.
   */
  async initialize(): Promise<void> {
    try {
      await this.loadFromFile();
    } catch (error) {
      // If the file doesn't exist, we'll create it on the first save
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }
  
  /**
   * Store a coupon and save to file if autoSave is enabled.
   * 
   * @param coupon - The coupon to store
   * @returns The ID of the stored coupon
   */
  async storeCoupon(coupon: Coupon): Promise<string> {
    const id = await super.storeCoupon(coupon);
    if (this.autoSave) {
      await this.saveToFile();
    }
    return id;
  }
  
  /**
   * Store multiple coupons and save to file if autoSave is enabled.
   * 
   * @param coupons - The coupons to store
   * @returns An array of stored coupon IDs
   */
  async storeCoupons(coupons: Coupon[]): Promise<string[]> {
    const ids = await super.storeCoupons(coupons);
    if (this.autoSave) {
      await this.saveToFile();
    }
    return ids;
  }
  
  /**
   * Clear all coupons and save to file if autoSave is enabled.
   */
  async clearStorage(): Promise<void> {
    await super.clearStorage();
    if (this.autoSave) {
      await this.saveToFile();
    }
  }
  
  /**
   * Remove expired coupons and save to file if autoSave is enabled.
   * 
   * @returns The number of coupons removed
   */
  async removeExpiredCoupons(): Promise<number> {
    const count = await super.removeExpiredCoupons();
    if (count > 0 && this.autoSave) {
      await this.saveToFile();
    }
    return count;
  }
  
  /**
   * Save the current state to the file.
   */
  async saveToFile(): Promise<void> {
    const coupons = await super.getAllCoupons();
    
    // Ensure the directory exists
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    
    // Write to a temporary file first to prevent corruption
    const tempPath = `${this.filePath}.tmp`;
    await fs.writeFile(tempPath, JSON.stringify(coupons, null, 2));
    
    // Rename the temp file to the actual file (atomic operation)
    await fs.rename(tempPath, this.filePath);
  }
  
  /**
   * Load coupons from the file.
   */
  async loadFromFile(): Promise<void> {
    const data = await fs.readFile(this.filePath, 'utf-8');
    const coupons: Coupon[] = JSON.parse(data);
    
    // Clear current storage and add loaded coupons
    await super.clearStorage();
    await super.storeCoupons(coupons);
  }
}