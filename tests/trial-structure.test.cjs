const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const exportsObject = {};
vm.runInNewContext(ts.transpileModule(
  fs.readFileSync(path.join(__dirname, '..', 'app/lib/trialStructure.ts'), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
).outputText, { exports: exportsObject });

const nodes = [
  { id: 'road', parentId: '', nodeType: 'road', name: 'כביש 85' },
  { id: 'element', parentId: 'road', nodeType: 'element', name: 'עבודות עפר' },
  { id: 'activity', parentId: 'element', nodeType: 'activity', name: 'ביצוע מצע' },
];

test('trial section can be linked when a generated tree has no section-type nodes', () => {
  assert.deepEqual(
    Array.from(exportsObject.trialStructureOptions(nodes), option => option.label),
    ['כביש 85', 'כביש 85 › עבודות עפר', 'כביש 85 › עבודות עפר › ביצוע מצע'],
  );
});

test('trial tree selection stores the selected node and fills its element context', () => {
  const patch = exportsObject.trialStructureSelectionPatch(nodes, 'activity');
  assert.equal(patch.structureNodeId, 'activity');
  assert.equal(patch.elementName, 'עבודות עפר');
  assert.equal(patch.subElement, 'ביצוע מצע');
});
