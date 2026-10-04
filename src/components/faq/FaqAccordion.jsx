import React, { useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';

function FaqItem({ item, isOpen, onToggle }) {
  const panelId = useId();
  const buttonId = useId();

  return (
    <div className="border-b-2 border-ink last:border-b-0">
      <h3>
        <button
          type="button"
          id={buttonId}
          aria-expanded={isOpen}
          aria-controls={panelId}
          onClick={onToggle}
          className="w-full flex items-start justify-between gap-4 py-4 text-left cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#18A999]/40 focus-visible:ring-offset-2 rounded-xl"
        >
          <span className="font-heading font-bold text-sm sm:text-base text-[#111111] leading-snug">
            {item.question}
          </span>
          <ChevronDown
            className={`w-5 h-5 shrink-0 mt-0.5 pointer-events-none text-[#3D4948] transition-transform duration-200 ${
              isOpen ? 'rotate-180 text-[#18A999]' : ''
            }`}
            aria-hidden="true"
          />
        </button>
      </h3>
      <div
        id={panelId}
        role="region"
        aria-labelledby={buttonId}
        hidden={!isOpen}
        className={isOpen ? 'pb-4' : 'hidden'}
      >
        <p className="text-sm text-[#3D4948] leading-relaxed">{item.answer}</p>
      </div>
    </div>
  );
}

export default function FaqAccordion({ items }) {
  const [openIds, setOpenIds] = useState(() => new Set());

  const toggle = (id) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="divide-y-0">
      {items.map((item) => (
        <FaqItem
          key={item.id}
          item={item}
          isOpen={openIds.has(item.id)}
          onToggle={() => toggle(item.id)}
        />
      ))}
    </div>
  );
}
