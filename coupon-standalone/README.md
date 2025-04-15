# MCP Coupon Standalone Example

A standalone implementation of the Model Context Protocol (MCP) coupon system. This example demonstrates how to create, validate, and use coupons for secure server-client communication.

## What are Coupons?

Coupons are verifiable tokens that prove the legitimacy of requests between clients and servers. They help establish trust and reputation in a decentralized system. When a client makes a request to a server, the server issues a verifiable `Coupon`, which proves:
- The request occurred
- The issuer's identity
- The recipient's identity
- The legitimacy of the interaction

## Features

This example demonstrates:

- Certificate and key generation for establishing identity
- Coupon creation, signing, and verification
- Coupon storage and retrieval
- Server and client interaction using coupons
- RESTful API for coupon management

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

The example will:
1. Start a coupon server on port 3000
2. Create a client that connects to the server
3. Request a coupon from the server
4. Make a secure request with a client-generated coupon
5. List all coupons in the system

## API Endpoints

The server exposes the following endpoints:

- `GET /health` - Health check endpoint
- `GET /identity` - Get server identity information
- `GET /coupons` - List all coupons with optional filtering
- `POST /issue-coupon` - Request a new coupon from the server
- `POST /validate-coupon` - Validate a coupon-authenticated request

## Docker Support

Build a Docker image with:

```bash
npm run docker-build
```

Run the Docker container:

```bash
docker run -p 3000:3000 mcp-coupon-standalone
```

## Security Considerations

This example uses self-signed certificates for demonstration purposes. In a production environment, you should:

1. Use proper X.509 certificates issued by trusted Certificate Authorities
2. Implement secure storage for certificates and private keys
3. Set up certificate revocation mechanisms
4. Configure coupon expiration policies
5. Implement rate limiting for coupon issuance