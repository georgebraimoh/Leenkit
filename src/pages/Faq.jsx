import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { HelpCircle } from 'lucide-react';
import PageTransition from '../components/layout/PageTransition';
import FaqAccordion from '../components/faq/FaqAccordion';
import Button from '../components/common/Button';
import { FAQ_SECTIONS } from '../data/faq';

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
          <h1 className="text-4xl sm:text-5xl font-extrabold font-heading text-[#111111]">
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
              className="px-3 py-1.5 text-xs font-semibold rounded-full bg-white border-2 border-ink text-[#111111] hover:border-[#18A999] hover:text-[#087F73] transition-colors"
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
              className="bg-white border-2 border-ink rounded-3xl p-5 sm:p-8 shadow-xs scroll-mt-24"
            >
              <h2 className="text-xl font-bold font-heading text-[#111111] mb-2">
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
