import posthog from "posthog-js";

const posthogToken = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;

if (!posthogToken) {
  throw new Error("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN is not set");
}

posthog.init(posthogToken, {
  api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
  // defaults: "2026-05-30",
  capture_pageview: false, // manual $pageview capture — see posthog-pageview.tsx
  person_profiles: "identified_only",
});
