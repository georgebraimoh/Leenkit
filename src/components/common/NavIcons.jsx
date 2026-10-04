import React from 'react';

// Navigation icons in the style of Apple's SF Symbols: rounded strokes,
// with a filled variant for the active tab (like the iOS tab bar).
function Svg({ children, className = 'w-6 h-6', ...props }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className} {...props}>
      {children}
    </svg>
  );
}

export function HomeIcon({ filled, className }) {
  return filled ? (
    <Svg className={className} stroke="none">
      <path fill="currentColor" d="M11.16 3.1a1.3 1.3 0 0 1 1.68 0l8.2 6.9a.9.9 0 1 1-1.16 1.38L19 10.6V19a2 2 0 0 1-2 2h-3v-5.25a.75.75 0 0 0-.75-.75h-2.5a.75.75 0 0 0-.75.75V21H7a2 2 0 0 1-2-2v-8.4l-.88.78A.9.9 0 1 1 2.96 10l8.2-6.9z" />
    </Svg>
  ) : (
    <Svg className={className}>
      <path d="M3.5 10.5 12 3.6l8.5 6.9" />
      <path d="M5.75 9.3V19a1.5 1.5 0 0 0 1.5 1.5H10v-5h4v5h2.75a1.5 1.5 0 0 0 1.5-1.5V9.3" />
    </Svg>
  );
}

export function SparklesIcon({ filled, className }) {
  const big = 'M10 4.5c.6 3.6 2.4 5.4 6 6-3.6.6-5.4 2.4-6 6-.6-3.6-2.4-5.4-6-6 3.6-.6 5.4-2.4 6-6z';
  const small = 'M18 2.75c.25 1.4.85 2 2.25 2.25-1.4.25-2 .85-2.25 2.25-.25-1.4-.85-2-2.25-2.25 1.4-.25 2-.85 2.25-2.25z';
  const tiny = 'M17.5 15.25c.2 1.05.65 1.5 1.75 1.75-1.1.25-1.55.7-1.75 1.75-.2-1.05-.65-1.5-1.75-1.75 1.1-.25 1.55-.7 1.75-1.75z';
  return (
    <Svg className={className} fill={filled ? 'currentColor' : 'none'}>
      <path d={big} />
      <path d={small} />
      <path d={tiny} />
    </Svg>
  );
}

export function CalendarIcon({ filled, className }) {
  return filled ? (
    <Svg className={className} stroke="none">
      <path fill="currentColor" d="M7.5 2.75a.9.9 0 0 1 .9.9V4.5h7.2v-.85a.9.9 0 1 1 1.8 0v.85h.6a3 3 0 0 1 3 3V18a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V7.5a3 3 0 0 1 3-3h.6v-.85a.9.9 0 0 1 .9-.9zM4.8 9.5V18c0 .66.54 1.2 1.2 1.2h12c.66 0 1.2-.54 1.2-1.2V9.5z" />
      <g fill="currentColor">
        <rect x="6.6" y="11.2" width="2.6" height="2.4" rx=".6" />
        <rect x="10.7" y="11.2" width="2.6" height="2.4" rx=".6" />
        <rect x="14.8" y="11.2" width="2.6" height="2.4" rx=".6" />
        <rect x="6.6" y="15.1" width="2.6" height="2.4" rx=".6" />
        <rect x="10.7" y="15.1" width="2.6" height="2.4" rx=".6" />
      </g>
    </Svg>
  ) : (
    <Svg className={className}>
      <rect x="3.75" y="5.25" width="16.5" height="15" rx="2.5" />
      <path d="M3.75 9.75h16.5M7.75 3.5v3.25M16.25 3.5v3.25" />
    </Svg>
  );
}

export function PersonIcon({ filled, className }) {
  return filled ? (
    <Svg className={className} stroke="none">
      <path fill="currentColor" fillRule="evenodd" d="M12 2.75a9.25 9.25 0 1 1 0 18.5 9.25 9.25 0 0 1 0-18.5zM12 6.6a3.15 3.15 0 1 0 0 6.3 3.15 3.15 0 0 0 0-6.3zm0 7.9c-2.2 0-4.15.95-5.35 2.55a7.4 7.4 0 0 0 10.7 0C16.15 15.45 14.2 14.5 12 14.5z" />
    </Svg>
  ) : (
    <Svg className={className}>
      <circle cx="12" cy="12" r="8.75" />
      <circle cx="12" cy="9.75" r="3" />
      <path d="M6.6 17.6c1.25-1.8 3.15-2.75 5.4-2.75s4.15.95 5.4 2.75" />
    </Svg>
  );
}

export function ShieldIcon({ filled, className }) {
  return (
    <Svg className={className} fill={filled ? 'currentColor' : 'none'}>
      <path d="M12 3.1 19 5.9v5.3c0 4.35-2.9 8.05-7 9.7-4.1-1.65-7-5.35-7-9.7V5.9z" />
    </Svg>
  );
}

export function PlusIcon({ className }) {
  return (
    <Svg className={className} strokeWidth="2.4">
      <path d="M12 5v14M5 12h14" />
    </Svg>
  );
}

export function BellIcon({ filled, className }) {
  return (
    <Svg className={className} fill={filled ? 'currentColor' : 'none'}>
      <path d="M6.25 16.75V10.5a5.75 5.75 0 0 1 11.5 0v6.25l1.5 1.75H4.75z" />
      <path d="M10 20.75a2.1 2.1 0 0 0 4 0" fill="none" />
    </Svg>
  );
}
