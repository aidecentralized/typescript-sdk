# Coupon System Security Best Practices

This document outlines security best practices when working with the coupon system, including key management, certificate handling, and secure implementation patterns.

## Key Management

### Private Key Protection

Private keys are the most critical security component of the coupon system. If a private key is compromised, an attacker can issue fraudulent coupons.

**Best Practices:**

1. **Secure Storage**: 
   - Never store private keys in code repositories
   - Use environment variables or secret management services (AWS Secrets Manager, HashiCorp Vault, etc.)
   - Consider using Hardware Security Modules (HSMs) for production systems

2. **Access Control**:
   - Restrict access to private keys to only the necessary services
   - Implement the principle of least privilege
   - Log all access to private keys

3. **Key Rotation**:
   - Regularly rotate private keys (e.g., every 90 days)
   - Implement a process for smooth key transitions
   - Have a revocation plan for compromised keys

### Example: Secure Key Loading

```typescript
// GOOD: Load private key from environment variable
const privateKey = process.env.COUPON_PRIVATE_KEY;
if (!privateKey) {
  throw new Error('Missing required COUPON_PRIVATE_KEY environment variable');
}

// BAD: Hardcoded private key
const privateKey = '-----BEGIN PRIVATE KEY-----\n...'; // Don't do this!
```

## Certificate Management

### Certificate Authority

For production systems, use a proper Certificate Authority (CA) for issuing certificates.

**Best Practices:**

1. **Establish Trust**:
   - Use a well-known public CA or set up an internal CA
   - Document and publish your certificate policies
   - Implement proper certificate validation

2. **Certificate Lifecycle**:
   - Define certificate validity periods (typically 1-2 years)
   - Implement certificate renewal processes
   - Maintain a Certificate Revocation List (CRL)

3. **Certificate Content**:
   - Include accurate issuer and subject information
   - Use appropriate key usage extensions
   - Follow X.509 best practices

### Example: Certificate Validation

```typescript
function validateCertificate(certificate) {
  const now = new Date();
  const issuedAt = new Date(certificate.issuedAt);
  const expiresAt = new Date(certificate.expiresAt);
  
  // Check validity period
  if (now < issuedAt || now > expiresAt) {
    throw new Error('Certificate is not within its validity period');
  }
  
  // Check key usage
  if (!certificate.keyUsage.includes('digitalSignature')) {
    throw new Error('Certificate not authorized for digital signatures');
  }
  
  // In production, also check:
  // 1. Certificate revocation status
  // 2. Certificate chain validity
  // 3. Trusted root status
}
```

## Coupon Security

### Coupon Content

**Best Practices:**

1. **Minimal Data**:
   - Include only necessary data in coupons
   - Avoid including sensitive information
   - Use opaque identifiers when possible

2. **Contextual Information**:
   - Include purpose or scope in the coupon data
   - Add timestamps for issuance and expiry
   - Consider including request context (e.g., IP range, service ID)

3. **Expiration**:
   - Always set appropriate expiration times
   - Use shorter expiration for sensitive operations
   - Implement auto-expiry mechanisms

### Example: Setting Appropriate Expiry

```typescript
// Short-lived coupon for sensitive operations (1 hour)
const sensitiveCoupon = createCoupon(
  issuer,
  recipient,
  certificate,
  privateKey,
  { purpose: 'admin-operation', operation: 'config-change' },
  new Date(Date.now() + 60 * 60 * 1000).toISOString() // 1 hour
);

// Standard coupon for regular API usage (1 day)
const standardCoupon = createCoupon(
  issuer,
  recipient,
  certificate,
  privateKey,
  { purpose: 'api-access', scope: ['read'] },
  new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
);

// Long-lived coupon for persistent relationships (30 days)
const persistentCoupon = createCoupon(
  issuer,
  recipient,
  certificate,
  privateKey,
  { purpose: 'service-registration', serviceId: 'abc123' },
  new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
);
```

## Verification and Validation

### Signature Verification

**Best Practices:**

1. **Complete Verification**:
   - Always verify signatures before trusting coupons
   - Verify certificate validity
   - Check expiration dates

2. **No Shortcuts**:
   - Don't skip verification steps in production
   - Implement proper error handling
   - Log verification failures

3. **Canonicalization**:
   - Use standardized canonicalization (RFC 8785)
   - Ensure identical canonicalization in creation and verification
   - Test with various data structures

### Example: Complete Verification Process

```typescript
async function verifyAndValidateCoupon(coupon, trustedCAs) {
  // Step 1: Verify the coupon signature
  const signatureValid = verifyCoupon(coupon);
  if (!signatureValid) {
    throw new Error('Coupon signature verification failed');
  }
  
  // Step 2: Verify certificate validity
  const certValid = validateCertificate(coupon.issuerCertificate);
  if (!certValid) {
    throw new Error('Certificate validation failed');
  }
  
  // Step 3: Check if certificate is from a trusted CA
  const isTrustedCA = trustedCAs.some(ca => 
    ca.commonName === coupon.issuerCertificate.issuer.commonName &&
    ca.organization === coupon.issuerCertificate.issuer.organization
  );
  if (!isTrustedCA) {
    throw new Error('Certificate not issued by a trusted CA');
  }
  
  // Step 4: Check coupon expiration
  const now = new Date();
  const expiresAt = coupon.expiresAt ? new Date(coupon.expiresAt) : null;
  if (expiresAt && now > expiresAt) {
    throw new Error('Coupon has expired');
  }
  
  // Step 5: Validate coupon purpose/data
  if (!coupon.data?.purpose) {
    throw new Error('Coupon missing required purpose');
  }
  
  // All checks passed, coupon is valid
  return true;
}
```

## Secure Transport

### Network Security

**Best Practices:**

1. **TLS/HTTPS**:
   - Always use HTTPS for transporting coupons
   - Configure servers with modern TLS settings
   - Keep TLS libraries updated

2. **API Security**:
   - Implement proper authentication for coupon endpoints
   - Use rate limiting to prevent abuse
   - Consider adding CORS restrictions

3. **Data Protection**:
   - Don't log complete coupons (especially signatures)
   - Protect coupon storage endpoints
   - Implement proper access controls

### Example: Express Server with Security Headers

```typescript
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

const app = express();

// Basic security headers
app.use(helmet());

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later'
});
app.use('/api/coupons', apiLimiter);

// CORS configuration
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'https://trusted-domain.com');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  next();
});

// Coupon endpoint with authentication
app.get('/api/coupons', authenticate, async (req, res) => {
  // ...coupon handling logic
});

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  // Implement proper authentication logic here
  
  next();
}

app.listen(3000);
```

## Storage Security

### Secure Storage Practices

**Best Practices:**

1. **Access Control**:
   - Restrict access to coupon storage
   - Implement proper authentication
   - Consider encryption at rest

2. **Data Retention**:
   - Implement appropriate retention policies
   - Automatically remove expired coupons
   - Consider storage limits

3. **Auditing**:
   - Log all access to coupon storage
   - Record creation and verification events
   - Implement anomaly detection

### Example: Encrypted File Storage

```typescript
import { FileCouponStorage } from '@modelcontextprotocol/sdk/coupon';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import fs from 'fs/promises';

class EncryptedFileCouponStorage extends FileCouponStorage {
  private encryptionKey: Buffer;
  
  constructor(filePath: string, encryptionKey: string) {
    super(filePath, false); // Disable auto-save to handle encryption
    this.encryptionKey = Buffer.from(encryptionKey, 'hex');
  }
  
  // Override saveToFile to encrypt data
  async saveToFile(): Promise<void> {
    const coupons = await super.getAllCoupons();
    
    // Encrypt the data
    const iv = randomBytes(16);
    const cipher = createCipheriv('aes-256-cbc', this.encryptionKey, iv);
    
    let encrypted = cipher.update(JSON.stringify(coupons), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Store IV and encrypted data
    const data = {
      iv: iv.toString('hex'),
      data: encrypted
    };
    
    await fs.writeFile(this.filePath, JSON.stringify(data));
  }
  
  // Override loadFromFile to decrypt data
  async loadFromFile(): Promise<void> {
    const fileContent = await fs.readFile(this.filePath, 'utf8');
    const { iv, data } = JSON.parse(fileContent);
    
    // Decrypt the data
    const decipher = createDecipheriv(
      'aes-256-cbc', 
      this.encryptionKey, 
      Buffer.from(iv, 'hex')
    );
    
    let decrypted = decipher.update(data, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    const coupons = JSON.parse(decrypted);
    
    // Clear current storage and add loaded coupons
    await super.clearStorage();
    await super.storeCoupons(coupons);
  }
}

// Usage
const encryptionKey = randomBytes(32).toString('hex'); // Store securely!
const storage = new EncryptedFileCouponStorage('./data/coupons.enc', encryptionKey);
await storage.initialize();
```

## Threat Mitigation

### Common Attacks and Mitigations

1. **Replay Attacks**:
   - Include timestamps in coupons
   - Implement nonce values for one-time use
   - Track used coupons to prevent reuse

2. **Forgery Attacks**:
   - Always verify signatures
   - Use strong signature algorithms
   - Keep private keys secure

3. **Man-in-the-Middle**:
   - Use TLS for all communications
   - Implement certificate pinning
   - Verify expected recipients

4. **Denial of Service**:
   - Implement rate limiting
   - Set reasonable coupon size limits
   - Monitor for abnormal usage patterns

### Example: Nonce Implementation

```typescript
// Server-side nonce tracking
const usedNonces = new Set();

// Create coupon with nonce
const coupon = createCoupon(
  issuer,
  recipient,
  certificate,
  privateKey,
  { 
    purpose: 'one-time-action',
    nonce: randomBytes(16).toString('hex') 
  }
);

// Verify coupon and check nonce
function verifyWithNonce(coupon) {
  if (!verifyCoupon(coupon)) {
    return false;
  }
  
  const nonce = coupon.data?.nonce;
  if (!nonce) {
    throw new Error('Missing required nonce');
  }
  
  // Check if nonce has been used
  if (usedNonces.has(nonce)) {
    throw new Error('Coupon has already been used');
  }
  
  // Mark nonce as used
  usedNonces.add(nonce);
  
  return true;
}
```

## Production Readiness

### Checklist for Production Deployment

1. **Key Infrastructure**:
   - [ ] Secure private key storage implemented
   - [ ] Certificate issuance process established
   - [ ] Key rotation procedures documented

2. **Verification**:
   - [ ] Full signature verification implemented
   - [ ] Certificate validation checks in place
   - [ ] Expiry checking implemented

3. **Storage**:
   - [ ] Production-grade storage solution selected
   - [ ] Storage encryption implemented
   - [ ] Backup procedures established

4. **Monitoring**:
   - [ ] Logging for security events
   - [ ] Alerts for suspicious activities
   - [ ] Performance monitoring

5. **Documentation**:
   - [ ] Security architecture documented
   - [ ] Incident response procedures
   - [ ] User documentation for clients

### Example: Security Logging

```typescript
import { createLogger, format, transports } from 'winston';

// Create security logger
const securityLogger = createLogger({
  level: 'info',
  format: format.combine(
    format.timestamp(),
    format.json()
  ),
  transports: [
    new transports.File({ filename: 'security.log' }),
    new transports.Console()
  ]
});

// Log coupon creation
function logCouponCreation(coupon) {
  securityLogger.info('Coupon created', {
    event: 'coupon_created',
    couponId: coupon.id,
    issuer: coupon.issuer.commonName,
    recipient: coupon.recipient.commonName,
    expiresAt: coupon.expiresAt
  });
}

// Log verification attempts
function logVerification(coupon, success, reason) {
  const logLevel = success ? 'info' : 'warn';
  
  securityLogger[logLevel]('Coupon verification', {
    event: success ? 'coupon_verified' : 'coupon_verification_failed',
    couponId: coupon.id,
    issuer: coupon.issuer.commonName,
    recipient: coupon.recipient.commonName,
    success,
    reason
  });
}

// Log security events
function logSecurityEvent(event, details) {
  securityLogger.warn('Security event', {
    event,
    ...details
  });
}
```

## Further Resources

- [RFC 8785: JSON Canonicalization Scheme (JCS)](https://www.rfc-editor.org/rfc/rfc8785.html)
- [X.509 Certificate Standard](https://www.itu.int/rec/T-REC-X.509)
- [NIST Guidelines for Key Management](https://csrc.nist.gov/publications/detail/sp/800-57-part-1/rev-5/final)
- [OWASP API Security Top 10](https://owasp.org/www-project-api-security/)
- [Mozilla TLS Configuration Guidelines](https://wiki.mozilla.org/Security/Server_Side_TLS)