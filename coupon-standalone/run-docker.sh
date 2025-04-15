#!/bin/bash

# Exit on error
set -e

echo "🔨 Building Docker image..."
docker build -t mcp-coupon-demo .

echo "🚀 Running Docker container..."
docker run --rm -p 3000:3000 mcp-coupon-demo