"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";
import Dialog from "./Dialog";

interface DialogOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  socialLabel?: string;
  type?: "alert" | "confirm";
  onConfirm?: () => void;
  onCancel?: () => void;
  onSocialConfirm?: () => void;
}

interface DialogContextType {
  showDialog: (options: DialogOptions) => void;
  hideDialog: () => void;
}

const DialogContext = createContext<DialogContextType | undefined>(undefined);

export const DialogProvider = ({ children }: { children: ReactNode }) => {
  const [dialog, setDialog] = useState<DialogOptions | null>(null);

  const showDialog = (options: DialogOptions) => {
    setDialog(options);
  };

  const hideDialog = () => {
    setDialog(null);
  };

  const handleConfirm = () => {
    if (dialog?.onConfirm) dialog.onConfirm();
    hideDialog();
  };

  const handleCancel = () => {
    if (dialog?.onCancel) dialog.onCancel();
    hideDialog();
  };

  return (
    <DialogContext.Provider value={{ showDialog, hideDialog }}>
      {children}
      {dialog && (
        <Dialog
          isOpen={!!dialog}
          title={dialog.title}
          message={dialog.message}
          confirmLabel={dialog.confirmLabel}
          cancelLabel={dialog.cancelLabel}
          socialLabel={dialog.socialLabel}
          type={dialog.type || "alert"}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
          onSocialConfirm={dialog.onSocialConfirm ? () => {
            dialog.onSocialConfirm?.();
            hideDialog();
          } : undefined}
        />
      )}
    </DialogContext.Provider>
  );
};

export const useDialog = () => {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error("useDialog must be used within a DialogProvider");
  }
  return context;
};
