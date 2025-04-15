#!/bin/bash

# Install dependencies if needed
if [ ! -d "node_modules/ws" ] || [ ! -d "node_modules/express" ] || [ ! -d "node_modules/cors" ] || [ ! -d "node_modules/node-fetch" ]; then
  echo "Installing required dependencies..."
  npm install ws express cors node-fetch
fi

# Check if JavaScript files exist
if [ -f "examples/client-mcp-server.js" ] && [ -f "examples/main-mcp-server.js" ] && [ -f "examples/reputation-mcp-server.js" ] &&
   [ -f "examples/shared/websocket-transport.js" ] && [ -f "examples/shared/certificate-utils.js" ]; then
  echo "JavaScript files found. Using pre-compiled files..."
else
  echo "Some JavaScript files are missing. Checking TypeScript files..."
  # Make sure shared directory exists
  mkdir -p examples/shared
  
  # Check if shared TypeScript files exist
  if [ -f "examples/shared/websocket-transport.ts" ]; then
    echo "Compiling shared WebSocket transport..."
    npx tsc examples/shared/websocket-transport.ts --esModuleInterop --resolveJsonModule --target es2020 --module esnext --moduleResolution node --skipLibCheck
  else
    echo "ERROR: Missing WebSocketTransport implementation. Please create examples/shared/websocket-transport.ts"
    exit 1
  fi
  
  if [ -f "examples/shared/certificate-utils.ts" ]; then
    echo "Compiling certificate utilities..."
    npx tsc examples/shared/certificate-utils.ts --esModuleInterop --resolveJsonModule --target es2020 --module esnext --moduleResolution node --skipLibCheck
  else
    echo "ERROR: Missing certificate utilities. Please create examples/shared/certificate-utils.ts"
    exit 1
  fi
  
  # Try to compile server files if they exist
  if [ -f "examples/client-mcp-server.ts" ]; then
    echo "Compiling client MCP server..."
    npx tsc examples/client-mcp-server.ts --esModuleInterop --resolveJsonModule --target es2020 --module esnext --moduleResolution node --skipLibCheck || echo "Warning: Compilation failed, but will attempt to use existing JS file"
  fi
  
  if [ -f "examples/main-mcp-server.ts" ]; then
    echo "Compiling main MCP server..."
    npx tsc examples/main-mcp-server.ts --esModuleInterop --resolveJsonModule --target es2020 --module esnext --moduleResolution node --skipLibCheck || echo "Warning: Compilation failed, but will attempt to use existing JS file"
  fi
  
  if [ -f "examples/reputation-mcp-server.ts" ]; then
    echo "Compiling reputation MCP server..."
    npx tsc examples/reputation-mcp-server.ts --esModuleInterop --resolveJsonModule --target es2020 --module esnext --moduleResolution node --skipLibCheck || echo "Warning: Compilation failed, but will attempt to use existing JS file"
  fi
fi

echo "Starting servers..."

# Start each server in a new terminal window/tab or in background
if [ "$(uname)" == "Darwin" ]; then
  # macOS
  osascript -e 'tell app "Terminal" to do script "cd \"'$PWD'\" && node examples/client-mcp-server.js"'
  osascript -e 'tell app "Terminal" to do script "cd \"'$PWD'\" && node examples/main-mcp-server.js"'
  osascript -e 'tell app "Terminal" to do script "cd \"'$PWD'\" && node examples/reputation-mcp-server.js"'
elif [ "$(expr substr $(uname -s) 1 5)" == "Linux" ] && command -v xterm &> /dev/null; then
  # Linux with xterm
  xterm -e "cd \"$PWD\" && node examples/client-mcp-server.js" &
  xterm -e "cd \"$PWD\" && node examples/main-mcp-server.js" &
  xterm -e "cd \"$PWD\" && node examples/reputation-mcp-server.js" &
else
  # Fallback - just start them in the background
  echo "Starting all servers in background. Check individual logs for details."
  node examples/client-mcp-server.js > client-server.log 2>&1 &
  node examples/main-mcp-server.js > main-server.log 2>&1 &
  node examples/reputation-mcp-server.js > reputation-server.log 2>&1 &
  
  echo "Servers started in background. View logs with:"
  echo "  tail -f client-server.log"
  echo "  tail -f main-server.log"
  echo "  tail -f reputation-server.log"
fi

echo ""
echo "================================================"
echo "MCP Coupon Ecosystem is now running!"
echo ""
echo "Client MCP Server:      http://localhost:3001"
echo "Main MCP Server:        http://localhost:3002"
echo "Reputation MCP Server:  http://localhost:3003"
echo ""
echo "To configure Claude Desktop, see examples/claude_config.txt"
echo "================================================"