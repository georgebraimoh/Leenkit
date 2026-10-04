import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FileText } from 'lucide-react';
import PageTransition from '../components/layout/PageTransition';
import { TERMS_LAST_UPDATED, LEGAL_CONTACT_EMAIL } from '../data/legal';

const SECTIONS = [
  { id: 'introduction', number: '1', title: 'Introduction & Acceptance' },
  { id: 'eligibility', number: '2', title: 'Eligibility' },
  { id: 'account', number: '3', title: 'Your Account' },
  { id: 'using-leenkit', number: '4', title: 'Using LEENKIT' },
  { id: 'hangouts', number: '5', title: 'Hangouts & Organizers' },
  { id: 'verified', number: '6', title: 'Verified Organizers' },
  { id: 'payments', number: '7', title: 'Tickets, Payments & Sponsorships' },
  { id: 'content', number: '8', title: 'User Content' },
  { id: 'prohibited', number: '9', title: 'Prohibited Conduct' },
  { id: 'safety', number: '10', title: 'Safety' },
  { id: 'moderation', number: '11', title: 'Moderation & Enforcement' },
  { id: 'ip', number: '12', title: 'Intellectual Property' },
  { id: 'third-party', number: '13', title: 'Third-Party Services' },
  { id: 'disclaimers', number: '14', title: 'Disclaimers' },
  { id: 'liability', number: '15', title: 'Limitation of Liability' },
  { id: 'changes', number: '16', title: 'Changes to These Terms' },
  { id: 'governing-law', number: '17', title: 'Governing Law' },
  { id: 'contact', number: '18', title: 'Contact' }
];

export default function Terms() {
  useEffect(() => {
    const previous = document.title;
    document.title = 'Terms & Conditions | LEENKIT';
    return () => {
      document.title = previous;
    };
  }, []);

  return (
    <PageTransition>
      <article className="max-w-3xl mx-auto px-4 sm:px-6 py-12 space-y-10">
        <header className="text-center space-y-4 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#DDF4EF] text-[#087F73] text-xs font-semibold">
            <FileText className="w-4 h-4" aria-hidden="true" />
            <span>Platform terms</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold font-heading text-[#172121]">
            Terms & Conditions
          </h1>
          <p className="text-base text-[#3D4948] leading-relaxed">
            These terms explain the rules and responsibilities for using LEENKIT.
          </p>
          <p className="text-xs font-semibold text-[#687473]">Last updated: {TERMS_LAST_UPDATED}</p>
        </header>

        <p className="text-xs sm:text-sm text-[#3D4948] leading-relaxed bg-[#EEF1EF] border border-[#DDE3E0] rounded-2xl px-4 py-3">
          These Terms & Conditions are provided for use of the LEENKIT platform and should be reviewed and adapted for the applicable legal requirements before being treated as final legal advice.
        </p>

        <nav aria-label="Terms sections" className="bg-white border border-[#DDE3E0] rounded-3xl p-5 sm:p-6">
          <h2 className="text-sm font-bold font-heading text-[#172121] mb-3">Contents</h2>
          <ol className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm text-[#3D4948]">
            {SECTIONS.map((section) => (
              <li key={section.id}>
                <a
                  href={`#terms-${section.id}`}
                  className="hover:text-[#18A999] transition-colors"
                >
                  {section.number}. {section.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="bg-white border border-[#DDE3E0] rounded-3xl p-5 sm:p-8 space-y-10 text-sm text-[#3D4948] leading-relaxed">
          <section id="terms-introduction" className="scroll-mt-24 space-y-3">
            <h2 className="text-xl font-bold font-heading text-[#172121]">1. Introduction & Acceptance</h2>
            <p>
              LEENKIT is a social discovery platform that helps people discover, create, join, and share real-life Hangouts. These Terms & Conditions (“Terms”) govern your access to and use of the LEENKIT website and related services (the “Service”).
            </p>
            <p>
              When you create an account, you are asked to confirm that you have read and agree to these Terms and the{' '}
              <Link to="/privacy" className="font-semibold text-[#087F73] hover:text-[#18A999] underline underline-offset-2">
                Privacy Policy
              </Link>
              , and LEENKIT records the version you accepted. By using LEENKIT, you agree to these Terms. If you do not agree, you should not use the Service.
            </p>
          </section>

          <section id="terms-eligibility" className="scroll-mt-24 space-y-3">
            <h2 className="text-xl font-bold font-heading text-[#172121]">2. Eligibility</h2>
            <p>
              You must be able to form a legally binding agreement under the laws that apply to you, and you must provide accurate information when you create or use an account.
            </p>
            <p>
              You are responsible for complying with any age, capacity, and other legal requirements that apply in your location. Do not use LEENKIT if you are not permitted to do so.
            </p>
          </section>

          <section id="terms-account" className="scroll-mt-24 space-y-3">
            <h2 className="text-xl font-bold font-heading text-[#172121]">3. Your Account</h2>
            <p>
              You are responsible for your account and for activity that occurs under it. Keep your login credentials secure, and do not share them with others.
            </p>
            <p>
              Provide accurate profile and account information, and update it when it changes. You are responsible for the devices and methods you use to access LEENKIT, including third-party sign-in options you choose.
            </p>
            <p>
              If you believe someone else has accessed your account, change your password and contact LEENKIT using the details in section 18.
            </p>
          </section>

          <section id="terms-using-leenkit" className="scroll-mt-24 space-y-3">
            <h2 className="text-xl font-bold font-heading text-[#172121]">4. Using LEENKIT</h2>
            <p>
              LEENKIT lets you maintain a profile, browse Hangouts, join gatherings, organize Hangouts (subject to Hosting Guidelines), communicate in Hangout Spaces, share Hangouts, and interact with other members in ways the Service supports.
            </p>
            <p>
              You agree to use profiles, Hangouts, Hangout Spaces, event participation, organizing tools, and other content in line with these Terms, the Hosting Guidelines where they apply, and applicable law. LEENKIT is not a dating or matchmaking service.
            </p>
          </section>

          <section id="terms-hangouts" className="scroll-mt-24 space-y-3">
            <h2 className="text-xl font-bold font-heading text-[#172121]">5. Hangouts & Organizers</h2>
            <p>
              Organizers create and manage Hangouts. An Organizer is responsible for providing accurate information about the gathering, including venue, date, time, capacity, description, and ticket or price details where relevant.
            </p>
            <p>
              LEENKIT provides the platform that lists and facilitates Hangouts. LEENKIT does not become the Organizer of a Hangout created by a user, and does not guarantee that every Organizer, venue, or event is legitimate, suitable, or safe.
            </p>
            <p>
              Review Hangout details carefully before joining or purchasing. Organizers should follow Hosting Guidelines, including using public, accessible venues for first-time meetups when those guidelines apply.
            </p>
          </section>

          <section id="terms-verified" className="scroll-mt-24 space-y-3">
            <h2 className="text-xl font-bold font-heading text-[#172121]">6. Verified Organizers</h2>
            <p>
              LEENKIT may designate certain Organizers as verified as a trust-and-safety feature. Users cannot grant themselves verified status.
            </p>
            <p>
              LEENKIT decides whether to grant, keep, or remove verified status. LEENKIT does not currently collect government-issued ID or proof-of-life as part of verification.
            </p>
            <p>
              Verification does not guarantee an Organizer’s behavior, honesty, safety practices, legitimacy, or suitability, and it does not make LEENKIT responsible for that Organizer’s Hangouts.
            </p>
          </section>

          <section id="terms-payments" className="scroll-mt-24 space-y-3">
            <h2 className="text-xl font-bold font-heading text-[#172121]">7. Tickets, Payments & Sponsorships</h2>
            <p>
              Hangouts may be free or paid. Paid tickets and online sponsorships are processed by Paystack in Nigerian Naira (NGN). The buyer pays the price shown; LEENKIT does not add a booking fee for buyers.
            </p>
            <p>
              <strong>Platform fee for Organizers.</strong> For each paid ticket and each online sponsorship, LEENKIT keeps a platform fee of 10% of the amount paid, with a minimum of ₦200 per payment. LEENKIT pays Paystack’s card processing fees out of its share. The remainder is paid to the Organizer’s payout bank account by Paystack, on Paystack’s settlement schedule. LEENKIT may change the fee for future payments with notice in the app; it never changes for a payment already made.
            </p>
            <p>
              <strong>Payout accounts.</strong> To sell tickets or receive online sponsorships, an Organizer must add a Nigerian bank account. LEENKIT checks the account number with Paystack and shows the account name the bank returns; LEENKIT does not currently confirm that this name matches the Organizer. Organizers must only add accounts they are entitled to receive money into, and are responsible for any taxes on what they earn.
            </p>
            <p>
              <strong>Refunds.</strong> If a Hangout is cancelled, or LEENKIT cannot confirm a buyer’s spot (for example, it filled up while they were paying), the payment is flagged for review by LEENKIT. Refunds are not automatic: where LEENKIT issues a refund, it is made through Paystack to the original payment method. Leaving a Hangout you paid for does not automatically entitle you to a refund. LEENKIT’s full refund policy, including how refunds for Organizer cancellations are funded, is still being finalised.
            </p>
            <p>
              <strong>Pledges</strong> are promises recorded in the app with no payment. LEENKIT is not involved in settling pledges.
            </p>
          </section>

          <section id="terms-content" className="scroll-mt-24 space-y-3">
            <h2 className="text-xl font-bold font-heading text-[#172121]">8. User Content</h2>
            <p>
              You may submit content such as profile information, photos, Hangout descriptions, messages in Hangout Spaces, reports, and other material (“User Content”).
            </p>
            <p>
              You retain the rights you already have in your User Content. You grant LEENKIT a non-exclusive, worldwide, royalty-free license to host, store, display, reproduce, and otherwise use that User Content solely as reasonably necessary to operate, improve, and provide the Service — for example, showing your Hangout on Explore or displaying your profile to other users.
            </p>
            <p>
              You represent that you have the right to submit the User Content you post and that it does not violate these Terms or applicable law. This license is not a transfer of ownership of your content to LEENKIT.
            </p>
          </section>

          <section id="terms-prohibited" className="scroll-mt-24 space-y-3">
            <h2 className="text-xl font-bold font-heading text-[#172121]">9. Prohibited Conduct</h2>
            <p>You may not use LEENKIT to:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Engage in illegal activity or encourage others to do so</li>
              <li>Commit fraud, impersonate others, or misrepresent who you are or what a Hangout is</li>
              <li>Harass, threaten, abuse, or intimidate others, including hate-based harassment</li>
              <li>Engage in sexual exploitation or share exploitative material</li>
              <li>Spam, scrape, or collect other users’ personal information without authorization</li>
              <li>Distribute malicious software or attempt to compromise, disrupt, or gain unauthorized access to the platform</li>
              <li>Post misleading event information, including false venues, times, capacity, or prices</li>
              <li>Misuse payment systems, including unauthorized charges or abusive payment activity</li>
            </ul>
          </section>

          <section id="terms-safety" className="scroll-mt-24 space-y-3">
            <h2 className="text-xl font-bold font-heading text-[#172121]">10. Safety</h2>
            <p>
              Meeting people in real life involves risk. You are responsible for exercising judgment when you interact with others, join Hangouts, or host them.
            </p>
            <p>We recommend that you:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Meet in public places where possible</li>
              <li>Tell someone you trust where you are going</li>
              <li>Consider attending with someone you know</li>
              <li>Protect sensitive personal information</li>
              <li>Leave situations that feel unsafe</li>
              <li>Contact local emergency services if you are in immediate danger</li>
            </ul>
            <p>
              LEENKIT cannot guarantee the safety of users, events, venues, or interactions. Additional practical guidance is available on the{' '}
              <Link to="/safety" className="font-semibold text-[#087F73] hover:text-[#18A999] underline underline-offset-2">
                Safety & Trust Guide
              </Link>
              .
            </p>
          </section>

          <section id="terms-moderation" className="scroll-mt-24 space-y-3">
            <h2 className="text-xl font-bold font-heading text-[#172121]">11. Moderation & Enforcement</h2>
            <p>
              LEENKIT may remove content, restrict accounts, remove Hangouts, suspend or terminate accounts, and take other reasonable action when users violate these Terms, the Hosting Guidelines, or create risks for the community or the platform.
            </p>
            <p>
              You can delete your account at any time from Edit Profile. Deleting your account cancels Hangouts you are hosting and removes you from Hangouts you joined; refunds for cancelled paid Hangouts are handled as described in section 7.
            </p>
            <p>
              You can flag concerning Hangouts, profiles, or behavior using the Report option in the Service. LEENKIT does not promise that a report will lead to any particular outcome or response time.
            </p>
          </section>

          <section id="terms-ip" className="scroll-mt-24 space-y-3">
            <h2 className="text-xl font-bold font-heading text-[#172121]">12. Intellectual Property</h2>
            <p>
              The LEENKIT platform, including its name, branding, design, software, and other materials LEENKIT owns or licenses, remains the property of LEENKIT and its licensors.
            </p>
            <p>
              You may not copy, reproduce, modify, distribute, or otherwise exploit LEENKIT intellectual property without permission, except as allowed by these Terms or applicable law.
            </p>
          </section>

          <section id="terms-third-party" className="scroll-mt-24 space-y-3">
            <h2 className="text-xl font-bold font-heading text-[#172121]">13. Third-Party Services</h2>
            <p>
              LEENKIT relies on third-party services to operate, which may include payment processing, account authentication, hosting, storage, and mapping. Those providers have their own terms and practices.
            </p>
            <p>
              LEENKIT is not responsible for third-party sites or services that you access through the platform, including maps, payment checkout, or authentication screens operated by others.
            </p>
          </section>

          <section id="terms-disclaimers" className="scroll-mt-24 space-y-3">
            <h2 className="text-xl font-bold font-heading text-[#172121]">14. Disclaimers</h2>
            <p>
              LEENKIT is provided on an “as available” basis. We do not guarantee that every Hangout, Organizer, participant, or venue is accurate, legitimate, or suitable, or that the Service will be uninterrupted or error-free.
            </p>
            <p>
              Information posted by users is their responsibility. You use the Service and attend Hangouts at your own discretion.
            </p>
          </section>

          <section id="terms-liability" className="scroll-mt-24 space-y-3">
            <h2 className="text-xl font-bold font-heading text-[#172121]">15. Limitation of Liability</h2>
            <p>
              To the fullest extent permitted by applicable law, LEENKIT is not liable for indirect, incidental, or consequential losses arising from your use of the Service, from Hangouts you join or host, or from interactions with other users.
            </p>
            <p>
              Nothing in these Terms is intended to exclude rights that cannot be excluded under applicable law, including liability for fraud or for personal injury caused by negligence where that cannot be limited.
            </p>
          </section>

          <section id="terms-changes" className="scroll-mt-24 space-y-3">
            <h2 className="text-xl font-bold font-heading text-[#172121]">16. Changes to These Terms</h2>
            <p>
              LEENKIT may update these Terms from time to time. The “Last updated” date at the top of this page will change when we do.
            </p>
            <p>
              If a change is material, LEENKIT will ask you to review and accept the updated Terms in the app before you continue using your account. Your earlier acceptance remains on record.
            </p>
          </section>

          <section id="terms-governing-law" className="scroll-mt-24 space-y-3">
            <h2 className="text-xl font-bold font-heading text-[#172121]">17. Governing Law</h2>
            <p>
              These Terms are subject to applicable law. The governing law and dispute-resolution jurisdiction applicable to LEENKIT will be specified in the final version of these Terms. Nothing in these Terms limits rights you have under the mandatory laws of the place where you live.
            </p>
          </section>

          <section id="terms-contact" className="scroll-mt-24 space-y-3">
            <h2 className="text-xl font-bold font-heading text-[#172121]">18. Contact</h2>
            {LEGAL_CONTACT_EMAIL ? (
              <p>
                For questions about these Terms, contact LEENKIT at{' '}
                <a href={`mailto:${LEGAL_CONTACT_EMAIL}`} className="font-semibold text-[#087F73] hover:text-[#18A999] underline underline-offset-2">
                  {LEGAL_CONTACT_EMAIL}
                </a>
                .
              </p>
            ) : (
              <p>
                A dedicated contact address for questions about these Terms is being finalised and will be published on this page.
              </p>
            )}
          </section>
        </div>

        <p className="text-center text-xs text-[#687473]">
          Related:{' '}
          <Link to="/faq" className="font-semibold text-[#087F73] hover:text-[#18A999] underline underline-offset-2">
            FAQ
          </Link>
          {' · '}
          <Link to="/privacy" className="font-semibold text-[#087F73] hover:text-[#18A999] underline underline-offset-2">
            Privacy Policy
          </Link>
          {' · '}
          <Link to="/safety" className="font-semibold text-[#087F73] hover:text-[#18A999] underline underline-offset-2">
            Safety & Trust Guide
          </Link>
        </p>
      </article>
    </PageTransition>
  );
}
