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
const {saveProjectUserRows} = load('app/lib/projectUserStorage.ts');
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
function database({role='admin',active=true,loggedIn=true,error=null}={}) {
  const writes=[];
  return {writes,auth:{getUser:async()=>({data:{user:loggedIn?{id:'operator'}:null}})},from(table){
    if(table==='project_members') {
      const filters={}; const q={select(){return q},eq(k,v){filters[k]=v;return q},async maybeSingle(){assert.deepEqual(filters,{project_id:'majdal',user_id:'operator'});return {data:{role,active}}}};return q;
    }
    assert.equal(table,'project_email_users');
    return {async upsert(rows,options){writes.push(plain(rows));assert.equal(options.onConflict,'id');return {error}}};
  }};
}
test('save only touches selected project and preserves IDs and mailbox credentials',async()=>{
  const db=database();
  const rows=[{id:'existing-text-id',project_id:'majdal',smtp_app_password:'unchanged',active:false},{id:'other',project_id:'other'}];
  await saveProjectUserRows(db,'majdal',rows);
  assert.deepEqual(db.writes,[[rows[0]]]);
  assert.equal(rows.length,2);
});
for(const options of [{loggedIn:false},{role:'readwrite'},{role:'readonly'},{active:false}])
  test('unauthorized save is blocked '+JSON.stringify(options),async()=>{
    const db=database(options);await assert.rejects(saveProjectUserRows(db,'majdal',[{project_id:'majdal'}]));assert.equal(db.writes.length,0);
  });
test('empty save performs no insert or deletion',async()=>{
  const db=database();await saveProjectUserRows(db,'majdal',[]);assert.deepEqual(db.writes,[]);
});
test('RLS error remains a failed save with actionable text',async()=>{
  const db=database({error:{code:'42501'}});
  await assert.rejects(saveProjectUserRows(db,'majdal',[{project_id:'majdal'}]),/להתחבר מחדש/);
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
  await client.saveProjectEmailUsersToCloud([...result.users,{id:'other',projectId:'other'}],'majdal');
  assert.equal(client.written.length,1);
  assert.equal(client.written[0].id,'text-existing');
  assert.equal(client.written[0].smtp_app_password,'keep-secret');
  const edited={...result.users[1],directoryOnly:false,name:'Edited'};
  await client.saveProjectEmailUsersToCloud([edited],'majdal');
  assert.equal(client.written[0].id,edited.id);
});
test('failed directory response does not become an empty successful result',async()=>{
  const client=clientDirectory({error:'load failed'},false);
  await assert.rejects(client.loadProjectEmailUsersFromCloud('majdal'),/load failed/);
});
