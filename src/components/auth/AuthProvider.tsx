"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '@/lib/firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isGuest: boolean;
  setAsGuest: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  isGuest: false,
  setAsGuest: () => {},
});

import { useSync } from '@/hooks/useSync';

const SyncManager = () => {
  useSync();
  return null;
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(false);

  useEffect(() => {
    // Check for guest status in local storage
    const guestStatus = localStorage.getItem('ditiro_guest') === 'true';
    setIsGuest(guestStatus);

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const setAsGuest = () => {
    localStorage.setItem('ditiro_guest', 'true');
    setIsGuest(true);
  };

  return (
    <AuthContext.Provider value={{ user, loading, isGuest, setAsGuest }}>
      {!loading && <SyncManager />}
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
