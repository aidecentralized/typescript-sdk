#!/bin/bash

# Ensure the script exits immediately if any command fails
set -e

echo "🔨 Building the MCP Coupon Example..."
npm install
npm run build

echo "🚀 Running the example..."
npm start

echo "✅ Example completed successfully"