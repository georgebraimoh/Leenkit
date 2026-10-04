import React, { useEffect, useId, useState } from 'react';
import { MapPin, Search, X } from 'lucide-react';

// Area search by name (venue, neighbourhood, city). LEENKIT does not geocode
// yet, so this matches the text hosts entered for their venue; there is no
// GPS / "near me" until coordinates are stored with each Hangout.
export default function LocationAutocomplete({
  value,
  onSelectLocation,
  placeholder = 'Area, venue or city (e.g. Lekki, Wuse 2)',
  label = 'Search by area'
}) {
  const inputId = useId();
  const currentText = value && typeof value === 'object' ? (value.placeName || '') : (value || '');
  const [query, setQuery] = useState(currentText);

  useEffect(() => {
    setQuery(currentText);
  }, [currentText]);

  const commit = (text) => {
    const trimmed = (text || '').trim();
    if (trimmed === currentText.trim()) return;
    onSelectLocation(trimmed ? { placeName: trimmed } : null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    commit(query);
  };

  const handleClear = () => {
    setQuery('');
    onSelectLocation(null);
  };

  return (
    <form onSubmit={handleSubmit} role="search" className="relative w-full">
      <label htmlFor={inputId} className="sr-only">{label}</label>
      <div className="relative flex items-center">
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#18A999]">
          <MapPin className="w-4 h-4" aria-hidden="true" />
        </div>
        <input
          id={inputId}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onBlur={() => commit(query)}
          placeholder={placeholder}
          maxLength={120}
          enterKeyHint="search"
          className="w-full pl-10 pr-24 py-3 bg-[#EEF1EF] border-2 border-ink rounded-2xl text-sm text-[#111111] placeholder-[#6F6F6F] focus:outline-none focus:bg-white focus:border-[#18A999] shadow-xs transition-all"
        />
        <div className="absolute inset-y-0 right-0 pr-2 flex items-center gap-1">
          {query && (
            <button
              type="button"
              onClick={handleClear}
              aria-label="Clear area"
              className="p-1.5 rounded-full text-[#6F6F6F] hover:text-[#111111] cursor-pointer"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          )}
          <button
            type="submit"
            aria-label="Search area"
            className="px-2.5 py-1.5 bg-white border-2 border-ink hover:border-[#18A999] text-[#111111] hover:text-[#18A999] rounded-xl text-xs font-semibold flex items-center gap-1 shadow-xs transition-colors cursor-pointer"
          >
            <Search className="w-3.5 h-3.5 text-[#18A999]" aria-hidden="true" />
            <span className="hidden sm:inline">Search</span>
          </button>
        </div>
      </div>
    </form>
  );
}
