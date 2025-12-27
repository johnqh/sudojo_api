# Build stage
FROM oven/bun:1 AS builder

WORKDIR /app

# Copy package files
COPY package.json bun.lock ./

# Install dependencies (including devDependencies for build)
ARG NPM_TOKEN
RUN echo "//registry.npmjs.org/:_authToken=${NPM_TOKEN}" > ~/.npmrc && \
    bun install --frozen-lockfile && \
    rm ~/.npmrc

# Copy source code
COPY src ./src
COPY tsconfig.json ./

# Type check
RUN bunx tsc --noEmit

# Production stage
FROM oven/bun:1-slim AS production

WORKDIR /app

# Copy package files
COPY package.json bun.lock ./

# Install production dependencies only
ARG NPM_TOKEN
RUN echo "//registry.npmjs.org/:_authToken=${NPM_TOKEN}" > ~/.npmrc && \
    bun install --frozen-lockfile --production && \
    rm ~/.npmrc

# Copy source code (Bun runs TypeScript directly)
COPY src ./src

# Set environment
ENV NODE_ENV=production

# Expose port
EXPOSE 3000

# Start the application
CMD ["bun", "run", "src/index.ts"]
