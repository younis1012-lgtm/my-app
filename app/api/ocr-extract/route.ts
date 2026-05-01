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
קרא את הקובץ המצורף והחזר JSON בלבד לפי הסכמה.
סוג הטופס במערכת: ${subtype}.
חלץ רק מידע שקיים במסמך. אל תנחש.
שדות חשובים: מספר תעודה/מספר רישיון/מספר אישור, תוקף, תאריך הפקה, שם ספק, שם קבלן משנה, חומר מסופק, שם חומר, סניף, אנשי קשר וטלפון, פרטים כלליים.
כלל קריטי: certificateNo הוא מספר התעודה/הרישיון/האישור שמופיע ליד ניסוחים כמו "מספר רישיון", "רישיון מס׳", "מספר תעודה", "מס׳ אישור". אל תחזיר שנת תוקף כמו 2025 או 2026 בתור certificateNo.
אם במסמך מופיע למשל "מספר רישיון 947" אז certificateNo חייב להיות "947" גם אם שם הקובץ כולל 2026.
expiryDate הוא תאריך/שנת תוקף בלבד. אם מופיעה רק שנה, החזר את השנה כמחרוזת, לדוגמה "2026".
תאריכים מלאים החזר בפורמט YYYY-MM-DD בלבד. אם אין ערך ברור החזר מחרוזת ריקה.
confidence בין 0 ל-1 לפי רמת הביטחון.`;

    const content: any[] = [{ type: 'input_text', text: prompt }];
    if (isImage(mimeType)) {
      content.push({ type: 'input_image', image_url: dataUrl });
    } else {
      content.push({ type: 'input_file', filename: fileName, file_data: getBase64(dataUrl) });
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
    const parsed = safeJsonParse(outputText) ?? emptyData;
    return NextResponse.json({ data: { ...emptyData, ...parsed } });
  } catch (error: any) {
    console.error('OCR route failed', error);
    return NextResponse.json({ error: error?.message || 'OCR route failed' }, { status: 500 });
  }
}
