// Legal document versions. Bump a version ONLY when the document changes
// materially and users must re-accept it. The same values must be allowed by
// public.record_legal_acceptance() in the database (see the legal_acceptances
// migration); a new version requires a new migration.
export const TERMS_VERSION = '2026-10-01';
export const PRIVACY_VERSION = '2026-10-01';

// Human-readable "Last updated" dates shown on the documents.
export const TERMS_LAST_UPDATED = 'October 1, 2026';
export const PRIVACY_LAST_UPDATED = 'October 1, 2026';

// Shown when signup needs email confirmation: acceptance can only be recorded
// once the user has a session, so the legal gate asks on first sign-in.
export const EMAIL_CONFIRMATION_NOTICE =
  'Check your email to confirm your account, then sign in. When you first sign in, you will be asked to confirm that you agree to the Terms & Conditions and Privacy Policy.';

// Official legal/privacy contact address (confirmed by the product owner).
export const LEGAL_CONTACT_EMAIL = 'qleenqapp@gmail.com';
