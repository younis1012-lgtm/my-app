import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

type PreliminarySubtype = 'suppliers' | 'subcontractors' | 'materials';

type RequestBody = {
  fileName?: string;
  mimeType?: string;
  dataUrl?: string;
  subtype?: PreliminarySubtype;
};

type OcrData = {
  certificateNo: string;
  expiryDate: string;
  issueDate: string;
  supplierName: string;
  subcontractorName: string;
  materialName: string;
  suppliedMaterial: string;
  branch: string;
  contactPhone: string;
  details: string;
  confidence: number;
  notes: string;
  certificateNoCandidates: string[];
  expiryDateCandidates: string[];
  extractedText: string;
};

const emptyData: OcrData = {
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
  certificateNoCandidates: [],
  expiryDateCandidates: [],
  extractedText: '',
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
    expiryDateCandidates: { type: 'array', items: { type: 'string' } },
    extractedText: { type: 'string' },
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

function uniqueStrings(values: unknown[]) {
  const seen = new Set<string>();
  const result: string[] = [];
  values.forEach((value) => {
    const text = String(value ?? '').trim();
    if (!text || seen.has(text)) return;
    seen.add(text);
    result.push(text);
  });
  return result;
}

function normalizeDigits(value: unknown) {
  return String(value ?? '')
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[０-９]/g, (d) => String('０１２３４５６７８۹'.indexOf(d)))
    .trim();
}

function normalizeDate(value: unknown) {
  const raw = normalizeDigits(value).trim();
  if (!raw) return '';

  const iso = raw.match(/\b(20\d{2}|19\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;

  const dmy = raw.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](20\d{2}|19\d{2})\b/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;

  const year = raw.match(/\b(20\d{2}|19\d{2})\b/);
  return year?.[1] ?? raw;
}

function isLikelyYearOnly(value: unknown) {
  return /^(19|20)\d{2}$/.test(normalizeDigits(value));
}

function cleanCertificateNo(value: unknown) {
  const raw = normalizeDigits(value)
    .replace(/מספר|מס׳|מס'|רישיון|רשיון|תעודה|אישור|license|licence|certificate|no\.?|number/gi, ' ')
    .replace(/[^0-9A-Za-z\-/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const numbers = raw.match(/\b\d{1,8}\b/g) ?? [];
  const candidate = numbers.find((num) => !isLikelyYearOnly(num)) ?? '';
  return candidate;
}

function extractCertificateCandidatesFromText(text: unknown) {
  const source = normalizeDigits(text);
  const patterns = [
    /(?:מספר\s*)?(?:רישיון|רשיון)\s*(?:מס[׳']?|מספר|no\.?|number)?\s*[:#\-]?\s*(\d{1,8})/gi,
    /(?:מספר\s*)?(?:תעודה|אישור)\s*(?:מס[׳']?|מספר|no\.?|number)?\s*[:#\-]?\s*(\d{1,8})/gi,
    /(?:license|licence|certificate|approval)\s*(?:no\.?|number)?\s*[:#\-]?\s*(\d{1,8})/gi,
  ];

  const found: string[] = [];
  patterns.forEach((pattern) => {
    for (const match of source.matchAll(pattern)) {
      const candidate = cleanCertificateNo(match[1]);
      if (candidate && !isLikelyYearOnly(candidate)) found.push(candidate);
    }
  });
  return uniqueStrings(found);
}

function extractExpiryCandidatesFromText(text: unknown) {
  const source = normalizeDigits(text);
  const patterns = [
    /(?:תוקף|בתוקף|valid\s*until|expiry|expiration)\s*[:#\-]?\s*(\d{1,2}[./-]\d{1,2}[./-](?:19|20)\d{2})/gi,
    /(?:תוקף|בתוקף|valid\s*until|expiry|expiration)\s*[:#\-]?\s*((?:19|20)\d{2}[./-]\d{1,2}[./-]\d{1,2})/gi,
    /(?:תוקף|בתוקף|valid\s*until|expiry|expiration)\s*[:#\-]?\s*((?:19|20)\d{2})/gi,
  ];
  const found: string[] = [];
  patterns.forEach((pattern) => {
    for (const match of source.matchAll(pattern)) {
      const candidate = normalizeDate(match[1]);
      if (candidate) found.push(candidate);
    }
  });
  return uniqueStrings(found);
}

function postProcessOcrData(raw: Partial<OcrData>, fileName: string): OcrData {
  const merged: OcrData = {
    ...emptyData,
    ...raw,
    certificateNoCandidates: Array.isArray(raw.certificateNoCandidates) ? raw.certificateNoCandidates.map(String) : [],
    expiryDateCandidates: Array.isArray(raw.expiryDateCandidates) ? raw.expiryDateCandidates.map(String) : [],
    confidence: Number.isFinite(Number(raw.confidence)) ? Number(raw.confidence) : 0,
  };

  const searchableText = [
    merged.extractedText,
    merged.notes,
    merged.details,
  ].filter(Boolean).join('\n');

  const textCertificateCandidates = extractCertificateCandidatesFromText(searchableText);
  const parsedCertificateCandidates = uniqueStrings([
    ...textCertificateCandidates,
    ...merged.certificateNoCandidates.map(cleanCertificateNo),
    cleanCertificateNo(merged.certificateNo),
  ]).filter((candidate) => candidate && !isLikelyYearOnly(candidate));

  // Prefer numbers that were next to רישיון/רשיון/תעודה/אישור in extracted text.
  merged.certificateNo = parsedCertificateCandidates[0] ?? '';

  const textExpiryCandidates = extractExpiryCandidatesFromText(searchableText);
  const parsedExpiryCandidates = uniqueStrings([
    ...textExpiryCandidates,
    ...merged.expiryDateCandidates.map(normalizeDate),
    normalizeDate(merged.expiryDate),
  ]).filter(Boolean);

  merged.expiryDate = parsedExpiryCandidates[0] ?? '';
  merged.issueDate = normalizeDate(merged.issueDate);

  // Final guard: never allow a plain year as certificate/license number.
  if (isLikelyYearOnly(merged.certificateNo)) merged.certificateNo = '';

  // If OCR still did not find a certificate number, only use filename when it has a clear non-year number.
  if (!merged.certificateNo) {
    const fileNums = uniqueStrings((normalizeDigits(fileName).match(/\b\d{2,8}\b/g) ?? [])).filter((n) => !isLikelyYearOnly(n));
    merged.certificateNo = fileNums[0] ?? '';
  }

  merged.certificateNoCandidates = parsedCertificateCandidates;
  merged.expiryDateCandidates = parsedExpiryCandidates;
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
קרא את הקובץ המצורף והחזר JSON בלבד לפי הסכמה.
סוג הטופס במערכת: ${subtype}.
חלץ רק מידע שקיים במסמך. אל תנחש.

כללים חשובים:
1. certificateNo הוא מספר תעודה / מספר רישיון / מספר אישור בלבד.
2. אם מופיע במסמך "מספר רישיון 947" אז certificateNo חייב להיות "947".
3. לעולם אל תחזיר שנת תוקף כמו 2025 או 2026 בתור certificateNo.
4. expiryDate הוא תוקף בלבד. אם מופיעה רק שנה, החזר שנה כמחרוזת, לדוגמה "2026".
5. certificateNoCandidates: החזר את כל המספרים האפשריים שמופיעים ליד "מספר רישיון", "רישיון מס׳", "מספר תעודה", "מספר אישור", "License No", "Certificate No". אל תכניס שנים לרשימה זו.
6. expiryDateCandidates: החזר את כל התאריכים/שנים שמופיעים ליד "תוקף", "בתוקף", "Valid until", "Expiry".
7. extractedText: החזר טקסט OCR קצר ורלוונטי סביב השדות שמצאת, לא את כל המסמך אם הוא ארוך.
8. תאריכים מלאים החזר בפורמט YYYY-MM-DD בלבד. אם אין ערך ברור החזר מחרוזת ריקה.
9. confidence בין 0 ל-1 לפי רמת הביטחון.`;

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
    const data = postProcessOcrData(parsed, fileName);
    return NextResponse.json({ data });
  } catch (error: any) {
    console.error('OCR route failed', error);
    return NextResponse.json({ error: error?.message || 'OCR route failed' }, { status: 500 });
  }
}
