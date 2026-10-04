import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Link as LinkIcon, AlertCircle } from 'lucide-react';
import { locationService } from '../../services/location/locationService';

export default function LocationPicker({
  value,
  onSelectLocation,
  onChange,
  error
}) {
  // Safe helper to invoke either onSelectLocation or onChange callback
  const notifyLocation = (loc) => {
    if (typeof onSelectLocation === 'function') {
      onSelectLocation(loc);
    }
    if (typeof onChange === 'function') {
      onChange(loc);
    }
  };

  // Extract initial values from prop
  const initialText = typeof value === 'object' && value ? (value.locationText || value.placeName || value.address || '') : (typeof value === 'string' ? value : '');
  const initialUrl = typeof value === 'object' && value ? (value.googleMapsUrl || value.rawGoogleMapsUrl || '') : '';

  const [locationText, setLocationText] = useState(initialText);
  const [googleMapsUrl, setGoogleMapsUrl] = useState(initialUrl);
  const [urlValidationError, setUrlValidationError] = useState('');

  // Flag to distinguish internal user typing from external prop resets
  const isInternalChangeRef = useRef(false);

  // Sync internal state ONLY when value changes externally (e.g. form reset or initial load)
  useEffect(() => {
    if (isInternalChangeRef.current) {
      isInternalChangeRef.current = false;
      return;
    }

    if (value && typeof value === 'object') {
      setLocationText(value.locationText || value.placeName || value.address || '');
      setGoogleMapsUrl(value.googleMapsUrl || value.rawGoogleMapsUrl || '');
    } else if (typeof value === 'string') {
      setLocationText(value);
    } else if (!value) {
      setLocationText('');
      setGoogleMapsUrl('');
    }
  }, [value]);

  const handleChange = (text, url) => {
    isInternalChangeRef.current = true;

    const trimmedUrl = (url || '').trim();
    const normalizedUrl = trimmedUrl && !/^https?:\/\//i.test(trimmedUrl) ? `https://${trimmedUrl}` : trimmedUrl;

    let urlErr = '';
    let isValidUrl = true;

    if (!trimmedUrl) {
      isValidUrl = false;
    } else {
      isValidUrl = locationService.validateGoogleMapsUrl(normalizedUrl);
      if (!isValidUrl) {
        urlErr = 'Please enter a valid Google Maps link (e.g. https://maps.app.goo.gl/... or https://www.google.com/maps/...)';
      }
    }

    setUrlValidationError(urlErr);

    if (!text && !trimmedUrl) {
      notifyLocation(null);
      return;
    }

    const finalUrl = isValidUrl ? normalizedUrl : null;
    const placeName = text.trim() || (finalUrl ? 'Google Maps Location' : '');
    const address = text.trim() || (finalUrl ? 'Navigable via Google Maps' : '');

    notifyLocation({
      placeName,
      address,
      locationText: text,
      city: typeof value === 'object' ? value?.city || null : null,
      country: typeof value === 'object' ? value?.country || null : null,
      countryCode: typeof value === 'object' ? value?.countryCode || null : null,
      latitude: typeof value === 'object' ? value?.latitude || null : null,
      longitude: typeof value === 'object' ? value?.longitude || null : null,
      googleMapsUrl: finalUrl,
      rawGoogleMapsUrl: url,
      hasUrlError: Boolean(urlErr) || !trimmedUrl
    });
  };

  const handleTextChange = (e) => {
    const text = e.target.value;
    setLocationText(text);
    handleChange(text, googleMapsUrl);
  };

  const handleUrlChange = (e) => {
    const url = e.target.value;
    setGoogleMapsUrl(url);
    handleChange(locationText, url);
  };

  return (
    <div className="space-y-4 w-full">
      {/* LOCATION / VENUE NAME TEXT INPUT */}
      <div className="space-y-1.5">
        <label className="text-xs font-bold text-[#111111] uppercase tracking-wider flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5 text-[#18A999]" />
          <span>Location / Venue Name</span>
        </label>
        
        <input
          type="text"
          value={locationText}
          onChange={handleTextChange}
          placeholder="e.g. Landmark Beach, Victoria Island, Lagos"
          className="w-full px-4 py-3 bg-[#EEF1EF] border-2 border-ink rounded-2xl text-sm text-[#111111] placeholder-[#6F6F6F] focus:outline-none focus:bg-white focus:border-[#18A999] shadow-xs transition-all"
        />
        
        <p className="text-[11px] text-[#6F6F6F]">
          Enter the venue, street address, or general location name of your Hangout.
        </p>
      </div>

      {/* REQUIRED GOOGLE MAPS LINK INPUT */}
      <div className="space-y-1.5 pt-1 border-t-2 border-ink">
        <label className="text-xs font-bold text-[#111111] uppercase tracking-wider flex items-center gap-1.5 pt-1">
          <LinkIcon className="w-3.5 h-3.5 text-[#18A999]" />
          <span>Google Maps link</span>
          <span className="text-rose-500 font-bold">*</span>
        </label>

        <input
          type="url"
          value={googleMapsUrl}
          onChange={handleUrlChange}
          placeholder="Paste Google Maps link (e.g. https://maps.app.goo.gl/...)"
          className={`w-full px-4 py-3 bg-[#EEF1EF] border rounded-2xl text-sm text-[#111111] placeholder-[#6F6F6F] focus:outline-none focus:bg-white transition-all shadow-xs ${
            urlValidationError ? 'border-rose-400 focus:border-rose-600 bg-rose-50/20' : 'border-ink focus:border-[#18A999]'
          }`}
        />

        {urlValidationError ? (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-medium text-rose-700 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span>{urlValidationError}</span>
          </div>
        ) : (
          <p className="text-[11px] text-[#6F6F6F]">
            Paste a Google Maps link so attendees can easily navigate to the Hangout spot.
          </p>
        )}
      </div>

      {/* FORM VALIDATION ERROR PROP */}
      {error && !urlValidationError && (
        <p className="text-xs font-semibold text-rose-500">
          {error}
        </p>
      )}
    </div>
  );
}
