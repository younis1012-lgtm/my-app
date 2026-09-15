const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname,'..','app/page.tsx'),'utf8');

test('NCR and trial section email generate one merged PDF and suppress loose attachments',()=>{
  assert.match(source,/\["nonconformances", "trialSections"\]\.includes\(section\)/);
  assert.match(source,/buildMergedPdfBlob\(title, html, archiveRecordPdfAppendices\(record\)\)/);
  assert.match(source,/attachments: consolidated \? \[\] : collectMailAttachments\(snapshot\)/);
  assert.match(source,/`\$\{title\} - כולל נספחים\.pdf`/);
});

test('trial section list shows status tracking indicators',()=>{
  assert.match(source,/מעקב קטעי ניסוי/);
  for (const label of ['בטיפול / טיוטה','אושרו','נדחו']) assert.ok(source.includes(label));
});
