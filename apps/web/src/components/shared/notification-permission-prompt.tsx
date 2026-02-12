"use client";

import { Button } from "@/components/ui/button";
import { useNotifications } from "@/hooks/use-notifications";
import { Bell, X } from "lucide-react";
import { useEffect, useState } from "react";

const COOLDOWN_KEY = "nascere_push_prompt_dismissed";
const COOLDOWN_DAYS = 7;

export function NotificationPermissionPrompt() {
  const { permissionStatus, requestPermission } = useNotifications();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) return;
    if (permissionStatus !== "default") return;

    const dismissed = localStorage.getItem(COOLDOWN_KEY);
    if (dismissed) {
      const dismissedAt = new Date(dismissed).getTime();
      const cooldownMs = COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
      if (Date.now() - dismissedAt < cooldownMs) return;
    }

    // Show after a short delay
    const timer = setTimeout(() => setVisible(true), 3000);
    return () => clearTimeout(timer);
  }, [permissionStatus]);

  if (!visible) return null;

  const handleActivate = async () => {
    await requestPermission();
    setVisible(false);
  };

  const handleDismiss = () => {
    setVisible(false);
    localStorage.setItem(COOLDOWN_KEY, new Date().toISOString());
  };

  return (
    <div className="fixed inset-x-4 bottom-20 z-50 sm:inset-x-auto sm:right-4 sm:bottom-4 sm:max-w-sm">
      <div className="flex items-start gap-3 rounded-lg border bg-white p-4 shadow-lg">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <Bell className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <p className="font-medium text-sm">Ative as notificações</p>
          <p className="mt-1 text-gray-500 text-xs">
            Receba lembretes de consultas e atualizações da equipe.
          </p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" className="gradient-primary" onClick={handleActivate}>
              Ativar
            </Button>
            <Button size="sm" variant="ghost" onClick={handleDismiss}>
              Agora não
            </Button>
          </div>
        </div>
        <button type="button" onClick={handleDismiss} className="text-gray-400 hover:text-gray-600">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
