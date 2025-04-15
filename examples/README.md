# MCP Coupon Ecosystem

This directory contains a complete implementation of a coupon-based reputation system using Model Context Protocol (MCP). The system consists of three distinct MCP servers that work together to demonstrate coupon creation, verification, and reputation tracking.

## System Architecture

The ecosystem consists of three separate MCP servers:

### 1. Client MCP Server (Port 3001)
- Generates client certificates and identities
- Creates signed coupons for authentication
- Provides tools to send authenticated requests to the Main MCP Server

### 2. Main MCP Server (Port 3002)
- Receives requests with coupon authentication
- Verifies coupons with the Reputation MCP Server
- Provides protected resources/tools that require valid coupons
- Manages a list of trusted issuers

### 3. Reputation MCP Server (Port 3003)
- Verifies coupons and maintains verification history
- Tracks reputation scores for entities based on verification results
- Provides both MCP tools and REST API endpoints
- Stores and manages reputation data

## Core Functionality

1. **Identity Management**:
   - Generate client certificates with public/private key pairs
   - Self-signed certificates for demonstration purposes
   
2. **Coupon Creation and Signing**:
   - Create coupons with client identities
   - Sign coupons with private keys
   - Include certificate chains for verification
   
3. **Coupon Verification**:
   - Format validation
   - Signature verification
   - Expiry checking
   - Trusted issuer validation
   
4. **Reputation Tracking**:
   - Record verification results
   - Calculate trust scores based on successful verifications
   - Provide reputation lookup by entity

## Running the Ecosystem

### Prerequisites

```bash
npm install ws express cors node-fetch
```

### Option 1: Easy Startup (Recommended)

Use the provided startup script to automatically launch all three servers:

```bash
chmod +x examples/startup.sh
./examples/startup.sh
```

This script will:
1. Install dependencies if needed
2. Use the pre-compiled JavaScript files or compile TypeScript files if needed
3. Start all three servers in separate terminals or background processes

### Option 2: Manual Startup

Start each server in a separate terminal window:

```bash
# Terminal 1 - Client MCP Server
node examples/client-mcp-server.js

# Terminal 2 - Main MCP Server
node examples/main-mcp-server.js

# Terminal 3 - Reputation MCP Server
node examples/reputation-mcp-server.js
```

### Important Note About Custom Implementations

The examples use custom implementations in the `examples/shared` directory:

- `websocket-transport.js/ts`: Server-side WebSocket transport implementation
- `certificate-utils.js/ts`: Certificate generation utilities

These are required because the SDK currently does not provide these implementations directly.

### Using with Claude Desktop

See the `claude_config.txt` file for instructions on configuring Claude Desktop to connect to all three servers.

## End-to-End Workflow

1. Generate a client certificate using the Client MCP Server
2. Create a coupon for authentication
3. Send a request to the Main MCP Server with the coupon
4. Main server verifies the coupon with the Reputation server
5. Reputation server tracks verification results and updates trust scores
6. Access to protected resources is granted or denied based on verification
7. Reputation data becomes available for future trust decisions

## Implementation Details

The implementation follows the principles set out in the requirements:

1. **Stateless Core SDK**: The core verification functions in `src/coupon/verify.js` are completely stateless
2. **Stateful Services**: Each MCP server maintains its own state (certificates, verification results, reputation scores)
3. **Server Separation**: Clear separation of responsibilities between the three servers
4. **REST + MCP APIs**: Reputation server provides both MCP tools and REST endpoints

The system demonstrates how the coupon verification SDK can be used to build a complete reputation system with proper separation of concerns.