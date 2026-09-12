const fs = require('node:fs');
const assert = require('node:assert/strict');
const ts = require('typescript');
const JSZip = require('jszip');
const source = fs.readFileSync('app/components/ConcentrationsSection.tsx', 'utf8') + '\nexport { buildPreliminaryConcentrationRows, definitions, buildWorkbookBlob, normalizeConcentrationRows };';
const compiled = ts.transpileModule(source, { compilerOptions: { esModuleInterop: true, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
const mod = { exports: {} };
new Function('require', 'exports', 'module', compiled)(require, mod.exports, mod);
const { buildPreliminaryConcentrationRows: build, definitions, buildWorkbookBlob, normalizeConcentrationRows } = mod.exports;
const certs = [
  { id: 'one', certificateNo: '001234', details: 'ISO', expiryDate: '2027-12-15', issueDate: '2024-12-16', attachments: [{ name: 'iso.pdf' }] },
  { id: 'two', certificateNo: 'AB-005', details: 'תו תקן', expiryDate: '2026-12-31', attachments: [{ name: 'standard.pdf' }] },
  { id: 'three', certificateNo: '', details: 'הרכב תערובת ב-30', expiryDate: '2028-07-28', attachments: [{ name: 'mix.pdf' }] },
  { id: 'four', details: 'אישור נוסף', attachments: [{ name: 'unknown.pdf' }] },
  { id: 'excluded', exists: false, certificateNo: 'EXCLUDED' },
  { id: 'empty', details: '', certificateNo: '', expiryDate: '', attachments: [] },
];
(async () => {
  for (const [id, subtype, key] of [['suppliers','suppliers','supplier'], ['contractors','subcontractors','subcontractor'], ['materials','materials','material']]) {
    const record = { id: 'record', subtype, date: '2026-07-03', [key]: { supplierName: 'ספק בדיקה', subcontractorName: 'קבלן בדיקה', materialName: 'חומר בדיקה', approvalNo: '999', certificates: certs } };
    const definition = definitions.find(d => d.id === id);
    const rows = normalizeConcentrationRows(definition, build([record], subtype));
    assert.equal(rows.length, 4, `${id}: keep each certificate, including numberless files`);
    const number = id === 'materials' ? 'מספר תעודה / אישור' : 'מספר תעודה / רישיון / אישור';
    const expiry = id === 'suppliers' ? 'תוקף' : 'תאריך תפוגה';
    assert.deepEqual(rows.map(r => r[number]), ['001234', 'AB-005', 'לא הוזן', 'לא הוזן']);
    assert.deepEqual(rows.map(r => r[expiry]), ['15/12/2027', '31/12/2026', '28/07/2028', 'לא הוזן']);
    assert.equal(rows[2]['קבצים מצורפים'], 'mix.pdf');
    assert.equal(rows[0]['תאריך הנפקת תעודה'], '16/12/2024');
    assert.equal(rows[0]['תאריך אישור'], '03/07/2026');
    assert.equal(build([{...record, certificates:[certs[0]]}], subtype).length, 4, 'Same certificate id is not exported twice');
    const blob = await buildWorkbookBlob(definition, rows, {projectName:'פרויקט בדיקה'});
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const xml = await zip.file('xl/worksheets/sheet1.xml').async('string');
    for (const text of ['001234', 'AB-005', 'mix.pdf', '28/07/2028', 'הרכב תערובת ב-30', 'קבצים מצורפים']) assert.ok(xml.includes(text), `${id}: exported workbook must contain ${text}`);
    assert.ok(!xml.includes('EXCLUDED'));
    const empty = build([{subtype, [key]:{}}], subtype);
    assert.equal(empty.length,1,'Entities without certificates remain visible');
    assert.equal(empty[0][expiry],'לא הוזן');
  }
  console.log('PASS: all three exports preserve certificate-number/type/expiry/file associations, numberless documents, leading zeros, missing values and exclusions.');
})().catch(error => { console.error(error); process.exitCode=1; });

