import React from 'react';
import CategoryChip from '../common/CategoryChip';
import LocationAutocomplete from '../common/LocationAutocomplete';
import { CATEGORIES } from '../../data/categories';
import { useLocationContext } from '../../context/LocationContext';
import { MapPin, Navigation, SlidersHorizontal, RefreshCw } from 'lucide-react';

export default function FilterBar({
  selectedCategory,
  onSelectCategory
}) {
  const {
    activeSearchLocation,
    setSearchLocation,
    distanceRadius,
    setDistanceRadius,
    resetLocationFilter
  } = useLocationContext();

  return (
    <div className="space-y-4">
      {/* Category Pills Bar */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
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

      {/* Location Search & Distance Radius Bar */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center pt-2 border-t border-[#EFE8DB]">
        {/* Location Search Bar */}
        <div className="md:col-span-8">
          <LocationAutocomplete
            value={activeSearchLocation}
            onSelectLocation={(loc) => setSearchLocation(loc)}
            placeholder="Search a place, landmark, or meeting point..."
          />
        </div>

        {/* Radius Filter */}
        <div className="md:col-span-4 flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#6F6F6F] shrink-0">
            Radius:
          </span>
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-1 text-xs w-full">
            {['Anywhere', '10km', '25km', '50km'].map((radius) => {
              const isActive = distanceRadius === radius;
              return (
                <button
                  key={radius}
                  type="button"
                  onClick={() => setDistanceRadius(radius)}
                  className={`px-3 py-1.5 rounded-full font-semibold transition-all shrink-0 cursor-pointer pressable ${
                    isActive
                      ? 'bg-[#171717] text-white shadow-xs'
                      : 'bg-white border border-[#EFE8DB] text-[#6F6F6F] hover:border-[#D6D2C9] hover:text-[#171717]'
                  }`}
                >
                  {radius}
                </button>
              );
            })}
          </div>

          {activeSearchLocation && (
            <button
              type="button"
              onClick={resetLocationFilter}
              className="p-2 text-[#6F6F6F] hover:text-[#18A999] hover:rotate-180 transition-all duration-300 shrink-0 cursor-pointer pressable"
              title="Reset location filter"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
