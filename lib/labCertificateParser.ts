export type LabCertificateResults = {
  certificateNo?: string;
  samplingDate?: string;
  reportDate?: string;
  materialSource?: string;
  location?: string;

  sieve3?: number;
  sieve15?: number;
  sieve1?: number;
  sieve38?: number;
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

function normalizeText(text: string) {
  return text
    .replace(/\r/g, "\n")
    .replace(/[\u200e\u200f]/g, "")
    .replace(/\u00a0/g, " ");
}

function getMatch(text: string, regex: RegExp) {
  const match = text.match(regex);
  return match?.[1]?.trim();
}

function getNumber(text: string, regex: RegExp) {
  const value = getMatch(text, regex);
  if (!value) return undefined;

  const cleaned = value
    .replace(/,/g, ".")
    .replace(/[^0-9.\-]/g, "");

  const num = Number(cleaned);
  return Number.isFinite(num) ? num : undefined;
}

export function parseLabCertificateText(rawText: string): LabCertificateResults {
  const text = normalizeText(rawText);

  return {
    certificateNo: getMatch(text, /(?:מס\.?\s*תעודה|מספר\s*תעודה|certificate\s*(?:no|number))[:\s]+([^\n]+)/i),
    samplingDate: getMatch(text, /(?:תאריך\s*דגימה|sampling\s*date)[:\s]+([\d./-]+)/i),
    reportDate: getMatch(text, /(?:תאריך\s*הוצאה|תאריך\s*דוח|report\s*date)[:\s]+([\d./-]+)/i),
    materialSource: getMatch(text, /(?:מקור\s*החומר|material\s*source)[:\s]+([^\n]+)/i),
    location: getMatch(text, /(?:מיקום|אתר|קטע|location)[:\s]+([^\n]+)/i),

    sieve3: getNumber(text, /(?:^|\s)3["”]?\s*[:\-]?\s*(\d+(?:[.,]\d+)?)/m),
    sieve15: getNumber(text, /(?:1\.5|1\s*1\/2)["”]?\s*[:\-]?\s*(\d+(?:[.,]\d+)?)/i),
    sieve1: getNumber(text, /(?:^|\s)1["”]\s*[:\-]?\s*(\d+(?:[.,]\d+)?)/m),
    sieve38: getNumber(text, /3\/8["”]?\s*[:\-]?\s*(\d+(?:[.,]\d+)?)/i),
    sieve34: getNumber(text, /3\/4["”]?\s*[:\-]?\s*(\d+(?:[.,]\d+)?)/i),
    sieve4: getNumber(text, /#\s*4\s*[:\-]?\s*(\d+(?:[.,]\d+)?)/i),
    sieve10: getNumber(text, /#\s*10\s*[:\-]?\s*(\d+(?:[.,]\d+)?)/i),
    sieve40: getNumber(text, /#\s*40\s*[:\-]?\s*(\d+(?:[.,]\d+)?)/i),
    sieve200: getNumber(text, /#\s*200\s*[:\-]?\s*(\d+(?:[.,]\d+)?)/i),

    ll: getNumber(text, /(?:\bLL\b|גבול\s*נזילות)\s*[:\-]?\s*(\d+(?:[.,]\d+)?)/i),
    pl: getNumber(text, /(?:\bPL\b|גבול\s*פלסטיות)\s*[:\-]?\s*(\d+(?:[.,]\d+)?)/i),
    pi: getNumber(text, /(?:\bPI\b|אינדקס\s*פלסטיות)\s*[:\-]?\s*(\d+(?:[.,]\d+)?)/i),

    sandEquivalent: getNumber(text, /(?:שווה\s*ערך\s*חול|sand\s*equivalent)\s*[:\-]?\s*(\d+(?:[.,]\d+)?)/i),
    specificGravity: getNumber(text, /(?:צפיפות\s*ממשית|specific\s*gravity)\s*[:\-]?\s*(\d+(?:[.,]\d+)?)/i),
    absorption: getNumber(text, /(?:ספיגות|absorption)\s*[:\-]?\s*(\d+(?:[.,]\d+)?)/i),
    losAngeles: getNumber(text, /(?:לוס\s*אנג(?:׳|')?לס|los\s*angeles)\s*[:\-]?\s*(\d+(?:[.,]\d+)?)/i),

    aashto: getMatch(text, /AASHTO\s*[:\-]?\s*([^\n\s]+)/i),

    maxDensity: getNumber(text, /(?:צפיפות\s*מקסימלית|max\s*density|maximum\s*density)\s*[:\-]?\s*(\d+(?:[.,]\d+)?)/i),
    optimumMoisture: getNumber(text, /(?:רטיבות\s*אופטימלית|optimum\s*moisture)\s*[:\-]?\s*(\d+(?:[.,]\d+)?)/i),
    totalMoisture: getNumber(text, /(?:רטיבות\s*כוללת|total\s*moisture)\s*[:\-]?\s*(\d+(?:[.,]\d+)?)/i),
    stone34: getNumber(text, /(?:אבן\s*3\/4|stone\s*3\/4)\s*[:\-]?\s*(\d+(?:[.,]\d+)?)/i),

    conclusion: getMatch(text, /(?:מסקנה|conclusion)[:\s]+([^\n]+)/i),
  };
}
