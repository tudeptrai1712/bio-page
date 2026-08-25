FROM node:20-alpine AS builder

# Install build dependencies for native sqlite modules
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy dependency definitions
COPY package*.json ./

# Install all dependencies
RUN npm install --production

# -------------------------------------------------------------
FROM node:20-alpine AS runner

WORKDIR /app

# Copy production node_modules from builder
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./

# Copy source code and static assets
COPY src/ ./src/
COPY public/ ./public/

# Persistent data directory
VOLUME ["/app/data"]

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "src/server.js"]

