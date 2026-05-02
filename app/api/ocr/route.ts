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
  rawText: '',
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

function normalizeDate(value: unknown) {
  const text = String(value ?? '').trim();
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

function extractCertificateNoFromText(text: string) {
  const t = String(text ?? '').replace(/[־–—]/g, '-');
  const patterns = [
    /תעודת\s*כיול\s*(?:מס['׳]?|מספר)?\s*[:#-]?\s*([0-9]{1,4}\s*\/\s*[0-9]{2,8})/i,
    /(?:מס['׳]?|מספר)\s*(?:תעודה|אישור|רישיון|רשיון|כיול)\s*[:#-]?\s*([0-9]{1,4}\s*\/\s*[0-9]{2,8})/i,
    /(?:תעודה|אישור|רישיון|רשיון)\s*(?:מס['׳]?|מספר)?\s*[:#-]?\s*([0-9]{1,4}\s*\/\s*[0-9]{2,8})/i,
    /(?:מס['׳]?|מספר)\s*(?:תעודה|אישור|רישיון|רשיון|כיול)\s*[:#-]?\s*([0-9]{2,8})/i,
    /(?:תעודת\s*כיול|רישיון|רשיון)\s*(?:מס['׳]?|מספר)?\s*[:#-]?\s*([0-9]{2,8})/i,
  ];
  for (const pattern of patterns) {
    const match = t.match(pattern);
    const candidate = match?.[1]?.replace(/\s+/g, '') ?? '';
    if (candidate && !/^20\d{2}$/.test(candidate)) return candidate;
  }
  return '';
}

function extractExpiryFromText(text: string) {
  const t = String(text ?? '').replace(/[־–—]/g, '-');
  const patterns = [
    /(?:תאריך\s*)?(?:פקיעת|פג|תוקף|בתוקף\s*עד|תאריך\s*תוקף)\s*(?:תוקף\s*)?(?:כיול)?\s*[:#-]?\s*(\d{1,2}\s+(?:ינואר|פברואר|מרץ|אפריל|מאי|יוני|יולי|אוגוסט|ספטמבר|אוקטובר|נובמבר|דצמבר)\s+20\d{2})/i,
    /(?:תאריך\s*)?(?:פקיעת|פג|תוקף|בתוקף\s*עד|תאריך\s*תוקף)\s*(?:תוקף\s*)?(?:כיול)?\s*[:#-]?\s*(\d{1,2}[\/.\-]\d{1,2}[\/.\-]20\d{2})/i,
    /(?:תאריך\s*)?(?:פקיעת|פג|תוקף|בתוקף\s*עד|תאריך\s*תוקף)\s*(?:תוקף\s*)?(?:כיול)?\s*[:#-]?\s*(20\d{2}[\/.\-]\d{1,2}[\/.\-]\d{1,2})/i,
    /(?:תאריך\s*)?(?:פקיעת|פג|תוקף|בתוקף\s*עד|תאריך\s*תוקף)\s*(?:תוקף\s*)?(?:כיול)?\s*[:#-]?\s*(20\d{2})/i,
  ];
  for (const pattern of patterns) {
    const match = t.match(pattern);
    const value = normalizeDate(match?.[1] ?? '');
    if (value) return value;
  }
  return '';
}

function cleanCertificateNo(value: unknown, rawText: string) {
  const fromText = extractCertificateNoFromText(rawText);
  if (fromText) return fromText;
  const text = String(value ?? '').trim().replace(/\s+/g, '');
  if (!text) return '';
  if (/^20\d{2}$/.test(text)) return '';
  const slash = text.match(/\d{1,4}\/\d{2,8}/);
  if (slash) return slash[0];
  const digits = text.match(/\d{2,8}/);
  return digits ? digits[0] : '';
}

function cleanParsedData(parsed: any, sourceText: string) {
  const rawText = String(parsed?.rawText || sourceText || '');
  return {
    ...emptyData,
    ...parsed,
    rawText,
    certificateNo: cleanCertificateNo(parsed?.certificateNo, rawText),
    expiryDate: normalizeDate(parsed?.expiryDate) || extractExpiryFromText(rawText),
    issueDate: normalizeDate(parsed?.issueDate),
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

    const prompt = `אתה OCR מקצועי למסמכי בקרת איכות בעברית/אנגלית.
קרא את המסמך המצורף ותחזיר JSON בלבד לפי הסכמה.
סוג רשומה במערכת: ${subtype}. סוג מסמך/שורת תעודה במערכת: ${documentLabel}.

חובה לסרוק את גוף המסמך עצמו, לא להסתמך על שם הקובץ.
חובה להחזיר גם rawText: טקסט קצר מהמסמך הכולל את השורות סביב מספר התעודה והתוקף.

כללים קריטיים:
1. certificateNo = מספר תעודה / רישיון / אישור / תעודת כיול כפי שמופיע במסמך.
   דוגמא: אם כתוב "תעודת כיול מס׳ 25/3785" החזר certificateNo="25/3785".
   אל תחזיר שנה כמו 2025/2026 בתור certificateNo.
2. expiryDate = תאריך פקיעה/תוקף בלבד.
   דוגמא: "12 מאי 2026" יוחזר expiryDate="2026-05-12".
   אם יש רק שנה, החזר "2026".
3. issueDate = תאריך הפקה/בדיקה אם קיים.
4. אל תנחש. אם אין ערך ברור, החזר מחרוזת ריקה.
5. אל תיצור מספרי אישור פנימיים כמו SUB-2026. המספור הפנימי נעשה במערכת בלבד.
`;

    const content: any[] = [{ type: 'input_text', text: prompt }];
    if (isImage(mimeType)) {
      content.push({ type: 'input_image', image_url: dataUrl });
    } else {
      content.push({ type: 'input_file', filename: fileName, file_data: getBase64(dataUrl) });
    }

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.OPENAI_OCR_MODEL || 'gpt-4.1-mini',
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
    return NextResponse.json({ data: cleanParsedData(parsed, outputText) });
  } catch (error: any) {
    console.error('OCR route failed', error);
    return NextResponse.json({ error: error?.message || 'OCR route failed' }, { status: 500 });
  }
}
