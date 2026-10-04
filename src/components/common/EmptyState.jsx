import React from 'react';
import { m } from 'framer-motion';
import Button from './Button';
import { Compass } from 'lucide-react';

export default function EmptyState({
  icon: Icon = Compass,
  title = "Nothing planned yet",
  description = "Find something worth showing up for.",
  actionLabel = "Explore Hangouts",
  onAction,
  className = ""
}) {
  return (
    <m.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`p-10 text-center bg-white border-2 border-ink rounded-3xl flex flex-col items-center max-w-md mx-auto my-6 ${className}`}
    >
      <m.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.25 }}
        className="w-16 h-16 rounded-full bg-[#DDF4EF] text-[#18A999] flex items-center justify-center mb-4"
      >
        <Icon className="w-8 h-8" />
      </m.div>
      <h3 className="text-xl font-bold font-heading text-[#111111] mb-2">{title}</h3>
      <p className="text-sm text-[#6F6F6F] mb-6 leading-relaxed">{description}</p>
      {onAction && (
        <Button onClick={onAction} variant="primary" showArrow>
          {actionLabel}
        </Button>
      )}
    </m.div>
  );
}
