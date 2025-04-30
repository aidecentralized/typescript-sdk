# MCP TypeScript SDK Documentation

Welcome to the documentation for the Model Context Protocol (MCP) TypeScript SDK. This documentation provides comprehensive information about the SDK's components, features, and usage.

## Components

- [**Coupon System**](./coupon/index.md): A cryptographically secure system for creating, signing, verifying, and managing coupons that establish trust between clients and servers.

## What is MCP?

The Model Context Protocol (MCP) is a standardized protocol for integrating AI models with various tools, resources, and capabilities. It provides a consistent interface for AI systems to interact with their environment, access tools, and exchange information.

## SDK Overview

This TypeScript SDK provides a complete implementation of the MCP protocol, allowing developers to:

1. Build MCP clients that can connect to MCP servers
2. Implement MCP servers that offer tools and resources
3. Integrate with AI systems and other MCP components
4. Establish trust and reputation through the coupon system

## Getting Started

To get started with the MCP TypeScript SDK, first install it from npm:

```
npm install @typescript-sdk/sdk
```

Then, import the components you need:

```typescript
// Client-side
import { Client } from '@typescript-sdk/sdk/client';

// Server-side
import { Server } from '@typescript-sdk/sdk/server';

// Coupon system
import { createCoupon, verifyCoupon } from '@typescript-sdk/sdk/coupon';
```

For more detailed information, see the documentation for each component.