# Changelog

## 1.0.0 — 2026-10-16

The first version of a private, self-hosted daily diary card, modelled on the daily page of DBT Pal without the coaching or exercises.

### What it does

- **Day view.** Rate each emotion and urge on its own scale (0–5 by default, up to 0–10). Answer "acted on it?" for urges, mark each medication Yes/No, and write notes. Changes save automatically. You can move between days with the arrows, a date picker, or the ←/→ keys.
- **History.** A heatmap of every emotion, urge and medication over 7, 14 or 30 days, plus a trend chart for each one, an urge stats table and a medication adherence chart. Tap a date to open that day.
- **PDF export for a therapist.** A single day prints as it looks in the app. A range of days, up to 92, prints as a summary with charts, followed by one page per day. On iPhone and iPad it opens the share sheet.
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

### Known gaps

- The Docker image has not been built or run yet (Docker wasn't available on the development machine).
- Sharing a PDF from iOS needs checking on a real iPhone and iPad.
- Charts don't change colour if the light/dark theme switches while History is open; reloading fixes it.
