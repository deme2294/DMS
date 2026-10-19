# ==============================================================================
# DMS Frontend - Production Multi-Stage Dockerfile (React + Vite + Nginx)
# ==============================================================================

# Stage 1: Build the React SPA
FROM node:20-alpine AS builder

WORKDIR /app

# Accept optional build argument for frontend API URL (defaults to relative /api)
ARG VITE_API_URL=/api
ENV VITE_API_URL=${VITE_API_URL}

# Copy dependency manifests
COPY package*.json ./

# Install dependencies cleanly
RUN npm ci

# Copy source code
COPY . .

# Build production bundle (tsc -b && vite build)
RUN npm run build

# ------------------------------------------------------------------------------
# Stage 2: Serve with lightweight Nginx Alpine
# ------------------------------------------------------------------------------
FROM nginx:1.27-alpine AS runner

# Remove default Nginx website
RUN rm -rf /usr/share/nginx/html/*

# Copy built static assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom Nginx configuration (reverse proxy for /api, /uploads, /socket.io)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose standard HTTP port
EXPOSE 80

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -q --spider http://127.0.0.1/ || exit 1

# Start Nginx in foreground
CMD ["nginx", "-g", "daemon off;"]
