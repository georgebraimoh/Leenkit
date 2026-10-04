// Core database tests: signup profiles + usernames, legal acceptance,
// Hosting Guidelines, safety reports, verified-organizer guard.
// Run: node tests/db/core.test.mjs  (in-memory database, no network)
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createTestDb } from './harness.mjs';

const { db, ok, as, asErr, mkUser, finish, repo } = await createTestDb('core');

// ---- F4/F1: trigger-created profiles, collision-safe usernames ----
const john1 = await mkUser('john@gmail.com', { name: 'John', avatar: 'https://x/a.png' });
const john2 = await mkUser('john@yahoo.com', { name: 'John', avatar: 'https://x/b.png' });
const googleJohn = await mkUser('jdoe@example.com', { full_name: 'John', picture: 'https://x/g.png' });
const oldClient = await mkUser('john@old.com', { name: 'John O', username: 'john' }); // metadata from currently deployed frontend
const weird = await mkUser(null, { name: '  !!!  ' });
const alice = await mkUser('alice@example.com', { name: 'Alice Smith' });
const profs = (await db.query(`SELECT id, name, username, avatar FROM public.profiles ORDER BY created_at`)).rows;
const byId = Object.fromEntries(profs.map((p) => [p.id, p]));
ok('one profile per auth user', profs.length === 6 && [john1, john2, googleJohn, oldClient, weird, alice].every((id) => byId[id]));
const names = profs.map((p) => p.username);
ok('usernames unique (case-insensitive)', new Set(names.map((n) => n?.toLowerCase())).size === names.length, names.join(', '));
ok('first "John" keeps readable username', byId[john1].username === 'john');
ok('second "John" gets suffix, not failure', /^john_[0-9a-f]{4}$/.test(byId[john2].username), byId[john2].username);
ok('Google full_name + picture used', byId[googleJohn].name === 'John' && byId[googleJohn].avatar === 'https://x/g.png' && /^john_/.test(byId[googleJohn].username));
ok('old-client username metadata honoured + deduped', /^john_/.test(byId[oldClient].username));
ok('name/avatar from email-signup metadata', byId[john1].name === 'John' && byId[john1].avatar === 'https://x/a.png');
ok('unusable name -> "member"', byId[weird].username === 'member', byId[weird].username);
ok('email local-part not used when name present', byId[alice].username === 'alice_smith', byId[alice].username);

// Exhaust suffixes: force collisions by pre-claiming every candidate is impractical; instead
// verify a profile is still created when the base and many variants exist.
for (let i = 0; i < 30; i++) await mkUser(`dup${i}@x.com`, { name: 'Dup' });
const dupCount = (await db.query(`SELECT count(*)::int c, count(DISTINCT lower(username))::int u FROM public.profiles WHERE name = 'Dup'`)).rows[0];
ok('30 same-name signups all succeed with unique usernames', dupCount.c === 30 && dupCount.u === 30);

// Clients can no longer insert profile rows at all; handle_new_user() is the only creator.
await asErr('clients cannot insert profile rows (trigger is the only creator)', 'authenticated', alice,
  `INSERT INTO public.profiles (id, name, username) VALUES ('${alice}', 'Alice', 'alice_x')`, /permission denied/);

// ---- Legal acceptance ----
const RPC = (t = '2026-10-02', p = '2026-10-02', s = 'signup') => `SELECT * FROM public.record_legal_acceptance('${t}', '${p}', '${s}')`;
await asErr('anon cannot execute record_legal_acceptance', 'anon', '', RPC(), /permission denied/);
await asErr('authenticated without uid rejected', 'authenticated', '', RPC(), /Authentication required/);
await asErr('wrong terms version rejected', 'authenticated', john1, RPC('2099-01-01'), /Unsupported/);
await asErr('wrong privacy version rejected', 'authenticated', john1, RPC('2026-10-02', '1.0'), /Unsupported/);
await asErr('bad source rejected', 'authenticated', john1, RPC('2026-10-02', '2026-10-02', 'admin'), /Unsupported acceptance source/);
const r1 = (await as('authenticated', john1, RPC())).rows[0];
ok('acceptance recorded for caller', r1.user_id === john1 && r1.terms_version === '2026-10-02' && r1.accepted_at);
await db.exec(`SELECT pg_sleep(0.01)`);
const r2 = (await as('authenticated', john1, RPC('2026-10-02', '2026-10-02', 'in_app'))).rows[0];
ok('repeat call returns original row (no overwrite)', r2.id === r1.id && String(r2.accepted_at) === String(r1.accepted_at) && r2.source === 'signup');
ok('own rows readable', (await as('authenticated', john1, `SELECT * FROM public.legal_acceptances`)).rows.length === 1);
ok("other users' rows invisible", (await as('authenticated', john2, `SELECT * FROM public.legal_acceptances`)).rows.length === 0);
await asErr('anon cannot read legal_acceptances', 'anon', '', `SELECT * FROM public.legal_acceptances`, /permission denied/);
await asErr('direct INSERT denied', 'authenticated', john2, `INSERT INTO public.legal_acceptances (user_id, terms_version, privacy_version, source) VALUES ('${john2}', '2026-10-02', '2026-10-02', 'signup')`, /permission denied/);
await asErr('direct UPDATE denied', 'authenticated', john1, `UPDATE public.legal_acceptances SET accepted_at = now() - interval '1 year'`, /permission denied/);
await asErr('direct DELETE denied', 'authenticated', john1, `DELETE FROM public.legal_acceptances`, /permission denied/);
const idx = (await db.query(`SELECT indexname FROM pg_indexes WHERE tablename = 'legal_acceptances' ORDER BY 1`)).rows.map((r) => r.indexname);
ok('no redundant legal_acceptances_user_idx', !idx.includes('legal_acceptances_user_idx'), idx.join(', '));
// History: simulate a future version bump via a new function body; old row must remain.
await db.exec(readFileSync(resolve(repo, 'supabase/migrations/20261001000000_legal_acceptances.sql'), 'utf8').split('-- 3. record_legal_acceptance')[1].replace(/^[^\n]*\n/, '').replace(/'2026-10-01'/g, "'2027-01-01'").replace(/^--.*$/gm, ''));
await as('authenticated', john1, RPC('2027-01-01', '2027-01-01', 'in_app'));
const hist = (await as('authenticated', john1, `SELECT terms_version FROM public.legal_acceptances ORDER BY accepted_at`)).rows.map((r) => r.terms_version);
ok('version bump adds a row, keeps history', hist.join() === '2026-10-02,2027-01-01', hist.join());

// ---- Hosting Guidelines (F2) ----
const rt = (await db.query(`SELECT pg_get_function_result('public.accept_hosting_guidelines(text)'::regprocedure) r`)).rows[0].r;
ok('accept_hosting_guidelines returns void', rt === 'void', rt);
await asErr('anon cannot accept hosting guidelines', 'anon', '', `SELECT public.accept_hosting_guidelines('1.0')`, /permission denied/);
await asErr('wrong guidelines version rejected', 'authenticated', alice, `SELECT public.accept_hosting_guidelines('2.0')`, /Unsupported/);
const before = (await db.query(`SELECT hosting_guidelines_accepted_at FROM public.profiles WHERE id = $1`, [alice])).rows[0];
await as('authenticated', alice, `SELECT public.accept_hosting_guidelines('1.0')`);
const after = (await as('authenticated', alice, `SELECT hosting_guidelines_accepted_at, hosting_guidelines_version FROM public.profiles WHERE id = '${alice}'`)).rows[0];
ok('guidelines accepted: timestamp + version stored, readable by client', !before.hosting_guidelines_accepted_at && after.hosting_guidelines_accepted_at && after.hosting_guidelines_version === '1.0');
const hangoutCols = (await db.query(`SELECT column_name, is_nullable, column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='hangouts' AND is_nullable='NO' AND column_default IS NULL`)).rows.map((r) => r.column_name);
const vals = { host_id: null, title: "'T'", category: "'Food'", date: "'2026-12-01'", time: "'18:00'" };
const hangoutInsert = (host) => {
  const cols = hangoutCols.filter((c) => c !== 'id');
  const v = cols.map((c) => (c === 'host_id' ? `'${host}'` : vals[c] ?? `'x'`));
  return `INSERT INTO public.hangouts (${cols.join(',')}) VALUES (${v.join(',')})`;
};
await asErr('host without guidelines cannot create Hangout (RLS)', 'authenticated', john2, hangoutInsert(john2), /row-level security/);
try { await as('authenticated', alice, hangoutInsert(alice)); ok('host with guidelines can create Hangout', true); }
catch (e) { ok('host with guidelines can create Hangout', false, e.message.split('\n')[0] + ` (cols: ${hangoutCols})`); }

// ---- Safety reports (F3) ----
const rep = (cols, vals) => `INSERT INTO public.safety_reports (${cols}) VALUES (${vals})`;
await as('authenticated', john2, rep('target_type, target_id, reason, description', `'user', '${alice}', 'Scam or spam', 'details'`));
const stored = (await db.query(`SELECT reporter_id, status, target_type FROM public.safety_reports`)).rows;
ok('report stored server-side with reporter = caller, status pending', stored.length === 1 && stored[0].reporter_id === john2 && stored[0].status === 'pending');
await asErr('anon cannot submit report', 'anon', '', rep('target_type, target_id, reason', `'user', '${alice}', 'x'`), /permission denied/);
await asErr('cannot spoof reporter_id', 'authenticated', john2, rep('reporter_id, target_type, target_id, reason', `'${alice}', 'user', '${alice}', 'x'`), /permission denied/);
await asErr('cannot set status', 'authenticated', john2, rep('status, target_type, target_id, reason', `'resolved', 'user', '${alice}', 'x'`), /permission denied/);
await asErr('reporter cannot read reports', 'authenticated', john2, `SELECT * FROM public.safety_reports`, /permission denied/);
await asErr('reported user cannot read reports', 'authenticated', alice, `SELECT * FROM public.safety_reports`, /permission denied/);
await asErr('cannot update reports', 'authenticated', john2, `UPDATE public.safety_reports SET status = 'dismissed'`, /permission denied/);
await asErr('cannot delete reports', 'authenticated', john2, `DELETE FROM public.safety_reports`, /permission denied/);
await asErr('invalid target_type rejected', 'authenticated', john2, rep('target_type, target_id, reason', `'hangout', '${alice}', 'x'`), /check constraint/);
await asErr('oversized description rejected', 'authenticated', john2, rep('target_type, target_id, reason, description', `'user', '${alice}', 'x', repeat('a', 2001)`), /check constraint/);
ok('service_role (admin path) can read reports', (await as('service_role', '', `SELECT count(*)::int c FROM public.safety_reports`)).rows[0].c === 1);

// ---- F8: LEENKIT error message ----
try {
  await db.exec(`SELECT set_config('request.jwt.claim.role', 'authenticated', false); UPDATE public.profiles SET is_verified_organizer = true WHERE id = '${alice}'`);
  ok('verified organizer protected', false, 'no error');
} catch (e) { ok('verified organizer message says LEENKIT', /changed by LEENKIT/.test(e.message), e.message.split('\n')[0]); }

finish();
