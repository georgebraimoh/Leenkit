import React, { createContext, useContext, useEffect, useState } from 'react';

const LocationContext = createContext();

const STORAGE_KEY_LOCATION = 'leenkit_active_location';

function readSaved() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_LOCATION);
    if (!saved) return null;
    const parsed = JSON.parse(saved);
    return parsed && typeof parsed.placeName === 'string' && parsed.placeName.trim() ? { placeName: parsed.placeName } : null;
  } catch {
    return null;
  }
}

// The area a visitor is browsing (matched against Hangout venue text).
export function LocationProvider({ children }) {
  const [activeSearchLocation, setActiveSearchLocation] = useState(readSaved);

  useEffect(() => {
    try {
      if (activeSearchLocation) {
        localStorage.setItem(STORAGE_KEY_LOCATION, JSON.stringify(activeSearchLocation));
      } else {
        localStorage.removeItem(STORAGE_KEY_LOCATION);
      }
      localStorage.removeItem('leenq_active_location');
    } catch {
      // Private mode or blocked storage: the filter just isn't remembered.
    }
  }, [activeSearchLocation]);

  const setSearchLocation = (placeObj) => setActiveSearchLocation(placeObj || null);
  const resetLocationFilter = () => setActiveSearchLocation(null);

  return (
    <LocationContext.Provider value={{
      activeSearchLocation,
      setSearchLocation,
      resetLocationFilter
    }}>
      {children}
    </LocationContext.Provider>
  );
}

export function useLocationContext() {
  return useContext(LocationContext);
}
