const fs = require('fs');
const ts = require('typescript');
const assert = require('node:assert/strict');
const source = fs.readFileSync('app/lib/systemConcreteStrength.ts', 'utf8');
const compiled = ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
const mod = {exports:{}}; new Function('exports','module', compiled)(mod.exports,mod);
const parse = mod.exports.readSystemConcreteStrength;
const items = JSON.parse(fs.readFileSync('tests/fixtures/system-concrete-table.json','utf8'));
assert.deepEqual(parse(items), {strength7Days:'23.5', strength28Days:''});
const copy = () => structuredClone(items);
let v = copy(); const sample = v.find(i=>i.str==='23.5'); v.push({...sample,str:'34.2',transform:sample.transform.map((n,i)=>i===4?n-43:n)});
assert.equal(parse(v).strength28Days,'34.2');
v[v.length - 1].str = '27.0'; assert.equal(parse(v).strength28Days, '27.0');
v = copy().filter(i=>i.str!=='23.5'); assert.equal(parse(v).strength7Days,'23.4');
v = copy().filter(i=>!i.str.includes('מינימלי')); assert.equal(parse(v),null);
assert.equal(parse([]),null);
v = copy().filter(i=>!['22.0','24.9','26.1','23.1','21.1','23.5'].includes(i.str)); assert.deepEqual(parse(v),{strength7Days:'',strength28Days:''});
console.log('PASS: actual PDF, real 28-day result, average fallback, other template unchanged, scan fallback, empty columns.');


