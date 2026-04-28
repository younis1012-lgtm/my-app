export type LabCertificateResults = {
  certificateNo?: string;
  samplingDate?: string;
  reportDate?: string;
  materialSource?: string;
  location?: string;

  sieve3?: number;
  sieve15?: number;
  sieve34?: number;
  sieve4?: number;
  sieve10?: number;
  sieve40?: number;
  sieve200?: number;

  ll?: number;
  pl?: number;
  pi?: number;

  sandEquivalent?: number;
  specificGravity?: number;
  absorption?: number;
  losAngeles?: number;

  aashto?: string;

  maxDensity?: number;
  optimumMoisture?: number;

  conclusion?: string;

  totalMoisture?: number;
  stone34?: number;
};

const normalizeText = (text: string) =>
  String(text ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/[|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const numberValue = (value?: string) => {
  if (!value) return undefined;
  const cleaned = value.replace(",", ".").replace(/[^\d.-]/g, "");
  if (!cleaned) return undefined;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const firstMatch = (text: string, patterns: RegExp[]) => {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return undefined;
};

const firstNumber = (text: string, patterns: RegExp[]) => numberValue(firstMatch(text, patterns));

const numberAfterLabel = (text: string, labels: string[]) => {
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const patterns = [
      new RegExp(`${escaped}\\s*[:=\\-]?\\s*([0-9]+(?:[.,][0-9]+)?)`, "i"),
      new RegExp(`([0-9]+(?:[.,][0-9]+)?)\\s*${escaped}`, "i"),
    ];
    const value = firstNumber(text, patterns);
    if (value !== undefined) return value;
  }
  return undefined;
};

export function parseLabCertificateText(rawText: string): LabCertificateResults {
  const text = normalizeText(rawText);

  const certificateNo =
    firstMatch(text, [
      /(?:מס(?:פר)?\.?\s*תעודה|תעודה\s*מס(?:פר)?|certificate\s*(?:no|number))\s*[:\-]?\s*([A-Za-z0-9./_-]{3,})/i,
      /(?:^|\s)(\d{4,6})(?:\s|$)/,
    ]) ?? "";

  const samplingDate = firstMatch(text, [
    /(?:תאריך\s*דגימה|sampling\s*date)\s*[:\-]?\s*([0-9]{1,2}[./-][0-9]{1,2}[./-][0-9]{2,4})/i,
  ]);

  const reportDate = firstMatch(text, [
    /(?:תאריך\s*הוצאה|תאריך\s*דוח|report\s*date)\s*[:\-]?\s*([0-9]{1,2}[./-][0-9]{1,2}[./-][0-9]{2,4})/i,
  ]);

  const aashto = firstMatch(text, [
    /(A-\d(?:-[a-z])?\s*\(?\d?\)?)/i,
    /AASHTO\s*[:\-]?\s*([A-Za-z0-9()\- ]{2,20})/i,
  ]);

  return {
    certificateNo,
    samplingDate,
    reportDate,
    materialSource: firstMatch(text, [/(?:מקור\s*החומר|material\s*source)\s*[:\-]?\s*([^:]{2,80})/i]),
    location: firstMatch(text, [/(?:מיקום|מקום\s*נטילה|location)\s*[:\-]?\s*([^:]{2,80})/i]),

    sieve3: numberAfterLabel(text, ['3"', "3 in", "נפה 3"]),
    sieve15: numberAfterLabel(text, ['1.5"', '1½"', "1.5", "נפה 1.5"]),
    sieve34: numberAfterLabel(text, ['3/4"', "3/4", "נפה 3/4"]),
    sieve4: numberAfterLabel(text, ["#4", "נפה 4"]),
    sieve10: numberAfterLabel(text, ["#10", "נפה 10"]),
    sieve40: numberAfterLabel(text, ["#40", "נפה 40"]),
    sieve200: numberAfterLabel(text, ["#200", "נפה 200"]),

    ll: numberAfterLabel(text, ["LL", "גבול נזילות"]),
    pl: numberAfterLabel(text, ["PL", "גבול פלסטיות"]),
    pi: numberAfterLabel(text, ["PI", "אינדקס פלסטיות"]),

    sandEquivalent: numberAfterLabel(text, ["שווה ערך חול", "sand equivalent", "SE"]),
    specificGravity: numberAfterLabel(text, ['צפיפות ממשית', "specific gravity", "density"]),
    absorption: numberAfterLabel(text, ["ספיגות", "absorption"]),
    losAngeles: numberAfterLabel(text, ["לוס אנג'לס", "לוס אנגלס", "los angeles", "LA"]),

    aashto,

    maxDensity: numberAfterLabel(text, ["צפיפות מקסימלית", "צפיפות מעבדתית", "max density"]),
    optimumMoisture: numberAfterLabel(text, ["רטיבות אופטימלית", "optimum moisture", "OMC"]),

    conclusion: firstMatch(text, [/(?:מסקנה|conclusion)\s*[:\-]?\s*([^:]{2,120})/i]),
  };
}
