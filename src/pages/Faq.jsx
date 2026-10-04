import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { HelpCircle } from 'lucide-react';
import PageTransition from '../components/layout/PageTransition';
import FaqAccordion from '../components/faq/FaqAccordion';
import Button from '../components/common/Button';
import { LEGAL_CONTACT_EMAIL } from '../data/legal';

const FAQ_SECTIONS = [
  {
    id: 'general',
    title: 'General',
    items: [
      {
        id: 'what-is-leenkit',
        question: 'What is LEENKIT?',
        answer:
          'LEENKIT is a location-first social discovery platform for real-life Hangouts. It helps people find something to do, create gatherings, and meet others in person around a time, place, and activity — not through endless chat threads.'
      },
      {
        id: 'what-can-i-do',
        question: 'What can I do on LEENKIT?',
        answer:
          'You can browse Hangouts, join ones that interest you, create your own, share them with others, and use the Hangout Space to coordinate with attendees. You can also keep a profile, follow people you vibe with, and use in-app reporting when something does not feel right.'
      },
      {
        id: 'dating-app',
        question: 'Is LEENKIT a dating app?',
        answer:
          'No. LEENKIT is not a dating or matchmaking platform. It is built for discovering and hosting real-life Hangouts — activities, meetups, and gatherings attached to a place and time. Any connections that form happen through those Hangouts, not through dating profiles or pairing features.'
      },
      {
        id: 'browse-without-account',
        question: 'Do I need an account to browse Hangouts?',
        answer:
          'No. You can explore Hangouts without signing in. Creating a Hangout, joining one, using a Hangout Space, editing your profile, or using features that belong to a signed-in account requires an account.'
      },
      {
        id: 'worldwide',
        question: 'Is LEENKIT available worldwide?',
        answer:
          'LEENKIT is not limited to a single city — Hangouts can be attached to real places anywhere. What you will find in a given area depends on what Organizers create there, and in-app payment options are limited to the currencies LEENKIT currently supports.'
      }
    ]
  },
  {
    id: 'hangouts',
    title: 'Hangouts',
    items: [
      {
        id: 'what-is-hangout',
        question: 'What is a Hangout?',
        answer:
          'A Hangout is a real-life gathering with a title, description, date, time, location, and capacity. It is the social unit on LEENKIT — the event people discover, join, and show up to in person.'
      },
      {
        id: 'create-hangout',
        question: 'How do I create a Hangout?',
        answer:
          'Sign in, open Host a Hangout, and accept the Hosting Guidelines if you have not already. Then add the title, category, date, time, capacity, description, cover image, and a Google Maps link for the venue. You can mark the Hangout as free or paid before publishing.'
      },
      {
        id: 'join-hangout',
        question: 'How do I join a Hangout?',
        answer:
          'Open the Hangout, review the details, and join. You need an account. If the Hangout uses a paid ticket through LEENKIT, you complete the payment step shown on that Hangout before your spot is confirmed.'
      },
      {
        id: 'leave-hangout',
        question: 'Can I leave a Hangout after joining?',
        answer:
          'Yes. If you joined as an attendee, you can leave from the Hangout. Organizers cannot leave their own Hangout; they remain responsible for it until it is cancelled or otherwise closed through the tools available to them.'
      },
      {
        id: 'share-hangout',
        question: 'Can I share a Hangout?',
        answer:
          'Yes. Hangouts include a share action so you can send the Hangout link to people you want to invite.'
      },
      {
        id: 'any-venue',
        question: 'Can I choose any venue or location?',
        answer:
          'Organizers choose the venue and provide a Google Maps link so attendees can find it. Hosting Guidelines ask Organizers to use public, accessible places for first-time meetups rather than private residential spaces. Always review the listed location before you join.'
      },
      {
        id: 'after-join',
        question: 'What happens after I join a Hangout?',
        answer:
          'You are added to the attendee list and can open the Hangout Space to communicate with the Organizer and other attendees. Show up at the listed time and place, and follow the safety guidance on LEENKIT.'
      },
      {
        id: 'hangout-space',
        question: 'What is a Hangout Space?',
        answer:
          'The Hangout Space is the communication space tied to a specific Hangout. It is where attendees and the Organizer can coordinate details for that gathering — not a permanent social network chat.'
      }
    ]
  },
  {
    id: 'organizers',
    title: 'Organizers',
    items: [
      {
        id: 'what-is-organizer',
        question: 'What is an Organizer?',
        answer:
          'An Organizer (or host) is the person who creates and manages a Hangout. They are responsible for the event details, venue information, and how the gathering is run.'
      },
      {
        id: 'who-can-organize',
        question: 'Who can become an Organizer?',
        answer:
          'Signed-in members who accept the Hosting Guidelines can create Hangouts. Hosting is open to eligible members; it is a responsibility, not just a button.'
      },
      {
        id: 'verified-organizer',
        question: 'What is a Verified Organizer?',
        answer:
          'A Verified Organizer is a trust-and-safety designation that LEENKIT may grant. It is not something a user can turn on themselves. Verification is meant to add extra confidence — it does not guarantee an Organizer’s behavior, an event’s quality, or anyone’s safety.'
      },
      {
        id: 'verification-how',
        question: 'How does Organizer verification work?',
        answer:
          'Verified status is granted by LEENKIT as a trust-and-safety process. It cannot be switched on from your own profile. The app does not currently include a self-service verification flow, and LEENKIT does not currently collect government-issued ID or proof-of-life for verification.'
      },
      {
        id: 'verification-guarantee',
        question: 'Does verification guarantee someone’s safety or legitimacy?',
        answer:
          'No. Verification adds a layer of confidence, but it does not guarantee an Organizer’s identity, behavior, honesty, or the safety or quality of any Hangout. Always review Hangout details carefully and follow the Safety & Trust Guide.'
      },
      {
        id: 'organizer-leave',
        question: 'Can an Organizer leave their own Hangout?',
        answer:
          'No. The Organizer cannot leave their own Hangout as an attendee would. They remain the host for that gathering.'
      }
    ]
  },
  {
    id: 'tickets',
    title: 'Tickets, Payments & Sponsorships',
    items: [
      {
        id: 'all-free',
        question: 'Are all Hangouts free?',
        answer:
          'No. Many Hangouts are free to join. Organizers can also set a ticket or entry price. Always check the Hangout page before you join or pay.'
      },
      {
        id: 'paid-tickets',
        question: 'Can Hangouts have paid tickets?',
        answer:
          'Yes. Organizers can create paid Hangouts with a listed price and currency. Review the ticket information on the Hangout before you complete any purchase.'
      },
      {
        id: 'how-payments',
        question: 'How do payments work?',
        answer:
          'Paid tickets and online sponsorships are paid on the Hangout page through Paystack, in Nigerian Naira. Your spot is confirmed only after LEENKIT has verified the payment with Paystack; the Hangout page shows the result. Paystack may also send you its own payment receipt. Review the Hangout details so you know what you are paying for.'
      },
      {
        id: 'what-is-sponsorship',
        question: 'What is sponsorship?',
        answer:
          'Sponsorship lets people support a Hangout financially. Depending on what is available for that Hangout, this may be a recorded pledge or a payment through LEENKIT’s payment flow. Sponsorship is optional and is not the same as buying a ticket unless the Hangout says otherwise.'
      },
      {
        id: 'after-pay',
        question: 'What happens after I pay for a ticket?',
        answer:
          'If payment is confirmed, you should receive access as an attendee for that Hangout, including the Hangout Space where applicable. If the payment is still being confirmed, wait for the Hangout page to update. Keep your payment reference in case you need to follow up on a problem.'
      },
      {
        id: 'cancelled-hangout',
        question: 'What happens if a Hangout is cancelled?',
        answer:
          'If the Organizer or LEENKIT cancels a Hangout, everyone who paid for a ticket or an online sponsorship is refunded in full automatically, to the original payment method through Paystack. It can take up to 10 business days for the money to arrive.'
      },
      {
        id: 'refunds',
        question: 'Can I get a refund?',
        answer:
          'Yes, in these cases: if the Hangout is cancelled, or LEENKIT could not confirm your spot, you get a full refund. If you leave a Hangout at least 24 hours before it starts, you get back what you paid minus LEENKIT’s platform fee; the Leave screen shows the exact amount before you confirm. Leaving later, or not attending, is not refunded. Refunds go back to your original payment method through Paystack and can take up to 10 business days. For questions about a payment, contact ' + LEGAL_CONTACT_EMAIL + ' with your payment reference.'
      }
    ]
  },
  {
    id: 'safety',
    title: 'Safety',
    items: [
      {
        id: 'is-safe',
        question: 'Is LEENKIT safe?',
        answer:
          'LEENKIT provides tools and guidance to help people meet thoughtfully, including a Safety guide, Hosting Guidelines, reporting, and Organizer verification. LEENKIT cannot guarantee the safety of users, Hangouts, venues, or in-person interactions. You are responsible for using good judgment.'
      },
      {
        id: 'meeting-people',
        question: 'What should I do when meeting people from a Hangout?',
        answer:
          'Treat it like any first-time meetup with people you met online. Review the Hangout details, prefer public venues, tell someone you trust where you are going, and keep your own transportation plan. Do not share sensitive personal information unnecessarily.'
      },
      {
        id: 'public-place',
        question: 'Should I meet in a public place?',
        answer:
          'Yes, whenever possible. Choose places with other people around, such as cafés, parks, or established venues. Hosting Guidelines also ask Organizers not to host first-time meetups in private residential spaces.'
      },
      {
        id: 'feels-wrong',
        question: 'What should I do if something feels wrong?',
        answer:
          'Trust your instincts. Leave the situation if it feels unsafe. Contact someone you trust, and contact local emergency services if you are in immediate danger. You can also report concerning behavior on LEENKIT after you are safe.'
      },
      {
        id: 'report',
        question: 'Can I report inappropriate behavior?',
        answer:
          'Hangouts, profiles, and Hangout Spaces include a Report option so you can flag concerning behavior while signed in. Your report is sent to LEENKIT and is not shown to the person or Hangout you report. LEENKIT does not promise a specific response or outcome, and reporting does not replace emergency help — if you are in immediate danger, contact local emergency services.'
      },
      {
        id: 'personal-info',
        question: 'How should I handle personal information?',
        answer:
          'Share only what you are comfortable with. Your profile and the Hangouts you join are publicly visible, so avoid putting your home address, phone number, financial details, or other sensitive information in your profile, Hangout descriptions, or Hangout Space messages, and be cautious about sharing it with people you have just met.'
      }
    ]
  },
  {
    id: 'account',
    title: 'Account & Profile',
    items: [
      {
        id: 'create-account',
        question: 'How do I create an account?',
        answer:
          'Sign up with your email address, or continue with Google. New accounts must agree to the Terms & Conditions and Privacy Policy before using LEENKIT. You need an account to create Hangouts, join them, and manage your profile.'
      },
      {
        id: 'edit-profile',
        question: 'Can I edit my profile?',
        answer:
          'Yes. After you sign in, you can edit your profile details such as your name, bio, location, interests, and optional social links.'
      },
      {
        id: 'profile-photo',
        question: 'Can I change my profile photo?',
        answer:
          'Yes. You can update your profile photo from Edit Profile, including uploading an image that meets the on-screen size and format limits.'
      },
      {
        id: 'delete-account',
        question: 'Can I delete my account?',
        answer:
          'LEENKIT does not currently offer in-app account deletion, and a formal account deletion process has not yet been finalised. You can contact ' + LEGAL_CONTACT_EMAIL + ' with questions or requests about your account and information.'
      },
      {
        id: 'account-help',
        question: 'How can I get help with my account?',
        answer:
          'If you forget your password, use “Forgot password” on the sign-in form to get a reset link by email. You can update your profile details any time from Edit Profile. For other account questions, contact ' + LEGAL_CONTACT_EMAIL + '.'
      }
    ]
  }
];

export default function Faq() {
  useEffect(() => {
    const previous = document.title;
    document.title = 'FAQ | LEENKIT';
    return () => {
      document.title = previous;
    };
  }, []);

  return (
    <PageTransition>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 space-y-12">
        <header className="text-center space-y-4 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#DDF4EF] text-[#087F73] text-xs font-semibold">
            <HelpCircle className="w-4 h-4" aria-hidden="true" />
            <span>Help</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold font-heading text-[#172121]">
            Frequently Asked Questions
          </h1>
          <p className="text-base text-[#3D4948] leading-relaxed">
            Everything you need to know about discovering, creating and joining Hangouts on LEENKIT.
          </p>
        </header>

        <nav aria-label="FAQ categories" className="flex flex-wrap justify-center gap-2">
          {FAQ_SECTIONS.map((section) => (
            <a
              key={section.id}
              href={`#faq-${section.id}`}
              className="px-3 py-1.5 text-xs font-semibold rounded-full bg-white border border-[#DDE3E0] text-[#172121] hover:border-[#18A999] hover:text-[#087F73] transition-colors"
            >
              {section.title}
            </a>
          ))}
        </nav>

        <div className="space-y-8">
          {FAQ_SECTIONS.map((section) => (
            <section
              key={section.id}
              id={`faq-${section.id}`}
              className="bg-white border border-[#DDE3E0] rounded-3xl p-5 sm:p-8 shadow-xs scroll-mt-24"
            >
              <h2 className="text-xl font-bold font-heading text-[#172121] mb-2">
                {section.title}
              </h2>
              <FaqAccordion items={section.items} />
            </section>
          ))}
        </div>

        <div className="text-center space-y-3 pt-2">
          <p className="text-sm text-[#3D4948]">
            Looking for community safety tips? Read the{' '}
            <Link to="/safety" className="font-semibold text-[#087F73] hover:text-[#18A999] underline underline-offset-2">
              Safety & Trust Guide
            </Link>
            . Platform rules are in the{' '}
            <Link to="/terms" className="font-semibold text-[#087F73] hover:text-[#18A999] underline underline-offset-2">
              Terms & Conditions
            </Link>
            , and how we handle your information is in the{' '}
            <Link to="/privacy" className="font-semibold text-[#087F73] hover:text-[#18A999] underline underline-offset-2">
              Privacy Policy
            </Link>
            .
          </p>
          <Link to="/explore">
            <Button variant="primary" size="lg" showArrow>
              Explore Hangouts
            </Button>
          </Link>
        </div>
      </div>
    </PageTransition>
  );
}
