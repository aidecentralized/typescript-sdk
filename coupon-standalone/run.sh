#!/bin/bash

# Exit on error
set -e

echo "🔨 Building the MCP Coupon Example..."
npm install
npm run build

echo "🚀 Running the example..."
npm start