import { supabase } from '../../lib/supabase';

export const MIN_HANGOUT_CAPACITY = 2;
export const MAX_HANGOUT_CAPACITY = 10000;

// Database guard errors (triggers/policies) -> messages people can act on.
function dbError(error) {
  const msg = error?.message || "";
  if (msg.includes("LEENKIT_RATE_LIMITED")) return new Error("You are doing that too often. Please wait a moment and try again.");
  if (msg.includes("LEENKIT_HANGOUT_CLOSED")) return new Error("This Hangout is no longer open.");
  return new Error(msg || "Something went wrong. Please try again.");
}

const DEFAULT_COVER_IMAGE = 'https://images.unsplash.com/photo-1528605248644-14dd04022da1?auto=format&fit=crop&w=1200&q=80';

function formatHangout(dbHangout, attendeesList = []) {
  // Attendee rows are only visible to members of the Hangout (RLS); everyone
  // else gets the public attendee_count.
  const attendeeIds = attendeesList.map(a => a.user_id);

  // Ensure host is always in attendeeIds if not already present
  if (dbHangout.host_id && !attendeeIds.includes(dbHangout.host_id)) {
    attendeeIds.unshift(dbHangout.host_id);
  }

  return {
    id: dbHangout.id,
    title: dbHangout.title,
    category: dbHangout.category || 'Other',
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
    attendeeCount: Math.max(
      Number.isFinite(dbHangout.attendee_count) ? dbHangout.attendee_count : 0,
      attendeeIds.length
    ),
    image: dbHangout.image || DEFAULT_COVER_IMAGE,
    status: dbHangout.status || 'upcoming',
    featured: dbHangout.featured || false,
    isPopular: dbHangout.is_popular || false,
    isPaid: Boolean(dbHangout.is_paid),
    price: dbHangout.price ? Number(dbHangout.price) : null,
    currency: dbHangout.currency || 'NGN',
    hideExactLocation: Boolean(dbHangout.hide_exact_location),
    seriesId: dbHangout.series_id || null,
    seriesIndex: dbHangout.series_index || null,
    approvalStatus: dbHangout.approval_status || 'approved',
    rejectionReason: dbHangout.rejection_reason || null,
    reviewedAt: dbHangout.reviewed_at || null,
    reviewedBy: dbHangout.reviewed_by || null
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
      .select('hangout_id, user_id');

    // Signed-out visitors cannot read attendee rows (privacy); counts come
    // from hangouts.attendee_count instead.
    if (attendeesError && attendeesError.code !== '42501') {
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

  async fetchHangoutById(hangoutId) {
    if (!hangoutId) return null;

    const { data: dbHangout, error } = await supabase
      .from('hangouts')
      .select('*')
      .eq('id', hangoutId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!dbHangout) return null;

    const { data: dbAttendees } = await supabase
      .from('hangout_attendees')
      .select('hangout_id, user_id')
      .eq('hangout_id', hangoutId);

    return formatHangout(dbHangout, dbAttendees || []);
  },

  async createHangout(userId, newHangoutData) {
    if (!userId) {
      throw new Error('You must be signed in to host a Hangout.');
    }

    const loc = newHangoutData.location || {};
    const locText = typeof loc === 'string' ? loc : (loc.placeName || loc.address || newHangoutData.locationText || '');
    const capacity = parseInt(newHangoutData.maxAttendees, 10) || 10;

    if (capacity < MIN_HANGOUT_CAPACITY || capacity > MAX_HANGOUT_CAPACITY) {
      throw new Error(
        `Hangout capacity must be between ${MIN_HANGOUT_CAPACITY} and ${MAX_HANGOUT_CAPACITY.toLocaleString()} attendees.`
      );
    }

    const payload = {
      title: newHangoutData.title.trim().slice(0, 120),
      category: newHangoutData.category,
      description: newHangoutData.description.trim().slice(0, 5000),
      host_id: userId,
      date: newHangoutData.date,
      time: newHangoutData.time,
      max_attendees: capacity,
      image: newHangoutData.image,
      is_paid: Boolean(newHangoutData.isPaid),
      price: newHangoutData.isPaid && newHangoutData.price ? parseFloat(newHangoutData.price) : null,
      currency: newHangoutData.isPaid ? (newHangoutData.currency || 'NGN') : 'NGN',
      place_name: (locText || 'Meeting Location').trim().slice(0, 200),
      address: (locText || '').trim(),
      city: loc.city || null,
      country: loc.country || null,
      country_code: loc.countryCode || null,
      latitude: typeof loc.latitude === 'number' && !isNaN(loc.latitude) ? loc.latitude : null,
      longitude: typeof loc.longitude === 'number' && !isNaN(loc.longitude) ? loc.longitude : null,
      google_maps_url: loc.googleMapsUrl || newHangoutData.googleMapsUrl || null,
      hide_exact_location: Boolean(newHangoutData.hideExactLocation),
      series_id: newHangoutData.seriesId || null,
      series_index: newHangoutData.seriesIndex || null,
      approval_status: 'pending'
    };

    const { data: createdHangout, error: createError } = await supabase
      .from('hangouts')
      .insert(payload)
      .select()
      .single();

    if (createError) {
      throw new Error(createError.message);
    }

    // The database adds the host as the first attendee and posts the
    // Space's opening notice (hangouts_after_insert trigger).
    return formatHangout({ ...createdHangout, attendee_count: 1 }, [{ user_id: userId }]);
  },

  async joinHangout(userId, hangoutId) {
    if (!userId) throw new Error('Must be signed in to join.');

    const { error } = await supabase
      .from('hangout_attendees')
      .insert({
        hangout_id: hangoutId,
        user_id: userId
      });

    // 23505 = already joined; anything else (full, closed, paid) is surfaced.
    if (error && error.code !== '23505') {
      throw new Error(error.message);
    }
  },

  // Leaves through the server so paid tickets/sponsorships are refunded per
  // policy (>= 24h before the start: amount minus LEENKIT's fee; later: none).
  // Returns { refund_amount, currency, paid }.
  async leaveHangout(userId, hangoutId) {
    if (!userId) throw new Error('Must be signed in to leave.');

    const { data, error } = await supabase.rpc('leave_hangout', { p_hangout_id: hangoutId });
    if (error) {
      throw new Error(error.message);
    }
    return data || { refund_amount: 0 };
  },

  // What leaving now would refund the signed-in user.
  async getLeaveRefundPreview(hangoutId) {
    const { data, error } = await supabase.rpc('get_leave_refund_preview', { p_hangout_id: hangoutId });
    if (error) throw new Error(error.message);
    return data;
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
      } catch {
        formattedTime = '';
      }
    }

    return {
      id: dbMessage.id,
      userId: dbMessage.user_id,
      userName: dbMessage.user_name || 'LEENKIT User',
      userAvatar: dbMessage.user_avatar || null,
      text: dbMessage.text || '',
      timestamp: formattedTime,
      createdAt: dbMessage.created_at,
      type: dbMessage.type || 'user'
    };
  },

  // Latest `limit` messages, oldest first.
  async fetchSpaceMessages(hangoutId, limit = 200) {
    if (!hangoutId) return [];

    const { data, error } = await supabase
      .from('hangout_messages')
      .select('*')
      .eq('hangout_id', hangoutId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(error.message);
    }

    return (data || []).reverse().map(this.formatMessage).filter(Boolean);
  },

  // Sender name/avatar are filled in by the database from the profile.
  async sendSpaceMessage({ hangoutId, userId, text }) {
    if (!hangoutId || !userId) {
      throw new Error('Hangout ID and User ID are required to send a message.');
    }

    const trimmedText = (text || '').trim();
    if (!trimmedText) {
      throw new Error('Message content cannot be empty.');
    }

    if (trimmedText.length > 2000) {
      throw new Error('Messages can be up to 2,000 characters.');
    }

    const payload = {
      hangout_id: hangoutId,
      user_id: userId,
      text: trimmedText
    };

    const { data, error } = await supabase
      .from('hangout_messages')
      .insert(payload)
      .select()
      .single();

    if (error) {
      throw dbError(error);
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
      message: (message || '').trim().substring(0, 200) || null
    };

    const { data, error } = await supabase
      .from('hangout_sponsorships')
      .insert(payload)
      .select()
      .single();

    if (error) {
      throw dbError(error);
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

        const totalPaid = Number(row.total_paid ?? 0);
        const totalPledged = Number(row.total_pledged ?? 0);
        const sponsorCount = Number(row.sponsor_count ?? 0);

        if (totalPaid > 0 || totalPledged > 0) {
          normalizedCurrencies.push({
            currency: curr,
            totalPaid,
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
  },

  // 1. Digital Ticket & Check-in
  async checkInAttendee(hangoutId, ticketCode) {
    if (!hangoutId || !ticketCode) throw new Error('Hangout ID and Ticket Code are required.');
    const { data, error } = await supabase.rpc('check_in_attendee', {
      p_hangout_id: hangoutId,
      p_ticket_code: ticketCode.trim().toUpperCase()
    });
    if (error) throw new Error(error.message);
    return data;
  },

  async getMyTicket(hangoutId, userId) {
    if (!hangoutId || !userId) return null;
    const { data, error } = await supabase
      .from('hangout_attendees')
      .select('id, ticket_code, checked_in_at, created_at')
      .eq('hangout_id', hangoutId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error || !data) return null;
    return {
      ticketCode: data.ticket_code,
      checkedInAt: data.checked_in_at,
      joinedAt: data.created_at
    };
  },

  // 2. Hangout Memories Stream
  async fetchMemories(hangoutId) {
    if (!hangoutId) return [];
    const { data, error } = await supabase
      .from('hangout_memories')
      .select(`
        id,
        hangout_id,
        user_id,
        image_url,
        caption,
        phase,
        created_at,
        profiles (
          id,
          name,
          username,
          avatar
        )
      `)
      .eq('hangout_id', hangoutId)
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Error fetching memories:', error.message);
      return [];
    }

    return (data || []).map(m => ({
      id: m.id,
      hangoutId: m.hangout_id,
      userId: m.user_id,
      imageUrl: m.image_url,
      caption: m.caption,
      phase: m.phase,
      createdAt: m.created_at,
      author: m.profiles ? {
        name: m.profiles.name,
        username: m.profiles.username,
        avatar: m.profiles.avatar
      } : null
    }));
  },

  async addMemory(hangoutId, userId, { file, caption, phase = 'during' }) {
    if (!hangoutId || !userId) throw new Error('Sign in required to share memory.');
    if (!file) throw new Error('Please select a photo.');

    const fileExt = file.name.split('.').pop() || 'jpg';
    const filePath = `memories/${hangoutId}/${Date.now()}_${Math.random().toString(36).substring(2, 6)}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('hangout-images')
      .upload(filePath, file, { cacheControl: '3600', upsert: false });

    if (uploadError) throw new Error(`Photo upload failed: ${uploadError.message}`);

    const { data: publicUrlData } = supabase.storage
      .from('hangout-images')
      .getPublicUrl(filePath);

    const { data, error } = await supabase
      .from('hangout_memories')
      .insert({
        hangout_id: hangoutId,
        user_id: userId,
        image_url: publicUrlData.publicUrl,
        caption: caption ? caption.trim().slice(0, 500) : null,
        phase
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  },

  async deleteMemory(memoryId) {
    if (!memoryId) return;
    const { error } = await supabase
      .from('hangout_memories')
      .delete()
      .eq('id', memoryId);
    if (error) throw new Error(error.message);
  },

  // 3. Series / Recurring Hangouts
  async createSeries({ hostId, title, recurrenceType = 'weekly', totalOccurrences = 4 }) {
    const { data, error } = await supabase
      .from('hangout_series')
      .insert({
        host_id: hostId,
        title,
        recurrence_type: recurrenceType,
        total_occurrences: totalOccurrences
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  },

  async getSeriesHangouts(seriesId) {
    if (!seriesId) return [];
    const { data, error } = await supabase
      .from('hangouts')
      .select('id, title, date, time, series_index, status')
      .eq('series_id', seriesId)
      .order('series_index', { ascending: true });

    if (error) return [];
    return data || [];
  }
};

