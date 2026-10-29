# ==============================================================================
# LOOP SPIT — Production Frontend Dockerfile
# Multi-stage build: Vite compilation + Unprivileged Nginx SPA static server
# ==============================================================================

# Stage 1: Build React/Vite application
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package definitions
COPY package*.json ./

# Install all build dependencies
RUN npm ci

# Copy frontend source files
COPY . .

# Build arguments for public client-side variables (never include secrets)
ARG VITE_API_URL=""
ARG VITE_GOOGLE_CLIENT_ID=""
ENV VITE_API_URL=${VITE_API_URL} \
    VITE_GOOGLE_CLIENT_ID=${VITE_GOOGLE_CLIENT_ID}

# Production build and prerender SEO HTML
RUN npm run build

# Stage 2: Serve with official unprivileged Nginx (runs as user nginx, UID: 101)
FROM nginxinc/nginx-unprivileged:1.27-alpine AS runner

# OpenContainers metadata linking to GitHub Packages repository
LABEL org.opencontainers.image.source="https://github.com/swapnil-exxe/loop" \
      org.opencontainers.image.description="LOOP SPIT Frontend Web Application" \
      org.opencontainers.image.licenses="MIT"

# Copy custom Nginx configuration for SPA routing and API reverse proxy
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy production static assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose unprivileged web port
EXPOSE 8080

# Healthcheck for Nginx web server
HEALTHCHECK --interval=20s --timeout=5s --retries=3 --start-period=5s \
  CMD wget -qO- http://127.0.0.1:8080/ || exit 1

STOPSIGNAL SIGQUIT

CMD ["nginx", "-g", "daemon off;"]
