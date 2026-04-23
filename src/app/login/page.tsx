"use client";

import React from 'react';
import Link from 'next/link';
import { DitiroIcon, LXGLogo, SparkleIcon } from '@/components/brand/Logos';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [showBenefits, setShowBenefits] = React.useState(false);

  const handleGoogleSignIn = async () => {
    try {
      const { signInWithPopup, GoogleAuthProvider } = await import('firebase/auth');
      const { auth } = await import('@/lib/firebase');
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      router.push('/');
    } catch (error) {
      console.error("Google Sign-In Error:", error);
      // For now, still redirect to '/' so the user isn't stuck if keys are missing but they want to see the app
      router.push('/');
    }
  };

  const handleNoSignUp = () => {
    setShowBenefits(true);
  };

  const handleFinalContinue = () => {
    router.push('/');
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex flex-col items-center justify-center relative overflow-hidden font-sans">
      {/* Background Geometric Pattern */}
      <div className="absolute inset-0 pointer-events-none opacity-20">
        <svg className="absolute bottom-[-10%] right-[-5%] w-[600px] h-[600px] text-neutral-800" viewBox="0 0 200 200" fill="none" stroke="currentColor" strokeWidth="0.5">
          <path d="M0 200 L200 0 M20 200 L200 20 M40 200 L200 40 M60 200 L200 60 M80 200 L200 80 M100 200 L200 100 M120 200 L200 120 M140 200 L200 140 M160 200 L200 160 M180 200 L200 180" />
          <path d="M200 200 L0 0 M180 200 L0 20 M160 200 L0 40 M140 200 L0 60 M120 200 L0 80 M100 200 L0 100 M80 200 L0 120 M60 200 L0 140 M40 200 L0 160 M20 200 L0 180" opacity="0.5" />
        </svg>
      </div>

      <main className="z-10 w-full max-w-md px-6">
        <div className="bg-neutral-900/50 backdrop-blur-xl border border-neutral-800 rounded-3xl p-12 flex flex-col items-center text-center shadow-2xl">
          {/* Logo */}
          <DitiroIcon className="w-20 h-20 text-[#e05012] mb-8" />
          
          {/* Text Content */}
          <h1 className="text-3xl font-bold mb-3 tracking-tight">Welcome to Ditiro.</h1>
          <p className="text-neutral-400 text-lg mb-10">Facilitating deeds. Acto action.</p>

          {/* Buttons */}
          <div className="w-full space-y-4">
            <button 
              onClick={handleGoogleSignIn}
              className="w-full bg-[#e05012] hover:bg-[#ff5f1f] text-white font-semibold py-4 rounded-xl flex items-center justify-center gap-3 transition-all active:scale-[0.98]"
            >
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Continue with Google
            </button>

            <div className="flex items-center gap-4 text-neutral-600">
              <div className="h-px bg-neutral-800 flex-1" />
              <span className="text-sm font-medium">or</span>
              <div className="h-px bg-neutral-800 flex-1" />
            </div>

            <button 
              onClick={handleNoSignUp}
              className="w-full border-2 border-[#e05012] text-[#e05012] hover:bg-[#e05012]/10 font-semibold py-4 rounded-xl transition-all active:scale-[0.98]"
            >
              No sign up
            </button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="absolute bottom-8 flex flex-col items-center gap-3">
        <LXGLogo className="h-4 w-auto text-neutral-700" />
        <p className="text-neutral-500 text-xs font-medium uppercase tracking-widest">Made by UX Giants</p>
      </footer>

      {/* Sparkles */}
      <SparkleIcon className="absolute bottom-10 right-10 w-8 h-8 text-neutral-800" />
      <SparkleIcon className="absolute top-20 left-20 w-4 h-4 text-neutral-800 opacity-50" />

      {/* Signup Benefits Snackbar */}
      {showBenefits && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-6 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-2 duration-500">
            <div className="p-8">
              <h2 className="text-xl font-bold mb-3 flex items-center gap-2">
                <DitiroIcon className="w-6 h-6 text-[#e05012]" />
                Why sign up?
              </h2>
              <p className="text-neutral-400">
                Signing up allows you to persist your conversations, sync tasks across all your devices, and unlock the full potential of Ditiro's AI organization features.
              </p>
            </div>
            
            <div className="bg-neutral-950/50 p-6 flex flex-col gap-4 border-t border-neutral-800">
              <button 
                onClick={handleFinalContinue}
                className="w-full text-neutral-400 hover:text-white transition-colors text-sm font-medium py-2"
              >
                Continue to Ditiro
              </button>
              <div className="flex items-center gap-4 text-neutral-800">
                <div className="h-px bg-neutral-800 flex-1" />
                <span className="text-xs uppercase tracking-widest font-bold">or</span>
                <div className="h-px bg-neutral-800 flex-1" />
              </div>
              <button 
                onClick={handleGoogleSignIn}
                className="w-full bg-[#e05012] hover:bg-[#ff5f1f] text-white font-semibold py-4 rounded-xl flex items-center justify-center gap-3 transition-all active:scale-[0.98]"
              >
                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Continue with Google
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
