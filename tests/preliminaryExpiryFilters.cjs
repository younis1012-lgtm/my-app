const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const ts=require('../node_modules/typescript');
const React=require('../node_modules/react');
const {renderToStaticMarkup}=require('../node_modules/react-dom/server');
const source=fs.readFileSync('app/page.tsx','utf8');
const ast=ts.createSourceFile('page.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const names=['normalizeDateValue','collectCertificateRows','getPreliminaryExpiryDate','isExpiredDate','ExpiryDateCell','tableCellSearchText'];
const snippets=ast.statements.filter(n=>names.includes(n.name?.text)||ts.isVariableStatement(n)&&n.declarationList.declarations.some(d=>names.includes(d.name.text))).map(n=>n.getText(ast)).join('\n');
const js=ts.transpileModule(snippets+'\nexports.f={getPreliminaryExpiryDate,ExpiryDateCell,tableCellSearchText};',{compilerOptions:{jsx:ts.JsxEmit.React,module:ts.ModuleKind.CommonJS}}).outputText;
const context={exports:{},React};vm.runInNewContext(js,context);const f=context.exports.f;
for(const kind of ['supplier','subcontractor','material']){const r={[kind]:{certificates:[{expiryDate:'2027-12-13'}]}}; assert.equal(f.getPreliminaryExpiryDate(r),'2027-12-13');}
assert.match(renderToStaticMarkup(React.createElement(f.ExpiryDateCell,{value:'2027-12-13'})),/2027-12-13/);
assert.match(renderToStaticMarkup(React.createElement(f.ExpiryDateCell,{value:''})),/לא הוזן תוקף/);
assert.match(renderToStaticMarkup(React.createElement(f.ExpiryDateCell,{value:'2020-01-01'})),/#dc2626/);
assert.equal(f.tableCellSearchText(React.createElement(f.ExpiryDateCell,{value:'2027-12-13'})),'2027-12-13');
const projection=source.match(/preliminary_records: "([^"]+)"/)[1];
for(const field of ['supplier','subcontractor','material'])assert.ok(projection.split(',').includes(field));
console.log('PASS: summary contains certificate data; three preliminary types, rendered dates, missing/expired dates, and expiry filtering.');

