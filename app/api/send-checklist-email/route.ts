import { postMail, readMailHistory } from "../../lib/emailServer";

export const runtime = "nodejs";
export const maxDuration = 60;
export const POST = postMail;
export const GET = readMailHistory;
