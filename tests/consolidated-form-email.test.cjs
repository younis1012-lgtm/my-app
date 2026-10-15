const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname,'..','app/page.tsx'),'utf8');

test('NCR and trial section email generate one merged PDF and suppress loose attachments',()=>{
  assert.match(source,/\["nonconformances", "trialSections"\]\.includes\(section\)/);
  assert.match(source,/buildMergedPdfWithLeftovers\(title, html, archiveRecordPdfAppendices\(record\)\)/);
  // Word/Excel etc. cannot be embedded in a PDF: they are sent as separate files instead of blocking the e-mail
  assert.match(source,/\.\.\.\(await leftoverMailAttachments\(leftovers\)\)\]/);
  assert.doesNotMatch(source,/לא ניתן לצרף ל-PDF את הקבצים הבאים/);
  assert.match(source,/attachments: consolidated \? \[\] : collectMailAttachments\(snapshot\)/);
  assert.match(source,/`\$\{title\} - כולל נספחים\.pdf`/);
});

test('trial section list loads reported details and shows status tracking indicators',()=>{
  assert.match(source,/מעקב קטעי ניסוי/);
  assert.match(source,/trial_sections: "[^"]*details"/);
  for (const label of ['בתהליך / בטיפול','אושרו','נדחו']) assert.ok(source.includes(label));
  assert.match(source,/status === "טיוטה" \|\| status === "draft" \? "בתהליך \/ בטיפול"/);
  assert.match(source,/\["סטטוס", exportStatusLabel\(get\("status"\)\)\]/);
});
