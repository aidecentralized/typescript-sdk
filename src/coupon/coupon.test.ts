/**
 * Tests for the coupon functionality.
 */

import { 
  createCoupon, 
  verifyCoupon,
  DistinguishedName,
  Certificate,
  Coupon,
  couponStorage,
  createRequestWithCoupon,
  extractAndVerifyCoupon
} from './index';

// Sample test data
const issuer: DistinguishedName = {
  commonName: 'Test Issuer',
  organization: 'Test Org',
  organizationalUnit: 'IT',
  country: 'US'
};

const recipient: DistinguishedName = {
  commonName: 'Test Recipient',
  organization: 'Client Org',
  country: 'CA'
};

// Sample certificate for testing
const testCertificate: Certificate = {
  serialNumber: '12345',
  issuer: {
    commonName: 'Test CA',
    organization: 'Test CA Org',
    country: 'US'
  },
  subject: issuer,
  issuedAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
  subjectPublicKey: '-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAu1SU1LfVLPHCozMxH2Mo\n4lgOEePzNm0tRgeLezV6ffAt0gunVTLw7onLRnrq0/IzW7yWR7QkrmBL7jTKEn5u\n+qKhbwKfBstIs+bMY2Zkp18gnTxKLxoS2tFczGkPLPgizskuemMghRniWaoLcyeh\nkd3qqGElvW/VDL5AaWTg0nLVkjRo9z+40RQzuVaE8AkAFmxZzow3x+VJYKdjykkJ\n0iT9wCS0DRTXu269V264Vf/3jvredZiKRkgwlL9xNAwxXFg0x/XFw005UWVRIkdg\ncKWTjpBP2dPwVZ4WWC+9aGVd+Gyn1o0CLelf4rEjGoXbAAEgAqeGUxrcIlbjXfbc\nmwIDAQAB\n-----END PUBLIC KEY-----',
  publicKeyAlgorithm: 'RSA',
  keyUsage: ['digitalSignature', 'keyEncipherment'],
  signature: 'abcdef1234567890',
  signatureAlgorithm: 'SHA256withRSA',
  version: '3'
};

// Sample private key for testing (this would be a real private key in production)
const privateKey = `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC7VJTUt9Us8cKj
MzEfYyjiWA4R4/M2bS1GB4t7NXp98C3SC6dVMvDuictGeurT8jNbvJZHtCSuYEvu
NMoSfm76oqFvAp8Gy0iz5sxjZmSnXyCdPEovGhLa0VzMaQ8s+CLOyS56YyCFGeJZ
qgtzJ6GR3eqoYSW9b9UMvkBpZODSctWSNGj3P7jRFDO5VoTwCQAWbFnOjDfH5Ulg
p2PKSQnSJP3AJLQNFNe7br1XbrhV//eO+t51mIpGSDCUv3E0DDFcWDTH9cXDTTlR
ZVEiR2BwpZOOkE/Z0/BVnhZYL71oZV34bKfWjQIt6V/isSMahdsAASACp4ZTGtwi
VuNd9tybAgMBAAECggEAVc6bu7VAnP6v0gDOeX4razv4FX/adCao9ZsHZ+WPX8/P
GGCn7f33GXjE8R0QQHpIy2S5LzcNGlqCPDv8WmU/vhjpuEcFBLZHPHHr31J4ksEF
Pd6Bm31kWR4PIhw9pzqxT0YwU9g9xEsBYi0nwMVdk+qw9CgmBva1tBbfuuHdnlJw
faIhfSD5H0bIZMPfIqxAJu/nrJkf2wPQot9NS6h0ZUQhdkGTFmGPFKBOUVH7Hv8z
cpjRUn8H2O63sA6CJaCnPLHlPKpTHU5SzeKLkhEH3LJAwfDJXIlHkQnvtZ2xWG/i
QyX/m6w5qV18L/WoX//3+5YMjEL4Dyd6n6L8J0po4QKBgQDl0xoQdlJuPikID6al
qG5LFJ+9/ZxU4cPzQQGNngZ0h/MlKwHDFLc6Ji2BZP9Y6iuQJuMQx5X8U8J3fILg
CuDNMuX5gbe2VXTTXj3x6RrJFm+E1lT0DIZCwkH5DwQxmT0jVYw02iHDGqIKxHPK
WdWP50gEkPgf3QHl9s92q8P9OQKBgQDQja2n2wQ8yXGTQwIRsxvtpyPT0sPkxRnK
maUKOBEW3S9+2X/+PAVWgwIMPdH9MdJPjzRhMHJpS70/pcFR0vXMJJ5bBTLEA1aS
HH1BYythCfW2bZf9/qcw8GVLzP8A0EYgCa0/7jMRIqGT0G8FrWmJE6mV9PQ+EKxN
jzAPTWwPgwKBgQChCxqp6U+6jYrIwGj6C7tLR2YevGLErmL/XKYxQGNPJEZXjlM5
kB6RvzIUW5nIjLBc1Uq0zZhLBTLQvJp3VJtXdzrIqLXxGpWXTUDiqj3vNGrb9pgr
+NvmJwJ42gKTmbQcWbJqF9VPJmYVl1rLjaF/FwwXcYFdAQrp1/BsbPc7uQKBgQCw
Grq3iLR9EZSxQhLwkbMQTgdDQp/hJKEiYxwFw2XyWwmFUF4S8PYNfIl2/+XbvGzh
8JieO8Jmj3uqEp5LwSwRtMHYL8KjJzYHt0w7tz73Xd52KJVthJwL6arGRrS2C9qJ
h1IrKnzajx1vANX7TIRdHwNLbZIYs5yvbp0yJrj2TQKBgDInYU1RaF2pMbWERXGC
QwNQhL7RahYB1Jq69cstRfQGqFtfscYFmVPr5ou+GgZ2tWGWxbUa/5P1zVvyZ9Cs
YJaYRVzOvPaRYOqfUjg+bAokjCITGkBka40xQHnKYnGfNe9gCwO+sHUpOKzGdnWA
C8jCf7UBzB8+1tUFDpA+vz22
-----END PRIVATE KEY-----`;

describe('Coupon Module', () => {
  beforeEach(async () => {
    // Clear storage before each test
    await couponStorage.clearStorage();
  });
  
  test('should create a valid coupon', () => {
    const coupon = createCoupon(
      issuer,
      recipient,
      testCertificate,
      privateKey,
      { purpose: 'test' }
    );
    
    expect(coupon).toBeDefined();
    expect(coupon.id).toBeDefined();
    expect(coupon.issuer).toEqual(issuer);
    expect(coupon.recipient).toEqual(recipient);
    expect(coupon.data).toEqual({ purpose: 'test' });
    expect(coupon.signature).toBeDefined();
    expect(coupon.signatureAlgorithm).toBe('SHA256withRSA');
  });
  
  test('should verify a valid coupon', () => {
    const coupon = createCoupon(
      issuer,
      recipient,
      testCertificate,
      privateKey
    );
    
    const isValid = verifyCoupon(coupon);
    expect(isValid).toBe(true);
  });
  
  test('should detect an invalid coupon', () => {
    // Create a valid coupon first
    const coupon = createCoupon(
      issuer,
      recipient,
      testCertificate,
      privateKey
    );
    
    // Tamper with the coupon
    const tamperedCoupon: Coupon = {
      ...coupon,
      data: { tampered: true }
    };
    
    const isValid = verifyCoupon(tamperedCoupon);
    expect(isValid).toBe(false);
  });
  
  test('should store and retrieve coupons', async () => {
    const coupon = createCoupon(
      issuer,
      recipient,
      testCertificate,
      privateKey
    );
    
    await couponStorage.storeCoupon(coupon);
    
    const retrievedCoupon = await couponStorage.getCoupon(coupon.id);
    expect(retrievedCoupon).toEqual(coupon);
    
    const allCoupons = await couponStorage.getAllCoupons();
    expect(allCoupons).toHaveLength(1);
    expect(allCoupons[0]).toEqual(coupon);
  });
  
  test('should filter coupons', async () => {
    // Create two coupons with different issuers
    const coupon1 = createCoupon(
      { ...issuer, commonName: 'Issuer 1' },
      recipient,
      testCertificate,
      privateKey
    );
    
    const coupon2 = createCoupon(
      { ...issuer, commonName: 'Issuer 2' },
      recipient,
      testCertificate,
      privateKey
    );
    
    await couponStorage.storeCoupons([coupon1, coupon2]);
    
    const filtered = await couponStorage.filterCoupons({
      issuerCommonName: 'Issuer 1'
    });
    
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe(coupon1.id);
  });
  
  test('should attach a coupon to a request', () => {
    const coupon = createCoupon(
      issuer,
      recipient,
      testCertificate,
      privateKey
    );
    
    const request = createRequestWithCoupon(
      'tools/call',
      { name: 'test', arguments: {} },
      coupon
    );
    
    expect(request.method).toBe('tools/call');
    expect(request.params._meta.coupon).toEqual(coupon);
    expect(request.params.name).toBe('test');
  });
  
  test('should extract and verify a coupon from a request', async () => {
    const coupon = createCoupon(
      issuer,
      recipient,
      testCertificate,
      privateKey
    );
    
    const request = createRequestWithCoupon(
      'tools/call',
      { name: 'test', arguments: {} },
      coupon
    );
    
    const extractedCoupon = await extractAndVerifyCoupon(request);
    expect(extractedCoupon).toEqual(coupon);
  });
});