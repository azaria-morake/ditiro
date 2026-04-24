"use client";

import React, { useEffect } from 'react';
import Link from 'next/link';
import { DitiroIcon, LXGLogo, SparkleIcon, GoogleIcon } from '@/components/brand/Logos';
import { useRouter } from 'next/navigation';
import { LoadingScreen } from '@/components/auth/LoadingScreen';

import { useAuth } from '@/components/auth/AuthProvider';
import { useDialog } from '@/components/ui/DialogProvider';

export default function LoginPage() {
  const router = useRouter();
  const { user, isGuest, loading, setAsGuest } = useAuth();
  const { showDialog } = useDialog();
  const [showBenefits, setShowBenefits] = React.useState(false);
  const [isLoggingIn, setIsLoggingIn] = React.useState(false);
  const [isProcessing, setIsProcessing] = React.useState(false);

  useEffect(() => {
    if (!loading && (user || isGuest)) {
      // If we are already logged in, skip the manual 'isLoggingIn' flow
      router.push('/');
    }
  }, [user, isGuest, loading, router]);

  const handleGoogleSignIn = async () => {
    setIsProcessing(true);
    try {
      const { signInWithPopup, GoogleAuthProvider } = await import('firebase/auth');
      const { auth } = await import('@/lib/firebase');
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      if (result.user) {
        setIsLoggingIn(true);
      }
    } catch (error: any) {
      console.error("Google Sign-In Error:", error);
      setIsProcessing(false);
      if (error.code !== 'auth/cancelled-popup-request') {
        showDialog({
          title: "Sign-in Error",
          message: "We couldn't sign you in with Google right now. Please try again or continue without sign up.",
          type: "alert"
        });
      }
    }
  };

  const handleNoSignUp = () => {
    setShowBenefits(true);
  };

  const handleFinalContinue = () => {
    setIsProcessing(true);
    setAsGuest();
    setShowBenefits(false);
    setIsLoggingIn(true);
  };

  const handleSetupComplete = () => {
    // If auth state has caught up, redirect will happen via useEffect above.
    // If not, we stay on the loading screen or reset to handle errors.
    if (!loading && (user || isGuest)) {
      router.push('/');
    } else if (!loading) {
      setIsLoggingIn(false); // Back to login if something failed
    }
  };

  if (isLoggingIn) {
    return <LoadingScreen onFinished={handleSetupComplete} />;
  }

  return (
    <div className="min-h-[100dvh] bg-neutral-950 text-white flex flex-col items-center justify-center relative font-sans p-6">
      {/* Background Geometric Pattern */}
      <div className="absolute inset-0 pointer-events-none opacity-20 overflow-hidden">
        <svg className="absolute bottom-[-10%] right-[-5%] w-[600px] h-[600px] text-neutral-800" viewBox="0 0 200 200" fill="none" stroke="currentColor" strokeWidth="0.5">
          <path d="M0 200 L200 0 M20 200 L200 20 M40 200 L200 40 M60 200 L200 60 M80 200 L200 80 M100 200 L200 100 M120 200 L200 120 M140 200 L200 140 M160 200 L200 160 M180 200 L200 180" />
          <path d="M200 200 L0 0 M180 200 L0 20 M160 200 L0 40 M140 200 L0 60 M120 200 L0 80 M100 200 L0 100 M80 200 L0 120 M60 200 L0 140 M40 200 L0 160 M20 200 L0 180" opacity="0.5" />
        </svg>
      </div>

      <main className="z-10 w-full max-w-md mb-20 md:mb-0">
        <div className="bg-neutral-900/50 backdrop-blur-xl border border-neutral-800 rounded-[2.5rem] p-8 md:p-12 flex flex-col items-center text-center shadow-2xl transition-all">
          {/* Logo */}
          <DitiroIcon className="w-16 h-16 md:w-20 md:h-20 text-[#e05012] mb-6 md:mb-8" />

          {/* Text Content */}
          <h1 className="text-2xl md:text-3xl font-bold mb-2 md:mb-3 tracking-tight">Welcome to Ditiro.</h1>
          <p className="text-neutral-400 text-base md:text-lg mb-8 md:mb-10">Turning intentions... into actions.</p>

          {/* Buttons */}
          <div className="w-full space-y-4">
            <button
              onClick={handleGoogleSignIn}
              disabled={isProcessing}
              className="w-full bg-[#e05012] hover:bg-[#ff5f1f] text-white font-semibold py-4 rounded-xl flex items-center justify-center gap-3 transition-all active:scale-[0.98] disabled:opacity-70"
            >
              <GoogleIcon className="w-5 h-5 text-white" />
              {isProcessing ? "Processing..." : "Continue with Google"}
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
              Continue as Guest
            </button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="absolute bottom-6 md:bottom-8 flex flex-col items-center gap-3 z-10">
        <LXGLogo className="h-4 w-auto text-neutral-700" />
        <p className="text-neutral-500 text-[10px] md:text-xs font-medium uppercase tracking-widest">Made by UX Giants</p>
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
                disabled={isProcessing}
                className="w-full bg-[#e05012] hover:bg-[#ff5f1f] text-white font-semibold py-4 rounded-xl flex items-center justify-center gap-3 transition-all active:scale-[0.98] disabled:opacity-70"
              >
                <GoogleIcon className="w-5 h-5 text-white" />
                {isProcessing ? "Processing..." : "Continue with Google"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
