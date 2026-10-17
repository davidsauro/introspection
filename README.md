# Diary

A private, self-hosted daily diary card for one person. It's modelled on the daily page of DBT Pal, without the coaching or exercises. Each day you can:

- rate **emotions** and **urges** on configurable scales (0–5 by default, up to 0–10)
- record whether you **acted on** each urge
- mark each **medication** as taken (Yes/No)
- write free-text **notes**

The **History** screen shows a heatmap and trend charts. **Export** creates a PDF for a therapist. A single day exports as it looks in the app. A range of days exports as a summary with charts, followed by every day.

It works on iPhone, iPad and Mac. On iPhone or iPad, use Safari → Share → *Add to Home Screen* to open it like an app.

Stack: Vue 3 + Vite, Node.js (Express 5), SQLite (better-sqlite3), and headless Chromium for the PDFs, all in one Docker container.

## Run it on the home server

```sh
mkdir -p data && sudo chown 1000:1000 data   # the container runs as uid 1000
docker compose up -d --build
```

The app listens on port **3000**. Point your reverse proxy (which handles HTTPS) at `http://<server>:3000`.

The first visit asks you to choose a password. Settings comes with a starter list of emotions and urges; edit it to suit.

### Configuration (`docker-compose.yml`)

| Variable | Default | Purpose |
|---|---|---|
| `COOKIE_SECURE` | `true` | Login cookie is only sent over HTTPS. Set to `false` only if you open the app over plain HTTP. |
| `TZ` | – | Server time zone (log timestamps). Diary dates always come from the device's own date. |
| `PDF_FORMAT` | `Letter` | `Letter` or `A4`. |
| `REPORT_TITLE` | `Diary Card` | Text in the PDF page header. |
| `TRUST_PROXY` | private networks | Express `trust proxy` setting, if your proxy isn't on a private network. |

### Backups

Everything is stored in `./data/diary.db`. While the app is running, take a consistent copy with:

```sh
sqlite3 data/diary.db ".backup data/diary-backup-$(date +%F).db"
```

You can also stop the container and copy the `data/` folder.

### Forgotten password

Stop the container, remove the stored hash, and start it again. You'll be asked to set a new password. No diary data is lost.

```sh
sqlite3 data/diary.db "DELETE FROM settings WHERE key='password_hash'; DELETE FROM sessions;"
```

## Development

Requires Node 22+.

```sh
cd server && npm install && npm run dev          # API on :3000
cd client && npm install && npm run dev          # Vite on :5173, proxies /api to :3000
```

PDF export in development needs a local Chrome/Chromium, and the server must load the print page from Vite:

```sh
PUPPETEER_EXECUTABLE_PATH=/path/to/chrome PRINT_BASE_URL=http://localhost:5173 npm run dev
```

### Tests

```sh
cd server && npm test     # API tests (node:test), each file against a fresh temporary database
cd client && npm test     # unit tests (Vitest): dates, report building, autosave store
```

The server suite also renders real PDFs when Chromium and a built client are available:

```sh
(cd client && npm run build) && cd server && PUPPETEER_EXECUTABLE_PATH=/path/to/chrome npm test
```

## Layout

```
server/src/app.js             Express app, static hosting + SPA fallback
server/src/index.js           starts the server, graceful shutdown
server/src/db.js              SQLite connection, migrations (PRAGMA user_version), seed data
server/src/auth.js            single-password login, SQLite-backed sessions
server/src/routes/            trackers, medications, days, export (PDF via puppeteer-core)
client/src/views/             Day, History, Export, Settings, Login, PrintReport (PDF page)
client/src/components/        DaySheet (the day layout, shared by the app and the PDF), charts, grid
```
