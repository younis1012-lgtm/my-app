import { NextRequest, NextResponse } from 'next/server';

import * as canvasRuntime from '@napi-rs/canvas';

export const runtime = 'nodejs';
export const maxDuration = 60;

type RequestBody = {
  fileName?: string;
  mimeType?: string;
  dataUrl?: string;
  subtype?: 'suppliers' | 'subcontractors' | 'materials' | 'asphalt-jmf' | 'reference-results';
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
  rows: [] as Array<{ metric: string; resultValue: string; minValue: string; maxValue: string }>,
  fields: {
    certificateNo: '',
    testDate: '',
    source: '',
    materialDescription: '',
    aashto: '',
    unified: '',
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
        },
        required: ['metric', 'resultValue', 'minValue', 'maxValue'],
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
    confidence: { type: 'number' },
    notes: { type: 'string' },
  },
  required: Object.keys(referenceResultsEmptyData),
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

async function renderPdfPageToPngDataUrl(page: any) {
  try {
    const { createCanvas } = canvasRuntime;
    const viewport = page.getViewport({ scale: 2 });
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
