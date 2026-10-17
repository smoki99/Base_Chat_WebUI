# base-chat-webui API – production image
#
# Runtime: tsx (same as dev/CI/E2E). The tsc build (dist/) is not directly
# runnable with plain node (extensionless ESM imports + source-only `shared`
# workspace), so the container executes the TypeScript source via tsx.
#
# Build: docker build -f apps/api/Dockerfile -t base-chat-webui/api .
# (context = repository root – npm workspaces)

FROM node:24-alpine AS deps
# HUSKY=0: no .git in the build context – skip the `prepare` hook
# node-llama-cpp (transitive via @tobilu/qmd): no prebuilds for musl/Alpine –
# skip its postinstall build (MCP is disabled in prod anyway)
ENV HUSKY=0 NODE_LLAMA_CPP_POSTINSTALL=skip
# better-sqlite3 ships no musl prebuilds -> compile from source
RUN apk add --no-cache python3 make g++
WORKDIR /app
COPY .npmrc package.json package-lock.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN npm ci --no-audit --no-fund

FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY apps/api ./apps/api
COPY packages/shared ./packages/shared
# Writable, node-owned data dir for the custom prompt (volume mount target)
RUN mkdir -p apps/api/data && chown -R node:node apps/api/data
# Non-root runtime user (ships with the node:alpine image)
USER node
EXPOSE 4001
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:4001/health || exit 1
CMD ["node_modules/.bin/tsx", "apps/api/src/index.ts"]