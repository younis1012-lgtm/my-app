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
  certificateNoCandidates: [] as string[],
  rawRelevantText: '',
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
    certificateNoCandidates: { type: 'array', items: { type: 'string' } },
    rawRelevantText: { type: 'string' },
  },
  required: Object.keys(emptyData),
};

function safeJsonParse(text: string) {
  try { return JSON.parse(text); } catch {}
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch { return null; }
}

function isImage(mimeType: string) {
  return mimeType.startsWith('image/');
}

const isYearOnly = (value: unknown) => /^(19|20)\d{2}$/.test(String(value ?? '').trim());
const isDateLikeNumber = (value: string) => /^20\d{6}$/.test(value) || /^\d{8}$/.test(value);

function cleanCertificateNo(value: unknown) {
  const raw = String(value ?? '').trim();
  if (!raw || isYearOnly(raw)) return '';
  const numbers = Array.from(raw.matchAll(/\d{2,8}/g))
    .map((m) => m[0])
    .filter((n) => !isYearOnly(n) && !isDateLikeNumber(n));
  return numbers[0] ?? '';
}

function normalizeDate(value: unknown) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  if (/^(19|20)\d{2}$/.test(raw)) return `${raw}-12-31`;
  const dm = raw.match(/(\d{1,2})[./-](\d{1,2})[./-]((?:19|20)?\d{2})/);
  if (dm) {
    const year = dm[3].length === 2 ? `20${dm[3]}` : dm[3];
    return `${year}-${dm[2].padStart(2, '0')}-${dm[1].padStart(2, '0')}`;
  }
  const ym = raw.match(/((?:19|20)\d{2})[./-](\d{1,2})[./-](\d{1,2})/);
  if (ym) return `${ym[1]}-${ym[2].padStart(2, '0')}-${ym[3].padStart(2, '0')}`;
  const year = raw.match(/(?:תוקף|בתוקף|עד|valid|expiry|expires)[^\d]{0,20}((?:19|20)\d{2})/i);
  if (year) return `${year[1]}-12-31`;
  return '';
}

function extractCertificateCandidatesFromText(text: string) {
  const normalized = String(text ?? '')
    .replace(/[׳’`]/g, "'")
    .replace(/[״“”]/g, '"')
    .replace(/\s+/g, ' ');
  const patterns = [
    /(?:מספר\s*)?(?:ריש[ייו]ון|רשיון)\s*(?:מס['"׳״]?|מספר|No\.?|#|:)?\s*[:#\-]?\s*(\d{2,8})/gi,
    /(?:ריש[ייו]ון|רשיון)\s*(?:מס['"׳״]?|מספר|No\.?|#|:)?\s*[:#\-]?\s*(\d{2,8})/gi,
    /(?:מס['"׳״]?|מספר)\s*(?:ריש[ייו]ון|רשיון|תעודה|אישור)\s*[:#\-]?\s*(\d{2,8})/gi,
    /(?:תעודה|אישור)\s*(?:מס['"׳״]?|מספר|No\.?|#|:)?\s*[:#\-]?\s*(\d{2,8})/gi,
    /(?:License|Licence|Certificate|Approval)\s*(?:No\.?|Number|#|:)?\s*[:#\-]?\s*(\d{2,8})/gi,
    /(?:ר\.\s*מ\.|רמ)\s*[:#\-]?\s*(\d{2,8})/gi,
  ];
  const found: string[] = [];
  for (const pattern of patterns) {
    for (const match of normalized.matchAll(pattern)) {
      const cleaned = cleanCertificateNo(match[1]);
      if (cleaned && !found.includes(cleaned)) found.push(cleaned);
    }
  }
  return found;
}

function extractExpiryFromText(text: string) {
  const normalized = String(text ?? '').replace(/\s+/g, ' ');
  const patterns = [
    /(?:תוקף|בתוקף|תוקף\s*עד|עד\s*תאריך|פג\s*תוקף|valid\s*until|expiry|expires)[^\d]{0,30}(\d{1,2}[./-]\d{1,2}[./-](?:19|20)?\d{2})/i,
    /(?:תוקף|בתוקף|תוקף\s*עד|עד\s*תאריך|valid\s*until|expiry|expires)[^\d]{0,30}((?:19|20)\d{2})/i,
  ];
  for (const pattern of patterns) {
    const m = normalized.match(pattern);
    if (m) {
      const d = normalizeDate(m[1]);
      if (d) return d;
    }
  }
  return '';
}

function postProcess(raw: any, fileName: string, outputText: string) {
  const merged: any = { ...emptyData, ...(raw && typeof raw === 'object' ? raw : {}) };
  const allText = [
    outputText,
    merged.rawRelevantText,
    merged.notes,
    merged.details,
    merged.certificateNo,
    ...(Array.isArray(merged.certificateNoCandidates) ? merged.certificateNoCandidates : []),
  ].join('\n');

  const candidateSources = [
    ...(Array.isArray(merged.certificateNoCandidates) ? merged.certificateNoCandidates : []),
    ...extractCertificateCandidatesFromText(allText),
    merged.certificateNo,
  ];

  const candidates = candidateSources
    .map(cleanCertificateNo)
    .filter(Boolean)
    .filter((value, index, arr) => arr.indexOf(value) === index);

  merged.certificateNo = candidates[0] ?? '';
  merged.certificateNoCandidates = candidates;
  merged.expiryDate = normalizeDate(merged.expiryDate) || extractExpiryFromText(allText) || normalizeDate(fileName);
  merged.issueDate = normalizeDate(merged.issueDate);

  // Do not use filename numbers for certificateNo unless they are not years/dates and OCR found nothing.
  if (!merged.certificateNo) {
    const fromName = Array.from(String(fileName ?? '').matchAll(/\d{2,8}/g))
      .map((m) => cleanCertificateNo(m[0]))
      .filter(Boolean);
    merged.certificateNo = fromName[0] ?? '';
  }

  if (isYearOnly(merged.certificateNo)) merged.certificateNo = '';
  return merged;
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

    const prompt = `אתה מנגנון OCR מקצועי למערכת בקרת איכות בפרויקטי תשתיות בישראל.
קרא את הקובץ המצורף ונתח אותו ויזואלית, כולל PDF סרוק, תמונה, טופס בעברית או באנגלית.
החזר JSON בלבד לפי הסכמה.
סוג הטופס במערכת: ${subtype}.

חובה לזהות מתוך המסמך עצמו, לא רק משם הקובץ:
- מספר תעודה / מספר רישיון / מספר אישור
- תאריך תוקף / בתוקף עד / valid until / expiry
- שם ספק / קבלן משנה / חומר, אם קיימים

כללים קריטיים:
1. certificateNo הוא מספר תעודה / מספר רישיון / מספר אישור בלבד.
2. אם מופיע במסמך "מספר רישיון 947", "רשיון מס' 947", או "רישיון מודד מס' 947" אז certificateNo חייב להיות "947".
3. לעולם אל תחזיר שנת תוקף כמו 2025 או 2026 בתור certificateNo.
4. expiryDate הוא תוקף בלבד. אם יש רק שנה, החזר סוף שנה בפורמט YYYY-12-31.
5. certificateNoCandidates: החזר את כל המספרים האפשריים שמופיעים ליד: מספר רישיון, רשיון, רישיון מס', מספר תעודה, מספר אישור, License No, Certificate No.
6. rawRelevantText: העתק את השורות הרלוונטיות שבהן מופיעים מספר רישיון/תעודה/אישור ותוקף.
7. אם אין ערך ברור, החזר מחרוזת ריקה. אל תנחש.`;

    const content: any[] = [{ type: 'input_text', text: prompt }];
    if (isImage(mimeType)) {
      content.push({ type: 'input_image', image_url: dataUrl });
    } else {
      content.push({ type: 'input_file', filename: fileName, file_data: dataUrl });
    }

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.OPENAI_OCR_MODEL || 'gpt-4.1',
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
    const parsed = safeJsonParse(outputText) ?? emptyData;
    return NextResponse.json({ data: postProcess(parsed, fileName, outputText) });
  } catch (error: any) {
    console.error('OCR route failed', error);
    return NextResponse.json({ error: error?.message || 'OCR route failed' }, { status: 500 });
  }
}
