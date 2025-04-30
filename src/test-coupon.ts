/**
 * This is a test file to demonstrate the coupon functionality.
 */

import {
  createCoupon,
  verifyCoupon,
  DistinguishedName,
  Certificate,
  couponStorage,
  createRequestWithCoupon
} from './coupon/index.js';

// Sample test data
async function runTest() {
  console.log('Starting coupon test...');

  // Sample distinguished names
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

  // Sample private key for testing
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

  try {
    // Step 1: Create a coupon
    console.log('Creating coupon...');
    const coupon = createCoupon(
      issuer,
      recipient,
      testCertificate,
      privateKey,
      { purpose: 'test', context: 'test-run' }
    );
    console.log('Coupon created:', coupon.id);

    // Step 2: Verify the coupon
    console.log('Verifying coupon...');
    const isValid = verifyCoupon(coupon);
    console.log('Coupon is valid:', isValid);

    if (!isValid) {
      throw new Error('Coupon verification failed');
    }

    // Step 3: Store the coupon
    console.log('Storing coupon...');
    await couponStorage.storeCoupon(coupon);
    
    // Step 4: Retrieve the coupon
    console.log('Retrieving coupon...');
    const retrievedCoupon = await couponStorage.getCoupon(coupon.id);
    console.log('Retrieved coupon:', retrievedCoupon?.id);

    if (!retrievedCoupon) {
      throw new Error('Coupon retrieval failed');
    }

    // Step 5: Create a request with the coupon
    console.log('Creating request with coupon...');
    const request = createRequestWithCoupon(
      'test/method',
      { 
        name: 'test-tool',
        arguments: { param1: 'value1' }
      },
      coupon
    );
    console.log('Request created:', JSON.stringify(request, null, 2));

    // Step 6: Test filtering
    console.log('Testing coupon filtering...');
    const filtered = await couponStorage.filterCoupons({
      issuerCommonName: 'Test Issuer'
    });
    console.log('Filtered coupons count:', filtered.length);

    console.log('All tests passed!');
  } catch (error) {
    console.error('Test failed:', error);
  }
}

runTest().catch(console.error);