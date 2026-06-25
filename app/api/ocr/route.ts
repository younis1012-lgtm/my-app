import { NextRequest, NextResponse } from 'next/server';

import * as canvasRuntime from '@napi-rs/canvas';

export const runtime = 'nodejs';
export const maxDuration = 60;

type RequestBody = {
  fileName?: string;
  mimeType?: string;
  dataUrl?: string;
  subtype?: 'suppliers' | 'subcontractors' | 'materials' | 'asphalt-jmf' | 'reference-results' | 'concrete-strength' | 'earthworks-density';
  workType?: string;
  expectedMetrics?: string[];
};

const emptyData = {
  certificateNo: '',
  expiryDate: '',
  issueDate: '',
  supplierName: '',
  subcontractorName: '',
  materialName: '',
  suppliedMaterial: '',
  branch: '',
  contactPhone: '',
  details: '',
  confidence: 0,
  notes: '',
  certificates: [] as Array<{
    details: string;
    certificateNo: string;
    expiryDate: string;
    issueDate: string;
    supplierName: string;
    materialName: string;
  }>,
};

const jsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    certificateNo: { type: 'string' },
    expiryDate: { type: 'string' },
    issueDate: { type: 'string' },
    supplierName: { type: 'string' },
    subcontractorName: { type: 'string' },
    materialName: { type: 'string' },
    suppliedMaterial: { type: 'string' },
    branch: { type: 'string' },
    contactPhone: { type: 'string' },
    details: { type: 'string' },
    confidence: { type: 'number' },
    notes: { type: 'string' },
    certificates: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          details: { type: 'string' },
          certificateNo: { type: 'string' },
          expiryDate: { type: 'string' },
          issueDate: { type: 'string' },
          supplierName: { type: 'string' },
          materialName: { type: 'string' },
        },
        required: ['details', 'certificateNo', 'expiryDate', 'issueDate', 'supplierName', 'materialName'],
      },
    },
  },
  required: Object.keys(emptyData),
};

const asphaltJmfEmptyData = {
  rows: [] as Array<{ metric: string; resultValue: string }>,
  batches: [] as Array<{
    batchNo: string;
    sampleNo: string;
    mixType: string;
    testDate: string;
    rows: Array<{ metric: string; resultValue: string }>;
  }>,
  fields: {
    sampleNo: '',
    mixType: '',
    testDate: '',
    plant: '',
    bitumenContent: '',
    vacuumDensity: '',
    stability: '',
    flow: '',
    airVoids: '',
    vma: '',
  },
  confidence: 0,
  notes: '',
};

const asphaltJmfJsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    rows: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          metric: { type: 'string' },
          resultValue: { type: 'string' },
        },
        required: ['metric', 'resultValue'],
      },
    },
    batches: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          batchNo: { type: 'string' },
          sampleNo: { type: 'string' },
          mixType: { type: 'string' },
          testDate: { type: 'string' },
          rows: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                metric: { type: 'string' },
                resultValue: { type: 'string' },
              },
              required: ['metric', 'resultValue'],
            },
          },
        },
        required: ['batchNo', 'sampleNo', 'mixType', 'testDate', 'rows'],
      },
    },
    fields: {
      type: 'object',
      additionalProperties: false,
      properties: {
        sampleNo: { type: 'string' },
        mixType: { type: 'string' },
        testDate: { type: 'string' },
        plant: { type: 'string' },
        bitumenContent: { type: 'string' },
        vacuumDensity: { type: 'string' },
        stability: { type: 'string' },
        flow: { type: 'string' },
        airVoids: { type: 'string' },
        vma: { type: 'string' },
      },
      required: ['sampleNo', 'mixType', 'testDate', 'plant', 'bitumenContent', 'vacuumDensity', 'stability', 'flow', 'airVoids', 'vma'],
    },
    confidence: { type: 'number' },
    notes: { type: 'string' },
  },
  required: ['rows', 'batches', 'fields', 'confidence', 'notes'],
};

const referenceResultsEmptyData = {
  rows: [] as Array<{
    metric: string;
    resultValue: string;
    minValue: string;
    maxValue: string;
    evidence: string;
    sourceRegion: string;
    confidence: number;
  }>,
  fields: {
    certificateNo: '',
    testDate: '',
    source: '',
    materialDescription: '',
    aashto: '',
    unified: '',
  },
  fieldEvidence: {
    certificateNo: { evidence: '', confidence: 0 },
    testDate: { evidence: '', confidence: 0 },
    source: { evidence: '', confidence: 0 },
    materialDescription: { evidence: '', confidence: 0 },
    aashto: { evidence: '', confidence: 0 },
    unified: { evidence: '', confidence: 0 },
  },
  confidence: 0,
  notes: '',
};

const referenceResultsJsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    rows: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          metric: { type: 'string' },
          resultValue: { type: 'string' },
          minValue: { type: 'string' },
          maxValue: { type: 'string' },
          evidence: { type: 'string' },
          sourceRegion: { type: 'string' },
          confidence: { type: 'number' },
        },
        required: ['metric', 'resultValue', 'minValue', 'maxValue', 'evidence', 'sourceRegion', 'confidence'],
      },
    },
    fields: {
      type: 'object',
      additionalProperties: false,
      properties: {
        certificateNo: { type: 'string' },
        testDate: { type: 'string' },
        source: { type: 'string' },
        materialDescription: { type: 'string' },
        aashto: { type: 'string' },
        unified: { type: 'string' },
      },
      required: ['certificateNo', 'testDate', 'source', 'materialDescription', 'aashto', 'unified'],
    },
    fieldEvidence: {
      type: 'object',
      additionalProperties: false,
      properties: Object.fromEntries(
        ['certificateNo', 'testDate', 'source', 'materialDescription', 'aashto', 'unified'].map((key) => [
          key,
          {
            type: 'object',
            additionalProperties: false,
            properties: {
              evidence: { type: 'string' },
              confidence: { type: 'number' },
            },
            required: ['evidence', 'confidence'],
          },
        ]),
      ),
      required: ['certificateNo', 'testDate', 'source', 'materialDescription', 'aashto', 'unified'],
    },
    confidence: { type: 'number' },
    notes: { type: 'string' },
  },
  required: Object.keys(referenceResultsEmptyData),
};

const earthworksDensityEmptyData = {
  fields: {
    densityCertificateNo: '',
    projectNo: '',
    issueDate: '',
    testDate: '',
    siteName: '',
    contractor: '',
    layerNo: '',
    layerCode: '',
    structureLayer: '',
    sampleLocation: '',
    fromSection: '',
    toSection: '',
    side: '',
    materialSource: '',
    materialDescription: '',
    aashto: '',
    unified: '',
    referenceCertificateNo: '',
    referenceDate: '',
    maxLabDensity: '',
    optimumMoisture: '',
    oversizePercent: '',
    averageMoisture: '',
    compactionAverage: '',
    lowerLimit: '',
    upperLimit: '',
    statisticalLower: '',
    statisticalUpper: '',
    statisticalAverage: '',
    la: '',
    laPrime: '',
    xn: '',
    status: '',
    testPointCount: '',
  },
  sampleRows: [] as Array<{
    sampleNo: string;
    testNo: string;
    layerNo: string;
    wetDensity: string;
    maxLabDensity: string;
    oversizePercent: string;
    moisture: string;
    compaction: string;
    location: string;
  }>,
  confidence: 0,
  notes: '',
};

const earthworksDensityJsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    fields: {
      type: 'object',
      additionalProperties: false,
      properties: Object.fromEntries(
        Object.keys(earthworksDensityEmptyData.fields).map((key) => [key, { type: 'string' }]),
      ),
      required: Object.keys(earthworksDensityEmptyData.fields),
    },
    sampleRows: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          sampleNo: { type: 'string' },
          testNo: { type: 'string' },
          layerNo: { type: 'string' },
          wetDensity: { type: 'string' },
          maxLabDensity: { type: 'string' },
          oversizePercent: { type: 'string' },
          moisture: { type: 'string' },
          compaction: { type: 'string' },
          location: { type: 'string' },
        },
        required: ['sampleNo', 'testNo', 'layerNo', 'wetDensity', 'maxLabDensity', 'oversizePercent', 'moisture', 'compaction', 'location'],
      },
    },
    confidence: { type: 'number' },
    notes: { type: 'string' },
  },
  required: Object.keys(earthworksDensityEmptyData),
};

const concreteStrengthEmptyData = {
  certificateNo: '',
  concreteType: '',
  strength7Days: '',
  strength28Days: '',
  testDate: '',
  castDate: '',
  concreteSource: '',
  quantity: '',
  slumpRequirement: '',
  slumpResult: '',
  curingType: '',
  structure: '',
  element: '',
  sampleLocation: '',
  fromSection: '',
  toSection: '',
  side: '',
  confidence: 0,
  notes: '',
};

const concreteStrengthJsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    certificateNo: { type: 'string' },
    concreteType: { type: 'string' },
    strength7Days: { type: 'string' },
    strength28Days: { type: 'string' },
    testDate: { type: 'string' },
    castDate: { type: 'string' },
    concreteSource: { type: 'string' },
    quantity: { type: 'string' },
    slumpRequirement: { type: 'string' },
    slumpResult: { type: 'string' },
    curingType: { type: 'string' },
    structure: { type: 'string' },
    element: { type: 'string' },
    sampleLocation: { type: 'string' },
    fromSection: { type: 'string' },
    toSection: { type: 'string' },
    side: { type: 'string' },
    confidence: { type: 'number' },
    notes: { type: 'string' },
  },
  required: Object.keys(concreteStrengthEmptyData),
};

function normalizeDataUrl(dataUrl: string, mimeType: string) {
  const raw = String(dataUrl || '').trim();
  if (!raw) return '';
  if (raw.startsWith('data:')) return raw;
  return `data:${mimeType || 'application/octet-stream'};base64,${raw}`;
}

type ExtractedCertificate = {
  details: string;
  certificateNo: string;
  expiryDate: string;
  issueDate: string;
  supplierName: string;
  materialName: string;
};

type PdfAudit = {
  pageCount: number;
  text: string;
  certificates: ExtractedCertificate[];
  imageOnlyPages: number[];
  imageOnlyPageImages: Array<{ pageNo: number; imageDataUrl: string }>;
};

function dataUrlToBytes(dataUrl: string) {
  const base64 = String(dataUrl || '').includes(',')
    ? String(dataUrl).split(',').pop() || ''
    : String(dataUrl || '');
  return new Uint8Array(Buffer.from(base64, 'base64'));
}

function safeJsonParse(text: string) {
  try { return JSON.parse(text); } catch {}
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch { return null; }
}

function isImage(mimeType: string) {
  return mimeType.startsWith('image/');
}

function normalizeHebrewDate(value: string) {
  const raw = String(value || '').trim();
  if (!raw) return '';

  const months: Record<string, string> = {
    'ינואר': '01', 'פברואר': '02', 'מרץ': '03', 'אפריל': '04', 'מאי': '05', 'יוני': '06',
    'יולי': '07', 'אוגוסט': '08', 'ספטמבר': '09', 'אוקטובר': '10', 'נובמבר': '11', 'דצמבר': '12',
  };

  const iso = raw.match(/(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;

  const dmY = raw.match(/(\d{1,2})[-/.](\d{1,2})[-/.](20\d{2})/);
  if (dmY) return `${dmY[3]}-${dmY[2].padStart(2, '0')}-${dmY[1].padStart(2, '0')}`;

  const hebrew = raw.match(/(\d{1,2})\s+(ינואר|פברואר|מרץ|אפריל|מאי|יוני|יולי|אוגוסט|ספטמבר|אוקטובר|נובמבר|דצמבר)\s+(20\d{2})/);
  if (hebrew) return `${hebrew[3]}-${months[hebrew[2]]}-${hebrew[1].padStart(2, '0')}`;

  return raw;
}

function cleanCertificateNo(value: string) {
  const raw = String(value || '').trim();
  if (!raw) return '';

  const cleaned = raw
    .replace(/מס(?:פר)?\s*(?:תעודה|רישיון|רשיון|אישור)?/g, '')
    .replace(/תעודת\s*כיול/g, '')
    .replace(/רישיון|רשיון|אישור|תעודה/g, '')
    .replace(/[:：]/g, '')
    .trim();

  const candidate = cleaned.match(/[A-Za-z0-9]+(?:[\/-][A-Za-z0-9]+)*/)?.[0] || '';
  if (!candidate) return '';
  if (/^20\d{2}$/.test(candidate)) return '';
  if (/^SUB-?20\d{2}/i.test(candidate)) return '';
  return candidate;
}

function normalizeCertificateNoKey(value: string) {
  return cleanCertificateNo(value).replace(/^0+(\d)/, '$1').toLowerCase();
}

async function renderPdfPageToPngDataUrl(page: any, scale = 2) {
  try {
    const { createCanvas } = canvasRuntime;
    const viewport = page.getViewport({ scale });
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    const context = canvas.getContext('2d');
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: context, viewport }).promise;
    return `data:image/png;base64,${canvas.toBuffer('image/png').toString('base64')}`;
  } catch (error) {
    console.error('PDF page render failed', error);
    return '';
  }
}

async function renderPdfPagesToPngDataUrls(
  dataUrl: string,
  mimeType: string,
  maxPages = 4,
): Promise<string[]> {
  if (!/pdf/i.test(mimeType) && !String(dataUrl || '').startsWith('data:application/pdf')) return [];
  try {
    ensurePdfCanvasPolyfills();
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const doc = await pdfjs.getDocument({
      data: dataUrlToBytes(dataUrl),
      disableWorker: true,
      useWorkerFetch: false,
      isEvalSupported: false,
      disableFontFace: true,
    }).promise;
    const images: string[] = [];
    const pageCount = Math.min(doc.numPages, maxPages);
    for (let pageNo = 1; pageNo <= pageCount; pageNo += 1) {
      const page = await doc.getPage(pageNo);
      const imageDataUrl = await renderPdfPageToPngDataUrl(page, 3.5);
      if (imageDataUrl) images.push(imageDataUrl);
    }
    return images;
  } catch (error) {
    console.error('Reference PDF visual render failed', error);
    return [];
  }
}

async function renderMbdCertificateRegions(
  dataUrl: string,
  mimeType: string,
): Promise<Array<{ label: string; imageDataUrl: string }>> {
  if (!/pdf/i.test(mimeType) && !String(dataUrl || '').startsWith('data:application/pdf')) return [];
  try {
    ensurePdfCanvasPolyfills();
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const doc = await pdfjs.getDocument({
      data: dataUrlToBytes(dataUrl),
      disableWorker: true,
      useWorkerFetch: false,
      isEvalSupported: false,
      disableFontFace: true,
    }).promise;
    const page = await doc.getPage(1);
    const viewport = page.getViewport({ scale: 4 });
    const source = canvasRuntime.createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    const sourceContext = source.getContext('2d');
    sourceContext.fillStyle = '#fff';
    sourceContext.fillRect(0, 0, source.width, source.height);
    await page.render({ canvasContext: sourceContext, viewport }).promise;

    const regions = [
      // MBD / קבוצת הנדסה ואיכות: התעודה היא לרוב צילום בתוך PDF.
      // לכן קוראים תקריבים ממוקדים של הטבלאות, ולא את כל הדף/גרפים.
      { label: 'metadata', x: 0.04, y: 0.10, width: 0.93, height: 0.26 },
      { label: 'classification', x: 0.04, y: 0.21, width: 0.94, height: 0.15 },
      { label: 'material-details', x: 0.60, y: 0.285, width: 0.36, height: 0.06 },
      { label: 'classification-values', x: 0.08, y: 0.245, width: 0.44, height: 0.11 },
      { label: 'compaction', x: 0.49, y: 0.32, width: 0.49, height: 0.24 },
      { label: 'grading', x: 0.50, y: 0.50, width: 0.48, height: 0.20 },
      { label: 'atterberg', x: 0.43, y: 0.66, width: 0.55, height: 0.16 },
    ];

    return regions.map((region) => {
      const sx = Math.floor(source.width * region.x);
      const sy = Math.floor(source.height * region.y);
      const sw = Math.floor(source.width * region.width);
      const sh = Math.floor(source.height * region.height);
      const crop = canvasRuntime.createCanvas(sw, sh);
      const cropContext = crop.getContext('2d');
      cropContext.fillStyle = '#fff';
      cropContext.fillRect(0, 0, sw, sh);
      cropContext.drawImage(source, sx, sy, sw, sh, 0, 0, sw, sh);
      return {
        label: region.label,
        imageDataUrl: `data:image/png;base64,${crop.toBuffer('image/png').toString('base64')}`,
      };
    });
  } catch (error) {
    console.error('MBD certificate region render failed', error);
    return [];
  }
}

function ensurePdfCanvasPolyfills() {
  try {
    const globalScope = globalThis as typeof globalThis & {
      DOMMatrix?: typeof canvasRuntime.DOMMatrix;
      ImageData?: typeof canvasRuntime.ImageData;
      Path2D?: typeof canvasRuntime.Path2D;
    };

    globalScope.DOMMatrix ||= canvasRuntime.DOMMatrix;
    globalScope.ImageData ||= canvasRuntime.ImageData;
    globalScope.Path2D ||= canvasRuntime.Path2D;
  } catch (error) {
    console.error('PDF canvas polyfill load failed', error);
  }
}

function extractAccreditationCertificateFromPage(pageText: string): ExtractedCertificate | null {
  const text = String(pageText || '').replace(/\s+/g, ' ').trim();
  if (!text) return null;
  const isCoverPage = /Page\s+No\.\s+1\s+of\s*:?\s+\d+/i.test(text);
  const isAccreditation =
    /Accreditation\s+Certificate/i.test(text) ||
    /תעודת\s+הסמכה/.test(text) ||
    /ISO\/IEC\s*17025/i.test(text);
  if (!isCoverPage || !isAccreditation) return null;

  const certificateNo = cleanCertificateNo(
    text.match(/Accreditation\s+Certificate\s+No\.?\s*([A-Za-z0-9./_-]+)/i)?.[1] ||
      text.match(/ISO\/IEC\s*17025:?\s*2017\s+([A-Za-z0-9./_-]+)\s+תעודת/)?.[1] ||
      text.match(/תעודת\s+הסמכה\s+מס\s*'?\s*([A-Za-z0-9./_-]+)/)?.[1] ||
      '',
  );
  if (!certificateNo) return null;

  const expiryDate = normalizeHebrewDate(
    text.match(/Until\s*:?\s*(\d{1,2}[./-]\d{1,2}[./-]20\d{2})/i)?.[1] ||
      text.match(/עד\s+יום\s*:?\s*(\d{1,2}[./-]\d{1,2}[./-]20\d{2})/)?.[1] ||
      '',
  );
  const issueDate = normalizeHebrewDate(
    text.match(/Valid\s+from\s*:?\s*(\d{1,2}[./-]\d{1,2}[./-]20\d{2})/i)?.[1] ||
      text.match(/בתוקף\s+מיום\s*:?\s*(\d{1,2}[./-]\d{1,2}[./-]20\d{2})/)?.[1] ||
      text.match(/בתוקף\s+מיום\s+(\d{1,2}[./-]\d{1,2}[./-]20\d{2})\s*:/)?.[1] ||
      '',
  );
  const supplierName = /Engineering\s*&\s*Quality\s*Group\s*Ltd/i.test(text)
    ? 'Engineering & Quality Group Ltd.'
    : /קבוצת\s+הנדסה\s+ואיכות/.test(text)
      ? 'קבוצת הנדסה ואיכות בע"מ'
      : '';

  return {
    details: 'תעודת הסמכה ISO/IEC 17025',
    certificateNo,
    expiryDate,
    issueDate,
    supplierName,
    materialName: '',
  };
}

async function auditPdfFile(dataUrl: string, mimeType: string): Promise<PdfAudit | null> {
  if (!/pdf/i.test(mimeType) && !String(dataUrl || '').startsWith('data:application/pdf')) return null;
  try {
    ensurePdfCanvasPolyfills();
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const data = dataUrlToBytes(dataUrl);
    const doc = await pdfjs.getDocument({
      data,
      disableWorker: true,
      useWorkerFetch: false,
      isEvalSupported: false,
      disableFontFace: true,
    }).promise;
    const pages: string[] = [];
    const certificates: ExtractedCertificate[] = [];
    const imageOnlyPages: number[] = [];
    const imageOnlyPageImages: Array<{ pageNo: number; imageDataUrl: string }> = [];
    const imageOps = new Set([
      pdfjs.OPS?.paintImageXObject,
      pdfjs.OPS?.paintJpegXObject,
      pdfjs.OPS?.paintInlineImageXObject,
      pdfjs.OPS?.paintImageMaskXObject,
    ]);

    for (let pageNo = 1; pageNo <= doc.numPages; pageNo += 1) {
      const page = await doc.getPage(pageNo);
      const content = await page.getTextContent();
      const text = content.items.map((item: any) => item.str).join(' ').replace(/\s+/g, ' ').trim();
      pages.push(`--- PAGE ${pageNo} ---\n${text}`);
      const certificate = extractAccreditationCertificateFromPage(text);
      if (certificate) certificates.push(certificate);

      if (text.length < 20) {
        try {
          const operatorList = await page.getOperatorList();
          const hasImage = operatorList.fnArray.some((fn: unknown) => imageOps.has(fn));
          if (hasImage) {
            imageOnlyPages.push(pageNo);
            const imageDataUrl = await renderPdfPageToPngDataUrl(page);
            if (imageDataUrl) imageOnlyPageImages.push({ pageNo, imageDataUrl });
          }
        } catch {
          imageOnlyPages.push(pageNo);
          const imageDataUrl = await renderPdfPageToPngDataUrl(page);
          if (imageDataUrl) imageOnlyPageImages.push({ pageNo, imageDataUrl });
        }
      }
    }

    return {
      pageCount: doc.numPages,
      text: pages.join('\n'),
      certificates: normalizeCertificateItems(certificates),
      imageOnlyPages,
      imageOnlyPageImages,
    };
  } catch (error) {
    console.error('PDF audit failed', error);
    return null;
  }
}

function mergeCertificateItems(...groups: unknown[]) {
  const seen = new Set<string>();
  const merged: ExtractedCertificate[] = [];
  for (const group of groups) {
    for (const item of normalizeCertificateItems(group)) {
      const key = [
        normalizeCertificateNoKey(item.certificateNo),
        item.expiryDate,
        item.issueDate,
        item.details.toLowerCase(),
      ].join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(item);
    }
  }
  return merged;
}

function extractFromText(text: string, fileName: string) {
  const combined = `${text || ''}\n${fileName || ''}`;
  const labels = [
    'מספר תעודה', 'מספר רישיון', 'מספר רשיון', 'מספר אישור', 'תעודת כיול מס', 'תעודה מס', 'רישיון מס', 'רשיון מס', 'מס׳', "מס'"
  ];

  let certificateNo = '';
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`${escaped}\\s*[:：]?\\s*([A-Za-z0-9]+(?:[\\/-][A-Za-z0-9]+)*)`, 'i');
    const match = combined.match(re);
    const candidate = cleanCertificateNo(match?.[1] || '');
    if (candidate) {
      certificateNo = candidate;
      break;
    }
  }

  if (!certificateNo) {
    const calibration = combined.match(/תעודת\s*כיול\s*(?:מס(?:פר)?|מס׳|מס')?\s*[:：]?\s*([0-9]{1,4}\/[0-9]{1,6})/);
    certificateNo = cleanCertificateNo(calibration?.[1] || '');
  }

  let expiryDate = '';
  const expiryPatterns = [
    /תאריך\s*(?:פקיעת|פג\s*תוקף|תוקף|פקיעה)[^0-9א-ת]*(\d{1,2}\s+(?:ינואר|פברואר|מרץ|אפריל|מאי|יוני|יולי|אוגוסט|ספטמבר|אוקטובר|נובמבר|דצמבר)\s+20\d{2})/,
    /תאריך\s*(?:פקיעת|פג\s*תוקף|תוקף|פקיעה)[^0-9]*(\d{1,2}[\/.\-]\d{1,2}[\/.\-]20\d{2})/,
    /(?:בתוקף\s*עד|תוקף\s*עד|פג\s*תוקף)[^0-9א-ת]*(\d{1,2}\s+(?:ינואר|פברואר|מרץ|אפריל|מאי|יוני|יולי|אוגוסט|ספטמבר|אוקטובר|נובמבר|דצמבר)\s+20\d{2})/,
    /(?:בתוקף\s*עד|תוקף\s*עד|פג\s*תוקף)[^0-9]*(\d{1,2}[\/.\-]\d{1,2}[\/.\-]20\d{2})/,
  ];
  for (const re of expiryPatterns) {
    const match = combined.match(re);
    if (match?.[1]) {
      expiryDate = normalizeHebrewDate(match[1]);
      break;
    }
  }

  return { certificateNo, expiryDate };
}

function normalizeCertificateItem(item: any) {
  return {
    details: String(item?.details || item?.documentType || item?.name || '').trim(),
    certificateNo: cleanCertificateNo(String(item?.certificateNo || item?.documentNo || item?.licenseNo || '')),
    expiryDate: normalizeHebrewDate(String(item?.expiryDate || item?.validUntil || item?.expirationDate || '')),
    issueDate: normalizeHebrewDate(String(item?.issueDate || item?.date || item?.approvalDate || '')),
    supplierName: String(item?.supplierName || '').trim(),
    materialName: String(item?.materialName || item?.suppliedMaterial || '').trim(),
  };
}

function normalizeCertificateItems(value: unknown) {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value
    .map(normalizeCertificateItem)
    .filter((item) => item.certificateNo || item.expiryDate || item.details)
    .filter((item) => {
      const key = [item.certificateNo, item.expiryDate, item.details].join('|').toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}


function normalizeMbdReferenceRows(value: unknown) {
  const sourceRows = Array.isArray(value) ? value : [];
  const normalizeMetric = (metric: string) =>
    String(metric || '')
      .replace(/[״"׳'`’]/g, '')
      .replace(/\s+/g, '')
      .toLowerCase();
  const canonicalMetric = (metric: string) => {
    const key = normalizeMetric(metric);
    if (key.includes('תעודה')) return 'תעודה מס׳';
    if (key.includes('תאריך')) return 'תאריך בדיקה';
    if (key.includes('מקורהחומר') || key === 'מקור') return 'מקור החומר';
    if (key.includes('תיאורהחומר') || key.includes('סוגהחומר')) return 'תיאור החומר';
    if (key.includes('aashto') || key.includes('מיוןהחומר')) return 'מיון AASHTO';
    if (key.includes('מיוןאחיד')) return 'מיון אחיד';
    if (key === '34' || key === '3/4' || key.includes('3/4')) return '3/4"';
    if (key === '4#' || key === '#4' || key.includes('נפה4')) return '#4';
    if (key === '10#' || key === '#10' || key.includes('נפה10')) return '#10';
    if (key === '40#' || key === '#40' || key.includes('נפה40')) return '#40';
    if (key === '200#' || key === '#200' || key.includes('נפה200')) return '#200';
    if (key === 'll' || key.includes('גבולנזילות')) return 'LL';
    if (key === 'pl' || key.includes('גבולפלסטיות')) return 'PL';
    if (key === 'ip' || key === 'pi' || key.includes('אינדקספלסטיות') || key.includes('מדדפלסטיות')) return 'IP';
    if (key.includes('צפיפותמעבדתיתמקסימלית') || key.includes('100%מעבדתי')) return '100% מעבדתי';
    if (key.includes('רטיבותאופטימלית')) return 'רטיבות אופטימלית';
    if (key.includes('צפיפותמקסימליתמחושבת') || key.includes('100%מחושב')) return '100% מחושב';
    if (key.includes('רטיבותמחושבת') || key.includes('רטיבותכוללת')) return 'רטיבות מחושבת';
    if (key.includes('תפיחהחופשית')) return 'תפיחה חופשית';
    return String(metric || '').trim();
  };
  const cleanNumber = (raw: unknown) => String(raw ?? '').trim().replace(/,/g, '.').replace(/\s+/g, ' ');
  const normalizeEvidence = (raw: unknown) => String(raw ?? '').trim().replace(/,/g, '.').replace(/\s+/g, ' ');
  const expectedRegionByMetric: Record<string, string> = {
    'תעודה מס׳': 'metadata',
    'תאריך בדיקה': 'metadata',
    'מקור החומר': 'metadata',
    'תיאור החומר': 'metadata',
    'מיון AASHTO': 'metadata',
    'מיון אחיד': 'metadata',
    '3/4"': 'grading',
    '#4': 'grading',
    '#10': 'grading',
    '#40': 'grading',
    '#200': 'grading',
    'LL': 'atterberg',
    'PL': 'atterberg',
    'IP': 'atterberg',
    'תפיחה חופשית': 'atterberg',
    '100% מעבדתי': 'compaction',
    'רטיבות אופטימלית': 'compaction',
    '100% מחושב': 'compaction',
    'רטיבות מחושבת': 'compaction',
  };
  const sieveSizes: Record<string, Set<string>> = {
    '3/4"': new Set(['19', '19.0', '19.00']),
    '#4': new Set(['4.75', '4.750']),
    '#10': new Set(['2', '2.0', '2.00', '2.000']),
    '#40': new Set(['0.425']),
    '#200': new Set(['0.075']),
  };
  const byMetric = new Map<string, any>();
  for (const row of sourceRows) {
    const metric = canonicalMetric(String((row as any)?.metric ?? ''));
    if (!metric) continue;
    let resultValue = cleanNumber((row as any)?.resultValue);
    let minValue = cleanNumber((row as any)?.minValue);
    let maxValue = cleanNumber((row as any)?.maxValue);
    const evidence = normalizeEvidence((row as any)?.evidence);
    const sourceRegion = String((row as any)?.sourceRegion ?? '').trim().toLowerCase();
    const confidence = Number((row as any)?.confidence ?? 0);
    const expectedRegion = expectedRegionByMetric[metric];
    const evidenceContainsResult =
      !resultValue ||
      evidence.toLowerCase().includes(resultValue.toLowerCase()) ||
      (resultValue.toUpperCase() === 'NP' && /(?:NP|ב["״']?פ)/i.test(evidence));
    const evidenceContainsLimits =
      (!minValue || evidence.includes(minValue)) &&
      (!maxValue || evidence.includes(maxValue));

    // תוצאה נשמרת רק כאשר המודל מצביע על התא והשורה שמהם העתיק אותה.
    // כך מספר מהגרף או מידת נפה לא יכול להיכנס לטבלה רק מפני שהוא מופיע בדף.
    if (
      confidence < 0.9 ||
      !evidence ||
      !evidenceContainsResult ||
      !evidenceContainsLimits ||
      (expectedRegion && sourceRegion !== expectedRegion)
    ) {
      resultValue = '';
      minValue = '';
      maxValue = '';
    }
    if (sieveSizes[metric]?.has(resultValue)) resultValue = '';
    if (sieveSizes[metric]?.has(minValue)) minValue = '';
    if (sieveSizes[metric]?.has(maxValue)) maxValue = '';
    // בתבנית MBD ערך MIN=0 מופיע בדרך כלל בעמודת #200.
    // אם ה-OCR שייך אותו לנפה אחרת, עדיף להשאיר ריק ולא לשמור הסטת עמודה שגויה.
    if (metric !== '#200' && minValue === '0') minValue = '';
    // צפיפות MBD מודפסת בק״ג/מ״ק. אם OCR החזיר 2.105/2.097 מהגרף או המרה, לא נשמור אותה אוטומטית.
    if ((metric === '100% מעבדתי' || metric === '100% מחושב') && /^2[.,]\d{2,3}$/.test(resultValue)) resultValue = '';
    if (!resultValue && !minValue && !maxValue) continue;
    const previous = byMetric.get(metric);
    if (!previous || (!previous.resultValue && resultValue)) {
      byMetric.set(metric, { metric, resultValue, minValue, maxValue });
    } else if (previous) {
      previous.minValue ||= minValue;
      previous.maxValue ||= maxValue;
    }
  }
  return Array.from(byMetric.values());
}

function normalizeMbdReferenceFields(fieldsValue: unknown, evidenceValue: unknown) {
  const fields = fieldsValue && typeof fieldsValue === 'object'
    ? { ...(fieldsValue as Record<string, unknown>) }
    : {};
  const fieldEvidence = evidenceValue && typeof evidenceValue === 'object'
    ? evidenceValue as Record<string, any>
    : {};

  for (const key of ['certificateNo', 'testDate', 'source', 'materialDescription', 'aashto', 'unified']) {
    const value = String(fields[key] ?? '').trim();
    if (!value) continue;
    const evidence = String(fieldEvidence[key]?.evidence ?? '').trim();
    const confidence = Number(fieldEvidence[key]?.confidence ?? 0);
    const valueForComparison = key === 'testDate' ? normalizeHebrewDate(value) : value;
    const evidenceForComparison = key === 'testDate' ? normalizeHebrewDate(evidence) : evidence;
    const comparableValue = valueForComparison.replace(/[״"׳'`’]/g, '').replace(/\s+/g, '').toLowerCase();
    const comparableEvidence = evidenceForComparison.replace(/[״"׳'`’]/g, '').replace(/\s+/g, '').toLowerCase();
    if (confidence < 0.9 || !evidence || !comparableEvidence.includes(comparableValue)) {
      fields[key] = '';
    }
  }

  const aashto = String(fields.aashto ?? '').trim();
  if (
    aashto &&
    !/^A-(?:1-[ab]|2-[4567]|3|4|5|6|7(?:-[56])?)(?:\(\d+\))?$/i.test(aashto.replace(/\s+/g, ''))
  ) {
    fields.aashto = '';
  }

  return fields;
}

function intersectVerifiedMbdFields(primaryValue: unknown, verifierValue: unknown) {
  const primary = primaryValue && typeof primaryValue === 'object'
    ? { ...(primaryValue as Record<string, unknown>) }
    : {};
  const verifier = verifierValue && typeof verifierValue === 'object'
    ? verifierValue as Record<string, unknown>
    : {};
  const normalizeComparable = (key: string, value: unknown) => {
    const raw = key === 'testDate'
      ? normalizeHebrewDate(String(value ?? ''))
      : String(value ?? '');
    return raw
      .replace(/[״"׳'`’]/g, '')
      .replace(/[^\p{L}\p{N}./()-]+/gu, '')
      .toLowerCase();
  };

  for (const key of ['certificateNo', 'testDate', 'source', 'materialDescription', 'aashto', 'unified']) {
    const primaryText = String(primary[key] ?? '').trim();
    const verifierText = String(verifier[key] ?? '').trim();
    if (
      !primaryText ||
      !verifierText ||
      normalizeComparable(key, primaryText) !== normalizeComparable(key, verifierText)
    ) {
      primary[key] = '';
    }
  }

  return primary;
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'OPENAI_API_KEY is missing in Vercel environment variables' }, { status: 500 });
    }

    const body = (await req.json()) as RequestBody;
    const fileName = String(body.fileName ?? 'document');
    const mimeType = String(body.mimeType ?? 'application/octet-stream');
    const dataUrl = String(body.dataUrl ?? '');
    const subtype = body.subtype ?? 'suppliers';

    if (!dataUrl) return NextResponse.json({ data: emptyData });

    if (subtype === 'concrete-strength') {
      const normalizedFileData = normalizeDataUrl(dataUrl, mimeType);
      const prompt = `אתה מחלץ תוצאות חוזק לחיצה מתעודת מעבדת בטון עבור בקרת איכות.
קרא את כל הקובץ חזותית, כולל PDF סרוק, והחזר JSON בלבד.

חלץ:
- certificateNo: מספר התעודה.
- concreteType: סוג/דרגת הבטון. החזר רק אחד מהערכים ב-30, ב-40, ב-50, ב-60 כאשר הוא מופיע.
- strength7Days: תוצאת חוזק הלחיצה בגיל 7 ימים. אם יש מספר קוביות, החזר את הממוצע המסכם המודפס; אם אין ממוצע מודפס, חשב ממוצע רק מתוצאות שמסומנות בבירור כ-7 ימים.
- strength28Days: תוצאת חוזק הלחיצה בגיל 28 ימים. אם יש מספר קוביות, החזר את הממוצע המסכם המודפס; אם אין ממוצע מודפס, חשב ממוצע רק מתוצאות שמסומנות בבירור כ-28 ימים.
- testDate: תאריך הבדיקה בפורמט yyyy-mm-dd אם ניתן.
- castDate: תאריך היציקה או תאריך נטילת הדגימה בפורמט yyyy-mm-dd.
- concreteSource: שם מפעל הבטון / ספק הבטון.
- quantity: כמות הבטון ביציקה במ"ק.
- slumpRequirement: דרישת הסומך.
- slumpResult: תוצאת בדיקת הסומך.
- curingType: סוג האשפרה.
- structure, element, sampleLocation, fromSection, toSection, side: פרטי המיקום אם הם מופיעים בתעודה.

כללים:
- אל תעתיק מספר מדגם, גיל בדיקה, משקל, מידות קובייה או עומס בתור חוזק.
- אל תנחש ערך שאינו מופיע בבירור.
- strength7Days ו-strength28Days הם ערכי חוזק בלבד, ללא יחידות.
- חפש את עמודת "חוזק לחיצה", "ממוצע", "תוצאה" או MPa. אל תחזיר את גיל הבדיקה 7/28, מספר מדגם, משקל, שטח, עומס או מידות בתור תוצאת חוזק.
- אם יש טבלה עם שורות של קוביות, קבץ לפי גיל הבדיקה. תוצאה מודפסת מסכמת או ממוצע גוברים על חישוב עצמאי.
- אם גיל 28 ימים טרם הגיע או אין תוצאה, השאר strength28Days ריק.
- confidence בין 0 ל-1.`;
      const content: any[] = [{ type: 'input_text', text: prompt }];
      if (isImage(mimeType)) {
        content.push({ type: 'input_image', image_url: normalizedFileData, detail: 'high' });
      } else {
        const renderedPages = await renderPdfPagesToPngDataUrls(normalizedFileData, mimeType, 4);
        if (renderedPages.length) {
          content.push({ type: 'input_file', filename: fileName, file_data: normalizedFileData });
          renderedPages.forEach((imageDataUrl, index) => {
            content.push({ type: 'input_text', text: `עמוד ${index + 1}` });
            content.push({ type: 'input_image', image_url: imageDataUrl, detail: 'high' });
          });
        } else {
          content.push({ type: 'input_file', filename: fileName, file_data: normalizedFileData });
        }
      }

      const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: process.env.OPENAI_OCR_MODEL || 'gpt-4.1-mini',
          input: [{ role: 'user', content }],
          temperature: 0,
          text: {
            format: {
              type: 'json_schema',
              name: 'concrete_strength_extract',
              schema: concreteStrengthJsonSchema,
              strict: true,
            },
          },
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        console.error('OpenAI concrete strength OCR error', result);
        return NextResponse.json({ error: result?.error?.message || 'Concrete strength OCR failed' }, { status: 500 });
      }
      const outputText = result.output_text || result.output?.flatMap((item: any) => item.content ?? []).find((part: any) => part.type === 'output_text')?.text || '';
      return NextResponse.json({
        data: { ...concreteStrengthEmptyData, ...(safeJsonParse(outputText) ?? {}) },
      });
    }

    if (subtype === 'asphalt-jmf') {
      const normalizedFileData = normalizeDataUrl(dataUrl, mimeType);
      const prompt = `You are extracting an asphalt lab certificate for Israeli QA/QC.
Return JSON only. Read the attached PDF/image visually if needed.
Extract result values for these metrics when visible:
מספר דגימה, סוג תערובת, תאריך בדיקה, שם דגימה, הזמנה מקורית של הדגימה,
1.5", 1", 3/4", mm 14, 1/2", 3/8", mm 8, #4, #10, #20, #40, #80, #200,
תכולת ביטומן, מפעל אספקה, יחס מלאן - ביטומן, צפיפות בשיטת וואקום, יציבות, נזילות,
חוזק משתייר, אחוז חלל, V.M.A, צפיפות בשיטת ריפ, התנגדות, שחיקה קנטברו.
Use the exact Hebrew metric names from this list in rows[].metric.
If the certificate contains more than one sample/batch/מנה/מדגם, return every one in batches[].
Each batches[] item must contain only that batch's own rows and must include batchNo, sampleNo, mixType and testDate when visible.
For asphalt production test certificates with two extraction/grading columns, create two batches so the concentration can export two rows.
Also keep rows[] as the first/primary batch for backward compatibility.
For dates, return yyyy-mm-dd when possible. Do not invent values.`;
      const content: any[] = [{ type: 'input_text', text: prompt }];
      if (isImage(mimeType)) {
        content.push({ type: 'input_image', image_url: normalizedFileData });
      } else {
        content.push({ type: 'input_file', filename: fileName, file_data: normalizedFileData });
      }

      const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: process.env.OPENAI_OCR_MODEL || 'gpt-4.1-mini',
          input: [{ role: 'user', content }],
          temperature: 0,
          text: {
            format: {
              type: 'json_schema',
              name: 'asphalt_jmf_extract',
              schema: asphaltJmfJsonSchema,
              strict: true,
            },
          },
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        console.error('OpenAI asphalt JMF OCR error', result);
        return NextResponse.json({ error: result?.error?.message || 'Asphalt JMF OCR failed' }, { status: 500 });
      }

      const outputText = result.output_text || result.output?.flatMap((item: any) => item.content ?? []).find((part: any) => part.type === 'output_text')?.text || '';
      const parsed = { ...asphaltJmfEmptyData, ...(safeJsonParse(outputText) ?? {}) };
      return NextResponse.json({ data: parsed });
    }

    if (subtype === 'earthworks-density') {
      const normalizedFileData = normalizeDataUrl(dataUrl, mimeType);
      const prompt = `You are extracting an Israeli QA/QC earthworks field density certificate.
Return JSON only using the supplied schema. Read the attached PDF/image visually, including scanned pages.

Document type: בדיקת צפיפות שדה / צפיפות באמצעות מכשיר גרעיני / הידוק מבוקר / בדיקת שדה למצעים / מצע א׳.
This also covers scanned certificates from Israeli laboratories such as קבוצת הנדסה / ברוק / MBD where the PDF may be image-only.

Extract fields exactly as printed:
- densityCertificateNo: the certificate/report number near "תעודה מס׳" or "דו״ח בדיקה מספר". Preserve slash, e.g. 682440/0. Do not use project number.
- projectNo: project/order number if printed separately.
- issueDate: תאריך הוצאה.
- testDate: תאריך הבדיקה.
- contractor: שם המזמין/קבלן.
- siteName: שם האתר.
- layerNo/layerCode: קוד השכבה or שכבה מספר.
- structureLayer: שכבת המבנה, e.g. מילוי נברר, קרקע יסוד, שתית, מצע א׳, מצעים.
- materialDescription: תאור מדגם / תיאור החומר.
- materialSource: מקור החומר.
- sampleLocation: מיקום הבדיקה exactly enough to identify the tested location.
- fromSection/toSection: if location contains "מחתך 126-131", return fromSection=126 and toSection=131.
- side: R/L/R+L/ימין/שמאל only if printed.
- referenceCertificateNo: the 100% / proctor / אפיון certificate number, usually near "הנתונים מתוך תעודה מס׳"; for מצע certificates this may be the אפיון מצע / תעודת ייחוס.
- referenceDate: date of that reference/proctor certificate.
- aashto: מיון החומר, e.g. A-1-b(0).
- unified: מיון אחיד, e.g. SM.
- maxLabDensity: צפיפות מעבדתית מקסימלית.
- optimumMoisture: רטיבות אופטימלית.
- oversizePercent: משקל יחסי צרורות +3/4 or similar.
- averageMoisture: רטיבות ממוצעת.
- compactionAverage/statisticalAverage/xn: Xn or average compaction if printed.
- lowerLimit/upperLimit: required/spec lower/upper compaction values if printed.
- statisticalLower/la: La if printed.
- statisticalUpper/laPrime: La' if printed.
- status: passed/failed conclusion, preferably OK or NC.
- testPointCount: number of visible sample/test rows in the results table.

Extract every result row in sampleRows[] from the field density table:
sampleNo, testNo, layerNo, wetDensity, maxLabDensity, oversizePercent, moisture, compaction, location.
For מצע/מצעים certificates, still extract the density/moisture/compaction rows exactly the same way and keep materialDescription/structureLayer as מצע/מצע א׳ when printed.
Do not confuse dates, project numbers, or certificate numbers with table values.
If a value is not clearly visible, return an empty string. Do not invent values.`;
      const content: any[] = [{ type: 'input_text', text: prompt }];
      if (isImage(mimeType)) {
        content.push({ type: 'input_image', image_url: normalizedFileData, detail: 'high' });
      } else {
        content.push({ type: 'input_file', filename: fileName, file_data: normalizedFileData });
        const renderedPages = await renderPdfPagesToPngDataUrls(normalizedFileData, mimeType, 3);
        renderedPages.forEach((imageDataUrl, index) => {
          content.push({ type: 'input_text', text: `Visual rendering page ${index + 1}. Use this image for scanned tables and Hebrew labels.` });
          content.push({ type: 'input_image', image_url: imageDataUrl, detail: 'high' });
        });
      }

      const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: process.env.OPENAI_OCR_MODEL || 'gpt-4.1-mini',
          input: [{ role: 'user', content }],
          temperature: 0,
          text: {
            format: {
              type: 'json_schema',
              name: 'earthworks_density_extract',
              schema: earthworksDensityJsonSchema,
              strict: true,
            },
          },
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        console.error('OpenAI earthworks density OCR error', result);
        return NextResponse.json({ error: result?.error?.message || 'Earthworks density OCR failed' }, { status: 500 });
      }

      const outputText = result.output_text || result.output?.flatMap((item: any) => item.content ?? []).find((part: any) => part.type === 'output_text')?.text || '';
      const parsed = { ...earthworksDensityEmptyData, ...(safeJsonParse(outputText) ?? {}) };
      parsed.fields = { ...earthworksDensityEmptyData.fields, ...(parsed.fields ?? {}) };
      parsed.sampleRows = Array.isArray(parsed.sampleRows) ? parsed.sampleRows : [];
      return NextResponse.json({ data: parsed });
    }

    if (subtype === 'reference-results') {
      const normalizedFileData = normalizeDataUrl(dataUrl, mimeType);
      const expectedMetrics = Array.isArray(body.expectedMetrics)
        ? body.expectedMetrics.map((item) => String(item ?? '').trim()).filter(Boolean)
        : [];
      const workType = String(body.workType ?? '').trim();
      const metricsHint = expectedMetrics.length
        ? expectedMetrics.map((metric) => `- ${metric}`).join('\n')
        : '- מספר תעודה\n- תאריך בדיקה\n- מקור החומר\n- תיאור החומר\n- מיון AASHTO\n- 3"\n- 1.5"\n- 1"\n- 3/4"\n- #4\n- #10\n- #40\n- #200\n- LL\n- PL\n- IP';
      const prompt = `אתה מחלץ תוצאות מתעודת מעבדה / תעודת ייחוס עבור בקרת איכות בפרויקט תשתיות בישראל.
קרא את הקובץ המצורף חזותית אם צריך והחזר JSON בלבד.
סוג חומר / טופס: ${workType || 'לא צוין'}.

מטרת החילוץ:
להחזיר rows[] של מדד ותוצאה, לפי המדדים הבאים בלבד ככל שהם מופיעים או ניתנים לזיהוי בתעודה:
${metricsHint}

כללים חשובים:
- rows[].metric חייב להיות אחד משמות המדדים ברשימה, בדיוק ככל האפשר.
- rows[].resultValue הוא הערך שנמדד בתעודה, ללא יחידות מיותרות.
- rows[].minValue ו-rows[].maxValue הם דרישת המינימום והמקסימום מהתעודה אם קיימים. אם אין דרישה כתובה, החזר מחרוזת ריקה.
- rows[].evidence חייב להכיל תעתיק קצר ומדויק של שם השורה והערכים המודפסים באותו תא/שורה. חובה לכלול בתעתיק את resultValue ואת minValue/maxValue כאשר הוחזרו.
- rows[].sourceRegion הוא אחד מהערכים: metadata, compaction, grading, atterberg, full-page.
- rows[].confidence הוא מספר בין 0 ל-1. החזר 0.9 ומעלה רק אם הערך נראה בבירור בתא הנכון. אם אינך בטוח, השאר את הערך ריק והחזר confidence נמוך.
- לכל שדה בתוך fields חובה להחזיר fieldEvidence תואם עם תעתיק מדויק מהמסמך ורמת confidence.
- אין לנסח מחדש שדות טקסט. לדוגמה materialDescription חייב להיות העתק מדויק של הטקסט שמופיע אחרי "תיאור מדגם" או "תיאור החומר".
- עבור נפות ודירוג, החזר אחוז עובר לכל נפה: 3", 1.5", 1", 3/4", #4, #10, #40, #200.
- אל תחזיר בשום אופן את גודל הנפה במ"מ בתור תוצאה. לדוגמה: 0.075, 0.425, 2.000, 4.750, 19.0 הם גדלי נפה ולא תוצאות.
- אם קיימת טבלת נפות עם שורות כגון "מ״מ", "עובר %", "MAX", "MIN", "מתאים": resultValue חייב להגיע רק משורת "עובר %"; maxValue משורת MAX; minValue משורת MIN.
- דוגמה: אם הכותרות הן #200 #40 #10 #4 3/4 והערכים בשורת "עובר %" הם 25 34 56 77 100, החזר #200=25, #40=34, #10=56, #4=77, 3/4"=100.
- עבור גבולות אטרברג החזר LL, PL, IP. אם מופיע NP או ב״פ, החזר NP.
- עבור טבלת גבולות/פלסטיות עם עמודות "תוצאה", "דרישה min", "max", החזר את התוצאה ואת min/max לפי אותה שורה.
- עבור מיון החזר מיון AASHTO אם מופיע, למשל A-1-b או A-2-4(0).
- עבור חומר נברר / מצע / קרקע יסוד, אל תחליף בטעות בין גבולות הסומך לבין קווי דירוג. קווי דירוג הם ערכי הנפות.
- עבור אספלט, החזר את המדדים שמופיעים ברשימת המדדים בלבד.
- אם ערך לא מופיע בבירור, אל תמציא אותו ואל תחזיר אותו.
- תאריכים החזר yyyy-mm-dd כאשר אפשר.
- מלא גם fields עם מספר תעודה, תאריך בדיקה, מקור החומר, תיאור חומר, aashto ומיון אחיד אם קיימים.`;
      const isMbdEngineeringQuality = /^MBD[_-]/i.test(fileName) || /קבוצת\s+הנדסה\s+ואיכות|Engineering\s*&\s*Quality/i.test(fileName);
      const labFormatHint = isMbdEngineeringQuality
        ? `
תבנית מעבדה מזוהה: MBD - קבוצת הנדסה ואיכות בע״מ.
חובה לקרוא חזותית מתוך תקריבי הטבלאות המצורפים בלבד. אין להשתמש בגרפים ואין להמיר יחידות.
החזר רק ערכים שאתה רואה בבירור בתאים של הטבלה.

מיפוי תבנית MBD:
1) כותרת/סיווג חומר:
- certificateNo מתוך "תעודה מס׳".
- testDate מתוך תאריך נטילה/בדיקה של המדגם, לא תאריך הפקת הדוח אם מופיעים שניהם.
- source מתוך מקור/מיקום/שם ספק אם מופיע.
- materialDescription מתוך סוג/תיאור החומר, למשל מילוי נברר.
- materialDescription הוא תעתיק מילולי בלבד. אסור לסכם, לתקן או להחליף אותו בשם קטגוריה כללי.
- aashto מתוך "מיון החומר".
- unified מתוך "מיון אחיד".
לכל השדות והמדדים באזור זה sourceRegion חייב להיות metadata.

2) טבלת צפיפות/רטיבות בצד ימין:
- "100% מעבדתי" = הערך ליד "צפיפות מעבדתית מקסימלית".
- "רטיבות אופטימלית" = הערך ליד "רטיבות אופטימלית".
- "100% מחושב" = הערך ליד "צפיפות מקסימלית מחושבת".
- "רטיבות מחושבת" = הערך ליד "רטיבות מחושבת".
אסור לקחת ערכים מהגרף הצמוד. אל תחזיר 2.097/5.5 אם הם לא מופיעים בתאי הטבלה האלה.
לכל המדדים בסעיף זה sourceRegion חייב להיות compaction.

3) טבלת נפות:
- קרא את שורת הכותרות של הנפות בדיוק כפי שמודפסות.
- resultValue מגיע רק משורת "עובר %".
- maxValue מגיע רק משורת MAX.
- minValue מגיע רק משורת MIN.
- גדלי נפה במ״מ כגון 19.0, 4.750, 2.000, 0.425, 0.075 הם כותרות/מידות, לא תוצאות.
לכל המדדים בסעיף זה sourceRegion חייב להיות grading.

4) טבלת גבולות/תפיחה:
- LL = שורת "גבול נזילות".
- PL = שורת "גבול פלסטיות".
- IP/PI = שורת "אינדקס פלסטיות".
- תפיחה חופשית = שורת "תפיחה חופשית".
- resultValue מהעמודה "תוצאה" באותה שורה בלבד.
- minValue/maxValue מעמודות הדרישה באותה שורה בלבד.
- אסור לחשב IP מתוך LL ו-PL. אם מודפס ערך IP, העתק אותו כפי שהוא.
לכל המדדים בסעיף זה sourceRegion חייב להיות atterberg.

אם אינך בטוח בערך - השאר אותו ריק. אל תנחש.
`
        : '';
      const extractionPrompt = `${prompt}
${labFormatHint}

Accuracy requirements for reference certificates:
- Inspect the complete document visually, including scanned pages and image-only tables. Do not rely only on embedded PDF text.
- Extract every visible requested metric, not only the grading row.
- Identify table row and column headers before assigning any number.
- Sieve apertures such as 19.0, 4.750, 2.000, 0.425 and 0.075 are labels, never measured grading results.
- Extract Atterberg limits LL, PL and PI/IP, free swell, maximum laboratory density, optimum moisture, calculated density and moisture, absorption, specific gravity, sand equivalent, and every other visible metric from expectedMetrics.
- Preserve textual results such as NP.
- Copy certificate requirements from MIN/MAX columns into minValue/maxValue. Never copy a measured result into a limit field.
- Verify internally that every returned value belongs to the same metric row.`;
      let mbdRegions: Array<{ label: string; imageDataUrl: string }> = [];
      const content: any[] = [{ type: 'input_text', text: extractionPrompt }];
      if (isImage(mimeType)) {
        content.push({ type: 'input_image', image_url: normalizedFileData, detail: 'high' });
      } else if (isMbdEngineeringQuality) {
        // MBD הוא PDF סרוק; לא שולחים input_file כדי שלא יופעל חילוץ טקסט ריק/מטעה.
        const renderedPages = await renderPdfPagesToPngDataUrls(normalizedFileData, mimeType, 1);
        renderedPages.forEach((imageDataUrl, index) => {
          content.push({ type: 'input_text', text: `Full visual page ${index + 1} for orientation only. Prefer the enlarged table crops for values.` });
          content.push({ type: 'input_image', image_url: imageDataUrl, detail: 'high' });
        });
        mbdRegions = await renderMbdCertificateRegions(normalizedFileData, mimeType);
        mbdRegions.forEach((region) => {
          content.push({
            type: 'input_text',
            text: `SOURCE REGION: ${region.label}. Read only the values that belong to this region. Set rows[].sourceRegion to exactly "${region.label}" for values copied from this crop.`,
          });
          content.push({ type: 'input_image', image_url: region.imageDataUrl, detail: 'high' });
        });
      } else {
        content.push({ type: 'input_file', filename: fileName, file_data: normalizedFileData });
        const renderedPages = await renderPdfPagesToPngDataUrls(normalizedFileData, mimeType);
        renderedPages.forEach((imageDataUrl, index) => {
          content.push({ type: 'input_text', text: `Visual rendering of PDF page ${index + 1}. Use this image to verify table row and column alignment.` });
          content.push({ type: 'input_image', image_url: imageDataUrl, detail: 'high' });
        });
      }

      const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: process.env.OPENAI_REFERENCE_OCR_MODEL || 'gpt-4.1',
          input: [{ role: 'user', content }],
          temperature: 0,
          text: {
            format: {
              type: 'json_schema',
              name: 'reference_results_extract',
              schema: referenceResultsJsonSchema,
              strict: true,
            },
          },
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        console.error('OpenAI reference results OCR error', result);
        return NextResponse.json({ error: result?.error?.message || 'Reference results OCR failed' }, { status: 500 });
      }

      const outputText = result.output_text || result.output?.flatMap((item: any) => item.content ?? []).find((part: any) => part.type === 'output_text')?.text || '';
      const parsed = { ...referenceResultsEmptyData, ...(safeJsonParse(outputText) ?? {}) };
      if (isMbdEngineeringQuality) {
        parsed.rows = normalizeMbdReferenceRows(parsed.rows);
        parsed.fields = normalizeMbdReferenceFields(parsed.fields, parsed.fieldEvidence);

        // קריאה עצמאית נוספת של הכותרת מונעת שמירת תיאור חומר שהמודל ניסח או
        // קרא באופן שונה. רק שדות ששתי הקריאות מסכימות עליהם נשמרים אוטומטית.
        const verificationRegions = [
          mbdRegions.find((region) => region.label === 'metadata'),
          mbdRegions.find((region) => region.label === 'material-details'),
          mbdRegions.find((region) => region.label === 'classification-values'),
        ].filter((region): region is { label: string; imageDataUrl: string } => Boolean(region));
        if (verificationRegions.length) {
          const verifierPrompt = `Read the attached cropped header of an MBD / Engineering & Quality Group laboratory certificate.
Return JSON only using the supplied schema.
Transcribe fields exactly as printed. Do not summarize, correct spelling, infer a material category, or use the filename.
Pay special attention to the exact text after "תיאור מדגם", "מקור מדגם", "מיון החומר", "מיון אחיד", and the printed test/sample date.
For every non-empty field, fieldEvidence.evidence must quote the exact visible label and value.
Keep rows empty. If any character is uncertain, leave that field empty.`;
          const verifierResponse = await fetch('https://api.openai.com/v1/responses', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: process.env.OPENAI_REFERENCE_OCR_MODEL || 'gpt-4.1',
              input: [{
                role: 'user',
                content: [
                  { type: 'input_text', text: verifierPrompt },
                  ...verificationRegions.flatMap((region) => [
                    { type: 'input_text', text: `Crop: ${region.label}` },
                    { type: 'input_image', image_url: region.imageDataUrl, detail: 'high' },
                  ]),
                ],
              }],
              temperature: 0,
              text: {
                format: {
                  type: 'json_schema',
                  name: 'mbd_metadata_verify',
                  schema: referenceResultsJsonSchema,
                  strict: true,
                },
              },
            }),
          });
          const verifierResult = await verifierResponse.json();
          if (verifierResponse.ok) {
            const verifierText = verifierResult.output_text ||
              verifierResult.output?.flatMap((item: any) => item.content ?? [])
                .find((part: any) => part.type === 'output_text')?.text ||
              '';
            const verifierParsed = safeJsonParse(verifierText) ?? {};
            const verifiedFields = normalizeMbdReferenceFields(
              verifierParsed.fields,
              verifierParsed.fieldEvidence,
            );
            parsed.fields = intersectVerifiedMbdFields(parsed.fields, verifiedFields);
          } else {
            // אם אימות הכותרת נכשל, לא שומרים אוטומטית שדות טקסט שעלולים להיות מנוחשים.
            parsed.fields = {
              ...parsed.fields,
              source: '',
              materialDescription: '',
            };
          }
        }
      }
      return NextResponse.json({ data: parsed });
    }

    const prompt = `אתה OCR מקצועי למסמכי בקרת איכות בפרויקטי תשתיות בישראל.
קרא את הקובץ המצורף חזותית והחזר JSON בלבד.
סוג טופס: ${subtype}.
חובה לחלץ מהמסמך עצמו, לא משם הקובץ, אלא אם אין מידע במסמך.
אם הקובץ כולל כמה אישורים / תעודות / רישיונות באותו PDF, חובה להחזיר את כולם במערך certificates, פריט נפרד לכל אישור. כל פריט יכלול details, certificateNo, expiryDate, issueDate, supplierName, materialName.
בשדות הראשיים החזר את האישור הראשון/הברור ביותר, אבל אל תוותר על שאר האישורים במערך certificates.
certificateNo = מספר התעודה / מספר הרישיון / מספר האישור שמופיע במסמך. דוגמאות תקינות: 25/3785, 947, Z70091.
expiryDate = תאריך תוקף / פקיעת תוקף. אם מופיע "12 מאי 2026" החזר 2026-05-12.
issueDate אינו חשוב, החזר ריק אם לא ברור.
אל תחזיר מספר אישור פנימי כמו SUB-2026-83698. אל תחזיר שנה בלבד כמו 2026 בתור certificateNo.
אם יש טבלה, קרא את השורות הסמוכות לכותרות: מספר תעודה, תעודת כיול מס׳, תאריך פקיעת תוקף כיול, תוקף, בתוקף עד.`;

    const normalizedFileData = normalizeDataUrl(dataUrl, mimeType);
    const pdfAudit = await auditPdfFile(normalizedFileData, mimeType);
    const pdfAuditHint = pdfAudit
      ? `
בדיקת PDF מוקדמת של המערכת:
- מספר עמודים: ${pdfAudit.pageCount}.
- אישורי שער טקסטואליים שזוהו: ${pdfAudit.certificates.map((item) => `${item.certificateNo}${item.expiryDate ? ` עד ${item.expiryDate}` : ''}`).join(', ') || 'לא זוהו'}.
- עמודים שהם תמונה/סריקה ללא טקסט: ${pdfAudit.imageOnlyPages.join(', ') || 'אין'}.
אם קיימים עמודים סרוקים ללא טקסט, חובה לבדוק אותם חזותית ולא לדלג עליהם. אם הם כוללים אישור/תעודה/רישיון, החזר אותם כפריטים נוספים במערך certificates.
אם יש שני אישורים עם אותו מספר בסיסי אבל תאריכי תוקף/הנפקה שונים, החזר את שניהם כשורות נפרדות.
בסוף בצע בדיקה חוזרת עמוד-עמוד: אל תסתפק בעמודים הראשונים, ואל תדלג על עמודים סרוקים/תמונתיים.`
      : '';
    const enhancedPrompt = `${prompt}\n${pdfAuditHint}`;
    const content: any[] = [{ type: 'input_text', text: enhancedPrompt }];
    if (isImage(mimeType)) {
      content.push({ type: 'input_image', image_url: normalizedFileData });
    } else {
      content.push({ type: 'input_file', filename: fileName, file_data: normalizedFileData });
    }

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.OPENAI_OCR_MODEL || 'gpt-4.1-mini',
        input: [{ role: 'user', content }],
        temperature: 0,
        text: {
          format: {
            type: 'json_schema',
            name: 'preliminary_ocr_extract',
            schema: jsonSchema,
            strict: true,
          },
        },
      }),
    });

    const result = await response.json();
    if (!response.ok) {
      console.error('OpenAI OCR error', result);
      return NextResponse.json({ error: result?.error?.message || 'OCR failed' }, { status: 500 });
    }

    const outputText = result.output_text || result.output?.flatMap((item: any) => item.content ?? []).find((part: any) => part.type === 'output_text')?.text || '';
    const parsed = { ...emptyData, ...(safeJsonParse(outputText) ?? {}) };
    let scannedPageCertificates: ExtractedCertificate[] = [];
    if (pdfAudit?.imageOnlyPages.length) {
      try {
        const scannedPrompt = `התמקד רק בעמודים הסרוקים/תמונתיים הבאים בקובץ: ${pdfAudit.imageOnlyPages.join(', ')}.
אל תשתמש בעמודים אחרים.
בדוק חזותית אם מופיע בהם אישור / כתב אישור / תעודה / רישיון.
אם מופיע "כתב אישור מס׳" או "נספח לכתב אישור מס׳", החזר אותו כפריט certificate נפרד.
חלץ במיוחד:
- details: סוג האישור, למשל "כתב אישור מכון התקנים" או "נספח לכתב אישור"
- certificateNo: מספר האישור בלבד, למשל 435
- issueDate: תאריך "בתוקף מ" או "ניתן ביום" בפורמט yyyy-mm-dd
- expiryDate: תאריך "עד" או "בתוקף עד" בפורמט yyyy-mm-dd
- supplierName: שם הגוף המאושר.
החזר JSON בלבד לפי הסכמה.`;
        const scannedContent: any[] = [
          { type: 'input_text', text: scannedPrompt },
        ];
        if (pdfAudit.imageOnlyPageImages.length) {
          pdfAudit.imageOnlyPageImages.forEach((image) => {
            scannedContent.push({
              type: 'input_text',
              text: `עמוד סרוק ${image.pageNo}:`,
            });
            scannedContent.push({
              type: 'input_image',
              image_url: image.imageDataUrl,
            });
          });
        } else {
          scannedContent.push({ type: 'input_file', filename: fileName, file_data: normalizedFileData });
        }
        const scannedResponse = await fetch('https://api.openai.com/v1/responses', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: process.env.OPENAI_OCR_MODEL || 'gpt-4.1-mini',
            input: [{ role: 'user', content: scannedContent }],
            temperature: 0,
            text: {
              format: {
                type: 'json_schema',
                name: 'preliminary_scanned_pages_extract',
                schema: jsonSchema,
                strict: true,
              },
            },
          }),
        });
        const scannedResult = await scannedResponse.json();
        if (scannedResponse.ok) {
          const scannedOutputText =
            scannedResult.output_text ||
            scannedResult.output?.flatMap((item: any) => item.content ?? []).find((part: any) => part.type === 'output_text')?.text ||
            '';
          const scannedParsed = { ...emptyData, ...(safeJsonParse(scannedOutputText) ?? {}) };
          scannedPageCertificates = mergeCertificateItems(
            scannedParsed.certificates,
            scannedParsed.certificateNo || scannedParsed.expiryDate || scannedParsed.details
              ? [normalizeCertificateItem(scannedParsed)]
              : [],
          );
        } else {
          console.error('OpenAI scanned-page OCR error', scannedResult);
        }
      } catch (error) {
        console.error('Scanned-page OCR pass failed', error);
      }
    }
    const fallback = extractFromText(`${outputText}\n${parsed.details || ''}\n${parsed.notes || ''}`, fileName);

    parsed.certificateNo = cleanCertificateNo(parsed.certificateNo) || fallback.certificateNo;
    parsed.expiryDate = normalizeHebrewDate(parsed.expiryDate) || fallback.expiryDate;
    parsed.issueDate = '';
    parsed.certificates = mergeCertificateItems(parsed.certificates, scannedPageCertificates, pdfAudit?.certificates ?? []);
    if (!parsed.certificates.length && (parsed.certificateNo || parsed.expiryDate || parsed.details)) {
      parsed.certificates = [normalizeCertificateItem(parsed)];
    }
    const minimumExpectedCertificates =
      (pdfAudit?.certificates.length ?? 0) + (pdfAudit?.imageOnlyPages.length ? 1 : 0);
    if (
      pdfAudit?.imageOnlyPages.length &&
      parsed.certificates.length < minimumExpectedCertificates
    ) {
      parsed.certificates = mergeCertificateItems(parsed.certificates, [
        {
          details: `אישור נוסף סרוק בעמודים ${pdfAudit.imageOnlyPages.join(', ')} - נדרש אימות מספר/תוקף`,
          certificateNo: '',
          expiryDate: '',
          issueDate: '',
          supplierName: parsed.supplierName || parsed.subcontractorName || '',
          materialName: parsed.materialName || parsed.suppliedMaterial || '',
        },
      ]);
    }

    return NextResponse.json({ data: parsed });
  } catch (error: any) {
    console.error('OCR route failed', error);
    return NextResponse.json({ error: error?.message || 'OCR route failed' }, { status: 500 });
  }
}
