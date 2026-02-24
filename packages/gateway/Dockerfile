# Dockerfile for OpenClaw Gateway
FROM node:20-slim

WORKDIR /app

# Copy the entire monorepo
COPY . .

# Install dependencies
RUN npm install

# Build the gateway and its dependencies
RUN npm run build

# Expose the gateway port
EXPOSE 18789

# Run the gateway server
CMD ["node", "packages/gateway/dist/main.js", "server"]
