const fs = require('fs');
const path = require('path');

const root = process.cwd();
const pagePath = path.join(root, 'app', 'page.tsx');
const templatesPagePath = path.join(root, 'app', 'engineering-templates', 'page.tsx');

if (!fs.existsSync(pagePath)) {
  console.error('ERROR: app/page.tsx was not found. Run this from C:\\Users\\Update\\my-app');
  process.exit(1);
}

let page = fs.readFileSync(pagePath, 'utf8');
const backupPath = path.join(root, 'app', `page.backup.before-templates-${new Date().toISOString().replace(/[:.]/g, '-').slice(0,19)}.tsx`);
fs.writeFileSync(backupPath, page, 'utf8');

const label = '\uD83C\uDFD7\uFE0F \u05E1\u05E4\u05E8\u05D9\u05D9\u05EA \u05EA\u05D1\u05E0\u05D9\u05D5\u05EA / \u05E2\u05E5 \u05E4\u05E8\u05D5\u05D9\u05E7\u05D8 \u05D7\u05D3\u05E9';

const newButton = `\n        <button\n          type="button"\n          style={{\n            ...styles.navBtn,\n            background: "#fff",\n            color: "#0f172a",\n          }}\n          onClick={() => {\n            window.location.href = "/engineering-templates";\n          }}\n        >\n          ${label}\n        </button>`;

const oldNavButtonRegex = /\n\s*<button\s+type="button"\s+style=\{\{\s*\.\.\.styles\.navBtn,\s*background:\s*section === "projectStructure" \? "#0f172a" : "#fff",\s*color:\s*section === "projectStructure" \? "#fff" : "#0f172a",\s*\}\}\s*onClick=\{\(\) => setSection\("projectStructure"\)\}\s*>[\s\S]*?<\/button>/m;

if (!oldNavButtonRegex.test(page)) {
  console.error('ERROR: Could not find the old Project Tree navigation button. No changes were made except backup.');
  console.error('Backup created at: ' + backupPath);
  process.exit(1);
}

page = page.replace(oldNavButtonRegex, newButton);

const oldProjectStructureRenderRegex = /\n\s*\{section === "projectStructure" && \(\s*<ProjectStructureSection[\s\S]*?onGenerateFromPlans=\{generateProjectStructureFromPlans\}\s*\/?>\s*\)\}/m;

if (oldProjectStructureRenderRegex.test(page)) {
  page = page.replace(oldProjectStructureRenderRegex, '\n          {false && section === "projectStructure" && null}');
} else {
  console.warn('WARNING: Old ProjectStructureSection render block was not found. The old menu button was still replaced.');
}

fs.writeFileSync(pagePath, page, 'utf8');

console.log('DONE');
console.log('Backup created: ' + backupPath);
console.log('Old Project Tree menu button was replaced with: ' + label);
console.log('Now run: npm run build');
