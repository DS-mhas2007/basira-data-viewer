import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";

const migration = (name) => fileURLToPath(new URL(`../migrations/${name}`, import.meta.url));
const db = new PGlite();

await db.exec(`
  CREATE ROLE anon;
  CREATE ROLE authenticated;
  CREATE ROLE service_role;
  CREATE SCHEMA auth;
  CREATE TABLE auth.users (id uuid PRIMARY KEY);
  CREATE FUNCTION auth.uid() RETURNS uuid
    LANGUAGE sql STABLE AS $$
      SELECT nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')::uuid
    $$;
`);

await db.exec(fs.readFileSync(migration("20260807041118_5454976d-e3c2-4e77-a07b-bddc164d0d23.sql"), "utf8"));
// Reproduce the real schema evolution: project_id is introduced before cloud_project_id.
await db.exec(fs.readFileSync(migration("20261114000000_project_scoped_chat_threads.sql"), "utf8"));
await db.exec(fs.readFileSync(migration("20261118005000_cloud_project_identity.sql"), "utf8"));
await db.exec(fs.readFileSync(migration("20261118010000_project_source_revision_tombstones.sql"), "utf8"));

const A = "00000000-0000-0000-0000-00000000000a";
const B = "00000000-0000-0000-0000-00000000000b";
const projectA = "10000000-0000-0000-0000-00000000000a";
const threadA = "20000000-0000-0000-0000-00000000000a";
const threadB = "20000000-0000-0000-0000-00000000000b";
await db.exec(`
  INSERT INTO auth.users (id) VALUES ('${A}'), ('${B}');
  INSERT INTO public.workspaces (id, owner_id, kind, name)
    VALUES ('30000000-0000-0000-0000-00000000000a', '${A}', 'personal', 'A workspace');
  INSERT INTO public.projects (id, workspace_id, local_project_id, name)
    VALUES ('${projectA}', '30000000-0000-0000-0000-00000000000a', 'prj_A', 'A project');
  INSERT INTO public.project_sources
    (project_id, local_source_id, kind, name, status, execution)
    VALUES ('${projectA}', 'src_A', 'csv', 'cohort.csv', 'needs-relink', 'browser');
  INSERT INTO public.chat_threads (id, user_id, title)
    VALUES ('${threadA}', '${A}', 'A private thread'),
           ('${threadB}', '${B}', 'B legacy thread');
`);

const asUser = async (id) => {
  await db.exec(`SELECT set_config('request.jwt.claims', '${JSON.stringify({ sub: id })}', false)`);
  await db.exec("SET ROLE authenticated");
};
const reset = async () => db.exec("RESET ROLE");
const count = async (sql) => Number((await db.query(sql)).rows[0].count);
let failures = 0;
const check = (condition, message) => {
  console.log(condition ? "PASS" : "FAIL", message);
  if (!condition) failures++;
};
const denied = async (fn) => {
  try { await fn(); return false; } catch { return true; }
};

// Owner A can read their workspace, project and source descriptor.
await asUser(A);
check(await count("SELECT count(*)::int AS count FROM public.workspaces") === 1, "A reads own workspace");
check(await count("SELECT count(*)::int AS count FROM public.projects") === 1, "A reads own project");
check(await count("SELECT count(*)::int AS count FROM public.project_sources") === 1, "A reads own source descriptor");
check(Number((await db.query("SELECT revision FROM public.projects LIMIT 1")).rows[0].revision) === 1,
  "existing cloud projects start at revision 1");
check((await db.query("SELECT deleted_at FROM public.project_sources LIMIT 1")).rows[0].deleted_at === null,
  "existing source descriptors start active without a tombstone");
await db.exec(`UPDATE public.project_sources SET deleted_at = now(), revision = revision + 1 WHERE project_id = '${projectA}'`);
check(await count("SELECT count(*)::int AS count FROM public.project_sources WHERE deleted_at IS NOT NULL") === 1,
  "owner can retain a source tombstone instead of hard-deleting it");
check(await denied(() => db.exec(`
  INSERT INTO public.project_sources (project_id, local_source_id, kind, name, status, execution, config)
  VALUES ('${projectA}', 'src_secret', 'csv', 'secret.csv', 'ready', 'browser', '{"api_key":"must-not-persist"}')
`)), "database rejects secret-like source config keys");
await reset();

// User B cannot enumerate or create data under A's workspace/project or read A's thread.
await asUser(B);
check(await count("SELECT count(*)::int AS count FROM public.projects") === 0, "B cannot read A's project");
check(await count("SELECT count(*)::int AS count FROM public.project_sources") === 0, "B cannot read A's source descriptor");
check(await count(`SELECT count(*)::int AS count FROM public.chat_threads WHERE id = '${threadA}'`) === 0,
  "B cannot read A's private thread");
check(await denied(() => db.exec(`
  INSERT INTO public.projects (workspace_id, local_project_id, name)
  VALUES ('30000000-0000-0000-0000-00000000000a', 'prj_B_attack', 'forbidden')
`)), "B cannot create a project inside A's workspace");
check(await denied(() => db.exec(`
  INSERT INTO public.project_sources (project_id, local_source_id, kind, name, status, execution)
  VALUES ('${projectA}', 'src_B_attack', 'csv', 'forbidden.csv', 'ready', 'browser')
`)), "B cannot attach a source descriptor to A's project");

// B cannot attach their own thread to A's cloud project.
check(await denied(() => db.exec(`
  UPDATE public.chat_threads SET cloud_project_id = '${projectA}' WHERE id = '${threadB}'
`)), "B cannot link their thread to A's cloud project");
check(await denied(() => db.exec(`
  INSERT INTO public.chat_threads (user_id, title, cloud_project_id)
  VALUES ('${B}', 'forbidden link', '${projectA}')
`)), "B cannot create a thread linked to A's cloud project");

// Legacy threads without a cloud project remain accessible and writable.
check(await count(`SELECT count(*)::int AS count FROM public.chat_threads WHERE id = '${threadB}'`) === 1,
  "B can still read a legacy thread with NULL cloud_project_id");
await db.exec(`
  INSERT INTO public.chat_threads (user_id, title)
  VALUES ('${B}', 'new legacy-compatible thread')
`);
check(await count("SELECT count(*)::int AS count FROM public.chat_threads") === 2,
  "B can still create a thread with NULL cloud_project_id");

if (failures) {
  console.error(`RLS failures: ${failures}`);
  process.exitCode = 1;
} else {
  console.log("ALL CLOUD PROJECT RLS CHECKS PASSED");
}
await db.close();
