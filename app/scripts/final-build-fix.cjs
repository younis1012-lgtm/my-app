const fs = require("fs");
const path = require("path");

const root = process.cwd();
const packagePath = path.join(root, "package.json");
const pagePath = path.join(root, "app", "page.tsx");
const nestedNodeModules = path.join(root, "app", "node_modules");
const nestedPackage = path.join(root, "app", "package.json");
const nestedLock = path.join(root, "app", "package-lock.json");

function removeIfExists(target) {
  if (!fs.existsSync(target)) return;
  fs.rmSync(target, { recursive: true, force: true });
  console.log("Removed:", path.relative(root, target));
}

// 1) Remove nested app dependencies that caused NextRequest type conflicts.
removeIfExists(nestedNodeModules);
removeIfExists(nestedPackage);
removeIfExists(nestedLock);

// 2) Force stable webpack build instead of turbopack build.
// Turbopack is crashing on RTL/Hebrew code-frame rendering before showing the real error.
if (!fs.existsSync(packagePath)) {
  console.error("ERROR: package.json not found. Run this script from C:\\Users\\Update\\my-app");
  process.exit(1);
}

const pkg = JSON.parse(fs.readFileSync(packagePath, "utf8"));
pkg.scripts = pkg.scripts || {};
pkg.scripts.build = "next build --webpack";
pkg.dependencies = pkg.dependencies || {};
pkg.devDependencies = pkg.devDependencies || {};

if (!pkg.dependencies.nodemailer) {
  pkg.dependencies.nodemailer = "^6.10.1";
}
if (!pkg.devDependencies["@types/nodemailer"]) {
  pkg.devDependencies["@types/nodemailer"] = "^6.4.17";
}

fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + "\n", "utf8");
console.log("Updated package.json build script to: next build --webpack");

// 3) Fix current PreliminaryRecord typing if it is still present.
if (fs.existsSync(pagePath)) {
  let src = fs.readFileSync(pagePath, "utf8");
  const before = src;

  src = src.replace(/const record:\s*PreliminaryRecord\s*=\s*\{/g, "const record = {");

  // Cast the object at the closing before the next save operation.
  src = src.replace(
    /(\n\s*savedAt:\s*nowLocal\(\),\s*\n\s*)\};(\s*\n\s*(?:await\s+withSaving|setPreliminaryRecords|const\s+nextRecords|try\s*\{))/g,
    "$1} as PreliminaryRecord;$2"
  );

  // If requiredDocuments/approval appears after savedAt variations, try a slightly wider safe pattern.
  src = src.replace(
    /(const record = \{[\s\S]{0,2000}\n\s*savedAt:\s*nowLocal\(\),\s*\n\s*)\};/g,
    (match) => match.includes("as PreliminaryRecord") ? match : match.replace(/\};$/, "} as PreliminaryRecord;")
  );

  if (src !== before) {
    fs.writeFileSync(pagePath, src, "utf8");
    console.log("Patched app/page.tsx PreliminaryRecord typing.");
  } else {
    console.log("No PreliminaryRecord typing patch needed.");
  }
}

console.log("Patch complete.");
