# Changelog

## 1.3.0 — 2026-10-17

### DBT skills
- **32 built-in skills** in four modules: Mindfulness (7), Distress Tolerance (11), Emotion Regulation (8) and Interpersonal (6). That's DBT Pal's 26 plus STOP, TIPP, IMPROVE the moment, Turning the mind, Half-smile and willing hands, and Mindfulness of current emotion. Each has a one-line description in our own words.
- **Skills section at the bottom of the Day screen:** the day's ticked skills, then the most recently used, topped up with 13 starter skills (Wise Mind, Observe, Describe, Nonjudgmental stance, Distract with ACCEPTS, Self-soothe, Radical acceptance, Check the Facts, Opposite Action, PLEASE, DEAR MAN, GIVE, Validation). Simple checkboxes that autosave. The list stays put while she ticks.
- **Browse all skills:** search by name or description and filter by module. Full screen on a phone, a dialog on iPad and Mac.
- **Settings → Skills:** add, rename, describe, move between modules, reorder, archive and restore, grouped into collapsible modules.
- **History and PDF:** skills used appear as grid rows. The PDF summary gets a "Skills used" table, and each day page lists that day's skills by module.

### Summary boxes
- **Day Streak:** consecutive days with an entry. It counts back from yesterday until today is logged, so it doesn't reset each morning.
- **Skills Used:** all-time total of skill ticks.
- **Total Entries:** days with anything logged.
- Computed from her device's date, and refreshed after every save.

### Under the hood
- **Migration v3** adds `skills` and `skill_log`, and gives existing diaries the 32 default skills. Migration steps can now include code, and each runs in one transaction with its seed data.
- **New API:** `/api/skills` (with `lastUsed`) and `/api/stats?today=`. Days now include `skills`.
- **Tests:** 47 server (skills, ticks, streak edge cases, upgrade from v2) and 62 client (Recent-list rules, search/filter, store, reports, PDF).

## 1.2.0 — 2026-10-16

- **A note under every emotion and urge card.** It starts as one line and grows as she types, never scrolling inside a fixed box. It autosaves with everything else.
- Card notes are stored separately from ratings, so she can write a note without rating, and clearing a rating keeps its note. A blank note is removed.
- The day's main Notes box uses the same auto-growing behaviour.
- The PDF shows each card's note under its rating, but only when there is one.
- Archived emotions and urges still appear on a past day if they have a note there.
- Database migration v2 adds the `tracker_notes` table. It applies automatically on start, and existing data is untouched.
- Tests: server (save, edit, delete, independence from ratings, validation) and client (autosave, retries, visibility, PDF).

## 1.1.1 — 2026-10-16

- Plain-HTTP login is allowed from `localhost` (e.g. `http://localhost:3000` on the server) even with `COOKIE_SECURE=true`, so you can test without going through the proxy. Other devices still need HTTPS. The session cookie is `Secure` over HTTPS and plain over localhost HTTP.

## 1.1.0 — 2026-10-16

### PDFs are now made in the browser

- PDF export uses **pdfmake** on her device instead of headless Chromium on the server.
- The PDF has its own print layout. It shows the same data as the app: each day's emotions and urges as 0–N boxes with the chosen value filled in, acted-on answers, medications and notes. Ranges start with a summary (heatmap, a trend chart for each tracker, an urge table and medication adherence), followed by a page per day.
- **Docker image: 1.5 GB → about 290 MB.** Chromium, puppeteer-core, its fonts and the server's `/api/export` endpoint are gone, along with the `/print` page, `PDF_FORMAT` and `REPORT_TITLE`.
- Faster: about 0.2 s for a day and 0.6 s for 14 days, with no server round trip. Files are smaller too: a single day went from 113 KB to 24 KB.
- pdfmake (about 1.9 MB, 800 KB gzipped) loads only when a PDF is created, so the rest of the app doesn't get slower.
- Charts print in the light theme even when the device is in dark mode.
- Tests: client PDF tests build the document, check its content (including archived items, old scales and acted-on answers), and render real PDFs in Node, up to the 92-day maximum.

## 1.0.0 — 2026-10-16

The first version of a private, self-hosted daily diary card, modelled on the daily page of DBT Pal without the coaching or exercises.

### What it does

- **Day view.** Rate each emotion and urge on its own scale (0–5 by default, up to 0–10). Answer "acted on it?" for urges, mark each medication Yes/No, and write notes. Changes save automatically. You can move between days with the arrows, a date picker, or the ←/→ keys.
- **History.** A heatmap of every emotion, urge and medication over 7, 14 or 30 days, plus a trend chart for each one, an urge stats table and a medication adherence chart. Tap a date to open that day.
- **PDF export for a therapist.** A single day prints like the app's day screen. A range of days, up to 92, prints as a summary with charts, followed by one page per day. On iPhone and iPad it opens the share sheet.
- **Settings.** Add, rename, reorder and archive emotions, urges and medications, and set each scale and whether to ask "acted on it?". Archived items keep their history. You can also change the password; this logs out other devices.
- **Single-password login** with a first-run setup screen. Logins are rate-limited.
- **Responsive layout** for iPhone (bottom tabs), iPad (top bar) and Mac (sidebar), with dark mode. It can be added to the home screen as an app.

### How it's built

- Vue 3 + Vite client, and an Express 5 server storing everything in SQLite (`data/diary.db`).
- PDFs are made by headless Chromium rendering the app's own print page, so they match the screen.
- One Docker image, run with `docker compose`, behind an existing HTTPS reverse proxy.

### Fixes from code review

- Old ratings keep the scale they were recorded on, and can still be edited, after a tracker's scale changes.
- Acted-on answers are no longer lost when re-rating an urge whose question was turned off.
- Logging in over plain HTTP while HTTPS-only cookies are enabled now gives a clear error instead of a login loop.
- "Today" rolls over at midnight in a home-screen app that is left open.
- Fixed the Day and History views briefly showing stale data when switching quickly.
- Days whose entries were all cleared show as "No entry recorded" in reports.
- Invalid saves are reported instead of retried forever. Saves made offline, or after the login expires, are retried on the correct day.
- Hardening:
  - Concurrent first-run setup can't set two passwords.
  - Malformed IDs and dates are rejected instead of causing errors.
  - The post-login redirect can't be pointed at another site.
  - The login limiter now forgets old entries.
  - Shutdown is graceful.

### Tests

- `server`: 34 API tests (`npm test`), including real PDF rendering when Chromium is available.
- `client`: 26 unit tests (`npm test`) for dates, report building and autosave.

### Docker verification

- Built and ran the image with `docker compose`. Checked:
  - Healthcheck.
  - HTTPS-only login behind the proxy, and the `Secure` cookie flag.
  - Saving data and client-side routes.
  - Asset caching.
  - PDF export using the container's own Chromium (about 1.2 s per PDF).
  - Graceful restart.
  - Data and logins surviving `restart` and a full `down`/`up`.
- The container now fixes ownership of a root-owned data folder (which Docker creates when `./data` is missing) and then drops to an unprivileged user. Before this, it crash-looped with `SQLITE_CANTOPEN`.
- PDFs use Liberation Sans, so text kerns properly. Alpine's default FreeSans spaced letters unevenly.

### Known gaps

- Sharing a PDF from iOS needs checking on a real iPhone and iPad.
- Charts don't change colour if the light/dark theme switches while History is open; reloading fixes it.
