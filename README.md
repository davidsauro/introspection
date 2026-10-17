# Diary

A private, self-hosted daily diary card for one person. It's modelled on the daily page of DBT Pal, without the coaching or exercises. Each day you can:

- rate **emotions** and **urges** on configurable scales (0–5 by default, up to 0–10)
- record whether you **acted on** each urge
- mark each **medication** as taken (Yes/No)
- add a **note under each emotion and urge**
- tick the **DBT skills** used (32 built in, with search and module filters)
- write free-text **notes**

The Day screen also shows a **day streak**, **skills used** and **total entries**.

The **History** screen shows a heatmap and trend charts. **Export** creates a PDF for a therapist with the same data as the app. A single day is one page. A range of days is a summary with charts, followed by a page per day. The PDF is generated in the browser on her device, so the server doesn't need to do anything for it.

It works on iPhone, iPad and Mac. On iPhone or iPad, use Safari → Share → *Add to Home Screen* to open it like an app.

Stack: Vue 3 + Vite, Node.js (Express 5) and SQLite (better-sqlite3) in one small Docker container. PDFs are made in the browser with pdfmake.

## Run it on the home server

```sh
docker compose up -d --build
```

The first build takes a minute or two, and the image is about 290 MB. The container creates `./data` if it's missing and fixes its ownership, then runs the app as an unprivileged user.

The app listens on port **3000**. Point your reverse proxy (which handles HTTPS) at `http://<server>:3000`.

The first visit asks you to choose a password. Settings comes with a starter list of emotions and urges; edit it to suit.

### Configuration (`docker-compose.yml`)

| Variable | Default | Purpose |
|---|---|---|
| `COOKIE_SECURE` | `true` | Logins must come over HTTPS (through your proxy), except from `http://localhost:3000` on the server itself, which is handy for testing. Set to `false` to allow plain HTTP from any device. |
| `TZ` | – | Server time zone (log timestamps). Diary dates always come from the device's own date. |
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

### Tests

```sh
cd server && npm test     # API tests (node:test), each file against a fresh temporary database
cd client && npm test     # unit tests (Vitest): dates, reports, autosave, and real PDF generation
```

## Layout

```
server/src/app.js             Express app, static hosting + SPA fallback
server/src/index.js           starts the server, graceful shutdown
server/src/db.js              SQLite connection, migrations (PRAGMA user_version), seed data
server/src/auth.js            single-password login, SQLite-backed sessions
server/src/routes/            trackers, medications, days
client/src/views/             Day, History, Export, Settings, Login
client/src/components/        DaySheet (the day screen), charts, history grid
client/src/pdf/               PDF layout (document.js), chart images, generation (pdfmake, lazy-loaded)
```
