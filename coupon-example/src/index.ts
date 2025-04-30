import { createMCPServer } from './server/server.js';
import { createMCPClient } from './client/client.js';

/**
 * Main function to demonstrate MCP server and client with coupon validation
 */
async function main() {
  try {
    console.log('🚀 Starting MCP Coupon Example');
    
    // Create and start the MCP server
    console.log('\n📡 Setting up server...');
    const port = 3000;
    const { start, stop, serverDN, serverCertificate, serverPrivateKey } = await createMCPServer(port);
    
    // Start the server
    start();
    
    // Create a client that connects to the server
    console.log('\n🔌 Setting up client...');
    const serverBaseUrl = `http://localhost:${port}`;
    const { makeSecureRequest, requestCoupon, clientDN } = await createMCPClient(
      serverBaseUrl,
      serverDN,
      serverCertificate
    );
    
    // Wait a moment for server to initialize
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Request a coupon from the server
    console.log('\n🎫 Requesting coupon from server...');
    const serverIssuedCoupon = await requestCoupon('demo-purpose');
    console.log(`Received coupon with ID: ${serverIssuedCoupon.id}`);
    
    // Make a secure request with a client-generated coupon
    console.log('\n🔒 Making secure request with client-generated coupon...');
    const testData = { message: 'Hello, secure world!', timestamp: new Date().toISOString() };
    const secureResponse = await makeSecureRequest(testData, 'secure-message');
    
    console.log('Response from secure endpoint:');
    console.log(JSON.stringify(secureResponse, null, 2));
    
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