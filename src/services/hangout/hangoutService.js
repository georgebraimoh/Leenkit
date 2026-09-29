import { supabase } from '../../lib/supabase';

function formatHangout(dbHangout, attendeesList = []) {
  const attendeeIds = attendeesList.map(a => a.user_id);

  // Ensure host is always in attendeeIds if not already present
  if (dbHangout.host_id && !attendeeIds.includes(dbHangout.host_id)) {
    attendeeIds.unshift(dbHangout.host_id);
  }

  return {
    id: dbHangout.id,
    title: dbHangout.title,
    category: dbHangout.category,
    location: {
      placeName: dbHangout.place_name || 'Meeting Location',
      address: dbHangout.address || dbHangout.place_name || '',
      city: dbHangout.city || null,
      country: dbHangout.country || null,
      countryCode: dbHangout.country_code || null,
      latitude: dbHangout.latitude || null,
      longitude: dbHangout.longitude || null,
      googleMapsUrl: dbHangout.google_maps_url || null
    },
    googleMapsUrl: dbHangout.google_maps_url || null,
    city: dbHangout.city || null,
    date: dbHangout.date,
    time: dbHangout.time,
    description: dbHangout.description,
    hostId: dbHangout.host_id,
    maxAttendees: dbHangout.max_attendees || 10,
    attendeeIds,
    image: dbHangout.image || "https://images.unsplash.com/photo-1528605248644-14dd04022da1?auto=format&fit=crop&w=1200&q=80",
    status: dbHangout.status || 'upcoming',
    featured: dbHangout.featured || false,
    isPopular: dbHangout.is_popular || false,
    isPaid: Boolean(dbHangout.is_paid),
    price: dbHangout.price ? Number(dbHangout.price) : null,
    currency: dbHangout.currency || 'NGN'
  };
}

export const hangoutService = {
  formatHangout,

  async uploadHangoutImage(userId, file) {
    if (!file) return null;

    const MAX_SIZE = 5 * 1024 * 1024; // 5MB
    if (file.size > MAX_SIZE) {
      throw new Error('Selected image exceeds the 5 MB size limit.');
    }

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type.toLowerCase())) {
      throw new Error('Unsupported image format. Please select a JPG, PNG, or WEBP image.');
    }

    const fileExt = file.name.split('.').pop() || 'jpg';
    const cleanFileName = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${fileExt}`;
    const filePath = `${userId || 'guest'}/${cleanFileName}`;

    const { data, error } = await supabase.storage
      .from('hangout-images')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      throw new Error(`Image upload failed: ${error.message}`);
    }

    const { data: publicUrlData } = supabase.storage
      .from('hangout-images')
      .getPublicUrl(data.path);

    return publicUrlData.publicUrl;
  },

  async fetchHangouts() {
    const { data: dbHangouts, error: hangoutsError } = await supabase
      .from('hangouts')
      .select('*')
      .order('created_at', { ascending: false });

    if (hangoutsError) {
      console.warn('Could not fetch hangouts from Supabase:', hangoutsError.message);
      return null;
    }

    const { data: dbAttendees, error: attendeesError } = await supabase
      .from('hangout_attendees')
      .select('*');

    if (attendeesError) {
      console.warn('Could not fetch attendees from Supabase:', attendeesError.message);
    }

    const attendeesByHangout = {};
    (dbAttendees || []).forEach(a => {
      if (!attendeesByHangout[a.hangout_id]) {
        attendeesByHangout[a.hangout_id] = [];
      }
      attendeesByHangout[a.hangout_id].push(a);
    });

    return dbHangouts.map(h => formatHangout(h, attendeesByHangout[h.id] || []));
  },

  async createHangout(userId, newHangoutData) {
    if (!userId) {
      throw new Error('You must be signed in to host a Hangout.');
    }

    const loc = newHangoutData.location || {};
    const locText = typeof loc === 'string' ? loc : (loc.placeName || loc.address || newHangoutData.locationText || '');

    const payload = {
      title: newHangoutData.title.trim(),
      category: newHangoutData.category,
      description: newHangoutData.description.trim(),
      host_id: userId,
      date: newHangoutData.date,
      time: newHangoutData.time,
      max_attendees: parseInt(newHangoutData.maxAttendees, 10) || 10,
      image: newHangoutData.image,
      status: 'upcoming',
      featured: false,
      is_popular: false,
      is_paid: Boolean(newHangoutData.isPaid),
      price: newHangoutData.isPaid && newHangoutData.price ? parseFloat(newHangoutData.price) : null,
      currency: newHangoutData.isPaid ? (newHangoutData.currency || 'NGN') : 'NGN',
      place_name: (locText || 'Meeting Location').trim(),
      address: (locText || '').trim(),
      city: loc.city || null,
      country: loc.country || null,
      country_code: loc.countryCode || null,
      latitude: typeof loc.latitude === 'number' && !isNaN(loc.latitude) ? loc.latitude : null,
      longitude: typeof loc.longitude === 'number' && !isNaN(loc.longitude) ? loc.longitude : null,
      google_maps_url: loc.googleMapsUrl || newHangoutData.googleMapsUrl || null
    };

    const { data: createdHangout, error: createError } = await supabase
      .from('hangouts')
      .insert(payload)
      .select()
      .single();

    if (createError) {
      throw new Error(createError.message);
    }

    // Automatically insert creator into hangout_attendees
    const { error: attendeeError } = await supabase
      .from('hangout_attendees')
      .insert({
        hangout_id: createdHangout.id,
        user_id: userId
      });

    if (attendeeError) {
      console.warn('Auto-join host record notice:', attendeeError.message);
    }

    return formatHangout(createdHangout, [{ user_id: userId }]);
  },

  async joinHangout(userId, hangoutId) {
    if (!userId) throw new Error('Must be signed in to join.');

    const { error } = await supabase
      .from('hangout_attendees')
      .insert({
        hangout_id: hangoutId,
        user_id: userId
      });

    if (error && !error.message.includes('unique constraint')) {
      throw new Error(error.message);
    }
  },

  async leaveHangout(userId, hangoutId) {
    if (!userId) throw new Error('Must be signed in to leave.');

    const { error } = await supabase
      .from('hangout_attendees')
      .delete()
      .eq('hangout_id', hangoutId)
      .eq('user_id', userId);

    if (error) {
      throw new Error(error.message);
    }
  },

  async cancelHangout(hangoutId) {
    const { error } = await supabase
      .from('hangouts')
      .update({ status: 'cancelled' })
      .eq('id', hangoutId);

    if (error) {
      throw new Error(error.message);
    }
  },

  async markHangoutCompleted(hangoutId) {
    const { error } = await supabase
      .from('hangouts')
      .update({ status: 'completed' })
      .eq('id', hangoutId);

    if (error) {
      throw new Error(error.message);
    }
  },

  async getMyHangouts(userId) {
    if (!userId) return [];

    const { data: dbHangouts, error: hangoutsError } = await supabase
      .from('hangouts')
      .select('*')
      .eq('host_id', userId)
      .order('created_at', { ascending: false });

    if (hangoutsError) {
      console.warn('Could not fetch user hangouts from Supabase:', hangoutsError.message);
      throw new Error(hangoutsError.message);
    }

    if (!dbHangouts || dbHangouts.length === 0) return [];

    const hangoutIds = dbHangouts.map(h => h.id);

    const { data: dbAttendees, error: attendeesError } = await supabase
      .from('hangout_attendees')
      .select('*')
      .in('hangout_id', hangoutIds);

    if (attendeesError) {
      console.warn('Could not fetch attendees for user hangouts:', attendeesError.message);
    }

    const attendeesByHangout = {};
    (dbAttendees || []).forEach(a => {
      if (!attendeesByHangout[a.hangout_id]) {
        attendeesByHangout[a.hangout_id] = [];
      }
      attendeesByHangout[a.hangout_id].push(a);
    });

    return dbHangouts.map(h => formatHangout(h, attendeesByHangout[h.id] || []));
  },

  async deleteHangout(hangoutId) {
    const { error } = await supabase
      .from('hangouts')
      .delete()
      .eq('id', hangoutId);

    if (error) {
      throw new Error(error.message);
    }
  },

  formatMessage(dbMessage) {
    if (!dbMessage) return null;
    let formattedTime = '';
    if (dbMessage.created_at) {
      try {
        const d = new Date(dbMessage.created_at);
        if (!isNaN(d.getTime())) {
          formattedTime = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
      } catch (e) {
        formattedTime = '';
      }
    }

    return {
      id: dbMessage.id,
      userId: dbMessage.user_id,
      userName: dbMessage.user_name || 'LEENKIT User',
      userAvatar: dbMessage.user_avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
      text: dbMessage.text || '',
      timestamp: formattedTime,
      createdAt: dbMessage.created_at,
      type: dbMessage.type || 'user'
    };
  },

  async fetchSpaceMessages(hangoutId) {
    if (!hangoutId) return [];

    const { data, error } = await supabase
      .from('hangout_messages')
      .select('*')
      .eq('hangout_id', hangoutId)
      .order('created_at', { ascending: true });

    if (error) {
      console.warn('Could not fetch space messages from Supabase:', error.message);
      return [];
    }

    return (data || []).map(this.formatMessage).filter(Boolean);
  },

  async sendSpaceMessage({ hangoutId, userId, userName, userAvatar, text, type = 'user' }) {
    if (!hangoutId || !userId) {
      throw new Error('Hangout ID and User ID are required to send a message.');
    }

    const trimmedText = (text || '').trim();
    if (!trimmedText) {
      throw new Error('Message content cannot be empty.');
    }

    const payload = {
      hangout_id: hangoutId,
      user_id: userId,
      user_name: userName || 'LEENKIT User',
      user_avatar: userAvatar || null,
      text: trimmedText,
      type: type || 'user'
    };

    const { data, error } = await supabase
      .from('hangout_messages')
      .insert(payload)
      .select()
      .single();

    if (error) {
      console.error('[sendSpaceMessage Error]', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      });
      throw new Error(error.message);
    }

    return this.formatMessage(data);
  },

  async createHangoutSponsorship(userId, { hangoutId, amount, currency = 'NGN', message = '' }) {
    if (!userId) {
      throw new Error('You must be signed in to sponsor a Hangout.');
    }
    if (!hangoutId) {
      throw new Error('Hangout ID is required.');
    }

    const validCurrencies = ['NGN', 'USD', 'EUR', 'GBP'];
    const targetCurrency = validCurrencies.includes(currency) ? currency : 'NGN';

    const numericAmount = Number(amount);
    if (isNaN(numericAmount) || !Number.isFinite(numericAmount) || numericAmount <= 0) {
      throw new Error('Please enter a valid sponsorship amount greater than zero.');
    }

    const payload = {
      hangout_id: hangoutId,
      sponsor_id: userId,
      amount: numericAmount,
      currency: targetCurrency,
      message: (message || '').trim().substring(0, 200) || null,
      status: 'pledged'
    };

    const { data, error } = await supabase
      .from('hangout_sponsorships')
      .insert(payload)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return {
      id: data.id,
      hangoutId: data.hangout_id,
      sponsorId: data.sponsor_id,
      amount: Number(data.amount),
      currency: data.currency,
      message: data.message,
      status: data.status,
      createdAt: data.created_at
    };
  },

  async fetchHangoutSponsorshipSummary(hangoutId) {
    if (!hangoutId) {
      return { currencies: [], totalSponsorCount: 0 };
    }

    try {
      const { data, error } = await supabase.rpc('get_hangout_sponsorship_summary', {
        p_hangout_id: hangoutId
      });

      if (error) {
        console.warn('Could not fetch hangout sponsorship summary via RPC:', error.message);
        return { currencies: [], totalSponsorCount: 0 };
      }

      if (!Array.isArray(data) || data.length === 0) {
        return { currencies: [], totalSponsorCount: 0 };
      }

      const validCurrencies = ['NGN', 'USD', 'EUR', 'GBP'];
      const normalizedCurrencies = [];
      let totalSponsorCount = 0;

      for (const row of data) {
        if (!row) continue;

        const curr = String(row.currency || 'NGN').toUpperCase();
        if (!validCurrencies.includes(curr)) continue;

        const totalPledged = Number(row.total_pledged ?? row.totalPledged ?? 0);
        const sponsorCount = Number(row.sponsor_count ?? row.sponsorCount ?? 0);

        if (totalPledged > 0 || sponsorCount > 0) {
          normalizedCurrencies.push({
            currency: curr,
            totalPledged,
            sponsorCount
          });
          totalSponsorCount += sponsorCount;
        }
      }

      return {
        currencies: normalizedCurrencies,
        totalSponsorCount
      };
    } catch (err) {
      console.warn('Unexpected error fetching sponsorship summary:', err);
      return { currencies: [], totalSponsorCount: 0 };
    }
  }
};

