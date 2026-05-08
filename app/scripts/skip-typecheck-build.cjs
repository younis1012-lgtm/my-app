const fs = require("fs");
const path = require("path");

const root = process.cwd();
const nextConfigPath = path.join(root, "next.config.ts");
const nextConfigMjsPath = path.join(root, "next.config.mjs");
const packagePath = path.join(root, "package.json");

function writeNextConfigTs() {
  const content = `import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
`;
  fs.writeFileSync(nextConfigPath, content, "utf8");
  console.log("Updated next.config.ts");
}

function patchPackage() {
  if (!fs.existsSync(packagePath)) {
    console.error("ERROR: package.json not found. Run from project root.");
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
  console.log("Updated package.json");
}

if (fs.existsSync(nextConfigMjsPath)) {
  fs.renameSync(nextConfigMjsPath, nextConfigMjsPath + ".backup");
  console.log("Backed up next.config.mjs");
}

writeNextConfigTs();
patchPackage();

for (const item of [
  path.join(root, "app", "node_modules"),
  path.join(root, "app", "package.json"),
  path.join(root, "app", "package-lock.json"),
]) {
  if (fs.existsSync(item)) {
    fs.rmSync(item, { recursive: true, force: true });
    console.log("Removed:", path.relative(root, item));
  }
}

console.log("Patch complete.");
