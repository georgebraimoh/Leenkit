import React from 'react';
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
  const baseStyles = 'pressable group inline-flex items-center justify-center font-bold rounded-xl border-2 border-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#111111] disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none disabled:pointer-events-none cursor-pointer';

  const sizeStyles = {
    sm: 'px-3.5 py-1.5 text-xs shadow-xs',
    md: 'px-5 py-2.5 text-sm shadow-xs',
    lg: 'px-6 py-3.5 text-base shadow-sm',
  };

  const variantStyles = {
    primary: 'bg-[#18A999] text-white hover:bg-[#087F73]',
    secondary: 'bg-[#DDF4EF] text-[#111111] hover:bg-[#cbf0e8]',
    accent: 'bg-[#FF6B2C] text-white hover:bg-[#E85A1C]',
    dark: 'bg-[#111111] text-white hover:bg-[#3D4948]',
    outline: 'bg-white text-[#111111] hover:bg-[#FFF8EE]',
    ghost: 'bg-transparent text-[#111111] border-transparent shadow-none hover:bg-white hover:border-ink',
    danger: 'bg-[#D64545] text-white hover:bg-[#b83535]'
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...props}
    >
      <span className="flex items-center gap-2">
        {children}
        {showArrow && (
          <ArrowRight className="w-4 h-4 transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden="true" />
        )}
      </span>
    </button>
  );
}
