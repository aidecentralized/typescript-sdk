import { Server } from '../../src/server/index.js';
import { Client } from '../../src/client/index.js';
import { createCoupon } from '../../src/coupon/create.js';
import { verifyCoupon } from '../../src/coupon/sign.js';
import { couponStorage } from '../../src/coupon/storage/index.js';
import { Certificate, Coupon, DistinguishedName } from '../../src/types/coupon.js';
import { createKeyPair, createSelfSignedCertificate } from './utils.js';
import fs from 'fs';

async function runMCPCouponDemo() {
  // Create output file
  const outputFile = 'mcp-coupon-demo-output.txt';
  const outputStream = fs.createWriteStream(outputFile, { flags: 'w' });
  
  // Helper to log to console and file
  const log = (message: string) => {
    console.log(message);
    outputStream.write(message + '\n');
  };

  log('🚀 Starting MCP Coupon Demo');
  log('==============================');

  try {
    // Create server identity (would normally come from a real certificate)
    log('\n📜 Generating server identity...');
    const serverKeyPair = await createKeyPair();
    const serverDN: DistinguishedName = {
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

    // Create client identity (would normally come from a real certificate)
    log('\n📜 Generating client identity...');
    const clientKeyPair = await createKeyPair();
    const clientDN: DistinguishedName = {
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

    // Initialize MCP server with coupon support
    log('\n🖥️ Creating MCP server with coupon support...');
    const mcpServer = new Server(
      { name: 'MCPCouponDemo', version: '1.0.0' },
      { enableCoupons: true }
    );

    // Configure coupon identity for the server
    mcpServer.configureCouponIdentity(
      serverDN,
      serverCertificate,
      serverKeyPair.privateKey
    );
    log('Server configured with coupon identity');

    // Set up coupon callback
    mcpServer.oncoupon = (coupon: Coupon) => {
      log(`✓ Server received valid coupon: ${coupon.id}`);
      log(`  From: ${coupon.issuer.commonName}`);
      log(`  Purpose: ${coupon.data?.purpose || 'not specified'}`);
      return true;
    };
    log('Server coupon callback configured');

    // Initialize MCP client
    log('\n💻 Creating MCP client with coupon support...');
    const mcpClient = new Client(
      { name: 'MCPCouponClient', version: '1.0.0' },
      {
        enableCoupons: true,
        clientDN,
        clientCertificate,
        clientPrivateKey: clientKeyPair.privateKey
      }
    );
    log('Client created with coupon support');

    // Issue a coupon from server to client
    log('\n🎫 Issuing server coupon to client...');
    const serverIssuedCoupon = await mcpServer.issueCoupon(
      clientDN,
      { purpose: 'server-issued-demo', timestamp: new Date().toISOString() },
      30 // expire in 30 days
    );
    log(`Server issued coupon with ID: ${serverIssuedCoupon.id}`);
    log(`Expiry: ${serverIssuedCoupon.expiresAt}`);

    // Create a coupon from client to server
    log('\n🎫 Creating client coupon for server...');
    const clientCreatedCoupon = createCoupon(
      clientDN,
      serverDN,
      clientCertificate,
      clientKeyPair.privateKey,
      { purpose: 'client-created-demo', timestamp: new Date().toISOString() },
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
    );
    log(`Client created coupon with ID: ${clientCreatedCoupon.id}`);

    // Verify coupon (as would happen during request handling)
    log('\n✅ Verifying coupons...');
    
    // Verify server-issued coupon
    const isServerCouponValid = verifyCoupon(serverIssuedCoupon);
    log(`Server-issued coupon validation: ${isServerCouponValid ? 'VALID' : 'INVALID'}`);
    
    // Verify client-created coupon
    const isClientCouponValid = verifyCoupon(clientCreatedCoupon);
    log(`Client-created coupon validation: ${isClientCouponValid ? 'VALID' : 'INVALID'}`);

    // Store the client's coupon (as would happen during request processing)
    log('\n💾 Storing client coupon...');
    await couponStorage.storeCoupon(clientCreatedCoupon);
    
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
runMCPCouponDemo();