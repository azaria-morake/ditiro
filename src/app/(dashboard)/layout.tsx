"use client";

import React, { useEffect } from 'react';
import Sidebar from '@/components/sidebar/Sidebar';
import { MenuButton } from '@/components/sidebar/MenuButton';
import { useAuth } from '@/components/auth/AuthProvider';
import { useRouter } from 'next/navigation';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, isGuest } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user && !isGuest) {
      // Add a small delay for mobile session restoration
      const timeout = setTimeout(() => {
        router.push('/login');
      }, 800);
      return () => clearTimeout(timeout);
    }
  }, [user, loading, isGuest, router]);

  if (loading) {
    return <div className="h-screen w-full bg-neutral-950" />;
  }

  // If not loading, and not authenticated/guest, we'll be redirected by the useEffect.
  // We still check here to prevent flashing content.
  if (!user && !isGuest) {
    return <div className="h-screen w-full bg-neutral-950" />;
  }

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden relative">
      <Sidebar />
      <header className="fixed top-0 left-0 right-0 h-16 flex items-center px-4 md:hidden shrink-0 z-40 pointer-events-none">
        <div className="pointer-events-auto">
          <MenuButton />
        </div>
      </header>
      <div className="flex-1 flex flex-col min-w-0 h-full w-full pt-16 md:pt-0">
        <main className="flex-1 overflow-hidden relative">
          {children}
        </main>
      </div>
    </div>
  );
}
