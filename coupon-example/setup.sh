#!/bin/bash

# Create a local SDK module by linking the files
echo "📦 Setting up SDK links..."

# Create node_modules directory if it doesn't exist
mkdir -p node_modules/@mcp-sdk

# Link the SDK files
ln -sf ../../.. node_modules/@mcp-sdk/sdk

# Update import paths in the source files
echo "🔄 Updating import paths..."

# Fix the imports in all TypeScript files
find ./src -name "*.ts" -type f -exec sed -i '' 's|../../src/|@mcp-sdk/sdk/src/|g' {} \;

echo "✅ Setup complete!"