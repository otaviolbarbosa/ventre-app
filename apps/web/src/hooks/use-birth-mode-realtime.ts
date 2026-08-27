"use client";

import { useAuth } from "@/hooks/use-auth";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { Tables } from "@ventre/supabase";
import { supabase } from "@ventre/supabase";
import { useEffect, useState } from "react";

type BirthModeActivation = Tables<"pregnancies">;

type ConnectionStatus = "disabled" | "connecting" | "connected" | "reconnecting";

const CHANNEL_NAME = "birth-mode-activations";
const RECONNECT_STATUSES = new Set(["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"]);

export function useBirthModeRealtime() {
  const { user } = useAuth();
  const [lastActivation, setLastActivation] = useState<BirthModeActivation | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("disabled");

  useEffect(() => {
    if (typeof window === "undefined" || !user) return;

    let cancelled = false;

    setConnectionStatus("connecting");

    const channel: RealtimeChannel | undefined = supabase
      .channel(CHANNEL_NAME)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "pregnancies",
          filter: "birth_mode_active=eq.true",
        },
        (payload) => {
          if (cancelled) return;
          console.debug("[birth-mode-realtime] activation received", payload.new);
          setLastActivation(payload.new as BirthModeActivation);
        },
      )
      .subscribe((status) => {
        if (cancelled) return;
        console.debug("[birth-mode-realtime] status", status);

        if (status === "SUBSCRIBED") {
          setConnectionStatus("connected");
          return;
        }

        if (RECONNECT_STATUSES.has(status)) {
          setConnectionStatus("reconnecting");
          channel?.subscribe();
        }
      });

    return () => {
      cancelled = true;
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [user]);

  return {
    lastActivation,
    connectionStatus,
  };
}
