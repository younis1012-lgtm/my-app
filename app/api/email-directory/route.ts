import { readMailDirectory, saveMailDirectory } from "../../lib/emailServer";
export const runtime = "nodejs";
export const GET = readMailDirectory;
export const POST = saveMailDirectory;
