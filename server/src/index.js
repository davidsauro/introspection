import { app } from './app.js';
import { db } from './db.js';
import { closeBrowser } from './routes/export.js';

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => console.log(`Diary listening on http://0.0.0.0:${PORT}`));

// `docker stop` sends SIGTERM: finish in-flight requests, then close Chromium and the database.
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    server.close(async () => {
      await closeBrowser();
      db.close();
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 5000).unref();
  });
}
