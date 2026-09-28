import {
  validateInstagramUrl,
  validateTikTokUrl,
  validateSpotifyUrl,
  validateAllSocialUrls
} from '../src/utils/socialUrlValidator.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`✓ PASS: ${message}`);
    passed++;
  } else {
    console.error(`✗ FAIL: ${message}`);
    failed++;
  }
}

console.log('--- TESTING SOCIAL URL VALIDATOR ---\n');

// 1. Instagram tests
assert(validateInstagramUrl('https://www.instagram.com/johndoe/').isValid === true, 'Valid Instagram URL with trailing slash');
assert(validateInstagramUrl('https://instagram.com/johndoe').isValid === true, 'Valid Instagram URL without www');
assert(validateInstagramUrl('http://instagram.com/johndoe').isValid === false, 'Rejects HTTP Instagram URL');
assert(validateInstagramUrl('https://instagram.com.fake.com/johndoe').isValid === false, 'Rejects lookalike domain instagram.com.fake.com');
assert(validateInstagramUrl('javascript:alert(1)').isValid === false, 'Rejects javascript: scheme');
assert(validateInstagramUrl('https://instagram.com/').isValid === false, 'Rejects root Instagram URL without username');

// 2. TikTok tests
assert(validateTikTokUrl('https://www.tiktok.com/@johndoe').isValid === true, 'Valid TikTok URL with @');
assert(validateTikTokUrl('https://tiktok.com/@johndoe').isValid === true, 'Valid TikTok URL without www');
assert(validateTikTokUrl('http://tiktok.com/@johndoe').isValid === false, 'Rejects HTTP TikTok URL');
assert(validateTikTokUrl('https://eviltiktok.com/@johndoe').isValid === false, 'Rejects lookalike domain eviltiktok.com');

// 3. Spotify tests
assert(validateSpotifyUrl('https://open.spotify.com/user/12345678').isValid === true, 'Valid Spotify user URL');
assert(validateSpotifyUrl('https://spotify.com/user/12345678').isValid === true, 'Valid Spotify URL without open.');
assert(validateSpotifyUrl('http://open.spotify.com/user/12345678').isValid === false, 'Rejects HTTP Spotify URL');

// 4. Combined validation test
const result = validateAllSocialUrls({
  instagramUrl: 'https://www.instagram.com/valid_user',
  tiktokUrl: 'https://www.tiktok.com/@valid_user',
  spotifyUrl: 'https://open.spotify.com/user/valid_id'
});
assert(result.isValid === true, 'Combined validation succeeds for all valid URLs');

const invalidResult = validateAllSocialUrls({
  instagramUrl: 'http://instagram.com/user', // HTTP invalid
  tiktokUrl: 'https://www.tiktok.com/@user',
  spotifyUrl: '' // optional valid
});
assert(invalidResult.isValid === false, 'Combined validation fails if one URL is HTTP');

console.log(`\nTest Summary: ${passed} passed, ${failed} failed.`);
if (failed > 0) {
  process.exit(1);
}
