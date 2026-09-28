import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import PageTransition from '../components/layout/PageTransition';
import SearchBar from '../components/hangout/SearchBar';
import FilterBar from '../components/hangout/FilterBar';
import HangoutGrid from '../components/hangout/HangoutGrid';
import { useLeenkit } from '../context/LeenkitContext';
import { useLocationContext } from '../context/LocationContext';
import { MapPin, RefreshCw } from 'lucide-react';

export default function Explore() {
  const { hangouts } = useLeenkit();
  const {
    activeSearchLocation,
    distanceRadius,
    getDistanceFromActive,
    resetLocationFilter
  } = useLocationContext();

  const [searchParams, setSearchParams] = useSearchParams();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get('category') || 'all');

  useEffect(() => {
    const cat = searchParams.get('category');
    if (cat) setSelectedCategory(cat);
  }, [searchParams]);

  const handleCategorySelect = (catId) => {
    setSelectedCategory(catId);
    setSearchParams(prev => {
      if (catId === 'all') prev.delete('category');
      else prev.set('category', catId);
      return prev;
    });
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedCategory('all');
    resetLocationFilter();
    setSearchParams({});
  };

  // Extract radius integer in km if active (e.g. '10km' => 10)
  const maxRadiusKm = distanceRadius && distanceRadius !== 'Anywhere'
    ? parseInt(distanceRadius.replace('km', ''), 10)
    : null;

  // Filter hangouts by location distance, category, and search query
  const filteredHangouts = hangouts.filter(hangout => {
    // Standardize location object safely
    const locObj = typeof hangout.location === 'object' ? hangout.location : {
      placeName: hangout.location || '',
      city: hangout.city || '',
      country: hangout.country || ''
    };

    // Category filter
    if (selectedCategory !== 'all' && hangout.category.toLowerCase() !== selectedCategory.toLowerCase()) {
      return false;
    }

    // Distance Radius filter (if active location and radius set)
    if (activeSearchLocation && maxRadiusKm !== null) {
      const distance = getDistanceFromActive(locObj.latitude, locObj.longitude);
      if (distance === null || distance > maxRadiusKm) {
        return false;
      }
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const titleMatch = hangout.title?.toLowerCase().includes(q);
      const descMatch = hangout.description?.toLowerCase().includes(q);
      const placeMatch = locObj.placeName?.toLowerCase().includes(q);
      const addressMatch = locObj.address?.toLowerCase().includes(q);
      const cityMatch = locObj.city?.toLowerCase().includes(q);
      const countryMatch = locObj.country?.toLowerCase().includes(q);
      const catMatch = hangout.category?.toLowerCase().includes(q);

      if (!titleMatch && !descMatch && !placeMatch && !addressMatch && !cityMatch && !countryMatch && !catMatch) {
        return false;
      }
    }

    return true;
  });

  const locationTitle = activeSearchLocation
    ? (activeSearchLocation.placeName || activeSearchLocation.city || activeSearchLocation.country || 'selected location')
    : 'around the world';

  const isFiltered = selectedCategory !== 'all' || searchQuery || activeSearchLocation || (distanceRadius && distanceRadius !== 'Anywhere');

  return (
    <PageTransition>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Header Section */}
        <div className="space-y-4 max-w-3xl">
          <h1 className="text-4xl sm:text-5xl font-extrabold font-heading text-[#171717] tracking-tight">
            What Hangouts are happening <span className="text-[#18A999]">{locationTitle}?</span>
          </h1>

          <p className="text-base text-[#6F6F6F] leading-relaxed">
            Browse real-life Hangouts, meetups, and real-world gatherings happening near real coordinates.
          </p>

          <SearchBar value={searchQuery} onChange={setSearchQuery} />
        </div>

        {/* Filters Section */}
        <FilterBar
          selectedCategory={selectedCategory}
          onSelectCategory={handleCategorySelect}
        />

        {/* Results Counter */}
        <div className="flex items-center justify-between pt-4 border-t border-[#E8E6E1] text-xs text-[#6F6F6F]">
          <span>
            Showing <strong className="text-[#171717]">{filteredHangouts.length}</strong> {filteredHangouts.length === 1 ? 'Hangout' : 'Hangouts'}
          </span>
          {isFiltered && (
            <button
              onClick={handleResetFilters}
              className="text-[#18A999] hover:underline font-semibold cursor-pointer flex items-center gap-1 pressable link-nudge"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reset all filters</span>
            </button>
          )}
        </div>

        {/* Hangout Responsive Grid */}
        <HangoutGrid
          hangouts={filteredHangouts}
          onResetFilters={handleResetFilters}
        />
      </div>
    </PageTransition>
  );
}
