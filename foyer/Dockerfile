ARG BUILD_FROM=node:22-alpine
FROM ${BUILD_FROM}

ENV NODE_ENV=production
WORKDIR /app

# No dependencies to install: Foyer uses only Node's own modules.
COPY app/package.json /app/package.json
COPY app/server.js /app/server.js
COPY app/lib /app/lib
COPY app/public /app/public

EXPOSE 8110
HEALTHCHECK --interval=60s --timeout=5s --start-period=20s CMD wget -q -O /dev/null "http://127.0.0.1:${FOYER_PORT:-8110}/healthz" || exit 1

CMD ["node", "/app/server.js"]
