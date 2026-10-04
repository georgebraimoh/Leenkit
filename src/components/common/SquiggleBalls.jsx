import React from 'react';

// The animated underline under "Find a Hangout." with two small brand balls
// (orange and sea green) riding on it. They slide toward each other, merge
// and blend where they meet (the green turns see-through as they overlap),
// then roll back to their own ends, on a loop. The line and the
// balls sway together. Must sit inside a `relative` element. CSS in index.css.
export default function SquiggleBalls() {
  return (
    <span className="squiggle animate-squiggle" aria-hidden="true">
      <svg className="squiggle__line" viewBox="0 0 300 12" fill="none" preserveAspectRatio="none">
        <path
          d="M2 6 C 50 1, 100 11, 150 6 C 200 1, 250 11, 298 6"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
        />
      </svg>
      <span className="squiggle__balls">
        <span className="squiggle__track squiggle__track--orange">
          <span className="squiggle__ball squiggle__ball--orange" />
        </span>
        <span className="squiggle__track squiggle__track--green">
          <span className="squiggle__ball squiggle__ball--green" />
        </span>
      </span>
    </span>
  );
}
