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
# Chromium renders the PDF exports; tini reaps its child processes.
RUN apk add --no-cache chromium nss freetype harfbuzz ttf-freefont font-noto-emoji tini

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

RUN mkdir -p /data && chown node:node /data
USER node

EXPOSE 3000
VOLUME /data
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://127.0.0.1:3000/api/auth/status >/dev/null || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "src/index.js"]
