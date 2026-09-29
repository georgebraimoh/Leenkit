/**
 * LEENKIT Location Service — Worldwide Manual Location Entry & Google Maps Validation
 * Zero external map API calls (Google Places API / Nominatim / Overpass removed).
 */

// Local Haversine distance calculator for coordinates when available
export function calculateDistance(lat1, lon1, lat2, lon2) {
  if (lat1 === null || lat1 === undefined || lon1 === null || lon1 === undefined ||
      lat2 === null || lat2 === undefined || lon2 === null || lon2 === undefined) {
    return null;
  }
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

/**
 * Validates whether a given string is a valid Google Maps link.
 * Does NOT perform network requests. Inspects pattern, protocol, and hostname only.
 */
export function validateGoogleMapsUrl(url) {
  if (!url || typeof url !== 'string') return false;
  let trimmed = url.trim();
  if (!trimmed) return false;

  if (!/^https?:\/\//i.test(trimmed)) {
    trimmed = 'https://' + trimmed;
  }

  try {
    const parsed = new URL(trimmed);

    // Protocol check
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }

    const hostname = parsed.hostname.toLowerCase();

    // Accepted Google Maps hostnames & shortlinks
    const isGoogleMapsHost =
      hostname === 'maps.google.com' ||
      hostname.endsWith('.maps.google.com') ||
      hostname === 'google.com' ||
      hostname.endsWith('.google.com') ||
      hostname === 'maps.app.goo.gl' ||
      hostname === 'goo.gl';

    if (!isGoogleMapsHost) return false;

    // Path check for main google.com domain
    if (hostname.includes('google.com') && !hostname.startsWith('maps.')) {
      if (!parsed.pathname.startsWith('/maps')) {
        return false;
      }
    }

    return true;
  } catch (err) {
    return false;
  }
}

export const locationService = {
  validateGoogleMapsUrl,

  /**
   * Helper to format a manual location text input + optional Google Maps link into a location object
   */
  formatLocation(locationText, googleMapsUrl = null) {
    const text = (locationText || '').trim();
    const url = googleMapsUrl && validateGoogleMapsUrl(googleMapsUrl) ? googleMapsUrl.trim() : null;

    return {
      placeName: text || (url ? 'Custom Google Maps Location' : 'Meeting Location'),
      address: text || (url ? 'Navigable via Google Maps' : ''),
      city: null,
      country: null,
      countryCode: null,
      latitude: null,
      longitude: null,
      googleMapsUrl: url
    };
  },

  // Safe fallback search method for legacy filter inputs
  async searchPlaces(query) {
    if (!query || !query.trim()) return [];
    const text = query.trim();
    return [{
      placeName: text,
      address: text,
      city: null,
      country: null,
      countryCode: null,
      latitude: null,
      longitude: null
    }];
  },

  // Fallback stubs for legacy components
  getStates() { return []; },
  getCitiesByState() { return []; },
  getAreasByCity() { return []; },
  getPlacesByArea() { return []; },
  searchNigeriaLocations(query) { return this.searchPlaces(query); },

  async getCurrentLocation() {
    return {
      placeName: "Manual Location",
      address: "Manual Location",
      city: null,
      country: null,
      countryCode: null,
      latitude: null,
      longitude: null
    };
  }
};
