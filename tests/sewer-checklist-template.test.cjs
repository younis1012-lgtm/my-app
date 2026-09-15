const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const templates = fs.readFileSync(path.join(root, 'app/checklistTemplates.ts'), 'utf8');
const page = fs.readFileSync(path.join(root, 'app/page.tsx'), 'utf8');

test('sewer line checklist mirrors form 57.03.2 and is listed in water and drainage templates', () => {
  assert.match(templates, /sewerLines:\s*\{/);
  assert.match(templates, /formNo: '57\.03\.2'/);
  assert.match(templates, /procedureNo: '57\.03'/);
  for (const activity of ['אישור לקבלן משנה', 'סימון תוואי קו וחפירה', 'הנחת צנרת ביוב', 'בדיקת אטימות', 'צילום קווי ביוב', 'אישור סופי לקטע']) {
    assert.ok(templates.includes(activity), activity);
  }
  assert.match(page, /templateKeys: \["waterSystems", "sewerLines", "drainagePiping", "channelPaving"\]/);
  for (const field of ['lineNo', 'betweenManholes', 'pipeMaterial', 'pipeDiameter', 'lineLengthMeters']) {
    assert.ok(page.includes(field), field);
  }
  assert.match(page, /const formNo = template\.formNo/);
});
