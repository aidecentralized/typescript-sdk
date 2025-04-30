import { createServer } from './server.js';
import { createClient } from './client.js';
import { couponStorage } from './storage.js';

/**
 * Main function to demonstrate the coupon system
 */
async function main() {
  try {
    console.log('🚀 Starting Coupon System Example');
    
    // Create and start the server
    console.log('\n📡 Setting up server...');
    const port = 3000;
    const { serverIdentity, stop } = await createServer(port);
    
    // Wait a moment for server to initialize
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Create a client that connects to the server
    console.log('\n🔌 Setting up client...');
    const serverUrl = `http://localhost:${port}`;
    const { 
      clientIdentity, 
      requestCoupon, 
      makeSecureRequest, 
      getAllCoupons
    } = await createClient(serverUrl);
    
    // Request a coupon from the server
    console.log('\n🎫 Requesting coupon from server...');
    const serverIssuedCoupon = await requestCoupon('example-purpose');
    console.log(`Received coupon with ID: ${serverIssuedCoupon.id}`);
    
    // Make a secure request with a client-generated coupon
    console.log('\n🔒 Making secure request with client-generated coupon...');
    const testData = { message: 'Hello, secure world!', timestamp: new Date().toISOString() };
    const secureResponse = await makeSecureRequest(testData, 'secure-message');
    
    console.log('Response from secure endpoint:');
    console.log(JSON.stringify(secureResponse, null, 2));
    
    // List all coupons
    console.log('\n📋 Listing all coupons:');
    const allCoupons = await couponStorage.getAllCoupons();
    console.log(`Found ${allCoupons.length} coupons:`);
    for (const coupon of allCoupons) {
      console.log(`- ID: ${coupon.id}`);
      console.log(`  From: ${coupon.issuer.commonName} to ${coupon.recipient.commonName}`);
      console.log(`  Purpose: ${coupon.data?.purpose}`);
      console.log(`  Issued: ${new Date(coupon.issuedAt).toLocaleString()}`);
      if (coupon.expiresAt) {
        console.log(`  Expires: ${new Date(coupon.expiresAt).toLocaleString()}`);
      }
      console.log();
    }
    
    // Clean up
    console.log('\n🧹 Cleaning up...');
    setTimeout(() => {
      stop();
      console.log('✅ Example completed successfully');
    }, 1000);
    
  } catch (error) {
    console.error('❌ Error running example:', error);
    process.exit(1);
  }
}

// Run the example
main();