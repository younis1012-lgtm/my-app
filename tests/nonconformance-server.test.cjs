const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function compiled(file) { return ts.transpileModule(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText; }
const workflow={}; vm.runInNewContext(compiled('app/lib/nonconformanceWorkflow.ts'),{exports:workflow,require});

function setup({legacyUsername='ה״א',role='readonly'}={}) {
  let saved=0;
  const db={auth:{getUser:async()=>({data:{user:{id:'user',email:'legacy@users.yk-quality.invalid',app_metadata:{legacy_username:legacyUsername},user_metadata:{name:legacyUsername}}}})},from(table){
    const q={select(){return q},eq(){return q},insert(){saved++;return Promise.resolve({error:null})},update(){saved++;return q},maybeSingle:async()=>table==='project_members'?{data:{role,active:true}}:{data:{id:'ncr',project_id:'project'}} ,then(resolve,reject){return Promise.resolve({error:null}).then(resolve,reject)}};return q;
  }};
  const server={}; vm.runInNewContext(compiled('app/lib/nonconformanceServer.ts'),{exports:server,require:name=>name==='@supabase/supabase-js'?{createClient:()=>db}:name==='./nonconformanceWorkflow'?workflow:require(name),process:{env:{NEXT_PUBLIC_SUPABASE_URL:'https://example.supabase.co',NEXT_PUBLIC_SUPABASE_ANON_KEY:'anon',SUPABASE_SERVICE_ROLE_KEY:'service'}},Request,Response,console});
  const request=()=>new Request('https://app.example/api/nonconformances',{method:'POST',headers:{authorization:'Bearer token','content-type':'application/json'},body:JSON.stringify({projectId:'project',mode:'insert',record:{id:'ncr',project_id:'project',description:'בעיה',details:{openedRole:'הבטחת איכות'}}})});
  return {server,request,get saved(){return saved}};
}

test('quality assurance viewer can save an NCR through the protected server route',async()=>{const s=setup();assert.equal((await s.server.saveQualityAssuranceNonconformance(s.request())).status,200);assert.equal(s.saved,1)});
test('ordinary readonly viewer cannot use the NCR write route',async()=>{const s=setup({legacyUsername:'viewer'});assert.equal((await s.server.saveQualityAssuranceNonconformance(s.request())).status,403);assert.equal(s.saved,0)});
