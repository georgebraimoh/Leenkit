/**
 * LEENKIT Social Profile URL Validator & Security Sanitizer.
 * Enforces HTTPS, domain allowlisting, URL parsing, and normalization.
 */

const INSTAGRAM_HOSTS = ['instagram.com', 'www.instagram.com'];
const TIKTOK_HOSTS = ['tiktok.com', 'www.tiktok.com'];
const SPOTIFY_HOSTS = ['open.spotify.com', 'spotify.com', 'www.spotify.com'];

/**
 * Safely parses a URL string using the native URL API.
 * Returns null if invalid, malformed, or using unsafe protocols.
 */
export function parseAndValidateUrl(inputUrl) {
  if (!inputUrl || typeof inputUrl !== 'string') return null;
  const trimmed = inputUrl.trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed);

    // Enforce HTTPS protocol only (reject HTTP, javascript:, data:, ftp:, etc.)
    if (parsed.protocol !== 'https:') {
      return null;
    }

    return parsed;
  } catch (err) {
    return null;
  }
}

/**
 * Validates whether a hostname matches an allowed list of domains.
 * Prevents lookalike subdomains like instagram.com.attacker.com.
 */
function isDomainAllowed(hostname, allowedHosts) {
  const lowerHost = (hostname || '').toLowerCase();
  return allowedHosts.some(allowed => lowerHost === allowed || lowerHost.endsWith('.' + allowed));
}

/**
 * Validates an Instagram profile URL.
 */
export function validateInstagramUrl(urlStr) {
  if (!urlStr || !urlStr.trim()) return { isValid: true, normalizedUrl: '', error: null };

  const parsed = parseAndValidateUrl(urlStr);
  if (!parsed) {
    return {
      isValid: false,
      normalizedUrl: '',
      error: 'Please enter a valid HTTPS Instagram URL (e.g. https://www.instagram.com/username).'
    };
  }

  if (!isDomainAllowed(parsed.hostname, INSTAGRAM_HOSTS)) {
    return {
      isValid: false,
      normalizedUrl: '',
      error: 'Instagram link must be hosted on instagram.com.'
    };
  }

  const path = parsed.pathname.replace(/\/+$/, '');
  if (!path || path === '/' || path === '') {
    return {
      isValid: false,
      normalizedUrl: '',
      error: 'Please include your username path in the link (e.g. https://www.instagram.com/username).'
    };
  }

  return {
    isValid: true,
    normalizedUrl: parsed.toString(),
    error: null
  };
}

/**
 * Validates a TikTok profile URL.
 */
export function validateTikTokUrl(urlStr) {
  if (!urlStr || !urlStr.trim()) return { isValid: true, normalizedUrl: '', error: null };

  const parsed = parseAndValidateUrl(urlStr);
  if (!parsed) {
    return {
      isValid: false,
      normalizedUrl: '',
      error: 'Please enter a valid HTTPS TikTok URL (e.g. https://www.tiktok.com/@username).'
    };
  }

  if (!isDomainAllowed(parsed.hostname, TIKTOK_HOSTS)) {
    return {
      isValid: false,
      normalizedUrl: '',
      error: 'TikTok link must be hosted on tiktok.com.'
    };
  }

  const path = parsed.pathname.replace(/\/+$/, '');
  if (!path || path === '/' || path === '') {
    return {
      isValid: false,
      normalizedUrl: '',
      error: 'Please include your profile handle in the link (e.g. https://www.tiktok.com/@username).'
    };
  }

  return {
    isValid: true,
    normalizedUrl: parsed.toString(),
    error: null
  };
}

/**
 * Validates a Spotify profile URL.
 */
export function validateSpotifyUrl(urlStr) {
  if (!urlStr || !urlStr.trim()) return { isValid: true, normalizedUrl: '', error: null };

  const parsed = parseAndValidateUrl(urlStr);
  if (!parsed) {
    return {
      isValid: false,
      normalizedUrl: '',
      error: 'Please enter a valid HTTPS Spotify URL (e.g. https://open.spotify.com/user/profile_id).'
    };
  }

  if (!isDomainAllowed(parsed.hostname, SPOTIFY_HOSTS)) {
    return {
      isValid: false,
      normalizedUrl: '',
      error: 'Spotify link must be hosted on spotify.com.'
    };
  }

  const path = parsed.pathname.replace(/\/+$/, '');
  if (!path || path === '/' || path === '') {
    return {
      isValid: false,
      normalizedUrl: '',
      error: 'Please include a valid Spotify profile path (e.g. https://open.spotify.com/user/profile_id).'
    };
  }

  return {
    isValid: true,
    normalizedUrl: parsed.toString(),
    error: null
  };
}

/**
 * Validates all three social URLs at once.
 */
export function validateAllSocialUrls({ instagramUrl, tiktokUrl, spotifyUrl }) {
  const igResult = validateInstagramUrl(instagramUrl);
  const ttResult = validateTikTokUrl(tiktokUrl);
  const spResult = validateSpotifyUrl(spotifyUrl);

  const isValid = igResult.isValid && ttResult.isValid && spResult.isValid;

  return {
    isValid,
    errors: {
      instagramUrl: igResult.error,
      tiktokUrl: ttResult.error,
      spotifyUrl: spResult.error
    },
    normalized: {
      instagram_url: igResult.isValid ? (igResult.normalizedUrl ? igResult.normalizedUrl : null) : null,
      tiktok_url: ttResult.isValid ? (ttResult.normalizedUrl ? ttResult.normalizedUrl : null) : null,
      spotify_url: spResult.isValid ? (spResult.normalizedUrl ? spResult.normalizedUrl : null) : null
    }
  };
}
