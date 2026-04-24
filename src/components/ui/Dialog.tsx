"use client";

import React from "react";
import clsx from "clsx";
import { AlertCircle, HelpCircle, X } from "lucide-react";
import { GoogleIcon } from "../brand/Logos";

interface DialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  socialLabel?: string;
  type: "alert" | "confirm";
  onConfirm: () => void;
  onCancel: () => void;
  onSocialConfirm?: () => void;
}

export default function Dialog({
  isOpen,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  type,
  onConfirm,
  onCancel,
  onSocialConfirm,
  socialLabel,
}: DialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-neutral-900 w-full max-w-sm rounded-[2rem] flex flex-col overflow-hidden shadow-2xl border border-neutral-800 animate-in zoom-in-95 duration-200"
      >
        <div className="p-8 flex flex-col items-center text-center">
          <div className={clsx(
            "w-14 h-14 rounded-full flex items-center justify-center mb-5",
            type === "alert" ? "bg-amber-500/10 text-amber-500" : "bg-[#e05012]/10 text-[#e05012]"
          )}>
            {type === "alert" ? <AlertCircle size={28} /> : <HelpCircle size={28} />}
          </div>
          
          <h3 className="text-xl font-bold text-neutral-100 mb-3">
            {title}
          </h3>
          
          <p className="text-sm text-neutral-400 leading-relaxed">
            {message}
          </p>
        </div>

        <div className={clsx(
          "p-4 px-6 pb-6 flex flex-col gap-3 bg-neutral-900",
        )}>
          {onSocialConfirm && (
            <button
              onClick={onSocialConfirm}
              className="w-full flex items-center justify-center gap-3 px-4 py-3.5 rounded-2xl text-sm font-bold bg-white text-black hover:bg-neutral-200 transition-all active:scale-[0.98]"
            >
              <GoogleIcon className="w-5 h-5" />
              {socialLabel || "Continue with Google"}
            </button>
          )}

          <div className="flex gap-3 w-full">
            {type === "confirm" && (
              <button
                onClick={onCancel}
                className="flex-1 px-4 py-3.5 rounded-2xl text-sm font-bold text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
              >
                {cancelLabel}
              </button>
            )}
            
            <button
              onClick={onConfirm}
              className={clsx(
                "flex-1 px-4 py-3.5 rounded-2xl text-sm font-bold shadow-lg transition-all active:scale-[0.98]",
                onSocialConfirm ? "text-neutral-500 hover:text-white hover:bg-neutral-800" : "bg-[#e05012] hover:bg-[#e05012]/90 text-white shadow-[#e05012]/20"
              )}
            >
              {type === "alert" && !confirmLabel ? "OK" : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
