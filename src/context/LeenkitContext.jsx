import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useUser } from './UserContext';
import { hangoutService } from '../services/hangout/hangoutService';
import { supabase } from '../lib/supabase';
import { friendlyError } from '../utils/format';

const LeenkitContext = createContext();

// Every action talks to the server first and only updates the screen with
// what the server confirmed. Failures are thrown with a readable message so
// the page can show them; nothing pretends to succeed.
export function LeenkitProvider({ children }) {
  const { currentUser, fetchAndCacheProfiles } = useUser();
  const userId = currentUser?.id;

  const [hangouts, setHangouts] = useState([]);
  const [messagesMap, setMessagesMap] = useState({});
  const [isHangoutsLoading, setIsHangoutsLoading] = useState(true);
  const [hangoutsError, setHangoutsError] = useState('');

  // Stable reference so the load effect does not re-run on every
  // UserProvider render (that caused repeated full reloads).
  const fetchProfilesRef = useRef(fetchAndCacheProfiles);
  fetchProfilesRef.current = fetchAndCacheProfiles;

  const cacheProfilesFor = useCallback((list) => {
    const ids = [];
    (list || []).forEach(h => {
      if (h.hostId) ids.push(h.hostId);
      if (h.attendeeIds) ids.push(...h.attendeeIds);
    });
    if (ids.length > 0) fetchProfilesRef.current?.(ids);
  }, []);

  const loadHangouts = useCallback(async () => {
    setHangoutsError('');
    try {
      const fetched = await hangoutService.fetchHangouts();
      if (fetched === null) throw new Error('Could not load Hangouts.');
      setHangouts(fetched);
      cacheProfilesFor(fetched);
    } catch (err) {
      setHangoutsError(friendlyError(err, 'Could not load Hangouts.'));
    } finally {
      setIsHangoutsLoading(false);
    }
  }, [cacheProfilesFor]);

  // Reload when the signed-in user changes (attendee visibility depends on it).
  useEffect(() => {
    setIsHangoutsLoading(true);
    loadHangouts();
  }, [userId, loadHangouts]);

  const upsertHangout = useCallback((hangout) => {
    if (!hangout) return;
    setHangouts(prev => {
      const exists = prev.some(h => h.id === hangout.id);
      return exists ? prev.map(h => (h.id === hangout.id ? hangout : h)) : [hangout, ...prev];
    });
  }, []);

  // Fetch one Hangout fresh from the server (deep links, after joins/payments).
  const refreshHangout = useCallback(async (id) => {
    if (!id) return null;
    const fresh = await hangoutService.fetchHangoutById(id);
    if (fresh) {
      upsertHangout(fresh);
      cacheProfilesFor([fresh]);
    } else {
      setHangouts(prev => prev.filter(h => h.id !== id));
    }
    return fresh;
  }, [upsertHangout, cacheProfilesFor]);

  const addRealtimeMessage = useCallback((hangoutId, formattedMsg) => {
    if (!hangoutId || !formattedMsg || !formattedMsg.id) return;
    setMessagesMap(prev => {
      const existing = prev[hangoutId] || [];
      if (existing.some(m => m.id === formattedMsg.id)) return prev;
      return { ...prev, [hangoutId]: [...existing, formattedMsg] };
    });
  }, []);

  const loadSpaceMessages = useCallback(async (hangoutId) => {
    if (!hangoutId) return [];
    const fetched = await hangoutService.fetchSpaceMessages(hangoutId);
    setMessagesMap(prev => {
      const existing = prev[hangoutId] || [];
      const fetchedIds = new Set(fetched.map(m => m.id));
      const realtimeOnly = existing.filter(m => !fetchedIds.has(m.id));
      return { ...prev, [hangoutId]: [...fetched, ...realtimeOnly] };
    });
    return fetched;
  }, []);

  const subscribeToSpaceMessages = useCallback((hangoutId) => {
    if (!hangoutId) return () => {};

    let channel = null;
    let isCancelled = false;

    const init = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) supabase.realtime.setAuth(session.access_token);
      } catch {
        // Realtime falls back to the anon token; RLS still applies.
      }
      if (isCancelled) return;

      channel = supabase
        .channel(`space:${hangoutId}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'hangout_messages', filter: `hangout_id=eq.${hangoutId}` },
          (payload) => {
            if (payload.new && payload.new.hangout_id === hangoutId) {
              addRealtimeMessage(hangoutId, hangoutService.formatMessage(payload.new));
              // Join/leave notices change who is in the Hangout.
              if (payload.new.type === 'system') refreshHangout(hangoutId).catch(() => {});
            }
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            // Catch anything sent between the first load and subscribing.
            loadSpaceMessages(hangoutId).catch(() => {});
          }
        });
    };

    init();

    return () => {
      isCancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [addRealtimeMessage, loadSpaceMessages, refreshHangout]);

  const requireUser = () => {
    if (!userId) throw new Error('Please sign in first.');
  };

  const joinHangout = async (id) => {
    requireUser();
    const hangout = hangouts.find(h => h.id === id);
    if (hangout?.isPaid) {
      throw new Error('This is a paid Hangout. Get a ticket from the Hangout page.');
    }
    try {
      await hangoutService.joinHangout(userId, id);
    } catch (err) {
      throw new Error(friendlyError(err, 'Could not join this Hangout.'));
    }
    return refreshHangout(id);
  };

  const leaveHangout = async (id) => {
    requireUser();
    const hangout = hangouts.find(h => h.id === id);
    if (hangout && hangout.hostId === userId) {
      throw new Error('Hosts cannot leave their own Hangout. Cancel it instead.');
    }
    let result;
    try {
      result = await hangoutService.leaveHangout(userId, id);
    } catch (err) {
      throw new Error(friendlyError(err, 'Could not leave this Hangout.'));
    }
    await refreshHangout(id);
    return result;
  };

  const createHangout = async (newHangoutData) => {
    requireUser();
    try {
      const newHangout = await hangoutService.createHangout(userId, newHangoutData);
      upsertHangout(newHangout);
      return newHangout;
    } catch (err) {
      throw new Error(friendlyError(err, 'Could not publish this Hangout.'));
    }
  };

  const cancelHangout = async (id) => {
    try {
      await hangoutService.cancelHangout(id);
    } catch (err) {
      throw new Error(friendlyError(err, 'Could not cancel this Hangout.'));
    }
    return refreshHangout(id);
  };

  const completeHangout = async (id) => {
    try {
      await hangoutService.markHangoutCompleted(id);
    } catch (err) {
      throw new Error(friendlyError(err, 'Could not mark this Hangout as completed.'));
    }
    return refreshHangout(id);
  };

  const deleteHangout = async (id) => {
    try {
      await hangoutService.deleteHangout(id);
    } catch (err) {
      throw new Error(friendlyError(err, 'Could not delete this Hangout.'));
    }
    setHangouts(prev => prev.filter(h => h.id !== id));
  };

  const sendMessage = async (hangoutId, text) => {
    if (!text || !text.trim()) return null;
    requireUser();
    try {
      const inserted = await hangoutService.sendSpaceMessage({ hangoutId, userId, text: text.trim() });
      if (inserted) addRealtimeMessage(hangoutId, inserted);
      return inserted;
    } catch (err) {
      throw new Error(friendlyError(err, 'Message not sent.'));
    }
  };

  const getHangoutById = (id) => hangouts.find(h => h.id === id);

  const isAttending = (hangoutId) => {
    const hangout = getHangoutById(hangoutId);
    if (!hangout || !userId) return false;
    return (hangout.attendeeIds || []).includes(userId) || hangout.hostId === userId;
  };

  return (
    <LeenkitContext.Provider value={{
      hangouts,
      messagesMap,
      isHangoutsLoading,
      hangoutsError,
      reloadHangouts: loadHangouts,
      refreshHangout,
      joinHangout,
      leaveHangout,
      createHangout,
      cancelHangout,
      completeHangout,
      deleteHangout,
      sendMessage,
      loadSpaceMessages,
      subscribeToSpaceMessages,
      getHangoutById,
      isAttending
    }}>
      {children}
    </LeenkitContext.Provider>
  );
}

export function useLeenkit() {
  return useContext(LeenkitContext);
}
