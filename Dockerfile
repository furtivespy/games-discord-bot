# syntax = docker/dockerfile:1

ARG BUN_VERSION=1.3.14
FROM oven/bun:${BUN_VERSION} AS base

LABEL fly_launch_runtime="Bun"

WORKDIR /app

ENV NODE_ENV="production"


# Throw-away build stage to reduce size of final image
FROM base AS build

# Install packages needed to build native modules (canvas)
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev libpixman-1-dev git pkg-config python-is-python3 && \
    rm -rf /var/lib/apt/lists/*

# Install dependencies
COPY --link package.json bun.lock ./
RUN bun install --frozen-lockfile --production

# Copy application code
COPY --link . .

# Final stage for app image
FROM base

# Install runtime dependencies for canvas and color emoji fonts
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y \
    libcairo2 libpango-1.0-0 libjpeg62-turbo libgif7 librsvg2-2 libpixman-1-0 \
    fonts-noto-color-emoji fontconfig && \
    fc-cache -fv && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Copy built application
COPY --from=build /app /app

# Setup sqlite on a separate volume
RUN mkdir -p /data
VOLUME /data

EXPOSE 3000
ENV DATABASE_URL="file:///data/sqlite.db"
CMD [ "bun", "run", "start" ]
