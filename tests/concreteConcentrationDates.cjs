const fs = require('node:fs');
const assert = require('node:assert/strict');
const ts = require('typescript');
const source = fs.readFileSync('app/components/ConcentrationsSection.tsx', 'utf8') + '\nexport { buildConcreteConcentrationRows };';
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
const mod = { exports: {} };
new Function('require', 'exports', 'module', compiled)(require, mod.exports, mod);
const build = mod.exports.buildConcreteConcentrationRows;
const checklist = {
  templateKey: 'stoneFacingGravityWall', date: '2026-07-16', location: 'כביש 1',
  items: [
    { description: 'אישור בקרת איכות ליציקה', executionDate: '2026-07-16' },
    { description: 'יציקת גוף הקיר בשכבות כל 60 ס״מ ורטוט מבוקר', executionDate: '2026-08-10' },
    { description: 'נטילת דגימות בטון ובדיקת סומך על ידי מעבדה', executionDate: '2026-08-17', concreteResults: { castDate: '2026-07-16', sampleDate: '2026-07-17', testDate: '2026-08-17', certificateNo: '2567792', strength7Days: '23.5' } }
  ]
};
let rows = build([checklist]);
assert.equal(rows.length, 1);
assert.equal(rows[0]['תאריך יציקה'], '10/08/2026');
assert.equal(rows[0]['חוזק לחיצה - 7 ימים'], '23.5');
let bare = structuredClone(checklist); bare.items.pop();
assert.equal(build([bare])[0]['תאריך יציקה'], '10/08/2026');
bare.items[1].executionDate = '';
assert.equal(build([bare]).length, 0, 'Preparation alone must not create a pour');
let missing = structuredClone(checklist); missing.items[1].executionDate = '';
assert.equal(build([missing])[0]['תאריך יציקה'], '', 'Keep results but do not invent a casting date');
let other = structuredClone(checklist); other.items[1].executionDate = '2026-08-20';
assert.deepEqual(build([checklist, other]).map(r=>r['תאריך יציקה']), ['10/08/2026','20/08/2026']);
const site = {templateKey:'siteConcrete', items:[{description:'ביצוע יציקה ורטוט',executionDate:'2026-08-12'}]};
assert.equal(build([site])[0]['תאריך יציקה'], '12/08/2026');
console.log('PASS: checklist casting dates override certificate/preparation dates; missing dates, no certificate, separate checklists and site concrete.');
const ambiguous = structuredClone(checklist);
ambiguous.items.push({description:'ביצוע יציקה ורטוט',executionDate:'2026-08-11'});
assert.equal(build([ambiguous])[0]['תאריך יציקה'], '');
const excluded = structuredClone(checklist); excluded.items[1].excludedFromPrint = true;
assert.equal(build([excluded])[0]['תאריך יציקה'], '');
const changed = structuredClone(checklist); changed.items[1].executionDate = '2026-08-13';
assert.equal(build([changed])[0]['תאריך יציקה'], '13/08/2026', 'Stored certificate cannot freeze an old date');
