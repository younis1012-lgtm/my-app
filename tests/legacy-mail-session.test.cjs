const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

function loadServer(accessRows) {
  let createdUser;
  let memberships;
  const db = {
    auth: { admin: {
      getUserById: async () => ({ data: { user: null }, error: { message: "not found" } }),
      createUser: async (value) => { createdUser = value; return { data: { user: { id: value.id } }, error: null }; },
      updateUserById: async () => { throw new Error("unexpected update"); },
    } },
    from(table) {
      if (table === "project_access_users") return { select: async () => ({ data: accessRows, error: null }) };
      if (table === "projects") return { select: async () => ({ data: [{ id: "cb3f4c8e-8b7f-4af2-ac92-a2da69f2dc7c", name: "מגד אלכרום", description: "" }], error: null }) };
      if (table === "project_members") return { upsert: async (value) => { memberships = value; return { error: null }; } };
      throw new Error(`unexpected table ${table}`);
    },
  };
  const source = fs.readFileSync(path.join(__dirname, "..", "app/lib/legacyAuthServer.ts"), "utf8");
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  vm.runInNewContext(output, {
    exports,
    require(name) {
      if (name === "node:crypto") return require("node:crypto");
      if (name === "@supabase/supabase-js") return { createClient: () => db };
      throw new Error(`unexpected import ${name}`);
    },
    Request, Response, URL, Buffer,
    process: { env: { NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "secret" } },
  });
  return { handler: exports.createLegacySupabaseSession, get createdUser() { return createdUser; }, get memberships() { return memberships; } };
}

test("legacy viewer receives a Supabase session and readonly project membership", async () => {
  const server = loadServer([{ username: 'ה"א', password: "pass", display_name: 'ה"א', role: "readonly", code: "viewer", project_name: "", project_ids: ["cb3f4c8e-8b7f-4af2-ac92-a2da69f2dc7c"] }]);
  const response = await server.handler(new Request("https://app.example/api/auth/legacy-session", { method: "POST", headers: { origin: "https://app.example", "content-type": "application/json" }, body: JSON.stringify({ login: 'ה"א', password: "pass" }) }));
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.match(payload.email, /^legacy-[a-f0-9]+@users\.yk-quality\.invalid$/);
  assert.ok(payload.password.length > 30);
  assert.equal(server.createdUser.user_metadata.name, 'ה"א');
  assert.deepEqual(JSON.parse(JSON.stringify(server.memberships)), [{ user_id: server.createdUser.id, project_id: "cb3f4c8e-8b7f-4af2-ac92-a2da69f2dc7c", role: "readonly", active: true }]);
});

test("incorrect legacy credentials cannot create a mail session", async () => {
  const server = loadServer([{ username: 'ה"א', password: "correct", role: "readonly", project_ids: ["cb3f4c8e-8b7f-4af2-ac92-a2da69f2dc7c"] }]);
  const response = await server.handler(new Request("https://app.example/api/auth/legacy-session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ login: 'ה"א', password: "wrong" }) }));
  assert.equal(response.status, 401);
  assert.equal(server.createdUser, undefined);
});

test("cross-origin legacy session requests are rejected", async () => {
  const server = loadServer([]);
  const response = await server.handler(new Request("https://app.example/api/auth/legacy-session", { method: "POST", headers: { origin: "https://evil.example", "content-type": "application/json" }, body: JSON.stringify({ login: "user", password: "pass" }) }));
  assert.equal(response.status, 403);
});

test("legacy project name is resolved when the newer project_ids column is absent", async () => {
  const server = loadServer([{ username: 'ה"א', password: "pass", display_name: 'ה"א', role: "readonly", project_name: "מגד אלכרום" }]);
  const response = await server.handler(new Request("https://app.example/api/auth/legacy-session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ login: 'ה"א', password: "pass" }) }));
  assert.equal(response.status, 200);
  assert.equal(server.memberships[0].project_id, "cb3f4c8e-8b7f-4af2-ac92-a2da69f2dc7c");
});
