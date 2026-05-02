import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

type RequestBody = {
  fileName?: string;
  mimeType?: string;
  dataUrl?: string;
  subtype?: 'suppliers' | 'subcontractors' | 'materials' | string;
};

const emptyData = {
  documentType: '',
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
    documentType: { type: 'string' },
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

function dataUrlMimeType(dataUrl: string) {
  const match = dataUrl.match(/^data:([^;]+);base64,/i);
  return match?.[1] || '';
}

function ensureDataUrl(dataUrl: string, mimeType: string) {
  const raw = String(dataUrl || '').trim();
  if (!raw) return '';
  if (/^data:[^;]+;base64,/i.test(raw)) return raw;
  return `data:${mimeType || 'application/octet-stream'};base64,${raw}`;
}

function safeJsonParse(text: string) {
  try { return JSON.parse(text); } catch {}
  const match = String(text || '').match(/\{[\s\S]*\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch { return null; }
}

function isImage(mimeType: string) {
  return String(mimeType || '').toLowerCase().startsWith('image/');
}

function normalizeDigits(value: string) {
  return String(value || '')
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
}

function normalizeHebrewDate(value: string) {
  const raw = normalizeDigits(String(value || '')).trim();
  if (!raw) return '';

  const months: Record<string, string> = {
    'ינואר': '01', 'פברואר': '02', 'מרץ': '03', 'אפריל': '04', 'מאי': '05', 'יוני': '06',
    'יולי': '07', 'אוגוסט': '08', 'ספטמבר': '09', 'אוקטובר': '10', 'נובמבר': '11', 'דצמבר': '12',
    'january': '01', 'february': '02', 'march': '03', 'april': '04', 'may': '05', 'june': '06',
    'july': '07', 'august': '08', 'september': '09', 'october': '10', 'november': '11', 'december': '12',
  };

  const iso = raw.match(/(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;

  const dmY = raw.match(/(\d{1,2})[-/.](\d{1,2})[-/.](20\d{2})/);
  if (dmY) return `${dmY[3]}-${dmY[2].padStart(2, '0')}-${dmY[1].padStart(2, '0')}`;

  const namedMonth = raw.match(/(\d{1,2})\s+([A-Za-zא-ת]+)\s+(20\d{2})/i);
  if (namedMonth) {
    const month = months[namedMonth[2].toLowerCase()] || months[namedMonth[2]];
    if (month) return `${namedMonth[3]}-${month}-${namedMonth[1].padStart(2, '0')}`;
  }

  const yearOnly = raw.match(/^20\d{2}$/);
  if (yearOnly) return raw;

  return raw;
}

function invalidCertificateCandidate(value: string) {
  const v = String(value || '').trim();
  if (!v) return true;
  if (/^20\d{2}$/.test(v)) return true;
  if (/^\d{1,2}[-/.]\d{1,2}[-/.]20\d{2}$/.test(v)) return true;
  if (/^20\d{2}[-/.]\d{1,2}[-/.]\d{1,2}$/.test(v)) return true;
  if (/^SUB-?20\d{2}/i.test(v)) return true;
  return false;
}

function cleanCertificateNo(value: string) {
  const raw = normalizeDigits(String(value || '')).trim();
  if (!raw) return '';

  const cleaned = raw
    .replace(/(?:מספר|מס׳|מס')\s*(?:תעודה|רישיון|רשיון|אישור)?/g, '')
    .replace(/(?:תעודת|אישור)\s*(?:כיול|בדיקה)?/g, '')
    .replace(/רישיון|רשיון|אישור|תעודה|כיול/g, '')
    .replace(/[:：]/g, '')
    .trim();

  const candidates = cleaned.match(/[A-Za-z0-9]{1,12}(?:[\/-][A-Za-z0-9]{1,12})*/g) || [];
  for (const candidate of candidates) {
    if (!invalidCertificateCandidate(candidate)) return candidate;
  }
  return '';
}

function extractByRegex(text: string) {
  const combined = normalizeDigits(String(text || '')).replace(/\u200f|\u200e/g, ' ');
  const result = { certificateNo: '', expiryDate: '' };

  const certificatePatterns = [
    /תעודת\s*כיול\s*(?:מס(?:פר)?|מס׳|מס')?\s*[:：]?\s*([A-Za-z0-9]{1,12}(?:[\/-][A-Za-z0-9]{1,12})*)/i,
    /(?:מספר|מס׳|מס')\s*(?:תעודה|רישיון|רשיון|אישור)\s*[:：]?\s*([A-Za-z0-9]{1,12}(?:[\/-][A-Za-z0-9]{1,12})*)/i,
    /(?:תעודה|רישיון|רשיון|אישור)\s*(?:מס(?:פר)?|מס׳|מס')\s*[:：]?\s*([A-Za-z0-9]{1,12}(?:[\/-][A-Za-z0-9]{1,12})*)/i,
    /certificate\s*(?:no\.?|number)?\s*[:：#]?\s*([A-Za-z0-9]{1,12}(?:[\/-][A-Za-z0-9]{1,12})*)/i,
    /license\s*(?:no\.?|number)?\s*[:：#]?\s*([A-Za-z0-9]{1,12}(?:[\/-][A-Za-z0-9]{1,12})*)/i,
  ];

  for (const pattern of certificatePatterns) {
    const match = combined.match(pattern);
    const candidate = cleanCertificateNo(match?.[1] || '');
    if (candidate) {
      result.certificateNo = candidate;
      break;
    }
  }

  const expiryPatterns = [
    /(?:תאריך\s*)?(?:פקיעת\s*)?(?:תוקף|פקיעה|בתוקף\s*עד|פג\s*תוקף|valid\s*until|expiry\s*date|expiration\s*date)\s*[:：]?\s*(\d{1,2}\s+[A-Za-zא-ת]+\s+20\d{2})/i,
    /(?:תאריך\s*)?(?:פקיעת\s*)?(?:תוקף|פקיעה|בתוקף\s*עד|פג\s*תוקף|valid\s*until|expiry\s*date|expiration\s*date)\s*[:：]?\s*(\d{1,2}[\/.\-]\d{1,2}[\/.\-]20\d{2})/i,
    /(?:תאריך\s*)?(?:פקיעת\s*)?(?:תוקף|פקיעה|בתוקף\s*עד|פג\s*תוקף|valid\s*until|expiry\s*date|expiration\s*date)\s*[:：]?\s*(20\d{2}[\/.\-]\d{1,2}[\/.\-]\d{1,2})/i,
  ];

  for (const pattern of expiryPatterns) {
    const match = combined.match(pattern);
    if (match?.[1]) {
      result.expiryDate = normalizeHebrewDate(match[1]);
      break;
    }
  }

  return result;
}

function mergeAndClean(parsedInput: any, modelText: string) {
  const parsed = { ...emptyData, ...(parsedInput || {}) };
  const combined = [
    parsed.rawText,
    parsed.details,
    parsed.notes,
    modelText,
  ].filter(Boolean).join('\n');
  const fallback = extractByRegex(combined);

  parsed.certificateNo = cleanCertificateNo(parsed.certificateNo) || fallback.certificateNo;
  parsed.expiryDate = normalizeHebrewDate(parsed.expiryDate) || fallback.expiryDate;
  parsed.issueDate = normalizeHebrewDate(parsed.issueDate);
  parsed.confidence = Number.isFinite(Number(parsed.confidence)) ? Math.max(0, Math.min(1, Number(parsed.confidence))) : 0;

  if (invalidCertificateCandidate(parsed.certificateNo)) parsed.certificateNo = '';
  return parsed;
}

function buildPrompt(subtype: string) {
  return `אתה מנגנון OCR כללי למסמכים שמצורפים למערכת בקרת איכות.
קרא אך ורק את הקובץ המצורף עצמו. אל תנחש ואל תשתמש בשם הקובץ כמקור עיקרי.
סוג מודול במערכת: ${subtype || 'general'}.
החזר JSON בלבד לפי הסכמה.

כללים חשובים:
1. documentType = סוג המסמך כפי שמופיע בו, למשל: תעודת כיול, רישיון מודד, תעודת בדיקה, אישור ספק, תעודת חומר.
2. certificateNo = מספר התעודה/הרישיון/האישור הראשי של המסמך. אם כתוב "תעודת כיול מס׳ 25/3785" החזר בדיוק "25/3785".
3. expiryDate = תאריך תוקף/פקיעה בלבד. אם כתוב "12 מאי 2026" החזר "2026-05-12".
4. אסור להחזיר שנה בלבד כמו 2026 בתור certificateNo.
5. אסור להחזיר מספר אישור פנימי של המערכת כגון SUB-2026-... בתור certificateNo.
6. אם יש כמה מספרים במסמך, בחר רק את המספר שמופיע ליד כותרת או תווית של מספר תעודה/רישיון/אישור. לא מספר סידורי של מכשיר, לא דגם, לא מספר טלפון.
7. אם אין ערך ברור, החזר מחרוזת ריקה.
8. rawText = העתק קצר של השורות הרלוונטיות בלבד שעליהן הסתמכת.`;
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'OPENAI_API_KEY is missing in Vercel environment variables' }, { status: 500 });
    }

    const body = (await req.json()) as RequestBody;
    const fileName = String(body.fileName ?? 'document');
    const suppliedMime = String(body.mimeType ?? '').trim();
    const dataUrl = String(body.dataUrl ?? '').trim();
    const mimeType = suppliedMime || dataUrlMimeType(dataUrl) || 'application/octet-stream';
    const subtype = String(body.subtype ?? 'general');

    if (!dataUrl) return NextResponse.json({ data: emptyData });

    const normalizedDataUrl = ensureDataUrl(dataUrl, mimeType);
    const content: any[] = [{ type: 'input_text', text: buildPrompt(subtype) }];

    if (isImage(mimeType)) {
      content.push({ type: 'input_image', image_url: normalizedDataUrl });
    } else {
      content.push({ type: 'input_file', filename: fileName, file_data: normalizedDataUrl });
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
            name: 'quality_document_ocr_extract',
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
    const parsed = mergeAndClean(safeJsonParse(outputText), outputText);

    return NextResponse.json({ data: parsed });
  } catch (error: any) {
    console.error('OCR route failed', error);
    return NextResponse.json({ error: error?.message || 'OCR route failed' }, { status: 500 });
  }
}
