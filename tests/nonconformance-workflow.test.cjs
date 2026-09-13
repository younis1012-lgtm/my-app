const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const output = ts.transpileModule(fs.readFileSync(path.join(__dirname,'..','app/lib/nonconformanceWorkflow.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const workflow = {};
vm.runInNewContext(output,{exports:workflow,require});

test('quality assurance viewer can manage NCRs and receives QA identity defaults',()=>{
  const access={username:'ה״א',displayName:'הבטחת איכות',role:'readonly'};
  const actor=workflow.nonconformanceActor(access,[{name:'עדנאן שבת',role:'ה״א',email:'shbat.adnan.1991@gmail.com',active:true}]);
  assert.equal(workflow.canManageNonconformances(access),true);
  assert.deepEqual(JSON.parse(JSON.stringify(actor)),{openedBy:'QA',roleLabel:'הבטחת איכות',personalName:'עדנאן שבת'});
});

test('ordinary viewer cannot manage NCRs',()=>{
  assert.equal(workflow.canManageNonconformances({username:'viewer',displayName:'צופה',role:'readonly'}),false);
});

test('quality controller identity fills QC role and personal name',()=>{
  const actor=workflow.nonconformanceActor({username:'q.controling@gmail.com',displayName:'יונס אברהים',role:'readwrite'},[]);
  assert.equal(actor.openedBy,'QC');
  assert.equal(actor.roleLabel,'בקרת איכות');
  assert.equal(actor.personalName,'יונס אברהים');
});

test('responsible and handler choices are shared workflow constants',()=>{
  assert.deepEqual(JSON.parse(JSON.stringify(workflow.NCR_RESPONSIBLE_OPTIONS)),['','תכנון','ביצוע','ספק']);
  assert.deepEqual(JSON.parse(JSON.stringify(workflow.NCR_HANDLER_OPTIONS)),['','תכנון','ביצוע','ספק','מנהל פרויקט']);
});
