import React from 'react';
import CategoryChip from '../common/CategoryChip';
import LocationAutocomplete from '../common/LocationAutocomplete';
import { CATEGORIES } from '../../data/categories';
import { useLocationContext } from '../../context/LocationContext';

export const WHEN_FILTERS = [
  { id: 'any', label: 'Any time' },
  { id: 'today', label: 'Today' },
  { id: 'weekend', label: 'This weekend' },
  { id: 'week', label: 'Next 7 days' }
];

export const PRICE_FILTERS = [
  { id: 'any', label: 'Free & paid' },
  { id: 'free', label: 'Free' },
  { id: 'paid', label: 'Paid' }
];

function PillGroup({ label, options, value, onChange }) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-1" role="group" aria-label={label}>
      {options.map(opt => {
        const isActive = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange(opt.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all shrink-0 cursor-pointer pressable ${
              isActive
                ? 'bg-[#111111] text-white shadow-xs'
                : 'bg-white border-2 border-ink text-[#3D4948] hover:text-[#111111]'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export default function FilterBar({
  selectedCategory,
  onSelectCategory,
  when = 'any',
  onWhenChange,
  price = 'any',
  onPriceChange
}) {
  const { activeSearchLocation, setSearchLocation } = useLocationContext();

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1" role="group" aria-label="Category">
        {CATEGORIES.map((cat) => (
          <CategoryChip
            key={cat.id}
            label={cat.label}
            icon={cat.icon}
            active={selectedCategory === cat.id}
            onClick={() => onSelectCategory(cat.id)}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center pt-2 border-t-2 border-ink">
        <div className="md:col-span-5">
          <LocationAutocomplete
            value={activeSearchLocation}
            onSelectLocation={(loc) => setSearchLocation(loc)}
          />
        </div>
        <div className="md:col-span-7 flex flex-wrap items-center gap-x-4 gap-y-1">
          {onWhenChange && <PillGroup label="When" options={WHEN_FILTERS} value={when} onChange={onWhenChange} />}
          {onPriceChange && <PillGroup label="Price" options={PRICE_FILTERS} value={price} onChange={onPriceChange} />}
        </div>
      </div>
    </div>
  );
}
