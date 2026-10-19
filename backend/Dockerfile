# ==============================================================================
# DMS Backend - Multi-stage Production Dockerfile (Alpine)
# ==============================================================================

# Build Stage (handles native modules like bcrypt)
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

# Install native compilation dependencies for packages like bcrypt
RUN apk add --no-cache python3 make g++

# Copy package manifests
COPY package*.json ./

# Install dependencies cleanly
RUN npm ci

# ------------------------------------------------------------------------------
# Production Runtime Stage
# ------------------------------------------------------------------------------
FROM node:20-alpine AS runner

WORKDIR /usr/src/app

ENV NODE_ENV=production \
    PORT=5000 \
    DB_HOST=db \
    DB_PORT=3306 \
    DB_NAME=helpdesk_db \
    DB_USER=dms_app

# Copy dependencies from builder
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/package*.json ./

# Copy application source code
COPY . .

# Ensure upload directory exists and has proper permissions
RUN mkdir -p uploads && chown -R node:node /usr/src/app

# Run as non-root user for security
USER node

# Expose backend port
EXPOSE 5000

# Container healthcheck using Node's built-in fetch (no curl needed)
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://localhost:5000/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

# Start the application
CMD ["node", "start.cjs"]
