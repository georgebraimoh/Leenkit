import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Lock } from 'lucide-react';
import PageTransition from '../components/layout/PageTransition';
import { PRIVACY_LAST_UPDATED, LEGAL_CONTACT_EMAIL } from '../data/legal';

const SECTIONS = [
  { id: 'introduction', number: '1', title: 'Introduction' },
  { id: 'you-provide', number: '2', title: 'Information You Provide' },
  { id: 'sign-in', number: '3', title: 'Sign-In With Google' },
  { id: 'payments', number: '4', title: 'Tickets, Sponsorships & Payments' },
  { id: 'verification', number: '5', title: 'Organizer Verification' },
  { id: 'reports', number: '6', title: 'Safety Reports' },
  { id: 'storage', number: '7', title: 'Browser Storage & Technical Information' },
  { id: 'use', number: '8', title: 'How We Use Information' },
  { id: 'visibility', number: '9', title: 'Who Can See Your Information' },
  { id: 'providers', number: '10', title: 'Service Providers' },
  { id: 'retention', number: '11', title: 'Retention' },
  { id: 'choices', number: '12', title: 'Your Choices & Rights' },
  { id: 'security', number: '13', title: 'Security' },
  { id: 'children', number: '14', title: 'Children' },
  { id: 'international', number: '15', title: 'International Processing' },
  { id: 'changes', number: '16', title: 'Changes to This Policy' },
  { id: 'contact', number: '17', title: 'Contact' }
];

const linkClass = 'font-semibold text-[#087F73] hover:text-[#18A999] underline underline-offset-2';

function Section({ id, number, title, children }) {
  return (
    <section id={`privacy-${id}`} className="scroll-mt-24 space-y-3">
      <h2 className="text-xl font-bold font-heading text-[#172121]">
        {number}. {title}
      </h2>
      {children}
    </section>
  );
}

const section = (id) => SECTIONS.find((s) => s.id === id);

export default function Privacy() {
  useEffect(() => {
    const previous = document.title;
    document.title = 'Privacy Policy | LEENKIT';
    return () => {
      document.title = previous;
    };
  }, []);

  return (
    <PageTransition>
      <article className="max-w-3xl mx-auto px-4 sm:px-6 py-12 space-y-10">
        <header className="text-center space-y-4 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#DDF4EF] text-[#087F73] text-xs font-semibold">
            <Lock className="w-4 h-4" aria-hidden="true" />
            <span>Your privacy</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold font-heading text-[#172121]">
            Privacy Policy
          </h1>
          <p className="text-base text-[#3D4948] leading-relaxed">
            What information LEENKIT collects, how it is used, and who can see it.
          </p>
          <p className="text-xs font-semibold text-[#687473]">Last updated: {PRIVACY_LAST_UPDATED}</p>
        </header>

        <p className="text-xs sm:text-sm text-[#3D4948] leading-relaxed bg-[#EEF1EF] border border-[#DDE3E0] rounded-2xl px-4 py-3">
          This Privacy Policy describes how the current version of LEENKIT works. It should be reviewed against the legal requirements that apply to LEENKIT and its users before being treated as final legal advice.
        </p>

        <nav aria-label="Privacy Policy sections" className="bg-white border border-[#DDE3E0] rounded-3xl p-5 sm:p-6">
          <h2 className="text-sm font-bold font-heading text-[#172121] mb-3">Contents</h2>
          <ol className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm text-[#3D4948]">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <a href={`#privacy-${s.id}`} className="hover:text-[#18A999] transition-colors">
                  {s.number}. {s.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="bg-white border border-[#DDE3E0] rounded-3xl p-5 sm:p-8 space-y-10 text-sm text-[#3D4948] leading-relaxed">
          <Section {...section('introduction')}>
            <p>
              LEENKIT is a platform for discovering, creating, joining, and sharing real-life Hangouts. This Privacy Policy explains how LEENKIT handles personal information when you use the LEENKIT website and related services (the “Service”). It should be read together with the{' '}
              <Link to="/terms" className={linkClass}>Terms &amp; Conditions</Link>.
            </p>
          </Section>

          <Section {...section('you-provide')}>
            <p>Depending on how you use LEENKIT, we collect:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                <strong className="text-[#172121]">Account information:</strong> your name, email address, and password when you sign up with email. Passwords are handled by our authentication provider; LEENKIT does not store them in its own profile records. A public username is created automatically from your name, with a short suffix added if that username is already taken. Usernames for some earlier accounts were based on the first part of the account’s email address.
              </li>
              <li>
                <strong className="text-[#172121]">Profile information:</strong> your profile photo (a preset image or a photo you upload), location, bio, interests, and any Instagram, TikTok, or Spotify links you choose to add.
              </li>
              <li>
                <strong className="text-[#172121]">Hangouts you create:</strong> title, description, category, date and time, capacity, cover image, venue name and Google Maps link, and any ticket price and currency.
              </li>
              <li>
                <strong className="text-[#172121]">Participation and activity:</strong> which Hangouts you host or join, people you follow (“vibe” with), and notifications generated by that activity.
              </li>
              <li>
                <strong className="text-[#172121]">Messages:</strong> messages you send in a Hangout Space.
              </li>
              <li>
                <strong className="text-[#172121]">Sponsorships:</strong> sponsorship pledges or payments you make, including the amount, currency, and any message you include.
              </li>
              <li>
                <strong className="text-[#172121]">Safety reports:</strong> reports you submit, as described in the Safety Reports section.
              </li>
              <li>
                <strong className="text-[#172121]">Acceptance records:</strong> when you agree to the Hosting Guidelines, the Terms &amp; Conditions, or this Privacy Policy, we record which version you accepted and when.
              </li>
            </ul>
          </Section>

          <Section {...section('sign-in')}>
            <p>
              If you choose “Continue with Google”, Google shares basic account information with LEENKIT, such as your name, email address, and profile picture, so we can create and sign in to your LEENKIT account. Google’s handling of your information is governed by Google’s own terms and privacy policy.
            </p>
          </Section>

          <Section {...section('payments')}>
            <p>
              Paid tickets and paid sponsorships are processed by Paystack, a third-party payment provider. When you start a payment, LEENKIT sends Paystack your email address, the amount and currency, a transaction reference, and identifiers for the Hangout and payment type. You then enter your payment details on Paystack’s checkout page — LEENKIT’s own forms do not ask for your card number.
            </p>
            <p>
              LEENKIT keeps a record of each payment, including the reference, amount, currency, status, payment type, related Hangout, your email address, the Hangout title, any sponsorship message, and relevant timestamps. LEENKIT also stores the payment confirmation notices that Paystack sends. These notices may include transaction details and limited payment-method information provided by Paystack.
            </p>
            <p>
              LEENKIT also records the platform fee and the Organizer’s share for each payment, so Organizers can see what they earned.
            </p>
            <p>
              <strong>Organizer payouts.</strong> If you set up payouts, you give us your bank and account number. We send them to Paystack to verify the account and create a payout (“subaccount”) record in your name. LEENKIT stores only the bank name, the verified account name, the last four digits of the account number and Paystack’s reference for it; Paystack holds the full details.
            </p>
          </Section>

          <Section {...section('verification')}>
            <p>
              Verified Organizer status is granted by LEENKIT; you cannot set it on your own profile. LEENKIT does not currently collect government-issued ID, identity documents, or proof-of-life images or videos for verification. If a verification process that collects additional information is introduced, this Privacy Policy will be updated before it is used.
            </p>
          </Section>

          <Section {...section('reports')}>
            <p>
              LEENKIT includes a Report option on Hangouts, profiles, and Hangout Spaces. You must be signed in to submit a report. When you do, LEENKIT stores the report on its servers with your account ID, what you reported, the reason you chose, any details you add, the report’s status, and the time it was submitted.
            </p>
            <p>
              Reports are not shown to other users, including the person or Hangout you report. You cannot view or edit a report after submitting it. LEENKIT does not promise a specific review process, response time, or outcome for a report. If you need help with a safety concern, also follow the guidance in the{' '}
              <Link to="/safety" className={linkClass}>Safety &amp; Trust Guide</Link>, and contact local emergency services if you are in immediate danger.
            </p>
          </Section>

          <Section {...section('storage')}>
            <p>LEENKIT uses your browser’s storage to make the Service work:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Our authentication provider stores session information in your browser so you stay signed in.</li>
              <li>Your selected search location may be remembered on your device.</li>
            </ul>
            <p>
              The current version of LEENKIT does not include advertising or third-party analytics trackers. Pages do load some resources from third parties — for example, fonts from Google Fonts and some default images from Unsplash — which means your browser connects to those services and they may receive technical information such as your IP address.
            </p>
            <p>
              Our hosting, database, and authentication providers may also process technical information, such as IP addresses and request logs, as part of operating and securing their services.
            </p>
          </Section>

          <Section {...section('use')}>
            <p>We use information to:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Create and maintain your account and sign you in</li>
              <li>Show profiles and Hangouts and let people discover, join, and share Hangouts</li>
              <li>Run Hangout Spaces and send in-app notifications</li>
              <li>Send account emails, such as email confirmation and password reset links, and payment emails, such as receipts and notices about a payment we could not confirm</li>
              <li>Process ticket and sponsorship payments and confirm attendance</li>
              <li>Record acceptance of our Terms, Privacy Policy, and Hosting Guidelines</li>
              <li>Protect the Service, enforce our Terms, and respond to misuse</li>
              <li>Meet legal obligations that apply to us</li>
            </ul>
          </Section>

          <Section {...section('visibility')}>
            <p>LEENKIT is a social platform, so some information is visible to others by design:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                <strong className="text-[#172121]">Public, including to people who are not signed in:</strong> your profile (name, username, photo, location, bio, interests, social links, profile stats, Organizer and Verified Organizer status, and whether and when you accepted the Hosting Guidelines), Hangouts and their details, who has joined a Hangout, and a Hangout’s total sponsorship amount and number of sponsors.
              </li>
              <li>
                <strong className="text-[#172121]">Signed-in users:</strong> who you follow (“vibe” with) and who follows you.
              </li>
              <li>
                <strong className="text-[#172121]">Hangout members:</strong> messages in a Hangout Space are visible to that Hangout’s Organizer and attendees.
              </li>
              <li>
                <strong className="text-[#172121]">The Hangout’s Organizer:</strong> sponsorships you make to their Hangout, including who sponsored, the amount, and any message you include.
              </li>
              <li>
                <strong className="text-[#172121]">Only you:</strong> your payment records, your notifications, and your Terms/Privacy acceptance records are visible only to you within the app. Safety reports are not visible to any user, including you after submission.
              </li>
            </ul>
            <p>
              Uploaded profile photos and Hangout cover images are stored at public web addresses, so anyone with the link can view them. Do not upload anything you would not want to be public.
            </p>
          </Section>

          <Section {...section('providers')}>
            <p>LEENKIT relies on third-party providers to run the Service, including:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li><strong className="text-[#172121]">Supabase</strong> — authentication, database, file storage, and server functions</li>
              <li><strong className="text-[#172121]">Netlify</strong> — website hosting</li>
              <li><strong className="text-[#172121]">Paystack</strong> — payment processing</li>
              <li><strong className="text-[#172121]">Resend</strong> — delivering account and payment emails (your email address and the content of those emails)</li>
              <li><strong className="text-[#172121]">Google</strong> — optional sign-in and web fonts</li>
            </ul>
            <p>
              These providers process information as needed to provide their services and according to their own terms and policies. LEENKIT may also disclose information where required by law or where reasonably necessary to protect the safety and rights of users or others.
            </p>
            <p>
              Links to Google Maps, WhatsApp, or Instagram, TikTok, and Spotify profiles take you to those services. Their own privacy practices apply.
            </p>
          </Section>

          <Section {...section('retention')}>
            <p>
              LEENKIT aims to keep personal information only for as long as it is necessary for the purposes described in this policy, and as required or permitted by applicable law. In practice, account, profile, and Hangout information is kept while your account is active, and payment and acceptance records may be kept longer where needed for record-keeping, dispute resolution, or legal obligations.
            </p>
            <p>
              LEENKIT has not yet set specific retention periods for each type of information. This section will be updated when a retention schedule is confirmed.
            </p>
          </Section>

          <Section {...section('choices')}>
            <p>In the app today:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>You can view and edit your profile details at any time from Edit Profile.</li>
              <li>You can choose what you post in Hangouts, Hangout Spaces, and your profile.</li>
              <li>
                You can delete your account at any time from Edit Profile → Delete account. Upcoming Hangouts you host are cancelled, and we remove your profile details, uploaded photos, follows, notifications, payout details and your messages in Hangout Spaces.
              </li>
              <li>
                If you have never made or received a payment, your account and its remaining records are deleted. If you have bought or sold tickets or sponsorships, we keep the payment records (such as amount, date, Hangout and reference) and the payment confirmations received from Paystack for accounting, dispute and legal purposes, together with your Terms and Privacy acceptance records and any safety reports you submitted. These stay linked to an anonymised account record that no longer shows your name or username, but Paystack’s confirmations can include the email address used for the payment. Past Hangouts you hosted that had payments remain, shown as hosted by a deleted member. Paystack keeps its own records under its own policies.
              </li>
            </ul>
            <p>
              Depending on where you live, you may have rights over your personal information under applicable data-protection law. Under Nigerian data-protection law, these include the right to:
            </p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Be informed about how your personal information is used</li>
              <li>Access the personal information held about you</li>
              <li>Have inaccurate or incomplete information corrected</li>
              <li>Request deletion of your personal information, where applicable</li>
              <li>Object to, or ask for restriction of, certain processing</li>
              <li>Receive your information in a portable format, where applicable</li>
              <li>Withdraw consent, where processing is based on consent</li>
              <li>Complain to the Nigeria Data Protection Commission (NDPC)</li>
            </ul>
            <p>
              To ask about any of these rights, contact LEENKIT at the address in the Contact section below. These rights may be subject to conditions and exceptions under applicable law.
            </p>
          </Section>

          <Section {...section('security')}>
            <p>
              LEENKIT is served over HTTPS and uses database access rules to limit who can read and change information — for example, payment records are restricted to the account they belong to, and Hangout Space messages to that Hangout’s members. No online service can guarantee complete security, so please use a strong, unique password and protect your account.
            </p>
          </Section>

          <Section {...section('children')}>
            <p>
              To use LEENKIT, you must be able to form a binding agreement and meet the age and other legal requirements that apply where you live, as described in the{' '}
              <Link to="/terms" className={linkClass}>Terms &amp; Conditions</Link>. If you believe a child has provided personal information to LEENKIT without meeting those requirements, please contact us using the details below.
            </p>
          </Section>

          <Section {...section('international')}>
            <p>
              LEENKIT’s service providers may process information in countries other than the one where you live. Protections for personal information may differ between countries.
            </p>
          </Section>

          <Section {...section('changes')}>
            <p>
              We may update this Privacy Policy as LEENKIT changes. The “Last updated” date at the top of this page will change when we do. If a change is material, we will ask you to review and accept the updated policy in the app.
            </p>
          </Section>

          <Section {...section('contact')}>
            {LEGAL_CONTACT_EMAIL ? (
              <p>
                For privacy questions or requests, contact LEENKIT at{' '}
                <a href={`mailto:${LEGAL_CONTACT_EMAIL}`} className={linkClass}>{LEGAL_CONTACT_EMAIL}</a>.
              </p>
            ) : (
              <p>
                A dedicated contact address for privacy questions and requests is being finalised and will be published on this page.
              </p>
            )}
          </Section>
        </div>

        <p className="text-center text-xs text-[#687473]">
          Related:{' '}
          <Link to="/terms" className={linkClass}>Terms &amp; Conditions</Link>
          {' · '}
          <Link to="/faq" className={linkClass}>FAQ</Link>
          {' · '}
          <Link to="/safety" className={linkClass}>Safety &amp; Trust Guide</Link>
        </p>
      </article>
    </PageTransition>
  );
}
