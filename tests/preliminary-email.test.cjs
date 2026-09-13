const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const exportsObject = {};
vm.runInNewContext(
  ts.transpileModule(
    fs.readFileSync(path.join(__dirname, '..', 'app/lib/preliminaryEmail.ts'), 'utf8'),
    {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}},
  ).outputText,
  {exports:exportsObject,structuredClone},
);

test('current preliminary draft keeps every newly attached file without stale hydration', async () => {
  let hydrateCalls = 0;
  const current = [{id:'record',material:{certificates:[{attachments:[{name:'first.pdf'},{name:'second.pdf'}]}]}}];
  const records = await exportsObject.preparePreliminaryEmailRecords(
    current,
    async () => {hydrateCalls += 1; return {id:'record',material:{certificates:[{attachments:[{name:'first.pdf'}]}]}};},
    true,
  );
  assert.equal(hydrateCalls, 0);
  assert.deepEqual(records[0].material.certificates[0].attachments.map(file=>file.name), ['first.pdf','second.pdf']);
  records[0].material.certificates[0].attachments.pop();
  assert.equal(current[0].material.certificates[0].attachments.length, 2);
});

test('saved preliminary list records are still refreshed from the server', async () => {
  let hydrateCalls = 0;
  const records = await exportsObject.preparePreliminaryEmailRecords(
    [{id:'record'}],
    async record => {hydrateCalls += 1; return {...record,serverCopy:true};},
  );
  assert.equal(hydrateCalls, 1);
  assert.equal(records[0].serverCopy, true);
});
