import { listAccessUsers, saveAccessUsers } from "../../../lib/accessUsersServer";

export const runtime = "nodejs";
export const GET = listAccessUsers;
export const POST = saveAccessUsers;
