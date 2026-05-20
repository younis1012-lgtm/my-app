export type DensityCertificateResults = Record<string, string>;

const PDFJS_VERSION = "3.11.174";
const PDFJS_SCRIPT = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.min.js`;
const PDFJS_WORKER = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.js`;

const clean = (value: unknown) =>
  String(value ?? "")
    .replace(/[\u200e\u200f\u202a-\u202e]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const cleanNumber = (value: unknown) => {
  const match = String(value ?? "").replace(/,/g, ".").match(/-?\d+(?:\.\d+)?/);
  return match?.[0] ?? "";
};

const first = (...values: unknown[]) => {
  for (const value of values) {
    const text = clean(value);
    if (text) return text;
  }
  return "";
};

const hasDensityKeywords = (text: string) =>
  /צפיפות|רטיבות|מד גרעיני|דרגת צפיפות|La\s*=|צפיפות מחושבת|מילוי|חפירה|הידוק|מעברי מכבש|מכבש|AASHTO|מספר תעודת מעבדה|דו["״']?ח בדיקה מספר/i.test(text);

const waitForScript = (script: HTMLScriptElement) =>
  new Promise<void>((resolve, reject) => {
    const done = () => resolve();
    const fail = () => reject(new Error("טעינת קורא PDF נכשלה"));
    script.addEventListener("load", done, { once: true });
    script.addEventListener("error", fail, { once: true });
    window.setTimeout(() => reject(new Error("זמן טעינת קורא PDF הסתיים")), 12000);
  });

const loadPdfJs = async (): Promise<any | null> => {
  if (typeof window === "undefined" || typeof document === "undefined") return null;
  const existing = (window as any).pdfjsLib;
  if (existing) return existing;

  let script = document.querySelector('script[data-density-pdfjs="true"]') as HTMLScriptElement | null;
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

const extractPdfText = async (file: File): Promise<string> => {
  const pdfjs = await loadPdfJs();
  if (!pdfjs) return "";
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buffer }).promise;
  const pages: string[] = [];
  for (let pageNo = 1; pageNo <= pdf.numPages; pageNo += 1) {
    const page = await pdf.getPage(pageNo);
    const content = await page.getTextContent();
    pages.push((content.items || []).map((item: any) => String(item?.str ?? "")).join("\n"));
  }
  return pages.join("\n");
};

const extractTextFromFile = async (file: File): Promise<string> => {
  const lowerName = file.name.toLowerCase();
  const isPdf = lowerName.endsWith(".pdf") || file.type.includes("pdf");

  if (isPdf) {
    try {
      const text = await extractPdfText(file);
      if (hasDensityKeywords(text)) return text;
    } catch (error) {
      console.warn("PDF.js extraction failed", error);
    }
  }

  try {
    const text = await file.text();
    if (hasDensityKeywords(text)) return text;
  } catch {
    // ignore
  }

  return file.name;
};

const pickRegex = (text: string, patterns: RegExp[], numeric = true) => {
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    const value = numeric ? cleanNumber(match?.[1] ?? "") : clean(match?.[1] ?? "");
    if (value) return value;
  }
  return "";
};

const averageFromLabelRow = (text: string, label: string) => {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`${escaped}\\s+((?:\\d+(?:[.,]\\d+)?\\s+){3,12})`, "i").exec(text);
  const values = Array.from(String(match?.[1] ?? "").matchAll(/\d+(?:[.,]\d+)?/g))
    .map((item) => Number(cleanNumber(item[0])))
    .filter((item) => Number.isFinite(item));
  if (!values.length) return "";
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  return average.toFixed(1).replace(/\.0$/, "");
};

const firstTextAfter = (text: string, label: string, stopLabels: string[] = []) => {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`${escaped}\\s*[:：]?\\s*([^\\n\\r]{2,120})`, "i").exec(text);
  let value = clean(match?.[1] ?? "");
  stopLabels.forEach((stop) => {
    const index = value.indexOf(stop);
    if (index >= 0) value = value.slice(0, index).trim();
  });
  return value.replace(/[;,:：]+$/g, "");
};

const normalizeDate = (value: string) => {
  const match = clean(value).match(/\d{1,2}[./-]\d{1,2}[./-]\d{2,4}/);
  if (!match) return "";
  return match[0].replace(/\./g, "/").replace(/-/g, "/");
};


const pickText = (text: string, patterns: RegExp[]) => {
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    const value = clean(match?.[1] ?? "");
    if (value) return value;
  }
  return "";
};

const pickFirstNumber = (text: string, patterns: RegExp[]) => {
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    const value = cleanNumber(match?.[1] ?? "");
    if (value) return value;
  }
  return "";
};

const normalizeSide = (value: unknown) => {
  const text = clean(value).replace(/\s+/g, "").toUpperCase();
  const match = text.match(/(?:צד)?([LR](?:\+[LR])?|ימין|שמאל|שני)/i);
  if (!match) return "";
  const side = match[1].toUpperCase();
  if (side === "ימין") return "R";
  if (side === "שמאל") return "L";
  if (side === "שני") return "L+R";
  return side;
};

const extractChainage = (text: string) => {
  const normalized = clean(text);
  const match = normalized.match(/חתך\s*(\d{2,5})\s*[-–]\s*(\d{2,5})([^\n\r]{0,120})/i);
  if (!match) return { from: "", to: "", side: "", location: "" };
  const a = Number(match[1]);
  const b = Number(match[2]);
  const tail = clean(match[3] ?? "");
  const side = normalizeSide(tail);
  return {
    from: String(Math.min(a, b)),
    to: String(Math.max(a, b)),
    side,
    location: clean(match[0]),
  };
};

const extractItemAfterColonBlock = (text: string, label: string) => {
  const lines = text.split(/\n|\r/).map(clean).filter(Boolean);
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].includes(label)) {
      for (let j = i + 1; j < Math.min(lines.length, i + 8); j += 1) {
        const line = lines[j];
        if (!line || line.includes(":")) continue;
        if (/^(שם|מספר|תאריך|עמוד|דו)/.test(line)) continue;
        return line;
      }
    }
  }
  return "";
};

export const parseEarthworksDensityText = (fileName: string, rawText: string): DensityCertificateResults => {
  const text = clean(`${fileName}\n${rawText}`);
  if (!hasDensityKeywords(text)) return {};

  const fileNumber = (fileName.match(/\d{4,}/g) ?? []).find((value) => value.length >= 5) ?? "";
  const chainage = extractChainage(text);
  const date = normalizeDate(
    first(
      pickRegex(text, [/תאריך הבדיקה[^0-9]{0,80}(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})/i], false),
      pickRegex(text, [/תאריך הדגימה[^0-9]{0,80}(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})/i], false),
      (text.match(/\d{1,2}[./-]\d{1,2}[./-]\d{2,4}/) ?? [""])[0],
    ),
  );

  const certificateNo = first(
    pickRegex(text, [/דו["״']?ח בדיקה מספר\s*(\d{4,})/i, /דוח מספר[:\s]*(\d{4,})/i, /דוח\s+מספר[:\s]*(\d{4,})/i]),
    fileNumber,
  );
  const isRollerPassCertificate = /מעברי\s*מכבש|מס['׳]?\s*מעברים/i.test(text);
  const isDensityCertificate = /צפיפות|רטיבות|מד\s*גרעיני|דרגת\s*צפיפות/i.test(text) && !isRollerPassCertificate;

  const compaction = first(
    pickRegex(text, [/x\s*=\s*(\d+(?:[.,]\d+)?)/i]),
    averageFromLabelRow(text, "אחוז דרגת צפיפות"),
  );
  const lowerLimit = first(pickRegex(text, [/La\s*=\s*(\d+(?:[.,]\d+)?)/i, /L'a\s*=\s*(\d+(?:[.,]\d+)?)/i]), "");
  const upperLimit = lowerLimit || compaction ? "100" : "";
  const calculatedDensity = first(
    pickRegex(text, [/צפיפות מעבדתית מקסימלית[:\s.)]+(\d{3,5})/i, /צפיפות מחושבת[^0-9]{0,80}(\d{3,5})/i]),
    (text.match(/צפיפות מחושבת[^\n\r]*?(\d{3,5})/) ?? ["", ""])[1],
  );
  const moisture = first(
    averageFromLabelRow(text, "אחוז הרטיבות בבדיקה"),
    pickRegex(text, [/רטיבות אופטימלית[:\s.)]+(\d+(?:[.,]\d+)?)/i]),
  );
  const pointRows = Array.from(text.matchAll(/בדיקה מספר\s+((?:\d{1,2}\s+){1,24}\d{1,2})/g));
  const pointNumbers = pointRows
    .flatMap((row) => Array.from(String(row[1]).matchAll(/\d{1,2}/g)).map((item) => Number(item[0])))
    .filter((item) => Number.isFinite(item));
  const points = first(
    pointNumbers.length ? String(Math.max(...pointNumbers)) : "",
    pickRegex(text, [
      /(?:כמות|מספר)\s*נקודות\s*בדיקה\s*[:\-]?\s*(\d{1,3})/i,
      /(\d{1,3})\s*נקודות\s*בדיקה/i,
    ]),
    text.includes("12 11 10 9 8 7") && text.includes("6 5 4 3 2 1") ? "12" : "",
  );
  const rollerPasses = first(
    pickRegex(text, [/מס['׳]?\s*מעברים\s*בוצעו\s*(\d+)/i, /(\d+)\s*מעברי\s*מכבש/i]),
  );
  const status = /הבדיקה עוברת|מסקנה:\s*מתאים|מתאים/i.test(text)
    ? "OK"
    : compaction && lowerLimit && Number(compaction) >= Number(lowerLimit)
      ? "OK"
      : "";

  const workType = first(
    pickText(text, [/:\s*(מילוי נברר|קרקע יסוד|שתית|חפירה|מילוי רגיל|מילוי מבוקר|הידוק רגיל|הידוק מבוקר)/i]),
    firstTextAfter(text, "הפריט הנבדק", ["שם האתר", "תאור החומר", "צפיפות באתר", "מעברי מכבש"]),
    extractItemAfterColonBlock(rawText, "הפריט הנבדק"),
  );
  const material = first(
    firstTextAfter(text, "תאור החומר", ["הפריט הנבדק", "צפיפות באתר", "שם המזמין"]),
    extractItemAfterColonBlock(rawText, "תאור החומר"),
  );
  const aashto = first(
    pickText(text, [/מיון לפי AASHTO\s*([A-Za-z0-9\-\(\)]+)/i, /\b(A-\d-[A-Za-z](?:\(\d+\))?)\b/i]),
  );
  const referenceCertificate = pickRegex(text, [/מדו["״']?ח מספר[:\s.]+(\d{4,})/i, /מספר תעודת מעבדה[:\s.]+(\d{4,})/i]);
  const layer = first(
    pickRegex(text, [
      /שכבה\s*(?:מס(?:פר)?['׳]?)?\s*[:\-]?\s*([0-9]{1,3})/i,
      /(שתית|קרקע\s*יסוד)(?=\s*(?:שכבה|חתך|מקום|$))/i,
    ], false),
    pickRegex(text, [/שכבה מספר\/סוג שכבה[^0-9]{0,50}(\d+)/i]),
    pickRegex(text, /(?:^|\s)(\d+)\s+שכבה מספר\/סוג שכבה/i.exec(text)?.[0] ? [/(?:^|\s)(\d+)\s+שכבה מספר\/סוג שכבה/i] : []),
    /\n\s*1\s*\n\s*שכבה מספר\/סוג שכבה/i.test(rawText) ? "1" : "",
  );

  const results: DensityCertificateResults = {};
  if (date) results["תאריך הבדיקה"] = date;
  if (chainage.from) results["מחתך"] = chainage.from;
  if (chainage.to) results["עד חתך"] = chainage.to;
  if (chainage.side) results["צד"] = chainage.side;
  if (chainage.location) results["מקום נטילה"] = chainage.location;
  if (layer) results["שכבה מס׳"] = layer;
  if (workType) results["סוג העבודה"] = workType;
  if (material) results["תאור החומר"] = material;
  if (aashto) results["מיון החומר"] = aashto;
  if (referenceCertificate) results["מספר תעודת בדיקה אפיון - 100%"] = referenceCertificate;

  if (isRollerPassCertificate) {
    if (certificateNo) results["מס' תעודת בדיקההידוק רגיל"] = certificateNo;
    if (rollerPasses) results["מעברי מכבש"] = rollerPasses;
    if (status || rollerPasses) results["מעמד הידוק רגיל"] = first(status, "OK");
    results["מעמד תוצאות"] = first(status, "OK");
  } else if (isDensityCertificate) {
    if (certificateNo) results["מס׳ תעודת בדיקה צפיפות/ רטיבות שדה"] = certificateNo;
    if (points) results["הידוק מבוקר (צפיפות מד גרעיני)"] = points;
    if (status) {
      results["מעמד צפיפות/רטיבות"] = status;
      results["מעמד תוצאות"] = status;
    }
    if (calculatedDensity) results["צפיפות מחושבת"] = calculatedDensity;
    if (lowerLimit) results["גבול תחתון"] = lowerLimit;
    if (upperLimit) results["גבול עליון"] = upperLimit;
    if (compaction) results["ממוצע"] = compaction;
    if (moisture) results["רטיבות ממוצעת"] = moisture;
  } else if (certificateNo) {
    results["מספר תעודת בדיקה"] = certificateNo;
  }

  results["הערות"] = first(results["הערות"], "נקלט אוטומטית מתעודת PDF");

  return Object.keys(results).length >= 3 ? results : {};
};

export const extractEarthworksDensityFromFile = async (file: File): Promise<DensityCertificateResults> => {
  try {
    const text = await extractTextFromFile(file);
    return parseEarthworksDensityText(file.name, text);
  } catch (error) {
    console.warn("Earthworks density extraction failed", error);
    return {};
  }
};
