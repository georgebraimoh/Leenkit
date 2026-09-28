import React from 'react';

export default function FormField({
  label,
  error,
  required,
  children,
  helpText,
  className = ""
}) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <label className="block text-xs font-semibold text-[#172121] tracking-wider uppercase">
          {label} {required && <span className="text-[#18A999]">*</span>}
        </label>
      )}
      {children}
      {helpText && !error && (
        <p className="text-xs text-[#6F6F6F]">{helpText}</p>
      )}
      {error && (
        <p className="text-xs font-medium text-rose-500 flex items-center gap-1">
          <span>•</span> {error}
        </p>
      )}
    </div>
  );
}
