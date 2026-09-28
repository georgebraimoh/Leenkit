import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

export default function Button({
  children,
  onClick,
  type = 'button',
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  disabled = false,
  showArrow = false,
  className = '',
  ...props
}) {
  const prefersReducedMotion = useReducedMotion();
  const baseStyles = 'group inline-flex items-center justify-center font-medium rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none disabled:pointer-events-none cursor-pointer';

  const sizeStyles = {
    sm: 'px-4 py-2 text-xs tracking-wide',
    md: 'px-5 py-2.5 text-sm tracking-wide',
    lg: 'px-7 py-3.5 text-base tracking-wide font-semibold',
  };

  const variantStyles = {
    primary: 'bg-[#18A999] text-white hover:bg-[#087F73] focus:ring-[#18A999]/40 shadow-sm shadow-[#18A999]/20 font-bold',
    secondary: 'bg-[#DDF4EF] text-[#087F73] hover:bg-[#cbf0e8] focus:ring-[#18A999]/20 border border-[#DDE3E0] font-bold',
    accent: 'bg-[#FFD166] text-[#172121] hover:bg-[#E6A800] focus:ring-[#FFD166]/40 font-bold',
    dark: 'bg-[#172121] text-white hover:bg-[#3D4948] focus:ring-[#172121] font-bold',
    outline: 'border border-[#DDE3E0] bg-white text-[#172121] hover:bg-[#DDF4EF] hover:border-[#18A999]/30 focus:ring-[#18A999]/30 font-bold',
    ghost: 'bg-transparent text-[#172121] hover:bg-[#DDF4EF] focus:ring-[#18A999]/20 font-bold',
    danger: 'bg-[#D64545] text-white hover:bg-[#b83535] focus:ring-rose-500/30 font-bold'
  };

  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled}
      whileHover={disabled || prefersReducedMotion ? undefined : { scale: 1.03, y: -1 }}
      whileTap={disabled || prefersReducedMotion ? undefined : { scale: 0.97 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
      className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...props}
    >
      <span className="flex items-center gap-2">
        {children}
        {showArrow && (
          <ArrowRight className="w-4 h-4 transition-transform duration-150 group-hover:translate-x-0.5" />
        )}
      </span>
    </motion.button>
  );
}
