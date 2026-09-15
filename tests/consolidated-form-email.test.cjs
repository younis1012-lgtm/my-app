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

test('trial section list loads reported details and shows status tracking indicators',()=>{
  assert.match(source,/מעקב קטעי ניסוי/);
  assert.match(source,/trial_sections: "[^"]*details"/);
  for (const label of ['בהליך','אושרו','נדחו']) assert.ok(source.includes(label));
  assert.match(source,/status === "טיוטה" \|\| status === "draft" \? "בהליך"/);
});
