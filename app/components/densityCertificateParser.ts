export type DensityCertificateResults = Record<string, any>;

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

const soilSurveyCertificateNumber = (fileName: string, text: string) => {
  const fileNumbers = Array.from(clean(fileName).matchAll(/\d{4,}/g)).map((match) => match[0]);
  const dohReport = clean(fileName).match(/^DOH[_-]\d+[_-](\d{4,})/i)?.[1];
  if (dohReport) return dohReport;

  const lines = text.split("\n").map(clean).filter(Boolean);
  for (const line of lines) {
    if (!/(?:דו"ח|ח"וד|דוח|חוד)/.test(line)) continue;
    const numbers = Array.from(line.matchAll(/\b\d{4,}\b/g)).map((match) => match[0]);
    if (numbers.length) return numbers[0];
  }

  return fileNumbers[fileNumbers.length - 1] ?? certificateNumberFromFileName(fileName);
};

const firstDateInText = (text: string) =>
  clean(text.match(/\b\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\b/)?.[0] ?? "");

const extractControlledDensityRows = (
  text: string,
  defaults: {
    certificateNo?: string;
    testDate?: string;
    layer?: string;
    location?: string;
    lowerLimit?: string;
    upperLimit?: string;
    material?: string;
    aashto?: string;
  } = {}
) => {
  const rows: Array<Record<string, string>> = [];
  const seen = new Set<string>();

  text
    .split("\n")
    .map(clean)
    .filter(Boolean)
    .forEach((line) => {
      const values = Array.from(line.matchAll(/-?\d+(?:[.,]\d+)?/g)).map((match) =>
        match[0].replace(",", ".")
      );
      if (values.length < 6) return;

      const pushRow = (
        sampleNo: number,
        layer: number,
        wetDensity: number,
        maxDensity: number,
        oversize: number,
        moisture: number,
        compaction: number
      ) => {
        const location =
          line.match(/(?:מתחת|ממחת)\s+ליסוד/)?.[0] ||
          line.match(/קיר(?:\s+\S+)?/)?.[0] ||
          defaults.location ||
          "";
        const key = `${sampleNo}|${wetDensity}|${maxDensity}|${moisture}|${compaction}`;
        if (seen.has(key)) return;
        seen.add(key);

        const status =
          defaults.lowerLimit && Number.isFinite(Number(defaults.lowerLimit))
            ? compaction >= Number(defaults.lowerLimit)
              ? "OK"
              : "לא תקין"
            : "OK";

        rows.push({
          "מספר בדיקה": String(sampleNo),
          "מספר תעודת בדיקה": defaults.certificateNo ?? "",
          "מס' תעודת בדיקה צפיפות/ רטיבות שדה": defaults.certificateNo ?? "",
          "מס׳ תעודת בדיקה צפיפות/ רטיבות שדה": defaults.certificateNo ?? "",
          "תאריך הבדיקה": defaults.testDate ?? "",
          "מקום נטילה": location,
          "מקום הבדיקה": location,
          "שכבה מס'": String(layer),
          "שכבה מס׳": String(layer),
          "צפיפות רטובה": String(wetDensity),
          "צפיפות רטובה מבוקרת": String(wetDensity),
          "צפיפות מקס מעבדתית": String(maxDensity),
          "צפיפות מעבדתית מקסימלית": String(maxDensity),
          "+3/4": String(oversize),
          "רטיבות": String(moisture),
          "רטיבות ממוצעת": String(moisture),
          "דרגת הידוק": String(compaction),
          "צפיפות מחושבת": String(compaction),
          "תוצאות בדיקה": String(compaction),
          "ממוצע": String(compaction),
          "גבול תחתון": defaults.lowerLimit ?? "",
          "גבול עליון": defaults.upperLimit ?? "",
          "הידוק מבוקר (צפיפות מד גרעיני)": "1",
          "מעמד צפיפות/רטיבות": status,
          "מעמד תוצאות": status,
          "תאור החומר": defaults.material ?? "",
          "תיאור החומר": defaults.material ?? "",
          "מיון החומר": defaults.aashto ?? "",
          "מיון AASHTO": defaults.aashto ?? "",
        });
      };

      for (let i = 0; i <= values.length - 6; i += 1) {
        const compaction = Number(values[i]);
        const moisture = Number(values[i + 1]);
        const oversize = Number(values[i + 2]);
        const maxDensity = Number(values[i + 3]);
        const wetDensity = Number(values[i + 4]);
        const layer = Number(values[i + 5]);

        if (!(compaction >= 80 && compaction <= 120)) continue;
        if (!(moisture >= 0 && moisture <= 60)) continue;
        if (!(oversize >= 0 && oversize <= 100)) continue;
        if (!(maxDensity >= 1000 && maxDensity <= 3000)) continue;
        if (!(wetDensity >= 1000 && wetDensity <= 3000)) continue;
        if (!(layer >= 0 && layer <= 100)) continue;

        const sampleNo =
          values
            .slice(i + 6)
            .map((value) => Number(value))
            .find((value) => value >= 1 && value <= 999) ??
          rows.length + 1;
        pushRow(sampleNo, layer, wetDensity, maxDensity, oversize, moisture, compaction);
        return;
      }

      for (let i = 0; i <= values.length - 8; i += 1) {
        const sampleNo = Number(values[i]);
        const layer = Number(values[i + 2]);
        const wetDensity = Number(values[i + 3]);
        const maxDensity = Number(values[i + 4]);
        const oversize = Number(values[i + 5]);
        const moisture = Number(values[i + 6]);
        const compaction = Number(values[i + 7]);

        if (!(sampleNo >= 1 && sampleNo <= 999)) continue;
        if (!(layer >= 0 && layer <= 100)) continue;
        if (!(wetDensity >= 1000 && wetDensity <= 3000)) continue;
        if (!(maxDensity >= 1000 && maxDensity <= 3000)) continue;
        if (!(oversize >= 0 && oversize <= 100)) continue;
        if (!(moisture >= 0 && moisture <= 60)) continue;
        if (!(compaction >= 80 && compaction <= 120)) continue;

        pushRow(sampleNo, layer, wetDensity, maxDensity, oversize, moisture, compaction);
        return;
      }
    });

  return rows;
};

const soilSurveyTestDate = (text: string) => {
  const dates = Array.from(text.matchAll(/\b\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\b/g))
    .map((match) => clean(match[0]))
    .filter(Boolean);
  const parsed = dates
    .map((value) => {
      const parts = value.split(/[./-]/).map((part) => Number(part));
      if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) return null;
      const [day, month, rawYear] = parts;
      const year = rawYear < 100 ? 2000 + rawYear : rawYear;
      if (year < 2020 || month < 1 || month > 12 || day < 1 || day > 31) return null;
      return { value, time: Date.UTC(year, month - 1, day) };
    })
    .filter(Boolean) as Array<{ value: string; time: number }>;
  parsed.sort((a, b) => a.time - b.time);
  return parsed[0]?.value ?? firstDateInText(text);
};

const parseSoilSurveyRows = (
  fileName: string,
  text: string
): DensityCertificateResults | null => {
  const flatText = clean(text);
  if (!/\bA-\d-[A-Za-z0-9]\(\d+\)/.test(flatText)) return null;
  if (!/(?:#200|AASHTO|LL|PL|PI|סקר|רקס|קרקע|עקרק)/i.test(flatText)) return null;

  const certificateNo = soilSurveyCertificateNumber(fileName, text);
  const testDate = soilSurveyTestDate(text);
  const rows = text
    .split("\n")
    .map(clean)
    .map((line) => {
      const match = line.match(
        /^((?:\d+(?:[.,]\d+)?\s+){4,12})(GM|GP|GW|GC|SM|SP|SW|SC|CL|CH|ML|MH)\s+(A-\d-[A-Za-z0-9]\(\d+\))\s+(.+?)\s+(\d{2,5})([RLC])\s+(\d{1,3})\s*$/i
      );
      if (!match) return null;

      const nums = match[1]
        .trim()
        .split(/\s+/)
        .map((value) => value.replace(",", "."));
      if (nums.length < 8) return null;

      const pi = nums.pop() ?? "";
      const pl = nums.pop() ?? "";
      const ll = nums.pop() ?? "";
      const depth = nums.pop() ?? "";
      const sieveValues = nums;
      const sieveValue = (index: number) => sieveValues[index] ?? "";

      const section = match[5];
      const side = match[6].toUpperCase();
      const materialDescription = clean(match[4]);
      const aashto = clean(match[3]);
      const unified = clean(match[2]).toUpperCase();
      const testNo = match[7];

      return {
        "מספר בדיקה": testNo,
        "מספר תעודת בדיקה": certificateNo,
        "מספר תעודת בדיקה אפיון - 100%": certificateNo,
        "תאריך הבדיקה": testDate,
        "מחתך": section,
        "עד חתך": section,
        "צד": side,
        "מקום נטילה": `${section}${side}`,
        "עומק": depth,
        "תאור החומר": materialDescription,
        "תיאור החומר": materialDescription,
        "מיון החומר": aashto,
        "מיון AASHTO": aashto,
        "AASHTO": aashto,
        "מיון אחיד": unified,
        "#200": sieveValue(0),
        "#40": sieveValue(1),
        "#10": sieveValue(2),
        "#4": sieveValue(3),
        "3/4\"": sieveValue(4),
        "1.5\"": sieveValue(5),
        "3\"": sieveValue(6),
        "LL": ll,
        "PL": pl,
        "PI": pi,
        "IP": pi,
        "מעמד תוצאות": "OK",
        "סוג העבודה": "סקר קרקע - בורות וקידוחי ניסיון",
      };
    })
    .filter(Boolean) as Array<Record<string, string>>;

  if (!rows.length) return null;

  return {
    "סוג תעודה": "סקר קרקע",
    "מספר תעודת בדיקה": certificateNo,
    "מספר תעודת בדיקה אפיון - 100%": certificateNo,
    "תאריך הבדיקה": testDate,
    "כמות חתכים": String(rows.length),
    "sampleRows": rows,
    "rows": rows,
    "הערות": "נקלט אוטומטית מתעודת סקר קרקע לפי חתכים",
  };
};

export const parseEarthworksDensityText = (
  fileName: string,
  rawText: string
): DensityCertificateResults => {
  const text = cleanMultiline(rawText);
  const flatText = clean(text);

  const soilSurvey = parseSoilSurveyRows(fileName, text);
  if (soilSurvey) return soilSurvey;

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

  const upperLimit = pickValueNearLabel(text, [
    "La' =",
    "ערך עליון",
    "גבול עליון",
  ]);
  if (upperLimit) results["גבול עליון"] = upperLimit;

  const sampleRows = extractControlledDensityRows(text, {
    certificateNo,
    testDate: results["תאריך הבדיקה"],
    layer: results["שכבה מס'"],
    location: results["מקום נטילה"],
    lowerLimit: results["גבול תחתון"],
    upperLimit: results["גבול עליון"],
    material: results["תאור החומר"],
    aashto: results["מיון החומר"],
  });

  if (sampleRows.length) {
    const compactionValues = sampleRows
      .map((row) => Number(row["דרגת הידוק"]))
      .filter((value) => Number.isFinite(value));
    const moistureValues = sampleRows
      .map((row) => Number(row["רטיבות"]))
      .filter((value) => Number.isFinite(value));
    const average = (values: number[]) =>
      values.length
        ? (values.reduce((sum, value) => sum + value, 0) / values.length)
            .toFixed(1)
            .replace(/\.0$/, "")
        : "";

    results["sampleRows"] = sampleRows;
    results["rows"] = sampleRows;
    results["כמות נקודות בדיקה"] = String(sampleRows.length);
    results["הידוק מבוקר (צפיפות מד גרעיני)"] = String(sampleRows.length);
    results["צפיפות מחושבת"] = average(compactionValues);
    results["ממוצע"] = results["צפיפות מחושבת"];
    results["רטיבות ממוצעת"] = average(moistureValues);
    results["מעמד צפיפות/רטיבות"] =
      results["גבול תחתון"] && Number(results["צפיפות מחושבת"]) < Number(results["גבול תחתון"])
        ? "לא תקין"
        : "OK";
    results["מעמד תוצאות"] = results["מעמד צפיפות/רטיבות"];
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
