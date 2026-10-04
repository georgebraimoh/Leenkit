import React from 'react';
import { m, AnimatePresence } from 'framer-motion';
import HangoutCard from './HangoutCard';
import EmptyState from '../common/EmptyState';

const EASE = [0.16, 1, 0.3, 1];

// Cards fade in with a short stagger and glide into place when filters change.
export default function HangoutGrid({ hangouts = [], onResetFilters }) {
  if (hangouts.length === 0) {
    return (
      <EmptyState
        title="No Hangouts match"
        description="Try other filters."
        actionLabel="Clear filters"
        onAction={onResetFilters}
      />
    );
  }

  return (
    <m.div layout className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
      <AnimatePresence mode="popLayout">
        {hangouts.map((hangout, index) => {
          const featured = index === 0 && hangouts.length > 3;
          return (
            <m.div
              key={hangout.id}
              layout
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE, delay: Math.min(index, 8) * 0.05 } }}
              exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.2 } }}
              transition={{ layout: { duration: 0.35, ease: EASE } }}
              className={`h-full ${featured ? 'md:col-span-2' : ''}`}
            >
              <HangoutCard hangout={hangout} featured={featured} />
            </m.div>
          );
        })}
      </AnimatePresence>
    </m.div>
  );
}
