# base-chat-webui Web – production image (nginx, non-root)
#
# Stage 1: Vite production build (npm workspaces – context = repository root)
# Stage 2: static files behind nginx on port 8080 (unprivileged)
#
# Build: docker build -f apps/web/Dockerfile -t base-chat-webui/web .

FROM node:24-alpine AS build
# HUSKY=0: no .git in the build context – skip the `prepare` hook
# node-llama-cpp (transitive via @tobilu/qmd): no prebuilds for musl/Alpine –
# skip its postinstall build (not needed for the static web build)
ENV HUSKY=0 NODE_LLAMA_CPP_POSTINSTALL=skip
# better-sqlite3 (workspace dep) ships no musl prebuilds -> compile from source
RUN apk add --no-cache python3 make g++
WORKDIR /app
COPY .npmrc package.json package-lock.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
COPY packages/shared/src packages/shared/src
RUN npm ci --no-audit --no-fund
COPY apps/web ./apps/web
# VITE_CONTEXT_MESSAGES has a code-level default (20) – no build env needed
RUN npm run build -w web

FROM nginx:stable-alpine
# Non-root: minimal main config (pid in /tmp) + server block on port 8080
COPY deploy/nginx-main.conf /etc/nginx/nginx.conf
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
USER nginx
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/ || exit 1