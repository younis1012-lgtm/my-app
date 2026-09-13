import { createLegacySupabaseSession } from "../../../lib/legacyAuthServer";

export const runtime = "nodejs";
export const POST = createLegacySupabaseSession;
