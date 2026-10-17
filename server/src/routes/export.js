import express from 'express';
import puppeteer from 'puppeteer-core';
import { HttpError, assertDate } from '../util.js';

export const exportRouter = express.Router();

const MAX_RANGE_DAYS = 92;
const PORT = process.env.PORT || 3000;
// Where Chromium loads the print page from. Override in dev to point at the Vite server.
const PRINT_BASE_URL = process.env.PRINT_BASE_URL || `http://127.0.0.1:${PORT}`;
const PDF_FORMAT = process.env.PDF_FORMAT || 'Letter';
const REPORT_TITLE = process.env.REPORT_TITLE || 'Diary Card';
const CHROMIUM_PATH = process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium';
const MARGIN_X_MM = 12;
// CSS px widths of the paper; the page is laid out at the printable width so charts are sized for it.
const PAPER_WIDTH_PX = { Letter: 816, Legal: 816, A4: 794 };
const contentWidth = () => Math.round((PAPER_WIDTH_PX[PDF_FORMAT] ?? 816) - (2 * MARGIN_X_MM * 96) / 25.4);

let browserPromise = null;

// One shared Chromium; relaunched if it crashes or exits.
function getBrowser() {
  if (!browserPromise) {
    browserPromise = puppeteer
      .launch({
        executablePath: CHROMIUM_PATH,
        headless: true,
        // We only ever load our own page from localhost, and Chromium's sandbox
        // usually can't start as a non-root user inside a container.
        args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
      })
      .then((browser) => {
        browser.on('disconnected', () => (browserPromise = null));
        return browser;
      })
      .catch((err) => {
        browserPromise = null;
        throw err;
      });
  }
  return browserPromise;
}

function sessionCookie(req) {
  const match = /(?:^|;\s*)diary\.sid=([^;]+)/.exec(req.headers.cookie ?? '');
  return match?.[1];
}

const escapeHtml = (s) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

exportRouter.get('/pdf', async (req, res) => {
  const from = assertDate(req.query.from, 'from');
  const to = assertDate(req.query.to ?? from, 'to');
  if (from > to) throw new HttpError(400, 'from must be on or before to');
  if ((Date.parse(to) - Date.parse(from)) / 864e5 >= MAX_RANGE_DAYS) {
    throw new HttpError(400, `PDF range must be at most ${MAX_RANGE_DAYS} days`);
  }

  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    const base = new URL(PRINT_BASE_URL);
    await page.setCookie({ name: 'diary.sid', value: sessionCookie(req), domain: base.hostname, path: '/', httpOnly: true });
    await page.setViewport({ width: contentWidth(), height: 1000 });
    await page.emulateMediaType('print');
    await page.goto(`${PRINT_BASE_URL}/print?from=${from}&to=${to}`, { waitUntil: 'networkidle0', timeout: 30000 });
    await page.waitForFunction('window.__REPORT_READY__ === true || window.__REPORT_ERROR__', { timeout: 30000 });
    const reportError = await page.evaluate(() => window.__REPORT_ERROR__);
    if (reportError) throw new Error(`Report failed to render: ${reportError}`);

    const range = from === to ? from : `${from} to ${to}`;
    const pdf = await page.pdf({
      format: PDF_FORMAT,
      printBackground: true,
      displayHeaderFooter: true,
      margin: { top: '16mm', bottom: '14mm', left: `${MARGIN_X_MM}mm`, right: `${MARGIN_X_MM}mm` },
      headerTemplate: `<div style="font-size:8px;width:100%;padding:0 ${MARGIN_X_MM}mm;color:#666;display:flex;justify-content:space-between">
        <span>${escapeHtml(REPORT_TITLE)}</span><span>${range}</span></div>`,
      footerTemplate: `<div style="font-size:8px;width:100%;text-align:center;color:#666">
        Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>`,
    });

    const filename = from === to ? `diary-${from}.pdf` : `diary-${from}_to_${to}.pdf`;
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': pdf.length,
    });
    res.end(pdf);
  } finally {
    await page.close().catch(() => {});
  }
});
