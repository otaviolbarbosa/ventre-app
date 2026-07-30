"use client";

import posthog from "posthog-js";
import { PostHogProvider } from "posthog-js/react";
import { PosthogPageView } from "@/components/shared/posthog-pageview";

export function PosthogProvider({ children }: { children: React.ReactNode }) {
  return (
    <PostHogProvider client={posthog}>
      <PosthogPageView />
      {children}
    </PostHogProvider>
  );
}
