import React, { createContext, useContext, useEffect, useState } from 'react';
import { authService } from '../services/auth/authService';
import { vibeService } from '../services/vibe/vibeService';
import { notificationService } from '../services/notification/notificationService';
import { supabase } from '../lib/supabase';

const UserContext = createContext();

export function UserProvider({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  const [users, setUsers] = useState(() => {
    try {
      localStorage.removeItem('leenkit_all_users');
      localStorage.removeItem('leenq_all_users');
    } catch (e) {}
    return [];
  });

  const [vibingIds, setVibingIds] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalInitialView, setAuthModalInitialView] = useState('welcome');
  const [isAuthLoading, setIsAuthLoading] = useState(true);

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

    const loadAllProfiles = async () => {
      try {
        const allProfiles = await authService.fetchProfilesAll();
        if (mounted && allProfiles && allProfiles.length > 0) {
          setUsers(prev => {
            const map = new Map(prev.map(u => [u.id, u]));
            allProfiles.forEach(u => map.set(u.id, u));
            return Array.from(map.values());
          });
        }
      } catch (e) {
        console.warn('Could not load initial profiles:', e);
      }
    };

    loadAllProfiles();

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

  const fetchAndCacheProfiles = async (ids) => {
    if (!ids || (Array.isArray(ids) && ids.length === 0)) return;
    const missing = (Array.isArray(ids) ? ids : [ids]).filter(id => id && !users.some(u => u.id === id));
    if (missing.length === 0) return;

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
      console.warn('Could not fetch profiles by IDs:', e.message);
    }
  };

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
    const user = await authService.registerWithEmail(data);

    setCurrentUser(user);
    setIsAuthenticated(true);
    updateUsersList(user);

    return user;
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

  const getUserById = (id) => {
    if (!id) return null;
    const found = users.find(user => user.id === id);
    if (found) return found;

    if (currentUser?.id === id) return currentUser;

    fetchAndCacheProfiles([id]);

    return {
      id,
      name: 'LEENKIT Member',
      avatar:
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
      location: 'Abuja'
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