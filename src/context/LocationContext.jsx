import React, { createContext, useContext, useState, useEffect } from 'react';
import { locationService, calculateDistance } from '../services/location/locationService';

const LocationContext = createContext();

const STORAGE_KEY_LOCATION = 'leenkit_active_location';
const FALLBACK_STORAGE_KEY_LOCATION = 'leenq_active_location';

export function LocationProvider({ children }) {
  const [userLocation, setUserLocation] = useState(null);
  const [activeSearchLocation, setActiveSearchLocation] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY_LOCATION) || localStorage.getItem(FALLBACK_STORAGE_KEY_LOCATION);
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error(e); }
    }
    return null;
  });
  const [distanceRadius, setDistanceRadius] = useState('Anywhere'); // '10km', '25km', '50km', 'Anywhere'

  useEffect(() => {
    if (activeSearchLocation) {
      localStorage.setItem(STORAGE_KEY_LOCATION, JSON.stringify(activeSearchLocation));
    } else {
      localStorage.removeItem(STORAGE_KEY_LOCATION);
    }
  }, [activeSearchLocation]);

  const enableUserLocation = async () => {
    try {
      const loc = await locationService.getCurrentLocation();
      setUserLocation(loc);
      setActiveSearchLocation(loc);
      return loc;
    } catch (err) {
      console.warn("Location permission not granted or unavailable.");
      return null;
    }
  };

  const setSearchLocation = (placeObj) => {
    setActiveSearchLocation(placeObj);
  };

  const resetLocationFilter = () => {
    setActiveSearchLocation(null);
    setDistanceRadius('Anywhere');
  };

  // Helper to calculate distance from active location to a hangout
  const getDistanceFromActive = (hangoutLat, hangoutLon) => {
    const currentLat = activeSearchLocation?.latitude || userLocation?.latitude;
    const currentLon = activeSearchLocation?.longitude || userLocation?.longitude;

    if (!currentLat || !currentLon || !hangoutLat || !hangoutLon) return null;
    return calculateDistance(currentLat, currentLon, hangoutLat, hangoutLon);
  };

  return (
    <LocationContext.Provider value={{
      userLocation,
      activeSearchLocation,
      distanceRadius,
      setDistanceRadius,
      enableUserLocation,
      setSearchLocation,
      resetLocationFilter,
      getDistanceFromActive
    }}>
      {children}
    </LocationContext.Provider>
  );
}

export function useLocationContext() {
  return useContext(LocationContext);
}
