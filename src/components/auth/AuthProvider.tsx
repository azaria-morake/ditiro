"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '@/lib/firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isGuest: boolean;
  setAsGuest: () => void;
  logout: () => Promise<void>;
  loginWithGoogle: () => Promise<User | null>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  isGuest: false,
  setAsGuest: () => {},
  logout: async () => {},
  loginWithGoogle: async () => null,
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

  const logout = async () => {
    localStorage.removeItem('ditiro_guest');
    setIsGuest(false);
    await auth.signOut();
    setUser(null);
  };

  const loginWithGoogle = async () => {
    const { signInWithPopup, GoogleAuthProvider } = await import('firebase/auth');
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      if (result.user) {
        localStorage.removeItem('ditiro_guest');
        setIsGuest(false);
      }
      return result.user;
    } catch (error) {
      console.error("Google Sign-in failed in provider:", error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, isGuest, setAsGuest, logout, loginWithGoogle }}>
      {!loading && <SyncManager />}
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
