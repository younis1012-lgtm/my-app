const fs = require("fs");
const path = require("path");

const root = process.cwd();
const packagePath = path.join(root, "package.json");
const vercelPath = path.join(root, "vercel.json");

if (!fs.existsSync(packagePath)) {
  console.error("ERROR: package.json not found. Run from project root: C:\\Users\\Update\\my-app");
  process.exit(1);
}

const pkg = JSON.parse(fs.readFileSync(packagePath, "utf8"));
pkg.scripts = pkg.scripts || {};
pkg.scripts.build = "next build --webpack";
pkg.dependencies = pkg.dependencies || {};
pkg.devDependencies = pkg.devDependencies || {};

if (!pkg.dependencies.nodemailer) pkg.dependencies.nodemailer = "^6.10.1";
if (!pkg.devDependencies["@types/nodemailer"]) pkg.devDependencies["@types/nodemailer"] = "^6.4.17";

fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + "\\n", "utf8");

let vercel = {};
if (fs.existsSync(vercelPath)) {
  try {
    vercel = JSON.parse(fs.readFileSync(vercelPath, "utf8"));
  } catch {
    vercel = {};
  }
}

vercel.buildCommand = "npm run build";
vercel.installCommand = "npm install";
vercel.framework = "nextjs";

fs.writeFileSync(vercelPath, JSON.stringify(vercel, null, 2) + "\\n", "utf8");

console.log("Forced package.json build script to: next build --webpack");
console.log("Updated vercel.json buildCommand to: npm run build");
console.log("");
console.log("Now run:");
console.log("npm install");
console.log("npm run build");
console.log("git add package.json package-lock.json vercel.json");
console.log("git commit -m \\"force webpack build\\"");
console.log("git push");
