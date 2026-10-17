import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import './db.js';
import { sessionMiddleware, requireAuth, authRouter } from './auth.js';
import { trackersRouter } from './routes/trackers.js';
import { medicationsRouter } from './routes/medications.js';
import { daysRouter } from './routes/days.js';
import { exportRouter } from './routes/export.js';
import { errorHandler } from './util.js';

const PUBLIC_DIR = path.resolve(process.env.PUBLIC_DIR || 'public');

export const app = express();
app.disable('x-powered-by');
// Behind the home reverse proxy, which terminates HTTPS.
app.set('trust proxy', process.env.TRUST_PROXY ?? 'loopback, linklocal, uniquelocal');

app.use(express.json({ limit: '1mb' }));
app.use(sessionMiddleware);

app.use('/api/auth', authRouter);
app.use('/api/trackers', requireAuth, trackersRouter);
app.use('/api/medications', requireAuth, medicationsRouter);
app.use('/api/days', requireAuth, daysRouter);
app.use('/api/export', requireAuth, exportRouter);
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

// Built Vue app, with SPA fallback so client-side routes like /history load index.html.
if (fs.existsSync(PUBLIC_DIR)) {
  // Vite's hashed filenames never change content, so they can be cached for good.
  app.use('/assets', express.static(path.join(PUBLIC_DIR, 'assets'), { immutable: true, maxAge: '1y' }));
  app.use(express.static(PUBLIC_DIR, { index: false, maxAge: '1h' }));
  app.get('/{*splat}', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'index.html'), { maxAge: 0 }));
}

app.use(errorHandler);
