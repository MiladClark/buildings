FROM node:24-bookworm-slim AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
ARG NPM_REGISTRY=https://registry.npmjs.org
RUN --mount=type=cache,target=/root/.npm npm ci --registry="$NPM_REGISTRY" \
    --no-audit --no-fund --fetch-timeout=60000 --fetch-retries=1 --loglevel=http

FROM dependencies AS builder
ENV NEXT_TELEMETRY_DISABLED=1
COPY . .
# Static compilation does not connect to the runtime database.
RUN DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build npm run build

FROM node:24-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3300 \
    CHAT_UPLOAD_DIR=/app/data/chat-uploads
RUN mkdir -p /app/data /app/.next && chown -R node:node /app
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public
# Keep the complete migration package: it is loaded only by the entrypoint.
COPY --from=dependencies --chown=node:node /app/node_modules/drizzle-orm ./node_modules/drizzle-orm
COPY --from=dependencies --chown=node:node /app/node_modules/postgres ./node_modules/postgres
COPY --from=builder --chown=node:node /app/drizzle/postgresql ./drizzle/postgresql
COPY --from=builder --chown=node:node /app/scripts/production ./scripts/production
USER node
EXPOSE 3300
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:3300/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "scripts/production/start.mjs"]
