"use client";

import React, { useEffect, useState } from 'react';
import { DitiroIcon, LXGLogo, SparkleIcon, GoogleIcon } from '@/components/brand/Logos';
import { useRouter } from 'next/navigation';
import { LoadingScreen } from '@/components/auth/LoadingScreen';

import { useAuth } from '@/components/auth/AuthProvider';
import { useDialog } from '@/components/ui/DialogProvider';

export default function LoginPage() {
  const router = useRouter();
  const { user, isGuest, loading, setAsGuest, loginWithEmail, signUpWithEmail } = useAuth();
  const { showDialog } = useDialog();
  const [showBenefits, setShowBenefits] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Email Auth State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && (user || isGuest)) {
      router.push('/');
    }
  }, [user, isGuest, loading, router]);

  const handleGoogleSignIn = async () => {
    setIsProcessing(true);
    setAuthError(null);
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
      if (error.code !== 'auth/cancelled-popup-request' && error.code !== 'auth/popup-closed-by-user') {
        showDialog({
          title: "Google Sign-in Error",
          message: "Could not complete Google sign-in. You can sign in using Email & Password or Guest mode.",
          type: "alert"
        });
      }
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setAuthError("Please enter both email and password.");
      return;
    }
    setIsProcessing(true);
    setAuthError(null);

    try {
      if (isSignUp) {
        await signUpWithEmail(email.trim(), password);
      } else {
        await loginWithEmail(email.trim(), password);
      }
      setIsLoggingIn(true);
    } catch (err: any) {
      console.error("Email auth error:", err);
      setIsProcessing(false);
      let msg = "Authentication failed. Please check your details.";
      if (err.code === "auth/network-request-failed") {
        msg = "Network error: Unable to reach Firebase Auth services (ERR_NAME_NOT_RESOLVED). Please check your internet connection, DNS, or ad-blocker settings.";
      } else if (err.code === "auth/invalid-credential" || err.code === "auth/wrong-password") {
        msg = "Invalid email or password. Please check your credentials.";
      } else if (err.code === "auth/user-not-found") {
        msg = "No account found with this email. Try creating an account.";
      } else if (err.code === "auth/email-already-in-use") {
        msg = "An account with this email already exists. Try signing in instead.";
      } else if (err.code === "auth/weak-password") {
        msg = "Password should be at least 6 characters long.";
      } else if (err.code === "auth/invalid-email") {
        msg = "Please enter a valid email address.";
      }
      setAuthError(msg);
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
    if (!loading && (user || isGuest)) {
      router.push('/');
    } else if (!loading) {
      setIsLoggingIn(false);
    }
  };

  if (isLoggingIn) {
    return <LoadingScreen onFinished={handleSetupComplete} />;
  }

  return (
    <div className="min-h-[100dvh] bg-neutral-950 text-white flex flex-col items-center justify-center relative font-sans p-6 overflow-y-auto">
      {/* Background Geometric Pattern */}
      <div className="absolute inset-0 pointer-events-none opacity-20 overflow-hidden">
        <svg className="absolute bottom-[-10%] right-[-5%] w-[600px] h-[600px] text-neutral-800" viewBox="0 0 200 200" fill="none" stroke="currentColor" strokeWidth="0.5">
          <path d="M0 200 L200 0 M20 200 L200 20 M40 200 L200 40 M60 200 L200 60 M80 200 L200 80 M100 200 L200 100 M120 200 L200 120 M140 200 L200 140 M160 200 L200 160 M180 200 L200 180" />
          <path d="M200 200 L0 0 M180 200 L0 20 M160 200 L0 40 M140 200 L0 60 M120 200 L0 80 M100 200 L0 100 M80 200 L0 120 M60 200 L0 140 M40 200 L0 160 M20 200 L0 180" opacity="0.5" />
        </svg>
      </div>

      <main className="z-10 w-full max-w-md my-8">
        <div className="bg-neutral-900/60 backdrop-blur-xl border border-neutral-800 rounded-[2.5rem] p-6 md:p-10 flex flex-col items-center text-center shadow-2xl transition-all">
          {/* Logo */}
          <DitiroIcon className="w-14 h-14 md:w-16 md:h-16 text-[#e05012] mb-4" />

          {/* Text Content */}
          <h1 className="text-2xl md:text-3xl font-bold mb-1 tracking-tight">Welcome to Ditiro.</h1>
          <p className="text-neutral-400 text-sm md:text-base mb-6">Turning intentions... into actions.</p>

          {/* Google Sign In Button */}
          <div className="w-full space-y-4">
            <button
              onClick={handleGoogleSignIn}
              disabled={isProcessing}
              className="w-full bg-[#e05012] hover:bg-[#ff5f1f] text-white font-semibold py-3.5 rounded-xl flex items-center justify-center gap-3 transition-all active:scale-[0.98] disabled:opacity-70 text-sm"
            >
              <GoogleIcon className="w-5 h-5 text-white" />
              {isProcessing ? "Processing..." : "Continue with Google"}
            </button>

            <div className="flex items-center gap-4 text-neutral-600">
              <div className="h-px bg-neutral-800 flex-1" />
              <span className="text-xs font-medium uppercase tracking-wider">or email</span>
              <div className="h-px bg-neutral-800 flex-1" />
            </div>

            {/* Auth Error Banner */}
            {authError && (
              <div className="w-full bg-red-950/50 border border-red-800/80 rounded-xl p-3 text-red-300 text-xs text-left animate-in fade-in duration-200">
                {authError}
              </div>
            )}

            {/* Email Form */}
            <form onSubmit={handleEmailSubmit} className="w-full space-y-3 text-left">
              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-neutral-950/80 border border-neutral-800 rounded-xl px-4 py-3 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-[#e05012] transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-neutral-950/80 border border-neutral-800 rounded-xl px-4 py-3 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-[#e05012] transition-colors"
                />
              </div>

              <button
                type="submit"
                disabled={isProcessing}
                className="w-full bg-neutral-800 hover:bg-neutral-700 text-white font-semibold py-3 rounded-xl transition-all active:scale-[0.98] disabled:opacity-70 text-sm mt-1"
              >
                {isProcessing ? "Authenticating..." : isSignUp ? "Create Account" : "Sign In with Email"}
              </button>
            </form>

            {/* Toggle Sign Up / Sign In */}
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setAuthError(null);
              }}
              className="text-xs text-neutral-400 hover:text-white transition-colors"
            >
              {isSignUp ? "Already have an account? " : "Don't have an account? "}
              <span className="text-[#e05012] font-semibold">
                {isSignUp ? "Sign In" : "Sign Up"}
              </span>
            </button>

            <div className="flex items-center gap-4 text-neutral-700 pt-1">
              <div className="h-px bg-neutral-800 flex-1" />
              <span className="text-[10px] font-medium uppercase tracking-widest text-neutral-600">or</span>
              <div className="h-px bg-neutral-800 flex-1" />
            </div>

            <button
              onClick={handleNoSignUp}
              className="w-full border border-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-800/50 font-semibold py-3 rounded-xl transition-all text-xs"
            >
              Continue as Guest
            </button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-auto py-4 flex flex-col items-center gap-2 z-10">
        <LXGLogo className="h-4 w-auto text-neutral-700" />
        <p className="text-neutral-500 text-[10px] font-medium uppercase tracking-widest">Made by UX Giants</p>
      </footer>

      {/* Sparkles */}
      <SparkleIcon className="absolute bottom-10 right-10 w-8 h-8 text-neutral-800 pointer-events-none" />
      <SparkleIcon className="absolute top-20 left-20 w-4 h-4 text-neutral-800 opacity-50 pointer-events-none" />

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
