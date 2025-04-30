FROM node:18-alpine

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies including express, cors, and uuid
RUN npm install express cors uuid

# Copy demo file and mark as executable
COPY mcp-coupon-demo.cjs ./

# Expose port
EXPOSE 3000

# Run the demo application
CMD ["node", "mcp-coupon-demo.cjs"]