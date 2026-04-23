"use client";

import React, { useEffect, useState } from 'react';
import { DitiroIcon, LXGLogo } from '../brand/Logos';

interface LoadingScreenProps {
  onFinished: () => void;
}

export const LoadingScreen = ({ onFinished }: LoadingScreenProps) => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setProgress(100);
    }, 100);

    const finishTimer = setTimeout(() => {
      onFinished();
    }, 3000); // 3 seconds total setup time

    return () => {
      clearTimeout(timer);
      clearTimeout(finishTimer);
    };
  }, [onFinished]);

  return (
    <div className="fixed inset-0 z-[100] bg-neutral-950 text-white flex flex-col items-center justify-center font-sans">
      {/* Background Geometric Pattern */}
      <div className="absolute inset-0 pointer-events-none opacity-20 overflow-hidden">
        <svg className="absolute bottom-[-10%] right-[-5%] w-[600px] h-[600px] text-neutral-800" viewBox="0 0 200 200" fill="none" stroke="currentColor" strokeWidth="0.5">
          <path d="M0 200 L200 0 M20 200 L200 20 M40 200 L200 40 M60 200 L200 60 M80 200 L200 80 M100 200 L200 100 M120 200 L200 120 M140 200 L200 140 M160 200 L200 160 M180 200 L200 180" />
          <path d="M200 200 L0 0 M180 200 L0 20 M160 200 L0 40 M140 200 L0 60 M120 200 L0 80 M100 200 L0 100 M80 200 L0 120 M60 200 L0 140 M40 200 L0 160 M20 200 L0 180" opacity="0.5" />
        </svg>
      </div>

      <div className="z-10 flex flex-col items-center text-center px-6">
        {/* Animated Glow behind Logo */}
        <div className="relative mb-12">
            <div className="absolute inset-0 bg-[#e05012] blur-[80px] opacity-20 animate-pulse" />
            <DitiroIcon className="w-24 h-24 text-[#e05012] relative" />
        </div>

        {/* Progress Bar Container */}
        <div className="w-64 h-1.5 bg-neutral-900 rounded-full overflow-hidden mb-10 relative border border-neutral-800">
            <div 
                className="h-full bg-gradient-to-r from-[#ac3e0e] to-[#e05012] transition-all duration-[2500ms] ease-out shadow-[0_0_15px_rgba(224,80,18,0.5)]"
                style={{ width: `${progress}%` }}
            />
        </div>

        <h1 className="text-xl md:text-2xl font-bold mb-3 tracking-tight text-neutral-100">
            Sharp-sharp! Ditiro is setting things up...
        </h1>
        <p className="text-neutral-500 text-sm md:text-base font-medium">
            Danko for the wait. Action is coming.
        </p>
      </div>

      {/* Footer */}
      <footer className="absolute bottom-12 flex flex-col items-center gap-3 opacity-40">
        <LXGLogo className="h-4 w-auto text-neutral-700" />
        <p className="text-neutral-500 text-[10px] font-medium uppercase tracking-widest">Made by UX Giants</p>
      </footer>
    </div>
  );
};
