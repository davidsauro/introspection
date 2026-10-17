import { api } from '../api.js';
import { useCatalogStore } from '../stores/catalog.js';
import { dateRange } from '../utils/dates.js';
import { buildReport } from '../utils/report.js';
import { buildPdfDocument, pdfFileName } from './document.js';
import { renderChartImages } from './charts.js';

let pdfMakePromise = null;

// pdfmake and its embedded font are ~1.9 MB, so they're only downloaded when a PDF is made.
function loadPdfMake() {
  pdfMakePromise ??= Promise.all([import('pdfmake/build/pdfmake'), import('pdfmake/build/vfs_fonts')])
    .then(([pdfMakeModule, vfsModule]) => {
      const pdfMake = pdfMakeModule.default ?? pdfMakeModule;
      pdfMake.addVirtualFileSystem(vfsModule.default ?? vfsModule);
      // The document only embeds data URLs; never fetch anything from the network.
      pdfMake.setUrlAccessPolicy(() => false);
      return pdfMake;
    })
    .catch((err) => {
      pdfMakePromise = null;
      throw err;
    });
  return pdfMakePromise;
}

// Builds the PDF for [from, to] entirely in the browser and returns it as a File.
export async function generatePdf(from, to) {
  const catalog = useCatalogStore();
  const [pdfMake, raw] = await Promise.all([
    loadPdfMake(),
    api.get(`/days?from=${from}&to=${to}`),
    catalog.load(true), // pick up any recent Settings changes
  ]);

  const report = buildReport(catalog, raw, dateRange(from, to));
  const chartImages = from === to ? {} : renderChartImages(report);
  const doc = buildPdfDocument({ report, catalog, chartImages });
  const blob = await pdfMake.createPdf(doc).getBlob();
  return new File([blob], pdfFileName(from, to), { type: 'application/pdf' });
}
