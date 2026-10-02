import React, { useState } from 'react';
import { initialsOf } from '../../utils/format';

const SIZES = {
  xs: 'w-5 h-5 text-[9px]',
  sm: 'w-6 h-6 text-[10px]',
  md: 'w-8 h-8 text-xs',
  lg: 'w-10 h-10 text-xs',
  xl: 'w-14 h-14 text-base',
  '2xl': 'w-24 h-24 sm:w-28 sm:h-28 text-2xl'
};

// Profile photo with an initials fallback. Never shows a stock photo of a
// stranger for members who have not uploaded one.
export default function Avatar({ src, name, size = 'md', className = '' }) {
  const [failed, setFailed] = useState(false);
  const sizeClass = SIZES[size] || SIZES.md;

  if (src && !failed) {
    return (
      <img
        src={src}
        alt={name ? `${name}'s profile picture` : 'Profile picture'}
        loading="lazy"
        onError={() => setFailed(true)}
        className={`${sizeClass} rounded-full object-cover shrink-0 bg-[#EEF1EF] ${className}`}
      />
    );
  }

  return (
    <span
      role="img"
      aria-label={name ? `${name}'s profile picture` : 'Profile picture'}
      className={`${sizeClass} rounded-full shrink-0 bg-[#18A999] text-white font-bold flex items-center justify-center select-none ${className}`}
    >
      {initialsOf(name)}
    </span>
  );
}
