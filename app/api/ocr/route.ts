import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

type RequestBody = {
  fileName?: string;
  mimeType?: string;
  dataUrl?: string;
  subtype?: 'suppliers' | 'subcontractors' | 'materials';
  documentLabel?: string;
};

const emptyData = {
  certificateNo: '',
  expiryDate: '',
  supplierName: '',
  subcontractorName: '',
  materialName: '',
  suppliedMaterial: '',
  branch: '',
  contactPhone: '',
  details: '',
  confidence: 0,
  notes: '',
  rawText: '',
};

const jsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    certificateNo: { type: 'string' },
    expiryDate: { type: 'string' },
    supplierName: { type: 'string' },
    subcontractorName: { type: 'string' },
    materialName: { type: 'string' },
    suppliedMaterial: { type: 'string' },
    branch: { type: 'string' },
    contactPhone: { type: 'string' },
    details: { type: 'string' },
    confidence: { type: 'number' },
    notes: { type: 'string' },
    rawText: { type: 'string' },
  },
  required: Object.keys(emptyData),
};

function getBase64(dataUrl: string) {
  const marker = ';base64,';
  const idx = dataUrl.indexOf(marker);
  return idx >= 0 ? dataUrl.slice(idx + marker.length) : dataUrl;
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

const heMonths: Record<string, string> = {
  'ינואר': '01', 'פברואר': '02', 'מרץ': '03', 'אפריל': '04', 'מאי': '05', 'יוני': '06',
  'יולי': '07', 'אוגוסט': '08', 'ספטמבר': '09', 'אוקטובר': '10', 'נובמבר': '11', 'דצמבר': '12',
};

function normalizeText(value: unknown) {
  return String(value ?? '')
    .replace(/[־–—]/g, '-')
    .replace(/[׳`’]/g, "'")
    .replace(/\u200f|\u200e/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeDate(value: unknown) {
  const text = normalizeText(value);
  if (!text) return '';

  const iso = text.match(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;

  const dmy = text.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](20\d{2})\b/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;

  const he = text.match(/\b(\d{1,2})\s+(ינואר|פברואר|מרץ|אפריל|מאי|יוני|יולי|אוגוסט|ספטמבר|אוקטובר|נובמבר|דצמבר)\s+(20\d{2})\b/);
  if (he) return `${he[3]}-${heMonths[he[2]]}-${he[1].padStart(2, '0')}`;

  const year = text.match(/\b(20\d{2})\b/);
  return year ? year[1] : '';
}

function isBadCertificateCandidate(value: string) {
  const text = value.trim();
  if (!text) return true;
  if (/^20\d{2}$/.test(text)) return true;
  if (/^\d{1,2}[./-]\d{1,2}[./-]20\d{2}$/.test(text)) return true;
  if (/^20\d{2}[./-]\d{1,2}[./-]\d{1,2}$/.test(text)) return true;
  return false;
}

function cleanupCertificateCandidate(value: unknown) {
  const text = normalizeText(value).replace(/\s*\/\s*/g, '/').replace(/[,:;]+$/g, '');
  if (isBadCertificateCandidate(text)) return '';
  const slash = text.match(/\b\d{1,4}\/\d{2,8}\b/);
  if (slash && !isBadCertificateCandidate(slash[0])) return slash[0];
  const alphaNum = text.match(/\b[A-Z]{1,5}[-/]?\d{2,10}\b/i);
  if (alphaNum && !/^SUB[-/]?20/i.test(alphaNum[0])) return alphaNum[0];
  const digits = text.match(/\b\d{2,8}\b/);
  if (digits && !isBadCertificateCandidate(digits[0])) return digits[0];
  return '';
}

function extractCertificateNoFromText(raw: string) {
  const text = normalizeText(raw);
  const label = '(?:תעודת\\s*כיול|מספר\\s*תעודה|מס[\\'׳]?\\s*תעודה|מספר\\s*רישיון|מספר\\s*רשיון|מס[\\'׳]?\\s*רישיון|מס[\\'׳]?\\s*רשיון|רישיון\\s*מס[\\'׳]?|רשיון\\s*מס[\\'׳]?|מספר\\s*אישור|מס[\\'׳]?\\s*אישור|תעודה\\s*מס[\\'׳]?|אישור\\s*מס[\\'׳]?)';
  const nearLabel = new RegExp(`${label}[^0-9A-Za-z]{0,30}([A-Z]{0,5}[-/]?\\d{1,4}\\s*\\/\\s*\\d{2,8}|[A-Z]{1,5}[-/]?\\d{2,10}|\\d{2,8})`, 'i');
  const match = text.match(nearLabel);
  const candidate = cleanupCertificateCandidate(match?.[1] ?? '');
  if (candidate) return candidate;

  // fallback: in calibration certificates the certificate number is often in the title line: "תעודת כיול 25/3785"
  const calibrationTitle = text.match(/תעודת\s*כיול[^0-9]{0,20}(\d{1,4}\s*\/\s*\d{2,8})/i);
  const calibrationCandidate = cleanupCertificateCandidate(calibrationTitle?.[1] ?? '');
  if (calibrationCandidate) return calibrationCandidate;

  // fallback: any slash certificate number that is not a date and not a year.
  const slashCandidates = [...text.matchAll(/\b\d{1,4}\s*\/\s*\d{2,8}\b/g)]
    .map((m) => cleanupCertificateCandidate(m[0]))
    .filter(Boolean)
    .filter((v) => !/^\d{1,2}\/20\d{2}$/.test(v));
  if (slashCandidates.length) return slashCandidates[0];

  return '';
}

function extractExpiryFromText(raw: string) {
  const text = normalizeText(raw);
  const label = '(?:תאריך\\s*)?(?:פקיעת\\s*תוקף|פקיעת|תוקף|בתוקף\\s*עד|תאריך\\s*תוקף|תוקף\\s*כיול|פקיעת\\s*תוקף\\s*כיול)';
  const patterns = [
    new RegExp(`${label}[^0-9]{0,40}(\\d{1,2}\\s+(?:ינואר|פברואר|מרץ|אפריל|מאי|יוני|יולי|אוגוסט|ספטמבר|אוקטובר|נובמבר|דצמבר)\\s+20\\d{2})`, 'i'),
    new RegExp(`${label}[^0-9]{0,40}(\\d{1,2}[/.\\-]\\d{1,2}[/.\\-]20\\d{2})`, 'i'),
    new RegExp(`${label}[^0-9]{0,40}(20\\d{2}[/.\\-]\\d{1,2}[/.\\-]\\d{1,2})`, 'i'),
    new RegExp(`${label}[^0-9]{0,40}(20\\d{2})`, 'i'),
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    const normalized = normalizeDate(match?.[1] ?? '');
    if (normalized) return normalized;
  }

  // fallback for calibration documents: any Hebrew full date after the certificate number area.
  const heDate = text.match(/\b\d{1,2}\s+(ינואר|פברואר|מרץ|אפריל|מאי|יוני|יולי|אוגוסט|ספטמבר|אוקטובר|נובמבר|דצמבר)\s+20\d{2}\b/);
  if (heDate) return normalizeDate(heDate[0]);
  return '';
}

function cleanParsedData(parsed: any, responseText: string) {
  const combinedText = [parsed?.rawText, parsed?.certificateNo, parsed?.expiryDate, responseText].filter(Boolean).join(' ');
  const rawText = normalizeText(combinedText);
  const certificateNo = extractCertificateNoFromText(rawText) || cleanupCertificateCandidate(parsed?.certificateNo);
  const expiryDate = normalizeDate(parsed?.expiryDate) || extractExpiryFromText(rawText);
  return {
    ...emptyData,
    ...parsed,
    rawText,
    certificateNo,
    expiryDate,
    confidence: typeof parsed?.confidence === 'number' ? Math.max(0, Math.min(1, parsed.confidence)) : 0,
  };
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
    const documentLabel = String(body.documentLabel ?? '');

    if (!dataUrl) return NextResponse.json({ data: emptyData });

    const prompt = `אתה סורק OCR מקצועי למסמכי בקרת איכות בעברית/אנגלית.
קרא את הקובץ המצורף עצמו ואל תסתמך על שם הקובץ.
סוג רשומה במערכת: ${subtype}. שורת המסמך במערכת: ${documentLabel}.

החזר JSON בלבד.
חובה להחזיר rawText קצר הכולל את השורות המדויקות במסמך שבהן מופיעים מספר התעודה/רישיון ותוקף/פקיעה.

שדות:
certificateNo = מספר תעודה / מספר רישיון / מספר אישור / מספר תעודת כיול מתוך המסמך.
expiryDate = תאריך פקיעה/תוקף מתוך המסמך.
supplierName / subcontractorName / materialName / suppliedMaterial / branch / contactPhone אם קיימים במסמך.

דוגמא מחייבת:
אם במסמך כתוב בכותרת: "תעודת כיול מס׳ 25/3785" אז certificateNo חייב להיות "25/3785".
אם במסמך כתוב: "תאריך פקיעת תוקף כיול 12 מאי 2026" אז expiryDate חייב להיות "2026-05-12".

איסורים:
אל תחזיר 2025 או 2026 בתור certificateNo.
אל תיצור מספר פנימי כגון SUB-2026.
אל תנחש. אם לא קיים ערך ברור במסמך, החזר מחרוזת ריקה.`;

    const content: any[] = [{ type: 'input_text', text: prompt }];
    if (isImage(mimeType)) {
      content.push({ type: 'input_image', image_url: dataUrl, detail: 'high' });
    } else {
      content.push({ type: 'input_file', filename: fileName, file_data: getBase64(dataUrl) });
    }

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.OPENAI_OCR_MODEL || 'gpt-4o',
        input: [{ role: 'user', content }],
        temperature: 0,
        text: { format: { type: 'json_schema', name: 'preliminary_ocr_extract', schema: jsonSchema, strict: true } },
      }),
    });

    const result = await response.json();
    if (!response.ok) {
      console.error('OpenAI OCR error', result);
      return NextResponse.json({ error: result?.error?.message || 'OCR failed' }, { status: 500 });
    }

    const outputText = result.output_text || result.output?.flatMap((item: any) => item.content ?? []).find((part: any) => part.type === 'output_text')?.text || '';
    const parsed = safeJsonParse(outputText) ?? emptyData;
    const data = cleanParsedData(parsed, outputText);
    return NextResponse.json({ data });
  } catch (error: any) {
    console.error('OCR route failed', error);
    return NextResponse.json({ error: error?.message || 'OCR route failed' }, { status: 500 });
  }
}
