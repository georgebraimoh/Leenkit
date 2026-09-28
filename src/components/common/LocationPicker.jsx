import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Link as LinkIcon, AlertCircle } from 'lucide-react';
import { locationService } from '../../services/location/locationService';

export default function LocationPicker({
  value,
  onSelectLocation,
  error
}) {
  // Extract initial values from prop
  const initialText = typeof value === 'object' && value ? (value.placeName || value.address || '') : (typeof value === 'string' ? value : '');
  const initialUrl = typeof value === 'object' && value ? (value.googleMapsUrl || '') : '';

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
      setLocationText(value.placeName || value.address || '');
      setGoogleMapsUrl(value.googleMapsUrl || '');
    } else if (typeof value === 'string') {
      setLocationText(value);
    } else if (!value) {
      setLocationText('');
      setGoogleMapsUrl('');
    }
  }, [value]);

  const handleChange = (text, url) => {
    isInternalChangeRef.current = true;

    const trimmedUrl = url.trim();

    let urlErr = '';
    let isValidUrl = true;

    if (trimmedUrl) {
      isValidUrl = locationService.validateGoogleMapsUrl(trimmedUrl);
      if (!isValidUrl) {
        urlErr = 'Please enter a valid Google Maps link (e.g. https://maps.app.goo.gl/... or https://www.google.com/maps/...)';
      }
    }

    setUrlValidationError(urlErr);

    if (!text && !trimmedUrl) {
      onSelectLocation(null);
      return;
    }

    // Preserve raw input text exactly as typed (spaces, commas, periods, quotes) without trimming while typing
    onSelectLocation({
      placeName: text,
      address: text,
      city: typeof value === 'object' ? value?.city || null : null,
      country: typeof value === 'object' ? value?.country || null : null,
      countryCode: typeof value === 'object' ? value?.countryCode || null : null,
      latitude: typeof value === 'object' ? value?.latitude || null : null,
      longitude: typeof value === 'object' ? value?.longitude || null : null,
      googleMapsUrl: isValidUrl && trimmedUrl ? trimmedUrl : null,
      hasUrlError: Boolean(urlErr)
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
      {/* REQUIRED LOCATION TEXT INPUT */}
      <div className="space-y-1.5">
        <label className="text-xs font-bold text-[#172121] uppercase tracking-wider flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5 text-[#18A999]" />
          <span>Location</span>
          <span className="text-rose-500 font-bold">*</span>
        </label>
        
        <input
          type="text"
          value={locationText}
          onChange={handleTextChange}
          placeholder="e.g. Landmark Beach, Victoria Island, Lagos"
          className="w-full px-4 py-3 bg-[#EEF1EF] border border-[#DDE3E0] rounded-2xl text-sm text-[#172121] placeholder-[#6F6F6F] focus:outline-none focus:bg-white focus:border-[#18A999] shadow-xs transition-all"
        />
        
        <p className="text-[11px] text-[#6F6F6F]">
          Enter the venue, street address, or general location of your Hangout.
        </p>
      </div>

      {/* OPTIONAL GOOGLE MAPS LINK INPUT */}
      <div className="space-y-1.5 pt-1 border-t border-[#DDE3E0]">
        <label className="text-xs font-bold text-[#172121] uppercase tracking-wider flex items-center gap-1.5 pt-1">
          <LinkIcon className="w-3.5 h-3.5 text-[#18A999]" />
          <span>Google Maps link (optional)</span>
        </label>

        <input
          type="url"
          value={googleMapsUrl}
          onChange={handleUrlChange}
          placeholder="Paste Google Maps link (e.g. https://maps.app.goo.gl/...)"
          className={`w-full px-4 py-3 bg-[#EEF1EF] border rounded-2xl text-sm text-[#172121] placeholder-[#6F6F6F] focus:outline-none focus:bg-white transition-all shadow-xs ${
            urlValidationError ? 'border-rose-400 focus:border-rose-600 bg-rose-50/20' : 'border-[#DDE3E0] focus:border-[#18A999]'
          }`}
        />

        {urlValidationError ? (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-medium text-rose-700 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span>{urlValidationError}</span>
          </div>
        ) : (
          <p className="text-[11px] text-[#6F6F6F]">
            Optional. Add a Google Maps link so attendees can easily find the Hangout.
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
