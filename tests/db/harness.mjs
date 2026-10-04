// Shared harness for database tests.
//
// Replays every migration in supabase/migrations (filename order) into an
// in-memory PGlite (WASM Postgres) with Supabase-like stubs: anon /
// authenticated / service_role roles, auth.users, auth.uid() / auth.role()
// driven by JWT-claim settings (as PostgREST does), storage tables, and
// Supabase's broad default privileges. Never connects to a real database.
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const MIGRATIONS = resolve(REPO, 'supabase', 'migrations');

export async function createTestDb(suiteName) {
  const db = new PGlite();
  let pass = 0;
  let fail = 0;
  const failures = [];

  const ok = (name, cond, extra = '') => {
    if (cond) pass++;
    else { fail++; failures.push(name); }
    console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  — ' + extra : ''}`);
  };

  // Run SQL as a role/user the way PostgREST does (role + JWT claims).
  const as = async (role, uid, sql, params) => {
    await db.exec(`RESET ROLE; SELECT set_config('request.jwt.claim.sub', '${uid || ''}', false), set_config('request.jwt.claim.role', '${role}', false);`);
    if (role !== 'postgres') await db.exec(`SET ROLE ${role};`);
    try { return await db.query(sql, params); } finally { await db.exec('RESET ROLE;'); }
  };

  const asErr = async (name, role, uid, sql, re) => {
    try { await as(role, uid, sql); ok(name, false, 'no error raised'); }
    catch (e) { ok(name, re ? re.test(e.message) : true, e.message.split('\n')[0]); }
  };

  const tryOk = async (name, fn) => {
    try { const r = await fn(); ok(name, r !== false); return r; }
    catch (e) { ok(name, false, e.message.split('\n')[0]); return null; }
  };

  // New auth user -> handle_new_user() creates the profile.
  const mkUser = async (email, meta) =>
    (await db.query(`INSERT INTO auth.users (email, raw_user_meta_data) VALUES ($1, $2) RETURNING id`, [email, meta])).rows[0].id;

  await db.exec(`
    CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;
    CREATE SCHEMA auth;
    CREATE TABLE auth.users (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text, raw_user_meta_data jsonb DEFAULT '{}'::jsonb);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.role', true), '') $$;
    CREATE SCHEMA storage;
    CREATE TABLE storage.buckets (id text PRIMARY KEY, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    CREATE TABLE storage.objects (id uuid DEFAULT gen_random_uuid(), bucket_id text, name text, owner uuid);
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
    CREATE PUBLICATION supabase_realtime;
    GRANT USAGE ON SCHEMA public, auth, storage TO anon, authenticated, service_role;
    GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth TO anon, authenticated, service_role;
    GRANT SELECT, INSERT, DELETE ON storage.objects TO anon, authenticated;
    GRANT ALL ON storage.objects TO service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;
  `);

  console.log(`\n# ${suiteName}`);
  const files = readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort();
  const prefixes = files.map((f) => f.split('_')[0]);
  ok('migration timestamps are unique', new Set(prefixes).size === prefixes.length);
  let replayed = true;
  for (const f of files) {
    try { await db.exec(readFileSync(resolve(MIGRATIONS, f), 'utf8')); }
    catch (e) { replayed = false; ok(`apply ${f}`, false, e.message.split('\n')[0]); }
  }
  ok(`all ${files.length} migrations replay on a fresh database`, replayed);

  const finish = () => {
    console.log(`\nRESULT ${suiteName}: pass=${pass} fail=${fail}`);
    if (fail > 0) {
      console.log(`Failed: ${failures.join('; ')}`);
      process.exitCode = 1;
    }
  };

  return { db, ok, as, asErr, tryOk, mkUser, finish, repo: REPO };
}
