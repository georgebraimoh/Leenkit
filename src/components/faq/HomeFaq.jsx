import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import FaqAccordion from './FaqAccordion';
import { FAQ_SECTIONS } from '../../data/faq';

// The most common questions, using the same approved answers as /faq.
const HOME_FAQ_IDS = ['what-is-leenkit', 'all-free', 'browse-without-account', 'join-hangout', 'hangout-space', 'is-safe'];

const ALL_ITEMS = FAQ_SECTIONS.flatMap((section) => section.items);
const HOME_ITEMS = HOME_FAQ_IDS.map((id) => ALL_ITEMS.find((item) => item.id === id)).filter(Boolean);

export default function HomeFaq() {
  return (
    <section aria-labelledby="home-faq-title" className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="flex items-end justify-between gap-4 mb-6">
        <h2 id="home-faq-title" className="text-3xl md:text-4xl font-extrabold font-heading text-[#111111]">
          Questions?
        </h2>
        <Link to="/faq" className="text-sm font-bold text-[#111111] hover:text-[#FF6B2C] flex items-center gap-1 link-nudge">
          <span>All FAQs</span>
          <ArrowRight className="w-4 h-4" aria-hidden="true" />
        </Link>
      </div>
      <div className="bg-white border-2 border-ink rounded-3xl shadow-md px-5 sm:px-7 py-2">
        <FaqAccordion items={HOME_ITEMS} />
      </div>
    </section>
  );
}
