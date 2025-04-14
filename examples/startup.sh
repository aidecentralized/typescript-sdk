#!/bin/bash

# Install dependencies if needed
if [ ! -d "node_modules/ws" ] || [ ! -d "node_modules/express" ] || [ ! -d "node_modules/cors" ] || [ ! -d "node_modules/node-fetch" ]; then
  echo "Installing required dependencies..."
  npm install ws express cors node-fetch
fi

# Check if TypeScript files exist
if [ -f "examples/client-mcp-server.ts" ] && [ -f "examples/main-mcp-server.ts" ] && [ -f "examples/reputation-mcp-server.ts" ]; then
  echo "TypeScript files found. Compiling..."
  # Compile TypeScript files
  npx tsc examples/client-mcp-server.ts --esModuleInterop --resolveJsonModule --target es2020 --module esnext --moduleResolution node
  npx tsc examples/main-mcp-server.ts --esModuleInterop --resolveJsonModule --target es2020 --module esnext --moduleResolution node
  npx tsc examples/reputation-mcp-server.ts --esModuleInterop --resolveJsonModule --target es2020 --module esnext --moduleResolution node
  
  echo "Compilation complete. Starting servers..."
  
  # Start each server in a new terminal window/tab
  if [ "$(uname)" == "Darwin" ]; then
    # macOS
    osascript -e 'tell app "Terminal" to do script "cd \"'$PWD'\" && node examples/client-mcp-server.js"'
    osascript -e 'tell app "Terminal" to do script "cd \"'$PWD'\" && node examples/main-mcp-server.js"'
    osascript -e 'tell app "Terminal" to do script "cd \"'$PWD'\" && node examples/reputation-mcp-server.js"'
  elif [ "$(expr substr $(uname -s) 1 5)" == "Linux" ]; then
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
else
  # JavaScript files
  echo "Starting servers from JavaScript files..."
  
  # Start each server in a new terminal window/tab
  if [ "$(uname)" == "Darwin" ]; then
    # macOS
    osascript -e 'tell app "Terminal" to do script "cd \"'$PWD'\" && node examples/client-mcp-server.js"'
    osascript -e 'tell app "Terminal" to do script "cd \"'$PWD'\" && node examples/main-mcp-server.js"'
    osascript -e 'tell app "Terminal" to do script "cd \"'$PWD'\" && node examples/reputation-mcp-server.js"'
  elif [ "$(expr substr $(uname -s) 1 5)" == "Linux" ]; then
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