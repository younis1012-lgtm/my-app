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

      if (tail) return tail;
    }
  }

  return "";
};

const calculateAverageOnlyFromDecimalValues = (text: string, label: string) => {
  const lines = text.split("\n");

  const target = lines.find((line) => line.includes(label));

  if (!target) return "";

  const values = Array.from(
    target.matchAll(/\d+(?:[.,]\d+)?/g)
  )
    .map((m) => Number(cleanNumber(m[0])))
    .filter((n) => Number.isFinite(n))
    .filter((n) => n > 0 && n < 100);

  if (!values.length) return "";

  const avg =
    values.reduce((sum, n) => sum + n, 0) / values.length;

  return avg.toFixed(1).replace(/\.0$/, "");
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

export const parseEarthworksDensityText = (
  fileName: string,
  rawText: string
): DensityCertificateResults => {
  const text = clean(rawText);

  const results: DensityCertificateResults = {};

  const chainage = extractChainage(text);

  if (chainage.from) results["מחתך"] = chainage.from;
  if (chainage.to) results["עד חתך"] = chainage.to;

  const dateMatch = text.match(
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
  ]);

  if (certificateNo) {
    results["מס׳ תעודת בדיקה צפיפות/ רטיבות שדה"] =
      certificateNo;
  }

  const density = pickValueNearLabel(text, [
    "צפיפות מחושבת",
    "צפיפות מעבדתית מקסימלית",
  ]);

  if (density) {
    results["צפיפות מחושבת"] = density;
  }

  const lowerLimit = pickValueNearLabel(text, [
    "La =",
    "L'a =",
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

  if (avgCompaction) {
    results["ממוצע"] = avgCompaction;
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

  if (workType) {
    results["סוג העבודה"] = workType;
  }

  const aashto = pickTextNearLabel(text, [
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