import { supabase } from '../../lib/supabase';

const DEFAULT_AVATAR =
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80';

export const CURRENT_GUIDELINES_VERSION = '1.0';

function guidelinesAcceptError(error) {
  const parts = [error?.message, error?.details, error?.hint, error?.code].filter(Boolean);
  const detail = parts.join(' | ') || 'Unknown error';

  if (import.meta.env.DEV) {
    console.error('[acceptHostingGuidelines]', error);
    return new Error(`Failed to accept hosting guidelines: ${detail}`);
  }

  return new Error(error?.message || 'Failed to accept hosting guidelines');
}

function formatUser(authUser, profile = {}) {
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
    location: profile.location || 'Abuja',
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
    attendedCount: profile.attended_count || 0
  };
}

function formatProfile(p) {
  if (!p) return null;
  return {
    id: p.id,
    name: p.name || 'LEENKIT Member',
    email: p.email || '',
    username: p.username || `user_${p.id.slice(0, 8)}`,
    avatar: p.avatar || DEFAULT_AVATAR,
    location: p.location || 'Abuja',
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

async function getProfile(authUser) {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', authUser.id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (profile) {
    return formatUser(authUser, profile);
  }

  // Auto-create a profile row for new OAuth users if one does not exist
  const name =
    authUser.user_metadata?.full_name ||
    authUser.user_metadata?.name ||
    authUser.email?.split('@')[0] ||
    'LEENKIT User';

  const username =
    authUser.user_metadata?.username ||
    authUser.email?.split('@')[0]?.toLowerCase().replace(/[^a-z0-9]/g, '_') ||
    `user_${authUser.id.slice(0, 8)}`;

  const avatar =
    authUser.user_metadata?.avatar_url ||
    authUser.user_metadata?.picture ||
    authUser.user_metadata?.avatar ||
    DEFAULT_AVATAR;

  const newProfile = {
    id: authUser.id,
    name,
    username,
    avatar,
    location: 'Abuja',
    bio: 'Joined LEENKIT to discover real-life Hangouts!',
    interests: [],
    hosted_count: 0,
    attended_count: 0
  };

  const { data: createdProfile, error: createError } = await supabase
    .from('profiles')
    .insert(newProfile)
    .select()
    .single();

  if (createError) {
    console.warn('Could not auto-create profile row:', createError.message);
    return formatUser(authUser, newProfile);
  }

  return formatUser(authUser, createdProfile);
}

export const authService = {
  formatProfile,

  async fetchProfilesAll() {
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('*')
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
      .select('*')
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
      .select('*')
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
      throw new Error(error.message);
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

    const username = email
      .split('@')[0]
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_');

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          name: name.trim(),
          username,
          avatar: avatar || DEFAULT_AVATAR
        }
      }
    });

    if (error) {
      throw new Error(error.message);
    }

    if (!data.user) {
      throw new Error('Account could not be created. Please try again.');
    }

    const newProfile = {
      id: data.user.id,
      name: name.trim(),
      username,
      avatar: avatar || DEFAULT_AVATAR,
      location: 'Abuja',
      bio: 'Joined LEENKIT to discover real-life Hangouts!',
      interests: [],
      hosted_count: 0,
      attended_count: 0
    };

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .insert(newProfile)
      .select()
      .single();

    if (profileError) {
      throw new Error(profileError.message);
    }

    return formatUser(data.user, profile);
  },

  async getCurrentUser() {
    const {
      data: { user },
      error
    } = await supabase.auth.getUser();

    if (error) {
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

    if (newPassword.length < 6) {
      throw new Error('Password must be at least 6 characters.');
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

    console.log('[Storage Upload] Uploading to "profile-images" at path:', filePath);

    const { data, error } = await supabase.storage
      .from('profile-images')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      console.error('[Storage Upload Diagnostics]', {
        message: error.message,
        name: error.name,
        status: error.status,
        statusCode: error.statusCode,
        errorData: error.error,
        filePath,
        bucket: 'profile-images',
        activeUserId
      });

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
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    const {
      data: { user: authUser },
      error: userError
    } = await supabase.auth.getUser();

    if (userError || !authUser) {
      return formatUser({ id: userId }, profile || {});
    }

    return formatUser(authUser, profile || {});
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
      await getProfile(authUser);

      const { data: createdProfile, error: createdLookupError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', authUser.id)
        .maybeSingle();

      if (createdLookupError) {
        throw guidelinesAcceptError(createdLookupError);
      }

      if (!createdProfile) {
        throw new Error('Your profile is not ready yet. Please refresh and try again.');
      }
    }

    const { data: profileData, error } = await supabase.rpc('accept_hosting_guidelines', {
      p_version: version || CURRENT_GUIDELINES_VERSION
    });

    if (error) {
      throw guidelinesAcceptError(error);
    }

    if (!profileData) {
      throw new Error('Failed to accept hosting guidelines: profile was not updated.');
    }

    return formatUser(authUser, profileData);
  }
};