const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const page = fs.readFileSync(path.join(root, 'app/page.tsx'), 'utf8');
const css = fs.readFileSync(path.join(root, 'app/globals.css'), 'utf8');

test('project navigation is grouped and keeps core field modules visible', () => {
  for (const label of ['מבנה הפרויקט', 'בקרת איכות', 'תכנון ומסמכים', 'עץ מבנה פרויקט', 'נקודות עצירה']) {
    assert.ok(page.includes(label), label);
  }
  assert.match(page, /className="project-navigation"/);
  assert.match(css, /\.project-navigation\s*\{/);
  assert.match(css, /@media \(max-width:900px\)/);
});

test('home dashboard promotes project tree and hold points', () => {
  assert.match(page, /\["projectStructure", "holdPoints", "checklists", "trialSections"\]/);
  assert.match(page, /תמונת מצב לפרויקט/);
  assert.match(page, /גישה מהירה/);
});
