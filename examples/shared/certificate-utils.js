import crypto from 'crypto';

/**
 * Generates a certificate for use with the coupon system.
 */
export function generateCertificate(options) {
    const now = new Date();
    const expiry = new Date(now);
    expiry.setDate(expiry.getDate() + (options.validityDays || 365));
    const publicKey = extractPublicKeyFromPrivate(options.privateKey);
    
    return {
        serialNumber: options.serialNumber || crypto.randomBytes(16).toString('hex'),
        subject: options.subject,
        issuer: options.issuer || options.subject, // Self-signed by default
        subjectPublicKey: publicKey,
        issuedAt: now.toISOString(),
        expiresAt: expiry.toISOString(),
        publicKeyAlgorithm: 'RSA',
        keyUsage: ['digitalSignature', 'keyEncipherment'],
        extendedKeyUsage: ['clientAuth', 'serverAuth'],
        signature: 'dummySignatureForDemoPurposes' + crypto.randomBytes(32).toString('base64')
    };
}
/**
 * Extracts the public key from a private key.
 */
function extractPublicKeyFromPrivate(privateKeyPem) {
    try {
        return crypto.createPublicKey(privateKeyPem).export({
            type: 'spki',
            format: 'pem'
        });
    }
    catch (error) {
        console.error('Error extracting public key:', error);
        // Fallback for demo purposes
        return `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAvPQMjDwX+BSgkfCPrQje
BO6yxRrLpYZ1WbIRfIEw2fMdOQD0qcUSzJL6Q7B4PZU6xV3v2EJkl97QDXGSjAB7
O5lKuJ7vSxI2hybY9MHQceZ+PFqgWwpTLluK5Q4DcOtI6Cbv/Q8EZZLLRPRbCqYx
5m1vnGzIZ4MuOL0QbIOsIpGHqLS7Vph9dGqUZnPsK5YZ5AP2panGs1St6B2t3XNN
lrCSu8B0fex5Q7Ipr9KoUUq2yFj9QoECgZg2s0HkLEnPvwrJnF8jX7DIwcTkAFS7
7tP2mOU4wX0ww6G1EjrJkFopx+R0yfXWCAafT2lKYoA0kCSMoS86JY6xw5SGNUJO
fQIDAQAB
-----END PUBLIC KEY-----`;
    }
}
