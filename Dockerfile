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

# Install production dependencies only
RUN npm ci --only=production && \
    npx prisma generate

# Copy built artifacts from builder
COPY --from=builder /app/build ./build
COPY --from=builder /app/public ./public
COPY --from=builder /app/src/client/templates ./src/client/templates

# Create non-root user
RUN useradd -m -u 1000 appuser && \
    chown -R appuser:appuser /app

USER appuser

EXPOSE 8080

# Run migrations and start server
CMD ["sh", "-c", "npx prisma migrate deploy && npm run start"]
