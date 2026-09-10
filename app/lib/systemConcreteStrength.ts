export type ConcretePdfItem = { str: string; width: number; transform: number[] };

// SYSTEM's side-by-side age columns end ABOVE the two minimum-requirement rows.
// Recognize the complete template before overriding the general laboratory OCR.
export function readSystemConcreteStrength(items: ConcretePdfItem[]) {
  const rows = items.filter(i => i.str.trim());
  const label = (text: string) => rows.find(i => i.str.includes(text));
  const average = label('חוזק לחיצה ממוצע');
  const individualMinimum = label('חוזק לחיצה מינימלי לדוגמא הנדרש בגיל');
  const averageMinimum = label('חוזק לחיצה מינימלי ממוצע נדרש בגיל');
  if (!average || !individualMinimum || !averageMinimum || !label('שעת נטילה') || !label('שעת יציאת')) return null;
  const y = (i: ConcretePdfItem) => i.transform[5];
  const center = (i: ConcretePdfItem) => i.transform[4] + i.width / 2;
  if (y(individualMinimum) >= y(average) || y(averageMinimum) >= y(individualMinimum)) return null;
  const days = rows.filter(i => i.str.trim() === 'ימים' && y(i) > y(average));
  const ageHeader = (age: string) => rows.find(i => i.str.trim() === age && days.some(d => Math.abs(y(d) - y(i)) < 2 && Math.abs(center(d) - center(i)) < 35));
  const seven = ageHeader('7');
  const twentyEight = ageHeader('28');
  if (!seven || !twentyEight || Math.abs(y(seven) - y(twentyEight)) > 2 || center(seven) <= center(twentyEight)) return null;
  // Each header consists of the age and the Hebrew word for days.
  const columnCenter = (header: ConcretePdfItem) => {
    const day = days.filter(d => Math.abs(y(d) - y(header)) < 2 && center(d) < center(header)).sort((a, b) => Math.abs(center(a) - center(header)) - Math.abs(center(b) - center(header)))[0];
    return (Math.min(day.transform[4], header.transform[4]) + Math.max(day.transform[4] + day.width, header.transform[4] + header.width)) / 2;
  };
  const c7 = columnCenter(seven), c28 = columnCenter(twentyEight);
  const halfWidth = (c7 - c28) / 2;
  const read = (c: number, header: ConcretePdfItem) => {
    const values = rows.filter(i => /^\d+(?:[.,]\d+)?$/.test(i.str.trim()) && Math.abs(center(i) - c) < halfWidth && y(i) >= y(average) - 2 && y(i) < y(header) - 3);
    const summary = values.find(i => Math.abs(y(i) - y(average)) < 2);
    if (summary) return summary.str.trim().replace(',', '.');
    if (!values.length) return '';
    return (values.reduce((sum, i) => sum + Number(i.str.replace(',', '.')), 0) / values.length).toFixed(1);
  };
  return { strength7Days: read(c7, seven), strength28Days: read(c28, twentyEight) };
}

