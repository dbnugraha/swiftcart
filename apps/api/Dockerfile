# syntax=docker/dockerfile:1
#
# The build context is the repository ROOT, not apps/api. The API imports
# @swiftcart/shared and installs against the workspace lockfile, and neither is
# reachable from a narrower context:
#
#   docker build -f apps/api/Dockerfile -t swiftcart-api .
#
# Two images come out of this file. `runtime` is the server: compiled JavaScript
# and production dependencies, nothing else. `toolchain` keeps the sources and
# dev dependencies so it can run `prisma migrate deploy` and the seed, which
# need the Prisma CLI and tsx. Splitting them keeps the CLI and the whole
# TypeScript compiler out of the image that faces the network.

ARG NODE_VERSION=24-bookworm-slim

# --------------------------------------------------------------------- base

# Debian rather than Alpine: @node-rs/argon2 and Prisma both publish glibc
# prebuilds, so this installs binaries instead of compiling Rust at image build.
FROM node:${NODE_VERSION} AS base

# Prisma's schema engine links against libssl and cannot detect the version on
# a slim image without this, which turns `migrate deploy` into a coin flip.
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# NODE_ENV is deliberately unset here. npm reads it, and `production` would drop
# the dev dependencies that the build and toolchain stages are made of. Only the
# runtime stage sets it.

# --------------------------------------------------------------------- deps

FROM base AS deps

# Manifests first and alone, so editing a source file does not invalidate the
# install layer. apps/mobile's manifest is copied but its workspace is never
# installed: npm needs every manifest present to reconcile the lockfile against
# the workspace list, while Expo would add hundreds of megabytes of dependencies
# the server never loads.
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/mobile/package.json apps/mobile/

# --ignore-scripts: the root postinstall builds packages/shared, whose sources
# are not in this stage. The build stage runs that compile explicitly.
RUN --mount=type=cache,target=/root/.npm \
    npm ci --ignore-scripts \
        --include-workspace-root \
        --workspace @swiftcart/shared \
        --workspace @swiftcart/api

# -------------------------------------------------------------------- build

FROM deps AS build

# prisma.config.ts reads this when the CLI loads it, so `prisma generate` will
# not start without it. Generation opens no connection — this is a placeholder,
# and the real URL arrives from the environment at runtime.
ENV DATABASE_URL="postgres://build:build@127.0.0.1:5432/build"

COPY packages/shared packages/shared
COPY apps/api apps/api

# shared before api: the API's typecheck resolves @swiftcart/shared through its
# compiled dist, not its source, so the build fails if this order is swapped.
RUN npm run build --workspace @swiftcart/shared \
 && npm run build --workspace @swiftcart/api

# ---------------------------------------------------------------- toolchain

# Migrations and seeding. Same layers as `build`, so this costs nothing extra to
# produce; it exists as a named stage purely so compose can target it.
FROM build AS toolchain

WORKDIR /app/apps/api

CMD ["npx", "prisma", "migrate", "deploy"]

# ---------------------------------------------------------------- prod-deps

FROM base AS prod-deps

COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/mobile/package.json apps/mobile/

# --legacy-peer-deps is what makes this image lean rather than a correctness
# choice. @prisma/client declares `prisma` and `typescript` as OPTIONAL peers,
# and npm installs optional peers by default — dragging the CLI, the compiler
# and Studio's React tree into a production install. They are only reachable
# through a dev edge or that optional peer edge, so `--omit=dev` alone leaves
# them behind. `--omit=optional` would evict them but also @node-rs/argon2's
# platform binary, which is a real optionalDependency, and password hashing
# would stop working. Refusing to auto-install peers drops exactly the unwanted
# set: 366MB of node_modules becomes 109MB.
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev --ignore-scripts --legacy-peer-deps \
        --include-workspace-root \
        --workspace @swiftcart/api

# ------------------------------------------------------------------ runtime

FROM base AS runtime

ENV NODE_ENV=production

# npm links @swiftcart/shared as a symlink into packages/shared, so the package
# has to land at exactly that path or the import fails at startup. Copying the
# whole prod-deps tree preserves both the link and anything npm chose not to
# hoist to the root.
COPY --from=prod-deps --chown=node:node /app ./
COPY --from=build --chown=node:node /app/packages/shared/dist packages/shared/dist
COPY --from=build --chown=node:node /app/apps/api/dist apps/api/dist

# Unprivileged: the node images ship a `node` user for this.
USER node

WORKDIR /app/apps/api

EXPOSE 4000

# /healthz returns 503 only when Postgres is unreachable, which is the one
# dependency this process cannot serve without. The slim image has no curl, and
# fetch is global on Node 18+, so this needs nothing installed.
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# node directly rather than `npm start`: npm would sit between the init process
# and the server, and src/server.ts handles SIGTERM itself to drain in-flight
# requests before closing the pool.
CMD ["node", "--enable-source-maps", "dist/src/server.js"]
