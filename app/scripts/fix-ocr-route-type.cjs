const fs = require("fs");
const path = require("path");

const routePath = path.join(process.cwd(), "app", "api", "ocr", "route.ts");

if (!fs.existsSync(routePath)) {
  console.error("ERROR: app/api/ocr/route.ts not found. Run from project root: C:\\Users\\Update\\my-app");
  process.exit(1);
}

let source = fs.readFileSync(routePath, "utf8");
let original = source;

// Remove NextRequest from next/server import to prevent duplicate Next.js type mismatch.
source = source.replace(
  /import\s*\{\s*NextRequest\s*,\s*NextResponse\s*\}\s*from\s*["']next\/server["'];?/g,
  'import { NextResponse } from "next/server";'
);

source = source.replace(
  /import\s*\{\s*NextResponse\s*,\s*NextRequest\s*\}\s*from\s*["']next\/server["'];?/g,
  'import { NextResponse } from "next/server";'
);

source = source.replace(
  /import\s*\{\s*NextRequest\s*\}\s*from\s*["']next\/server["'];?\s*/g,
  ""
);

// Change route handler parameter type from NextRequest to the standard Web Request.
// This is accepted by Next.js route handlers and avoids the app/node_modules vs root/node_modules type conflict.
source = source.replace(
  /export\s+async\s+function\s+POST\s*\(\s*req\s*:\s*NextRequest\s*\)/g,
  "export async function POST(req: Request)"
);

source = source.replace(
  /export\s+async\s+function\s+POST\s*\(\s*request\s*:\s*NextRequest\s*\)/g,
  "export async function POST(request: Request)"
);

source = source.replace(
  /export\s+function\s+POST\s*\(\s*req\s*:\s*NextRequest\s*\)/g,
  "export function POST(req: Request)"
);

source = source.replace(
  /export\s+function\s+POST\s*\(\s*request\s*:\s*NextRequest\s*\)/g,
  "export function POST(request: Request)"
);

// Fallback: any remaining parameter type in this file.
source = source.replace(/:\s*NextRequest/g, ": Request");

if (source === original) {
  console.log("No changes were needed in app/api/ocr/route.ts");
} else {
  fs.writeFileSync(routePath, source, "utf8");
  console.log("Fixed app/api/ocr/route.ts route handler typing.");
}
