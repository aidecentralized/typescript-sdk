import fs from 'fs';
import { createCoupon, verifyCoupon, extractAndVerifyCoupon, createRequestWithCoupon } from './coupon';
import { couponStorage } from './storage';
import { createKeyPair, createSelfSignedCertificate } from './utils';

/**
 * Simple demo of the coupon system, outputs to file
 */
async function runCouponDemo() {
  // Create output file
  const outputFile = 'coupon-demo-output.txt';
  const outputStream = fs.createWriteStream(outputFile, { flags: 'w' });
  
  // Helper to log to console and file
  const log = (message: string) => {
    console.log(message);
    outputStream.write(message + '\n');
  };

  log('🚀 Starting MCP Coupon Demo');
  log('==============================');

  try {
    // Create server identity
    log('\n📜 Generating server identity...');
    const serverKeyPair = await createKeyPair();
    const serverDN = {
      commonName: 'MCP Server',
      organization: 'MCP Demo Organization',
      country: 'US'
    };
    const serverCertificate = createSelfSignedCertificate(
      serverDN,
      serverKeyPair.publicKey,
      serverKeyPair.privateKey
    );
    log(`Server identity created: ${serverDN.commonName} (${serverDN.organization})`);

    // Create client identity
    log('\n📜 Generating client identity...');
    const clientKeyPair = await createKeyPair();
    const clientDN = {
      commonName: 'MCP Client',
      organization: 'MCP Client Organization',
      country: 'US'
    };
    const clientCertificate = createSelfSignedCertificate(
      clientDN,
      clientKeyPair.publicKey,
      clientKeyPair.privateKey
    );
    log(`Client identity created: ${clientDN.commonName} (${clientDN.organization})`);

    // Create a server-issued coupon for the client
    log('\n🎫 Creating server-issued coupon for client...');
    const serverIssuedCoupon = createCoupon(
      serverDN,
      clientDN,
      serverCertificate,
      serverKeyPair.privateKey,
      { purpose: 'server-issued-demo', timestamp: new Date().toISOString() },
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
    );
    log(`Server issued coupon with ID: ${serverIssuedCoupon.id}`);
    log(`Expiry: ${serverIssuedCoupon.expiresAt}`);

    // Store the server-issued coupon
    await couponStorage.storeCoupon(serverIssuedCoupon);
    log('Coupon stored in storage');

    // Create a client-issued coupon for the server
    log('\n🎫 Creating client-issued coupon for server...');
    const clientIssuedCoupon = createCoupon(
      clientDN,
      serverDN,
      clientCertificate,
      clientKeyPair.privateKey,
      { purpose: 'client-issued-demo', timestamp: new Date().toISOString() },
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
    );
    log(`Client issued coupon with ID: ${clientIssuedCoupon.id}`);

    // Verify coupons
    log('\n✅ Verifying coupons...');
    
    // Verify server-issued coupon
    const isServerCouponValid = verifyCoupon(serverIssuedCoupon, true);
    log(`Server-issued coupon validation: ${isServerCouponValid ? 'VALID' : 'INVALID'}`);
    
    // Verify client-issued coupon
    const isClientCouponValid = verifyCoupon(clientIssuedCoupon, true);
    log(`Client-issued coupon validation: ${isClientCouponValid ? 'VALID' : 'INVALID'}`);

    // Create a request with the client-issued coupon
    log('\n🔒 Creating a request with a coupon attached...');
    const request = createRequestWithCoupon(
      'tools/call',
      { name: 'exampleTool', params: { value: 42 } },
      clientIssuedCoupon
    );
    log('Request created with coupon attached');
    log(JSON.stringify(request, null, 2));

    // Extract and verify the coupon from the request
    log('\n🔍 Extracting and verifying coupon from request...');
    const extractedCoupon = extractAndVerifyCoupon(request, true);
    if (extractedCoupon) {
      log('✓ Coupon extracted and verified successfully');
      log(`Coupon ID: ${extractedCoupon.id}`);
      log(`From: ${extractedCoupon.issuer.commonName}`);
      log(`To: ${extractedCoupon.recipient.commonName}`);
      log(`Purpose: ${extractedCoupon.data?.purpose}`);
      
      // Store the extracted coupon
      await couponStorage.storeCoupon(extractedCoupon);
      log('Extracted coupon stored in storage');
    } else {
      log('❌ Failed to extract and verify coupon from request');
    }

    // List all stored coupons
    log('\n📋 Listing all stored coupons:');
    const allCoupons = await couponStorage.getAllCoupons();
    log(`Found ${allCoupons.length} coupons in storage:`);
    
    for (const coupon of allCoupons) {
      log(`\nCoupon ID: ${coupon.id}`);
      log(`Issuer: ${coupon.issuer.commonName} (${coupon.issuer.organization})`);
      log(`Recipient: ${coupon.recipient.commonName} (${coupon.recipient.organization})`);
      log(`Issued at: ${new Date(coupon.issuedAt).toLocaleString()}`);
      if (coupon.expiresAt) {
        log(`Expires at: ${new Date(coupon.expiresAt).toLocaleString()}`);
      }
      log(`Purpose: ${coupon.data?.purpose || 'not specified'}`);
    }

    // Filter coupons by issuer
    log('\n🔎 Filtering coupons by issuer:');
    const clientIssuedCoupons = await couponStorage.filterCoupons({
      issuerCommonName: clientDN.commonName
    });
    log(`Found ${clientIssuedCoupons.length} coupons issued by ${clientDN.commonName}`);

    // Cleanup
    log('\n🧹 Cleaning up...');
    await couponStorage.clearStorage();
    log('Coupon storage cleared');

    log('\n✨ Demo completed successfully');
    outputStream.end();
    console.log(`Output saved to ${outputFile}`);
  } catch (error) {
    log(`\n❌ Error: ${(error as Error).message}`);
    console.error(error);
    outputStream.end();
  }
}

// Run the demo
runCouponDemo();