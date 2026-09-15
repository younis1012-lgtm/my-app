const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const path = require('node:path');
const root = path.join(__dirname,'..');
function load(file, extras={}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,...extras});
  return exports;
}
const {matchesProjectAssignment,assignmentProjectIds} = load('app/lib/projectAssignments.ts');
let storageFetch = async()=>{ throw new Error('unexpected fetch'); };
const {saveProjectUserRows,restoreProjectUserDetails} = load('app/lib/projectUserStorage.ts',{fetch:(...args)=>storageFetch(...args)});
const plain = value => JSON.parse(JSON.stringify(value));
test('legacy assignments include name, scalar ID and array ID independently',()=>{
  for (const row of [
    {project_name:' מגד  אלכרום '},
    {project_id:'majdal'},
    {project_ids:['majdal']},
    {project_ids:[],project_id:'majdal'},
    {project_ids:['other'],project_id:'majdal'},
    {project_ids:['other'],project_name:'מגד אלכרום'},
    {projectIds:[],projectId:'majdal'},
    {projectName:'מגד אלכרום'},
  ]) assert.equal(matchesProjectAssignment(row,'majdal','מגד אלכרום'),true,JSON.stringify(row));
  assert.equal(matchesProjectAssignment({project_name:'מגד'},'majdal','מגד אלכרום'),false);
  assert.equal(matchesProjectAssignment({project_ids:['other'],project_name:'other'},'majdal','מגד אלכרום'),false);
  assert.equal(matchesProjectAssignment({},'majdal',''),false);
  assert.deepEqual(plain(assignmentProjectIds({project_ids:['A'],project_id:'a',projectId:'B'})),['a','b']);
});
test('client save sends only the selected project through the protected endpoint',async()=>{
  let request;
  const db={auth:{getSession:async()=>({data:{session:{access_token:'token'}}})}};
  storageFetch=async(url,options)=>{request={url,options};return {ok:true,json:async()=>({success:true})}};
  try {
    const rows=[{id:'existing-text-id',project_id:'majdal',smtp_app_password:'unchanged',active:false},{id:'other',project_id:'other'}];
    await saveProjectUserRows(db,'majdal',rows);
    assert.equal(request.url,'/api/email-directory');
    assert.equal(request.options.headers.Authorization,'Bearer token');
    assert.deepEqual(JSON.parse(request.options.body).rows,[rows[0]]);
  } finally { storageFetch=async()=>{throw new Error('unexpected fetch')}; }
});
test('client save requires a current authenticated session',async()=>{
  const db={auth:{getSession:async()=>({data:{session:null}})}};
  await assert.rejects(saveProjectUserRows(db,'majdal',[{project_id:'majdal'}]),/ההתחברות פגה/);
});
test('cached role and company fill missing legacy details without overwriting cloud values',()=>{
  const cloud=[{email:'legacy@example.com',role:'',company:'',phone:'',smtpAppPassword:''},{email:'stored@example.com',role:'מנהל',company:'ענן'}];
  const cached=[{email:'LEGACY@example.com',role:'מפקח',company:'חברה א',phone:'050',smtpAppPassword:'secret'},{email:'stored@example.com',role:'ישן',company:'ישן'}];
  const restored=restoreProjectUserDetails(cloud,cached,false);
  assert.deepEqual(plain(restored[0]),{...cloud[0],role:'מפקח',company:'חברה א',phone:'050',smtpAppPassword:''});
  assert.equal(restored[1].role,'מנהל');
  assert.equal(restored[1].company,'ענן');
});
test('both schema entry points preserve project membership policies on rerun',()=>{
  const a=fs.readFileSync(path.join(root,'app/supabase/09_project_email_users.sql'),'utf8');
  const b=fs.readFileSync(path.join(root,'app/project_email_users.sql'),'utf8');
  assert.equal(a,b);
  assert.doesNotMatch(a,/using\s*\(true\)|with check\s*\(true\)|delete from|truncate|disable row level/i);
  assert.match(a,/for all to authenticated/);
  assert.match(a,/pm\.user_id = auth\.uid\(\) and pm\.active and pm\.role = 'admin'/);
});

function clientDirectory(payload, responseOk=true) {
  const source=fs.readFileSync(path.join(root,'app/page.tsx'),'utf8');
  const ast=ts.createSourceFile('page.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  const names=['loadProjectEmailUsersFromCloud','saveProjectEmailUsersToCloud'];
  const selected=ast.statements.filter(node=>ts.isVariableStatement(node) && node.declarationList.declarations.some(d=>names.includes(d.name.getText(ast))));
  let written;
  const context={URLSearchParams,crypto:require('node:crypto').webcrypto,
    supabase:{auth:{getSession:async()=>({data:{session:{access_token:'token'}}})}},
    fetch:async(url,options)=>{assert.match(url,/projectId=majdal/);assert.match(url,/mode=manage-users/);assert.equal(options.headers.Authorization,'Bearer token');return {ok:responseOk,json:async()=>payload}},
    dedupeProjectEmailUsers:rows=>rows,normalizeStoredProjectId:value=>String(value),toSupabaseTimestamp:value=>value,
    saveProjectUserRows:async(db,id,rows)=>{assert.equal(id,'majdal');written=plain(rows)},
  };
  const code=selected.map(n=>n.getText(ast)).join('\n')+'\nglobalThis.handlers={loadProjectEmailUsersFromCloud,saveProjectEmailUsersToCloud};';
  vm.runInNewContext(ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,context);
  return {...context.handlers,get written(){return written}};
}
test('loading merges directory contacts without duplicating stored rows; save skips untouched legacy contacts',async()=>{
  const stored={id:'text-existing',project_id:'majdal',email:'existing@example.com',name:'Existing',smtp_app_password:'keep-secret',active:true};
  const client=clientDirectory({canManageUsers:true,users:[stored],contacts:[{email:stored.email,name:'Duplicate'},{email:'legacy@example.com',name:'Legacy'}]});
  const result=await client.loadProjectEmailUsersFromCloud('majdal');
  assert.equal(result.canManage,true);
  assert.equal(result.users.length,2);
  assert.equal(result.users[0].smtpAppPassword,'keep-secret');
  assert.equal(result.users[1].directoryOnly,true);
  await client.saveProjectEmailUsersToCloud([...result.users,{id:'other',projectId:'other'}],'majdal',true);
  assert.equal(client.written.length,1);
  assert.equal(client.written[0].id,'text-existing');
  assert.equal(client.written[0].smtp_app_password,'keep-secret');
  const edited={...result.users[1],directoryOnly:false,name:'Edited'};
  await client.saveProjectEmailUsersToCloud([edited],'majdal',true);
  assert.equal(client.written[0].id,edited.id);
});
test('failed directory response does not become an empty successful result',async()=>{
  const client=clientDirectory({error:'load failed'},false);
  await assert.rejects(client.loadProjectEmailUsersFromCloud('majdal'),/load failed/);
});
