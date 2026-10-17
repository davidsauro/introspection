# --- Build the Vue client ---
FROM node:22-alpine AS client
WORKDIR /app/client
COPY client/package.json client/package-lock.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# --- Install server production dependencies (better-sqlite3 compiles native code) ---
FROM node:22-alpine AS server-deps
RUN apk add --no-cache python3 make g++
WORKDIR /app
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev

# --- Runtime ---
FROM node:22-alpine
# Chromium renders the PDF exports; tini reaps its child processes; su-exec drops root after
# the entrypoint fixes data-folder ownership. Liberation Sans stands in for Arial/Helvetica.
RUN apk add --no-cache chromium nss freetype harfbuzz font-liberation font-noto-emoji tini su-exec

ENV NODE_ENV=production \
    PORT=3000 \
    DB_PATH=/data/diary.db \
    PUBLIC_DIR=/app/public \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app
COPY --from=server-deps /app/node_modules ./node_modules
COPY server/package.json ./
COPY server/src ./src
COPY --from=client /app/client/dist ./public

COPY --chmod=755 docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN mkdir -p /data && chown node:node /data

EXPOSE 3000
VOLUME /data
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://127.0.0.1:3000/api/auth/status >/dev/null || exit 1

# Starts as root only to fix /data ownership; the app itself runs as the `node` user.
ENTRYPOINT ["/sbin/tini", "--", "docker-entrypoint.sh"]
CMD ["node", "src/index.js"]
