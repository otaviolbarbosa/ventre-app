"use client";

import { PosthogPageView } from "@/components/shared/posthog-pageview";
import posthog from "posthog-js";
import { PostHogProvider } from "posthog-js/react";

export function PosthogProvider({ children }: { children: React.ReactNode }) {
  return (
    <PostHogProvider client={posthog}>
      <PosthogPageView />
      {children}
    </PostHogProvider>
  );
}
