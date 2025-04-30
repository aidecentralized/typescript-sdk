# MCP Coupon Example

This example demonstrates how to use the coupon system in the Model Context Protocol (MCP) TypeScript SDK. It includes both a server and client implementation that validate and use coupons for secure communication.

## What are Coupons?

Coupons are verifiable tokens that prove the legitimacy of requests between clients and servers. They help establish trust and reputation in a decentralized system. When a client makes a request to a server, the server issues a verifiable `Coupon`, which proves:
- The request occurred
- The issuer's identity
- The recipient's identity
- The legitimacy of the interaction

## Features

- Server with coupon validation endpoints
- Client that generates and attaches coupons to requests
- Certificate generation for testing
- Request issuance and validation

## Installation

```bash
# Install dependencies
npm install

# Build the project
npm run build
```

## Running the Example

```bash
# Start the example
npm start

# Or run in development mode
npm run dev
```

## Docker

You can also build and run this example using Docker:

```bash
# Build the Docker image
npm run docker-build

# Run the Docker container
docker run -p 3000:3000 mcp-coupon-example
```

## How It Works

1. The server and client generate self-signed certificates for testing
2. The server exposes endpoints for issuing and validating coupons
3. The client requests a coupon from the server
4. The client makes a secure request with a coupon attached
5. The server validates the coupon and processes the request

## API Endpoints

- `GET /health` - Health check endpoint
- `GET /coupons` - List all coupons (coupon endpoint from SDK)
- `GET /api/coupons` - Get all stored coupons with metadata
- `POST /api/issue-coupon` - Request a new coupon from the server
- `POST /api/validate-coupon` - Validate a coupon-authenticated request

## Security Considerations

This example uses self-signed certificates for demonstration purposes. In a production environment, you should:

1. Use proper X.509 certificates issued by trusted Certificate Authorities
2. Implement secure storage for certificates and private keys
3. Set up certificate revocation mechanisms
4. Configure coupon expiration policies
5. Implement rate limiting for coupon issuance