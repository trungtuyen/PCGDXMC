FROM node:22-alpine
WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev --ignore-scripts --no-audit --no-fund

COPY server.js auth.js create-admin.js migrate.js loadtest.js smoke-test.js ./
COPY schema.sql ./
COPY migrations ./migrations

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/v1/health >/dev/null 2>&1 || exit 1

CMD ["node","server.js"]
