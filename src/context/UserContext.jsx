import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { authService } from '../services/auth/authService';
import { vibeService } from '../services/vibe/vibeService';
import { notificationService } from '../services/notification/notificationService';
import { supabase } from '../lib/supabase';

const UserContext = createContext();

export function UserProvider({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  const [users, setUsers] = useState([]);
  const usersRef = useRef(users);
  usersRef.current = users;
  // Profile ids already requested, so each one is fetched at most once.
  const requestedProfileIds = useRef(new Set());

  const [vibingIds, setVibingIds] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalInitialView, setAuthModalInitialView] = useState('welcome');
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // Terms & Privacy acceptance for the signed-in user.
  // status: 'checking' | 'accepted' | 'required' | 'error'
  const [legalAcceptance, setLegalAcceptance] = useState({ userId: null, status: 'checking', error: '' });
  const legalCheckSeq = useRef(0);
  const signupInProgress = useRef(false);

  // Check whether the signed-in user has accepted the current legal versions.
  // Fails closed: a query error never counts as acceptance.
  const checkLegalAcceptance = async (userId) => {
    const seq = ++legalCheckSeq.current;
    setLegalAcceptance({ userId, status: 'checking', error: '' });

    try {
      const accepted = await authService.hasAcceptedCurrentLegal(userId);
      if (seq !== legalCheckSeq.current) return;
      // While an email signup is recording acceptance, don't flash the gate.
      if (!accepted && signupInProgress.current) return;
      setLegalAcceptance({ userId, status: accepted ? 'accepted' : 'required', error: '' });
    } catch (e) {
      if (seq !== legalCheckSeq.current) return;
      console.warn('Could not check Terms/Privacy acceptance:', e.message);
      setLegalAcceptance({
        userId,
        status: 'error',
        error: 'We could not confirm your acceptance of the Terms & Conditions and Privacy Policy.'
      });
    }
  };

  useEffect(() => {
    if (currentUser?.id) {
      checkLegalAcceptance(currentUser.id);
    } else {
      legalCheckSeq.current++;
      setLegalAcceptance({ userId: null, status: 'checking', error: '' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);

  // Load user's Vibing list from Supabase whenever authenticated user changes
  useEffect(() => {
    let mounted = true;
    if (currentUser?.id) {
      vibeService.fetchVibingUserIds(currentUser.id).then(ids => {
        if (mounted && ids) {
          setVibingIds(ids);
          if (ids.length > 0) {
            fetchAndCacheProfiles(ids);
          }
        }
      }).catch(err => {
        console.warn('Could not fetch vibing list:', err);
      });
    } else {
      setVibingIds([]);
    }
    return () => { mounted = false; };
  }, [currentUser?.id]);

  // Load user's notifications and subscribe to realtime notification changes
  useEffect(() => {
    let mounted = true;
    let unsubscribe = () => {};

    if (currentUser?.id) {
      notificationService.fetchNotifications(currentUser.id).then(list => {
        if (mounted && list) {
          setNotifications(list);
        }
      }).catch(err => {
        console.warn('Could not fetch notifications:', err);
      });

      unsubscribe = notificationService.subscribeToNotifications(
        currentUser.id,
        (newNotif) => {
          if (mounted && newNotif) {
            setNotifications(prev => {
              const filtered = prev.filter(n => n.id !== newNotif.id);
              return [newNotif, ...filtered];
            });
          }
        }
      );
    } else {
      setNotifications([]);
    }

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [currentUser?.id]);

  // Get the current Supabase user when the app starts and load profiles.
  useEffect(() => {
    let mounted = true;

    const loadCurrentUser = async () => {
      try {
        const user = await authService.getCurrentUser();

        if (!mounted) return;

        if (user) {
          setCurrentUser(user);
          setIsAuthenticated(true);

          setUsers(prev => {
            const exists = prev.some(existingUser => existingUser.id === user.id);

            if (exists) {
              return prev.map(existingUser =>
                existingUser.id === user.id ? user : existingUser
              );
            }

            return [user, ...prev];
          });
        } else {
          setCurrentUser(null);
          setIsAuthenticated(false);
        }
      } catch (error) {
        console.error('Failed to load current user:', error);
        setCurrentUser(null);
        setIsAuthenticated(false);
      } finally {
        if (mounted) {
          setIsAuthLoading(false);
        }
      }
    };

    loadCurrentUser();

    // Listen for Supabase authentication changes.
    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      if (session?.user) {
        try {
          const user = await authService.getCurrentUser();

          if (!mounted) return;

          setCurrentUser(user);
          setIsAuthenticated(true);

          setUsers(prev => {
            const exists = prev.some(existingUser => existingUser.id === user.id);

            if (exists) {
              return prev.map(existingUser =>
                existingUser.id === user.id ? user : existingUser
              );
            }

            return [user, ...prev];
          });
        } catch (error) {
          console.error('Failed to load authenticated user:', error);
        }
      } else {
        setCurrentUser(null);
        setIsAuthenticated(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Stable identity: consumers can depend on it without re-running effects.
  const fetchAndCacheProfiles = useCallback(async (ids) => {
    if (!ids || (Array.isArray(ids) && ids.length === 0)) return;
    const known = new Set(usersRef.current.map(u => u.id));
    const missing = Array.from(new Set(Array.isArray(ids) ? ids : [ids]))
      .filter(id => id && !known.has(id) && !requestedProfileIds.current.has(id));
    if (missing.length === 0) return;
    missing.forEach(id => requestedProfileIds.current.add(id));

    try {
      const fetched = await authService.fetchProfiles(missing);
      if (fetched && fetched.length > 0) {
        setUsers(prev => {
          const map = new Map(prev.map(u => [u.id, u]));
          fetched.forEach(u => map.set(u.id, u));
          return Array.from(map.values());
        });
      }
    } catch (e) {
      missing.forEach(id => requestedProfileIds.current.delete(id));
      console.warn('Could not fetch profiles by IDs:', e.message);
    }
  }, []);

  const openAuthModal = (view = 'welcome') => {
    setAuthModalInitialView(view);
    setIsAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    setIsAuthModalOpen(false);
  };

  const updateUsersList = (user) => {
    setUsers(prev => {
      const exists = prev.some(existingUser => existingUser.id === user.id);

      if (exists) {
        return prev.map(existingUser =>
          existingUser.id === user.id ? user : existingUser
        );
      }

      return [user, ...prev];
    });
  };

  const loginWithEmail = async (email, password) => {
    const user = await authService.loginWithEmail(email, password);

    setCurrentUser(user);
    setIsAuthenticated(true);
    updateUsersList(user);

    return user;
  };

  const registerWithEmail = async (data) => {
    // Enforced here as well as in the form: no account without acceptance.
    if (data?.acceptedLegal !== true) {
      throw new Error('Please agree to the Terms & Conditions and Privacy Policy to create an account.');
    }

    const { acceptedLegal: _acceptedLegal, ...registration } = data;
    signupInProgress.current = true;

    let result;
    try {
      result = await authService.registerWithEmail(registration);
    } catch (e) {
      signupInProgress.current = false;
      // The auth account may exist even if a later step failed; make sure a
      // signed-in user still gets a definitive acceptance check.
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData?.session?.user?.id) {
        checkLegalAcceptance(sessionData.session.user.id);
      }
      throw e;
    }

    // Email confirmation required: no session yet, so acceptance cannot be
    // recorded now. The legal gate asks for it on first sign-in.
    if (result.needsEmailConfirmation) {
      signupInProgress.current = false;
      return { user: null, needsEmailConfirmation: true };
    }

    const { user } = result;
    setCurrentUser(user);
    setIsAuthenticated(true);
    updateUsersList(user);

    // Record acceptance only after the account exists. If this fails the
    // account is real but unaccepted, so the in-app gate asks again.
    try {
      await authService.recordLegalAcceptance('signup');
      legalCheckSeq.current++; // supersede any check that started before the insert
      setLegalAcceptance({ userId: user.id, status: 'accepted', error: '' });
    } catch (e) {
      console.warn('Could not record Terms/Privacy acceptance at signup:', e.message);
      legalCheckSeq.current++;
      setLegalAcceptance({
        userId: user.id,
        status: 'required',
        error: 'Your account was created, but we could not save your acceptance. Please confirm again to continue.'
      });
    } finally {
      signupInProgress.current = false;
    }

    return { user, needsEmailConfirmation: false };
  };

  const acceptLegalTerms = async () => {
    if (!currentUser?.id) {
      throw new Error('No authenticated user found.');
    }

    const userId = currentUser.id;
    await authService.recordLegalAcceptance('in_app');
    legalCheckSeq.current++;
    setLegalAcceptance({ userId, status: 'accepted', error: '' });
  };

  const retryLegalCheck = () => {
    if (currentUser?.id) checkLegalAcceptance(currentUser.id);
  };

  const loginWithGoogle = async () => {
    return await authService.loginWithGoogle();
  };

  const loginWithFacebook = async () => {
    throw new Error('Facebook sign-in is not connected yet.');
  };

  const logout = async () => {
    await authService.logout();

    setCurrentUser(null);
    setIsAuthenticated(false);
    setVibingIds([]);
    setNotifications([]);
  };

  const updateProfile = async (updatedFields) => {
    if (!currentUser?.id) {
      throw new Error('No authenticated user found.');
    }

    const updatedUser = await authService.updateProfile(currentUser.id, updatedFields);

    setCurrentUser(updatedUser);
    updateUsersList(updatedUser);

    return updatedUser;
  };

  const acceptHostingGuidelines = async (version) => {
    if (!currentUser?.id) {
      throw new Error('No authenticated user found.');
    }

    const updatedUser = await authService.acceptHostingGuidelines(version);

    setCurrentUser(updatedUser);
    updateUsersList(updatedUser);

    return updatedUser;
  };

  const getUserById = (id) => {
    if (!id) return null;
    const found = users.find(user => user.id === id);
    if (found) return found;

    if (currentUser?.id === id) return currentUser;

    // Deduplicated: fetched at most once per id, outside the render pass.
    if (!requestedProfileIds.current.has(id)) {
      queueMicrotask(() => fetchAndCacheProfiles([id]));
    }

    return {
      id,
      name: 'LEENKIT Member',
      username: null,
      avatar: null,
      location: ''
    };
  };

  const isVibingWith = (userId) => {
    if (!userId) return false;
    return vibingIds.includes(userId);
  };

  const vibeWith = async (targetUserId) => {
    if (!currentUser?.id) {
      openAuthModal('welcome');
      return false;
    }
    if (currentUser.id === targetUserId) {
      throw new Error('You cannot vibe with yourself.');
    }

    setVibingIds(prev => Array.from(new Set([...prev, targetUserId])));

    try {
      await vibeService.vibeWithUser(currentUser.id, targetUserId);
      return true;
    } catch (e) {
      setVibingIds(prev => prev.filter(id => id !== targetUserId));
      throw e;
    }
  };

  const unvibeWith = async (targetUserId) => {
    if (!currentUser?.id) return false;

    setVibingIds(prev => prev.filter(id => id !== targetUserId));

    try {
      await vibeService.unvibeWithUser(currentUser.id, targetUserId);
      return true;
    } catch (e) {
      setVibingIds(prev => Array.from(new Set([...prev, targetUserId])));
      throw e;
    }
  };

  const markNotificationRead = async (id) => {
    if (!id) return;
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, isRead: true } : n))
    );
    await notificationService.markAsRead(id);
  };

  const markAllNotificationsRead = async () => {
    if (!currentUser?.id) return;
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    await notificationService.markAllAsRead(currentUser.id);
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <UserContext.Provider
      value={{
        isAuthenticated,
        currentUser,
        users,
        vibingIds,
        notifications,
        unreadCount,
        isAuthLoading,
        isAuthModalOpen,
        authModalInitialView,
        openAuthModal,
        closeAuthModal,
        loginWithEmail,
        registerWithEmail,
        loginWithGoogle,
        loginWithFacebook,
        logout,
        updateProfile,
        acceptHostingGuidelines,
        legalAcceptance,
        acceptLegalTerms,
        retryLegalCheck,
        getUserById,
        fetchAndCacheProfiles,
        isVibingWith,
        vibeWith,
        unvibeWith,
        markNotificationRead,
        markAllNotificationsRead
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}