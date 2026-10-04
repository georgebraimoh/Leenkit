// Fails if a tracked file looks like it contains a credential.
// Reports file and line only; never prints the matched value.
// Run: node scripts/check-secrets.mjs
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const PATTERNS = [
  ['Paystack secret/public key', /\b(sk|pk)_(live|test)_[A-Za-z0-9]{16,}/],
  ['Resend API key', /\bre_[A-Za-z0-9]{8,}_[A-Za-z0-9]{8,}/],
  ['JWT (e.g. Supabase service_role key)', /\beyJ[A-Za-z0-9_-]{15,}\.eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{10,}/],
  ['Supabase access token', /\bsbp_[A-Za-z0-9]{30,}/],
  ['Private key block', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ['Postgres URL with password', /postgres(?:ql)?:\/\/[^:\s/@]+:[^@\s/]+@/],
  ['AWS access key', /\bAKIA[0-9A-Z]{16}\b/],
];

// Files that may legitimately mention key-like placeholders.
const IGNORE = [/^package-lock\.json$/, /^scripts\/check-secrets\.mjs$/];

const files = execSync('git ls-files -z', { encoding: 'utf8' }).split('\0').filter(Boolean);
const findings = [];

for (const file of files) {
  if (IGNORE.some((re) => re.test(file))) continue;
  if (/(^|\/)\.env($|\.)/.test(file) && file !== '.env.example') {
    findings.push(`${file}: environment file is tracked`);
    continue;
  }
  let text;
  try { text = readFileSync(file, 'utf8'); } catch { continue; }
  if (text.includes('\u0000')) continue; // binary
  const lines = text.split(/\r?\n/);
  lines.forEach((line, i) => {
    for (const [label, re] of PATTERNS) {
      if (re.test(line)) findings.push(`${file}:${i + 1}: possible ${label}`);
    }
  });
}

if (findings.length) {
  console.error(`Possible secrets found (${findings.length}):`);
  findings.forEach((f) => console.error(`  ${f}`));
  process.exit(1);
}
console.log(`No secrets found in ${files.length} tracked files.`);
