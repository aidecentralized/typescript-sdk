/**
 * Main entry point for the coupon module.
 * This file exports all the coupon-related functionality.
 */

// Export the types
export * from '../types/coupon.js';
export * from '../types/coupon.schema.js';

// Export the canonicalization utilities
export * from '../utils/canonicalize.js';

// Export coupon creation functions
export * from './create.js';

// Export signing utilities
export * from './sign.js';

// Export verification utilities
export * from './verify.js';

// Export client utilities
export * from './client.js';

// Export server utilities
export * from './server.js';

// Export storage functionality
export { 
  couponStorage,
  CouponStorage,
  default as defaultCouponStorage
} from './storage/index.js';
export { FileCouponStorage } from './storage/file.js';

// Export export functionality
export * from './export/index.js';