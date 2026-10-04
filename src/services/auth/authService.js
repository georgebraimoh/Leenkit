import { supabase } from '../../lib/supabase';
import { TERMS_VERSION, PRIVACY_VERSION } from '../../data/legal';

// No stock photo: members without a picture are shown with their initials.
const DEFAULT_AVATAR = null;

export const CURRENT_GUIDELINES_VERSION = '1.0';

// Public profile columns. Must match the column-level SELECT grant in
// 20261002020100_profile_private_fields.sql; select('*') is not permitted
// because admin/moderation columns are private.
const PROFILE_COLUMNS = [
  'id', 'name', 'username', 'avatar', 'location', 'bio', 'interests',
  'hosted_count', 'attended_count', 'is_organizer', 'is_verified_organizer',
  'organizer_verified_at', 'followers_count', 'following_count', 'created_at',
  'updated_at', 'instagram_url', 'tiktok_url', 'spotify_url',
  'hosting_guidelines_accepted_at', 'hosting_guidelines_version'
].join(',');

// The signed-in user's own admin / suspension / deletion state. These fields
// are not readable on profiles; only get_my_account_status() returns them,
// and only for the caller. Fails safe: no status means "not admin".
async function getMyAccountStatus() {
  const { data, error } = await supabase.rpc('get_my_account_status');
  if (error) {
    console.warn('Could not load account status:', error.message);
    return {};
  }
  const row = Array.isArray(data) ? data[0] : data;
  return row || {};
}

function guidelinesAcceptError(error) {
  const parts = [error?.message, error?.details, error?.hint, error?.code].filter(Boolean);
  const detail = parts.join(' | ') || 'Unknown error';

  if (import.meta.env.DEV) {
    console.error('[acceptHostingGuidelines]', error);
    return new Error(`Failed to accept hosting guidelines: ${detail}`);
  }

  return new Error(error?.message || 'Failed to accept hosting guidelines');
}

function formatUser(authUser, profile = {}, status = {}) {
  return {
    id: authUser.id,
    name:
      profile.name ||
      authUser.user_metadata?.full_name ||
      authUser.user_metadata?.name ||
      authUser.email?.split('@')[0] ||
      'LEENKIT User',
    email: authUser.email,
    username:
      profile.username ||
      authUser.user_metadata?.username ||
      authUser.email?.split('@')[0]?.toLowerCase().replace(/[^a-z0-9]/g, '_'),
    avatar:
      profile.avatar ||
      authUser.user_metadata?.avatar_url ||
      authUser.user_metadata?.picture ||
      authUser.user_metadata?.avatar ||
      DEFAULT_AVATAR,
    location: profile.location || '',
    bio: profile.bio || '',
    interests: profile.interests || [],
    instagramUrl: profile.instagram_url || '',
    tiktokUrl: profile.tiktok_url || '',
    spotifyUrl: profile.spotify_url || '',
    hostingGuidelinesAcceptedAt: profile.hosting_guidelines_accepted_at || null,
    hostingGuidelinesVersion: profile.hosting_guidelines_version || null,
    isOrganizer: Boolean(profile.is_organizer),
    isVerifiedOrganizer: Boolean(profile.is_verified_organizer),
    organizerVerifiedAt: profile.organizer_verified_at || null,
    hostedCount: profile.hosted_count || 0,
    attendedCount: profile.attended_count || 0,
    isAdmin: Boolean(status.is_admin),
    suspendedAt: status.suspended_at || null,
    suspensionReason: status.suspension_reason || null,
    deletedAt: status.deleted_at || null
  };
}

function formatProfile(p) {
  if (!p) return null;
  return {
    id: p.id,
    // Deleted accounts are anonymised server-side (name "Deleted member").
    name: p.name || 'LEENKIT Member',
    email: p.email || '',
    username: p.username || `user_${p.id.slice(0, 8)}`,
    avatar: p.avatar || DEFAULT_AVATAR,
    location: p.location || '',
    bio: p.bio || '',
    interests: p.interests || [],
    instagramUrl: p.instagram_url || '',
    tiktokUrl: p.tiktok_url || '',
    spotifyUrl: p.spotify_url || '',
    hostingGuidelinesAcceptedAt: p.hosting_guidelines_accepted_at || null,
    hostingGuidelinesVersion: p.hosting_guidelines_version || null,
    isOrganizer: Boolean(p.is_organizer),
    isVerifiedOrganizer: Boolean(p.is_verified_organizer),
    organizerVerifiedAt: p.organizer_verified_at || null,
    hostedCount: p.hosted_count || 0,
    attendedCount: p.attended_count || 0
  };
}

// Where Supabase sends people after they click the confirmation link. The
// URL must be in Supabase Auth → URL Configuration → Redirect URLs; if it is
// not, Supabase falls back to the Site URL and the session is still picked up.
function confirmationRedirectUrl() {
  return `${window.location.origin}/auth/callback?next=/onboarding`;
}

// Supabase Auth error → message and code the UI can act on.
function authError(error, fallback) {
  const code = error?.code || '';
  const message = error?.message || '';
  let friendly = message || fallback;

  if (code === 'email_not_confirmed' || /email not confirmed/i.test(message)) {
    friendly = 'Please confirm your email address before signing in. Check your inbox for the confirmation link.';
  } else if (
    code === 'over_email_send_rate_limit' ||
    code === 'over_request_rate_limit' ||
    error?.status === 429 ||
    /rate limit|only request this after/i.test(message)
  ) {
    friendly = 'Too many emails were requested. Please wait a minute and try again.';
  } else if (code === 'invalid_credentials' || /invalid login credentials/i.test(message)) {
    friendly = 'Incorrect email or password.';
  }

  const err = new Error(friendly);
  err.code = code || (/email not confirmed/i.test(message) ? 'email_not_confirmed' : undefined);
  return err;
}

async function getProfile(authUser) {
  const [{ data: profile, error }, status] = await Promise.all([
    supabase.from('profiles').select(PROFILE_COLUMNS).eq('id', authUser.id).maybeSingle(),
    getMyAccountStatus()
  ]);

  if (error) {
    throw new Error(error.message);
  }

  // The handle_new_user() trigger creates every profile. If the row is not
  // there yet (trigger lag), show the auth data without writing anything.
  return formatUser(authUser, profile || {}, status);
}

export const authService = {
  formatProfile,

  async fetchProfilesAll() {
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select(PROFILE_COLUMNS)
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Could not fetch profiles from Supabase:', error.message);
      return [];
    }

    return (profiles || []).map(formatProfile);
  },

  async fetchProfiles(ids) {
    if (!ids || (Array.isArray(ids) && ids.length === 0)) return [];
    const uniqueIds = Array.from(new Set(Array.isArray(ids) ? ids : [ids])).filter(Boolean);

    const { data: profiles, error } = await supabase
      .from('profiles')
      .select(PROFILE_COLUMNS)
      .in('id', uniqueIds);

    if (error) {
      console.warn('Could not fetch profiles by IDs from Supabase:', error.message);
      return [];
    }

    return (profiles || []).map(formatProfile);
  },

  async fetchProfileByUsername(username) {
    if (!username) return null;

    const { data: p, error } = await supabase
      .from('profiles')
      .select(PROFILE_COLUMNS)
      .eq('username', username)
      .maybeSingle();

    if (error || !p) {
      return null;
    }

    return formatProfile(p);
  },
  async loginWithGoogle() {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin
      }
    });

    if (error) {
      throw new Error(error.message);
    }

    return data;
  },

  async loginWithEmail(email, password) {
    if (!email || !password) {
      throw new Error('Email and password are required.');
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password
    });

    if (error) {
      throw authError(error, 'Unable to sign in. Please try again.');
    }

    if (!data.user) {
      throw new Error('Unable to sign in. Please try again.');
    }

    return await getProfile(data.user);
  },

  async registerWithEmail({ name, email, password, avatar }) {
    if (!name || !email || !password) {
      throw new Error('Please complete all required fields.');
    }

    // The handle_new_user() trigger creates the profile (with a collision-safe
    // username) from this metadata, so the client never inserts a profile row.
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: confirmationRedirectUrl(),
        data: {
          name: name.trim(),
          ...(avatar ? { avatar } : {})
        }
      }
    });

    if (error) {
      throw authError(error, 'Account could not be created. Please try again.');
    }

    if (!data.user) {
      throw new Error('Account could not be created. Please try again.');
    }

    // No session means Supabase requires email confirmation before sign-in.
    if (!data.session) {
      return { user: null, needsEmailConfirmation: true };
    }

    const user = await getProfile(data.user);
    return { user, needsEmailConfirmation: false };
  },

  // Sends the signup confirmation email again (delivered through the SMTP
  // provider configured in Supabase, e.g. Resend). Supabase rate-limits this;
  // it also returns success for unknown emails so accounts can't be probed.
  async resendConfirmationEmail(email) {
    const trimmed = (email || '').trim();
    if (!trimmed) {
      throw new Error('Please enter your email address.');
    }

    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: trimmed,
      options: { emailRedirectTo: confirmationRedirectUrl() }
    });

    if (error) {
      throw authError(error, 'Could not resend the confirmation email. Please try again.');
    }
  },

  async getCurrentUser() {
    const {
      data: { user },
      error
    } = await supabase.auth.getUser();

    if (error) {
      // Signed-out visitors have no session; that is not an error.
      if (error.name === 'AuthSessionMissingError' || /session missing/i.test(error.message || '')) {
        return null;
      }
      throw new Error(error.message);
    }

    if (!user) {
      return null;
    }

    return await getProfile(user);
  },

  async logout() {
    const { error } = await supabase.auth.signOut();

    if (error) {
      throw new Error(error.message);
    }
  },

  async resetPasswordForEmail(email) {
    if (!email || !email.trim()) {
      throw new Error('Please enter your email address.');
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`
    });

    if (error) {
      throw new Error(error.message);
    }
  },

  async updatePassword(newPassword) {
    if (!newPassword) {
      throw new Error('Please enter a new password.');
    }

    if (newPassword.length < 8) {
      throw new Error('Password must be at least 8 characters.');
    }

    const { data, error } = await supabase.auth.updateUser({
      password: newPassword
    });

    if (error) {
      throw new Error(error.message);
    }

    return data;
  },

  async uploadAvatarImage(userId, file) {
    if (!file) return null;

    const MAX_SIZE = 5 * 1024 * 1024; // 5 MB limit
    if (file.size > MAX_SIZE) {
      throw new Error('Avatar image size exceeds the 5 MB limit.');
    }

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type.toLowerCase())) {
      throw new Error('Unsupported image format. Please select a JPG, PNG, or WEBP image.');
    }

    // Always retrieve the true authenticated user directly from the active Supabase Auth session
    const {
      data: { user: authUser },
      error: authError
    } = await supabase.auth.getUser();

    if (authError || !authUser) {
      console.warn('[Storage Upload] Active Supabase Auth session not found:', authError?.message);
      throw new Error('Authentication required: No active session found. Please sign in again.');
    }

    const activeUserId = authUser.id;
    const fileExt = file.name.split('.').pop() || 'jpg';
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${fileExt}`;
    const filePath = `${activeUserId}/${fileName}`;

    const { data, error } = await supabase.storage
      .from('profile-images')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      if (error.message?.includes('Failed to fetch') || error.name === 'TypeError') {
        throw new Error(
          'Profile picture upload network error (Failed to fetch). Please verify connection to Supabase storage or sign in again.'
        );
      }

      throw new Error(`Storage upload failed: ${error.message}`);
    }

    const { data: publicUrlData } = supabase.storage
      .from('profile-images')
      .getPublicUrl(data.path);

    if (!publicUrlData?.publicUrl) {
      throw new Error('Failed to generate public URL for uploaded profile picture.');
    }

    return publicUrlData.publicUrl;
  },

  async updateProfile(userId, profileUpdates) {
    if (!userId) {
      throw new Error('User ID is required to update profile.');
    }

    const allowedFields = [
      'name',
      'username',
      'avatar',
      'location',
      'bio',
      'interests',
      'instagram_url',
      'tiktok_url',
      'spotify_url'
    ];
    const updatesPayload = {};

    allowedFields.forEach((field) => {
      if (profileUpdates[field] !== undefined) {
        updatesPayload[field] = profileUpdates[field];
      }
    });

    const { data: profile, error } = await supabase
      .from('profiles')
      .update(updatesPayload)
      .eq('id', userId)
      .select(PROFILE_COLUMNS)
      .single();

    if (error) {
      throw new Error(error.message);
    }

    const {
      data: { user: authUser },
      error: userError
    } = await supabase.auth.getUser();

    if (userError || !authUser) {
      return formatUser({ id: userId }, profile || {}, await getMyAccountStatus());
    }

    return formatUser(authUser, profile || {}, await getMyAccountStatus());
  },

  async acceptHostingGuidelines(version = CURRENT_GUIDELINES_VERSION) {
    const {
      data: { user: authUser },
      error: authError
    } = await supabase.auth.getUser();

    if (authError || !authUser) {
      throw new Error('You must be signed in to accept hosting guidelines.');
    }

    const { data: existingProfile, error: profileLookupError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', authUser.id)
      .maybeSingle();

    if (profileLookupError) {
      throw guidelinesAcceptError(profileLookupError);
    }

    if (!existingProfile) {
      throw new Error('Your profile is not ready yet. Please refresh and try again.');
    }

    // The RPC returns void, so success is "no error"; read the profile back to
    // confirm the acceptance and refresh local state.
    const { error } = await supabase.rpc('accept_hosting_guidelines', {
      p_version: version || CURRENT_GUIDELINES_VERSION
    });

    if (error) {
      throw guidelinesAcceptError(error);
    }

    const { data: profileData, error: refreshError } = await supabase
      .from('profiles')
      .select(PROFILE_COLUMNS)
      .eq('id', authUser.id)
      .maybeSingle();

    if (refreshError) {
      throw guidelinesAcceptError(refreshError);
    }

    if (
      !profileData?.hosting_guidelines_accepted_at ||
      profileData.hosting_guidelines_version !== CURRENT_GUIDELINES_VERSION
    ) {
      throw new Error('Failed to accept hosting guidelines: acceptance was not saved.');
    }

    return formatUser(authUser, profileData, await getMyAccountStatus());
  },

  // Returns true only if the signed-in user has a stored acceptance of the
  // CURRENT Terms and Privacy Policy versions. Throws on query failure so
  // callers can fail closed rather than assume acceptance.
  async hasAcceptedCurrentLegal(userId) {
    if (!userId) return false;

    const { data, error } = await supabase
      .from('legal_acceptances')
      .select('id')
      .eq('user_id', userId)
      .eq('terms_version', TERMS_VERSION)
      .eq('privacy_version', PRIVACY_VERSION)
      .limit(1);

    if (error) {
      throw new Error(error.message);
    }

    return Array.isArray(data) && data.length > 0;
  },

  // Records acceptance for the signed-in user via the server-side RPC, which
  // always uses auth.uid() and only accepts the current versions.
  async recordLegalAcceptance(source) {
    const { data, error } = await supabase.rpc('record_legal_acceptance', {
      p_terms_version: TERMS_VERSION,
      p_privacy_version: PRIVACY_VERSION,
      p_source: source
    });

    if (error) {
      throw new Error(error.message || 'Could not record your acceptance.');
    }

    if (!data?.accepted_at) {
      throw new Error('Could not record your acceptance. Please try again.');
    }

    return data;
  }
};