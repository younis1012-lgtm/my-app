const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const path = require('node:path');
function harness(canSend=true) {
 const states=[], effects=[];let index=0, mounted=false, posts=0;
 const jsx=(type,props)=>({type,props:props||{}});
 const hooks={useState(initial){const slot=index++;if(!(slot in states))states[slot]=typeof initial==='function'?initial():initial;return [states[slot],value=>states[slot]=typeof value==='function'?value(states[slot]):value]},useRef(value){return {current:value}},useEffect(fn){if(!mounted)effects.push(fn)}};
 function load(file,imports){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require:n=>imports[n],crypto:{randomUUID:()=> 'test-id'},URLSearchParams,document:{activeElement:null},fetch:async(url,options)=>{if(options.method==='POST'){posts++;return {ok:true,json:async()=>({success:true,status:'sent'})}}return {ok:true,json:async()=>url.includes('email-directory')?{contacts:[],senders:[{id:'sender',email:'sender@example.com',name:'Sender'}]}:{history:[]}}}});return exports;}
 const email=load('app/lib/email.ts',{});
 const component=load('app/components/EmailComposer.tsx',{'react':hooks,'react/jsx-runtime':{jsx,jsxs:jsx},'../../lib/supabaseClient':{supabase:{auth:{getSession:async()=>({data:{session:{access_token:'test'}}})}}},'../lib/email':email});
 const props={context:{projectId:'project',module:'test',recordId:'record',title:'Test',data:{title:'Test',projectName:'Project'},attachments:[]},contacts:[],senderEmail:'sender@example.com',canSend,onClose(){}};
 function render(){index=0;const tree=component.EmailComposer(props);mounted=true;return tree;}
 function all(tree){if(!tree||typeof tree!=='object')return [];if(Array.isArray(tree))return tree.flatMap(all);return [tree,...all(tree.props?.children)];}
 return {render,all,get posts(){return posts},async mount(){render();effects.forEach(fn=>fn());await new Promise(r=>setImmediate(r));},button(tree,label){return all(tree).find(n=>n.type==='button'&&n.props.children===label)}};
}
test('send action opens preview and dispatches only after confirmation',async()=>{
 const h=harness();await h.mount();let tree=h.render();const input=h.all(tree).find(n=>n.type==='input'&&n.props.placeholder);input.props.onChange({target:{value:'recipient@example.com'}});tree=h.render();const first=h.button(tree,'המשך לשליחה');assert.equal(first.props.disabled,false);await first.props.onClick();assert.equal(h.posts,0);tree=h.render();const confirm=h.button(tree,'אישור ושליחה');assert.ok(confirm);await confirm.props.onClick();await new Promise(r=>setImmediate(r));assert.equal(h.posts,1);
});
test('missing permission explains why instead of an inert button',async()=>{
 const h=harness(false);await h.mount();let tree=h.render();await h.button(tree,'המשך לשליחה').props.onClick();tree=h.render();assert.ok(h.all(tree).some(n=>n.props.role==='status'&&String(n.props.children).includes('אין הרשאת שליחה')));assert.equal(h.posts,0);
});

