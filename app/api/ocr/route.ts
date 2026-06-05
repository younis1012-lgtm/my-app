import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

type RequestBody = {
  fileName?: string;
  mimeType?: string;
  dataUrl?: string;
  subtype?: 'suppliers' | 'subcontractors' | 'materials' | 'asphalt-jmf';
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
  required: ['rows', 'fields', 'confidence', 'notes'],
};

function normalizeDataUrl(dataUrl: string, mimeType: string) {
  const raw = String(dataUrl || '').trim();
  if (!raw) return '';
  if (raw.startsWith('data:')) return raw;
  return `data:${mimeType || 'application/octet-stream'};base64,${raw}`;
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
      const prompt = `You are extracting an asphalt JMF / Marshall mix design lab certificate for Israeli QA/QC.
Return JSON only. Read the attached PDF/image visually if needed.
Extract result values for these metrics when visible:
מספר דגימה, סוג תערובת, תאריך בדיקה, שם דגימה, הזמנה מקורית של הדגימה,
1.5", 1", 3/4", mm 14, 1/2", 3/8", mm 8, #4, #10, #20, #40, #80, #200,
תכולת ביטומן, מפעל אספקה, יחס מלאן - ביטומן, צפיפות בשיטת וואקום, יציבות, נזילות,
חוזק משתייר, אחוז חלל, V.M.A, צפיפות בשיטת ריפ, התנגדות, שחיקה קנטברו.
Use the exact Hebrew metric names from this list in rows[].metric.
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
    const fallback = extractFromText(`${outputText}\n${parsed.details || ''}\n${parsed.notes || ''}`, fileName);

    parsed.certificateNo = cleanCertificateNo(parsed.certificateNo) || fallback.certificateNo;
    parsed.expiryDate = normalizeHebrewDate(parsed.expiryDate) || fallback.expiryDate;
    parsed.issueDate = '';
    parsed.certificates = normalizeCertificateItems(parsed.certificates);
    if (!parsed.certificates.length && (parsed.certificateNo || parsed.expiryDate || parsed.details)) {
      parsed.certificates = [normalizeCertificateItem(parsed)];
    }

    return NextResponse.json({ data: parsed });
  } catch (error: any) {
    console.error('OCR route failed', error);
    return NextResponse.json({ error: error?.message || 'OCR route failed' }, { status: 500 });
  }
}
