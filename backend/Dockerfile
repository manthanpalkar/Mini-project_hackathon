# ==============================================================================
# LOOP SPIT — Production Backend Dockerfile
# Multi-stage build with pinned Node.js LTS, non-root user, and health check
# ==============================================================================

# Stage 1: Install production dependencies only
FROM node:20-alpine AS deps

WORKDIR /app

# Copy dependency definition files
COPY package*.json ./

# Install production dependencies reproducibly and clean npm cache
RUN npm ci --omit=dev && npm cache clean --force

# Stage 2: Minimal production runtime image
FROM node:20-alpine AS runner

WORKDIR /app

# Set default production environment variables
ENV NODE_ENV=production \
    PORT=5001 \
    HOST=0.0.0.0

# Copy node_modules from deps stage with non-root ownership
COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package*.json ./

# Copy backend application source code
COPY --chown=node:node . .

# Run as built-in non-root user 'node' (UID: 1000, GID: 1000)
USER node

# Expose internal backend port
EXPOSE 5001

# Docker native health check using standard Node.js HTTP probe against /health
HEALTHCHECK --interval=20s --timeout=5s --retries=3 --start-period=15s \
  CMD node -e "require('http').get('http://127.0.0.1:' + (process.env.PORT || 5001) + '/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

# Graceful termination handling via SIGTERM
STOPSIGNAL SIGTERM

# Start server
CMD ["node", "server.js"]
