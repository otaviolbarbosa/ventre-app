"use client";

import { type ReactNode, createContext, useCallback, useContext, useState } from "react";
import { ConfirmModal } from "../shared/confirm-modal";

export type ConfirmOptions = {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "destructive" | "destructive-inverted";
  onConfirm: () => void | Promise<void>;
};

type ConfirmationModalContextType = {
  confirm: (opts: ConfirmOptions) => void;
};

const ConfirmationModalContext = createContext<ConfirmationModalContextType | undefined>(undefined);

export const ConfirmationModalProvider = ({ children }: { children: ReactNode }) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions | null>(null);

  const confirm = useCallback((opts: ConfirmOptions) => {
    setOptions(opts);
    setOpen(true);
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!options) return;
    setLoading(true);
    try {
      await options.onConfirm();
      setOpen(false);
    } finally {
      setLoading(false);
    }
  }, [options]);

  const handleOpenChange = useCallback(
    (value: boolean) => {
      if (!loading) setOpen(value);
    },
    [loading],
  );

  return (
    <ConfirmationModalContext.Provider value={{ confirm }}>
      {children}
      {options && (
        <ConfirmModal
          open={open}
          onOpenChange={handleOpenChange}
          onConfirm={handleConfirm}
          loading={loading}
          title={options.title}
          description={options.description}
          confirmLabel={options.confirmLabel}
          cancelLabel={options.cancelLabel}
          variant={options.variant}
        />
      )}
    </ConfirmationModalContext.Provider>
  );
};

export const useConfirmationModalConsumer = (): ConfirmationModalContextType => {
  const context = useContext(ConfirmationModalContext);
  if (!context) {
    throw new Error("useConfirmModal must be used within a ConfirmationModalProvider");
  }
  return context;
};
