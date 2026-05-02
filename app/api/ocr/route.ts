import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

type RequestBody = {
  fileName?: string;
  mimeType?: string;
  dataUrl?: string;
  subtype?: 'suppliers' | 'subcontractors' | 'materials';
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
  },
  required: Object.keys(emptyData),
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

    const prompt = `אתה OCR מקצועי למסמכי בקרת איכות בפרויקטי תשתיות בישראל.
קרא את הקובץ המצורף חזותית והחזר JSON בלבד.
סוג טופס: ${subtype}.
חובה לחלץ מהמסמך עצמו, לא משם הקובץ, אלא אם אין מידע במסמך.
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

    return NextResponse.json({ data: parsed });
  } catch (error: any) {
    console.error('OCR route failed', error);
    return NextResponse.json({ error: error?.message || 'OCR route failed' }, { status: 500 });
  }
}
