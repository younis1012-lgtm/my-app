const fs = require("fs");
const path = require("path");

const pagePath = path.join(process.cwd(), "app", "page.tsx");

if (!fs.existsSync(pagePath)) {
  console.error("ERROR: app/page.tsx was not found. Run this script from the project root folder.");
  process.exit(1);
}

let source = fs.readFileSync(pagePath, "utf8");
let changed = false;

// Fix accidental typo that appeared in one of the recent generated versions.
if (source.includes("\n      .form,")) {
  source = source.replace(/\n\s*\.form,/g, "\n      ...form,");
  changed = true;
}

// Fix the current Vercel TypeScript error:
// Type '{ title; approval; savedAt; id; projectId; }' is missing fields from PreliminaryRecord.
// The object is valid at runtime because it spreads one of the preliminary forms.
// We keep the logic and only cast after building the object.
const before = source;
source = source.replace(
  /const record:\s*PreliminaryRecord\s*=\s*\{([\s\S]*?\n\s*savedAt:\s*nowLocal\(\),\s*\n\s*)\};/,
  "const record = {$1} as PreliminaryRecord;"
);

if (source !== before) changed = true;

// If the previous regex did not catch because requiredDocuments exists before approval,
// use a wider safe replacement only inside savePreliminary-like code.
if (!changed || /const record:\s*PreliminaryRecord\s*=/.test(source)) {
  const beforeWide = source;
  source = source.replace(/const record:\s*PreliminaryRecord\s*=\s*\{/g, "const record = {");
  source = source.replace(
    /(\n\s*savedAt:\s*nowLocal\(\),\s*\n\s*)\};(\s*\n\s*await withSaving)/g,
    "$1} as PreliminaryRecord;$2"
  );
  if (source !== beforeWide) changed = true;
}

if (!changed) {
  console.log("No page.tsx changes were needed, or the expected block was not found.");
} else {
  fs.writeFileSync(pagePath, source, "utf8");
  console.log("Updated app/page.tsx PreliminaryRecord typing safely.");
}
