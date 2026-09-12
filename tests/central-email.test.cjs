// Run: node --test tests/central-email.test.cjs. No network or real email is used.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, imports, env = {}) {
  const output = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
  const exports = {};
  vm.runInNewContext(output, {exports, require: name => {if (!(name in imports)) throw new Error(`Unexpected dependency ${name}`); return imports[name];}, Buffer, Response, Request, URL, process:{env}, console});
  return exports;
}
const email = load('app/lib/email.ts', {});
const normalize = value => JSON.parse(JSON.stringify(value));
function setup(options = {}) {
  const history = new Map(); let sent = 0, sentMessage;
  function query(table) {
    let operation='select', payload, conditions=[];
    const q = {
      select(){return q}, eq(key,value){conditions.push([key,value]);return q}, ilike(){return q}, limit(){return q}, order(){return q},
      insert(value){operation='insert';payload=value;return q}, update(value){operation='update';payload=value;return q},
      async single(){return execute()}, async maybeSingle(){return execute()}, then(resolve,reject){return Promise.resolve(execute()).then(resolve,reject)},
    };
    function execute() {
      if (table === 'project_members') return {data:options.noMember ? null : {role:options.role || 'readwrite'}};
      if (table === 'project_email_users') return {data:options.noSender ? null : {email:'sender@example.com', name:'Sender', smtp_app_password:'SERVER_SECRET'}};
      if (table !== 'email_history') throw new Error('Unexpected table');
      if (operation === 'insert') { if (options.failHistory) return {error:{code:'other'}}; if(history.has(payload.id))return {error:{code:'23505'}}; history.set(payload.id, {...payload}); return {data:{id:payload.id}}; }
      const row = [...history.values()].find(row=>conditions.every(([key,value])=>row[key]===value));
      if (operation === 'update') {if(options.failUpdate)return {error:{code:'failed'}};Object.assign(row,payload);return {data:row};}
      return {data:row};
    }
    return q;
  }
  const server = load('app/lib/emailServer.ts', {
    './email':email,
    '@supabase/supabase-js':{createClient:()=>({auth:{getUser:async()=>({data:{user:options.badToken ? null : {id:'user'}}})},from:query})},
    nodemailer:{createTransport:()=>({close(){},async sendMail(message){sent++;sentMessage=message;if(options.smtpError)throw {code:options.smtpError};return {messageId:'message',accepted:options.accepted || ['to@example.com'],rejected:options.rejected || []};}})},
  }, {NEXT_PUBLIC_SUPABASE_URL:'https://example.supabase.co',NEXT_PUBLIC_SUPABASE_ANON_KEY:'anon',SUPABASE_SERVICE_ROLE_KEY:'service'});
  const payload = {projectId:'project',module:'any-future-module',recordId:'record',requestId:'11111111-1111-1111-1111-111111111111',senderEmail:'sender@example.com',to:'to@example.com',cc:[],bcc:[],subject:'Subject',text:'Text <script>alert(1)</script>',attachments:[{filename:'test.txt',mimeType:'text/plain',contentBase64:'aGVsbG8='}]};
  async function send(changes={}, authenticated=true) { return server.postMail(new Request('https://app.example/api/send-email',{method:'POST',headers:authenticated?{Authorization:'Bearer token'}:{},body:JSON.stringify({...payload,...changes})})); }
  return {send,history,get sent(){return sent},get message(){return sentMessage}};
}
test('nested attachments include quality documents and deduplicate without mutating the source',()=>{
  const record={items:[{attachments:[{name:'a.txt',dataUrl:'data:text/plain;base64,aGVsbG8='}]}],documents:[{fileName:'b.pdf',fileUrl:'https://example.supabase.co/storage/v1/object/public/b.pdf',fileType:'application/pdf'}],copy:{name:'a.txt',dataUrl:'data:text/plain;base64,aGVsbG8='}};
  const before=JSON.stringify(record);const files=email.collectMailAttachments(record);
  assert.equal(files.length,2);assert.equal(files[1].filename,'b.pdf');assert.equal(JSON.stringify(record),before);
});
test('template substitution retains missing placeholders and blocks inherited properties',()=>{
  assert.equal(email.mergeMailData('{{title}} {{nested.status}} {{missing}} {{__proto__.x}}',{title:'Title',nested:{status:'OK'}}),'Title OK {{missing}} {{__proto__.x}}');
});
test('recipient parsing normalizes lists and rejects header injection',()=>{
  assert.deepEqual(normalize(email.mailRecipients(['A@x.com; b@x.com','a@x.com'])),['a@x.com','b@x.com']);
  assert.equal(email.validMailAddress('a@x.com\r\nBcc: b@x.com'),false);
});
for (const [name, options, auth, status] of [['anonymous',{},false,401],['expired',{badToken:true},true,401],['readonly',{role:'readonly'},true,403],['nonmember',{noMember:true},true,403]]) {
  test(`${name} cannot send`,async()=>{const s=setup(options);const response=await s.send({},auth);assert.equal(response.status,status);assert.equal(s.sent,0);});
}
for (const [name, changes] of [['invalid address',{to:'invalid'}],['missing template data',{text:'{{missing}}'}],['header injection',{subject:'subject\r\nBcc: a@b.com'}],['remote URL',{attachments:[{filename:'a',url:'http://127.0.0.1/secret'}]}],['malformed base64',{attachments:[{filename:'a',contentBase64:'!!!='}]}]]) {
  test(`${name} is rejected before SMTP`,async()=>{const s=setup();assert.equal((await s.send(changes)).status,400);assert.equal(s.sent,0);});
}
test('history failure prevents sending',async()=>{const s=setup({failHistory:true});assert.equal((await s.send()).status,503);assert.equal(s.sent,0);});
test('missing configured sender prevents sending',async()=>{const s=setup({noSender:true});assert.equal((await s.send()).status,409);assert.equal(s.sent,0);});
test('success uses server credentials, escapes HTML, records context and prevents duplicate dispatch',async()=>{
  const s=setup();const result=await (await s.send({senderAppPassword:'UNTRUSTED',bcc:['hidden@example.com']})).json();
  assert.equal(result.status,'sent');assert.equal(s.sent,1);assert.match(s.message.html,/&lt;script&gt;/);assert.equal(s.message.attachments[0].content.toString(),'hello');
  assert.equal([...s.history.values()][0].module,'any-future-module');assert.equal([...s.history.values()][0].status,'sent');assert.doesNotMatch(JSON.stringify([...s.history.values()]),/SECRET|UNTRUSTED/);
  assert.equal((await s.send()).status,409);assert.equal(s.sent,1);
});
test('partial recipient acceptance is not reported as complete success',async()=>{const s=setup({rejected:['bad@example.com']});const data=await(await s.send()).json();assert.equal(data.status,'partial');assert.deepEqual(data.rejected,['bad@example.com']);});
test('SMTP rejection is persisted as failure',async()=>{const s=setup({smtpError:'EAUTH'});const data=await(await s.send()).json();assert.equal(data.success,false);assert.equal([...s.history.values()][0].status,'failed');});
test('SMTP timeout is persisted as unknown to avoid unsafe retries',async()=>{const s=setup({smtpError:'ETIMEDOUT'});const data=await(await s.send()).json();assert.equal(data.status,'unknown');assert.equal((await s.send()).status,409);assert.equal(s.sent,1);});
test('audit update failure preserves send result and warns against retries',async()=>{const s=setup({failUpdate:true});const data=await(await s.send()).json();assert.equal(data.status,'sent');assert.ok(data.warning);assert.equal((await s.send()).status,409);assert.equal(s.sent,1);});
