# Multi-stage build for production
FROM node:21 AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci

# Copy source code
COPY src ./src
COPY tsconfig.json ./
COPY webpack.config.js ./
COPY public ./public

# Build application
RUN npm run build

# Production stage
FROM node:21-slim

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install OpenSSL (required by Prisma) and production dependencies
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/* && \
    npm ci --only=production && \
    npx prisma generate

# Copy built artifacts from builder
COPY --from=builder /app/build ./build
COPY --from=builder /app/public ./public
COPY --from=builder /app/src/client/templates ./src/client/templates
COPY --from=builder /app/src/client/assets ./src/client/assets

# Use the existing non-root node user (UID 1000)
RUN chown -R node:node /app

USER node

EXPOSE 8080

# Run migrations and start server
CMD ["sh", "-c", "npx prisma migrate deploy && npm run start"]
