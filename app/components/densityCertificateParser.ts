export type DensityCertificateResults = Record<string, string>;

const PDFJS_VERSION = "3.11.174";
const PDFJS_SCRIPT = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.min.js`;
const PDFJS_WORKER = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.js`;

type PdfWord = {
  text: string;
  x: number;
  y: number;
};

const clean = (value: unknown) =>
  String(value ?? "")
    .replace(/[\u200e\u200f\u202a-\u202e]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const cleanMultiline = (value: unknown) =>
  String(value ?? "")
    .replace(/[\u200e\u200f\u202a-\u202e]/g, "")
    .split(/\r?\n/)
    .map(clean)
    .filter(Boolean)
    .join("\n");

const cleanNumber = (value: unknown) => {
  const match = String(value ?? "")
    .replace(/,/g, ".")
    .match(/-?\d+(?:\.\d+)?/);

  return match?.[0] ?? "";
};

const waitForScript = (script: HTMLScriptElement) =>
  new Promise<void>((resolve, reject) => {
    script.addEventListener("load", () => resolve(), { once: true });
    script.addEventListener("error", () => reject(), { once: true });
  });

const loadPdfJs = async (): Promise<any | null> => {
  if (typeof window === "undefined") return null;

  const existing = (window as any).pdfjsLib;
  if (existing) return existing;

  let script = document.querySelector(
    'script[data-density-pdfjs="true"]'
  ) as HTMLScriptElement | null;

  if (!script) {
    script = document.createElement("script");
    script.src = PDFJS_SCRIPT;
    script.async = true;
    script.dataset.densityPdfjs = "true";
    document.head.appendChild(script);
  }

  await waitForScript(script);

  const pdfjs = (window as any).pdfjsLib;

  if (!pdfjs) return null;

  pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;

  return pdfjs;
};

const normalizeLine = (line: PdfWord[]) =>
  line
    .sort((a, b) => a.x - b.x)
    .map((w) => clean(w.text))
    .join(" ");

const buildStructuredText = (words: PdfWord[]) => {
  const rows: Record<string, PdfWord[]> = {};

  words.forEach((word) => {
    const y = Math.round(word.y / 4) * 4;

    if (!rows[y]) rows[y] = [];

    rows[y].push(word);
  });

  return Object.keys(rows)
    .sort((a, b) => Number(b) - Number(a))
    .map((y) => normalizeLine(rows[y]))
    .join("\n");
};

const extractPdfText = async (file: File): Promise<string> => {
  const pdfjs = await loadPdfJs();

  if (!pdfjs) return "";

  const buffer = await file.arrayBuffer();

  const pdf = await pdfjs.getDocument({
    data: buffer,
  }).promise;

  const words: PdfWord[] = [];

  for (let pageNo = 1; pageNo <= pdf.numPages; pageNo++) {
    const page = await pdf.getPage(pageNo);

    const content = await page.getTextContent();

    (content.items || []).forEach((item: any) => {
      const text = clean(item?.str);

      if (!text) return;

      const transform = item.transform || [];

      words.push({
        text,
        x: transform[4] || 0,
        y: transform[5] || 0,
      });
    });
  }

  return buildStructuredText(words);
};

const extractTextFromFile = async (file: File) => {
  try {
    return await extractPdfText(file);
  } catch {
    try {
      return await file.text();
    } catch {
      return file.name;
    }
  }
};

const pickValueNearLabel = (
  text: string,
  labels: string[],
  maxDistance = 80
) => {
  const lines = text.split("\n");

  for (const line of lines) {
    for (const label of labels) {
      if (!line.includes(label)) continue;

      const index = line.indexOf(label);

      const tail = line.slice(index + label.length, index + label.length + maxDistance);

      const number = cleanNumber(tail);

      if (number) return number;

      const head = line.slice(Math.max(0, index - maxDistance), index);
      const numberBefore = cleanNumber(head.split(/\s+/).slice(-4).join(" "));

      if (numberBefore) return numberBefore;
    }
  }

  return "";
};

const pickTextNearLabel = (
  text: string,
  labels: string[],
  maxDistance = 120
) => {
  const lines = text.split("\n");

  for (const line of lines) {
    for (const label of labels) {
      if (!line.includes(label)) continue;

      const index = line.indexOf(label);

      const tail = clean(
        line.slice(index + label.length, index + label.length + maxDistance)
      );

      const value = tail
        .replace(/^(הפריט הנבדק|מיון לפי AASHTO|מקום הבדיקה|תאריך הבדיקה|תאור החומר|תיאור החומר)\b.*$/i, "")
        .replace(/\b(הפריט הנבדק|מיון לפי AASHTO|מקום הבדיקה|תאריך הבדיקה)\b.*$/i, "")
        .trim();

      if (value && !/^(הפריט הנבדק|מקום הבדיקה|מיון לפי AASHTO)$/i.test(value)) return value;
    }
  }

  return "";
};

const calculateAverageOnlyFromDecimalValues = (text: string, label: string) => {
  const values = decimalValuesNearLabel(text, label);

  if (!values.length) return "";

  const avg =
    values.reduce((sum, n) => sum + n, 0) / values.length;

  return avg.toFixed(1).replace(/\.0$/, "");
};

const decimalValuesNearLabel = (text: string, label: string) => {
  const lines = text.split("\n");

  const targetIndex = lines.findIndex((line) => line.includes(label));

  if (targetIndex < 0) return [];

  const target = lines.slice(targetIndex, targetIndex + 3).join(" ");

  return Array.from(
    target.matchAll(/\d+(?:[.,]\d+)?/g)
  )
    .map((m) => Number(cleanNumber(m[0])))
    .filter((n) => Number.isFinite(n))
    .filter((n) => n > 0 && n < 130);
};

const extractChainage = (text: string) => {
  const match = text.match(
    /חתך\s*(\d{2,5})\s*[-–]\s*(\d{2,5})/i
  );

  if (!match) {
    return {
      from: "",
      to: "",
    };
  }

  return {
    from: match[1],
    to: match[2],
  };
};

const extractShortLocation = (text: string) => {
  const match = text.match(
    /(חתך\s*\d{2,5}\s*[-–]\s*\d{2,5}(?:\s+[^.\n\r]{0,80}?)?(?:צד\s*(?:R\+L|R|L|ימין|שמאל))?)/i
  );

  return clean(match?.[1] ?? "");
};

const extractSide = (text: string) => {
  const match = text.match(/(?:צד|נתיב)\s*[:\-]?\s*(R\+L|R|L|ימין|שמאל|ימני|שמאלי)/i);
  if (!match) return "";
  return match[1]
    .replace("ימין", "R")
    .replace("ימני", "R")
    .replace("שמאל", "L")
    .replace("שמאלי", "L");
};

const extractLayer = (text: string) => {
  const match = text.match(
    /(?:שכבה\s*(?:מס(?:פר)?['׳]?)?|מספר\s*שכבה)\s*[:\-]?\s*(\d{1,3})|(\d{1,3})\s*שכבה\s*מספר/i
  );

  return clean(match?.[1] ?? match?.[2] ?? "");
};

const extractAashto = (text: string) => {
  const match = text.match(/\b(A-\d-[A-Za-z](?:\(\d+\))?)\b/i);
  return clean(match?.[1] ?? "");
};

const certificateNumberFromFileName = (fileName: string) => {
  const match = clean(fileName).match(/(?:^|[^0-9])([0-9]{4,})(?:[^0-9]|$)/);
  return match?.[1] ?? "";
};

export const parseEarthworksDensityText = (
  fileName: string,
  rawText: string
): DensityCertificateResults => {
  const text = cleanMultiline(rawText);
  const flatText = clean(text);

  const results: DensityCertificateResults = {};

  const chainage = extractChainage(flatText);

  if (chainage.from) results["מחתך"] = chainage.from;
  if (chainage.to) results["עד חתך"] = chainage.to;

  const shortLocation = extractShortLocation(flatText);
  if (shortLocation) results["מקום נטילה"] = shortLocation;

  const side = extractSide(flatText);
  if (side) results["צד"] = side;

  const layer = extractLayer(flatText);
  if (layer) results["שכבה מס'"] = layer;

  const dateMatch = flatText.match(
    /\d{1,2}[./-]\d{1,2}[./-]\d{2,4}/
  );

  if (dateMatch) {
    results["תאריך הבדיקה"] = dateMatch[0];
  }

  const certificateNo = pickValueNearLabel(text, [
    'דו"ח בדיקה מספר',
    "דוח בדיקה מספר",
    "דוח מספר",
    "מספר תעודה",
  ]) || certificateNumberFromFileName(fileName);

  if (certificateNo) {
    results["מס׳ תעודת בדיקה צפיפות/ רטיבות שדה"] =
      certificateNo;
  }

  const lowerLimit = pickValueNearLabel(text, [
    "La =",
    "L'a =",
    "גבול תחתון",
  ]);

  if (lowerLimit) {
    results["גבול תחתון"] = lowerLimit;
    results["גבול עליון"] = "100";
  }

  const avgCompaction =
    calculateAverageOnlyFromDecimalValues(
      text,
      "אחוז דרגת צפיפות"
    );

  const compactionValues = decimalValuesNearLabel(text, "אחוז דרגת צפיפות");
  if (compactionValues.length) {
    results["כמות נקודות בדיקה"] = String(compactionValues.length);
    results["הידוק מבוקר (צפיפות מד גרעיני)"] = String(compactionValues.length);
  }

  if (avgCompaction) {
    results["ממוצע"] = avgCompaction;
    results["צפיפות מחושבת"] = avgCompaction;
  }

  const moisture =
    calculateAverageOnlyFromDecimalValues(
      text,
      "אחוז הרטיבות"
    );

  if (moisture) {
    results["רטיבות ממוצעת"] = moisture;
  }

  const material = pickTextNearLabel(text, [
    "תאור החומר",
    "תיאור החומר",
  ]);

  if (material) {
    results["תאור החומר"] = material;
  }

  const workType = pickTextNearLabel(text, [
    "הפריט הנבדק",
  ]);

  if (workType && !includesAnyText(workType, ["צפיפות באתר", "מד גרעיני", "בדיקה לפי"])) {
    results["סוג העבודה"] = workType;
  }

  const aashto = extractAashto(flatText) || pickTextNearLabel(text, [
    "מיון לפי AASHTO",
  ]);

  if (aashto) {
    results["מיון החומר"] = aashto;
  }

  if (
    results["ממוצע"] &&
    results["גבול תחתון"]
  ) {
    results["מעמד צפיפות/רטיבות"] =
      Number(results["ממוצע"]) >=
      Number(results["גבול תחתון"])
        ? "OK"
        : "לא תקין";

    results["מעמד תוצאות"] =
      results["מעמד צפיפות/רטיבות"];
  }

  results["הערות"] =
    "נקלט אוטומטית מתעודת PDF";

  return results;
};

const includesAnyText = (value: string, keywords: string[]) => {
  const text = clean(value).toLowerCase();
  return keywords.some((keyword) => text.includes(clean(keyword).toLowerCase()));
};

export const extractEarthworksDensityFromFile = async (
  file: File
): Promise<DensityCertificateResults> => {
  try {
    const text = await extractTextFromFile(file);

    return parseEarthworksDensityText(
      file.name,
      text
    );
  } catch (error) {
    console.warn(
      "Earthworks density extraction failed",
      error
    );

    return {};
  }
};
