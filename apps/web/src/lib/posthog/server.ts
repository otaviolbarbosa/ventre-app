import { PostHog } from "posthog-node";

let client: PostHog | null = null;

function getPosthogServerClient(): PostHog {
  if (!client) {
    const posthogToken = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;

    if (!posthogToken) {
      throw new Error("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN is not set");
    }

    client = new PostHog(posthogToken, {
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
      flushAt: 1,
      flushInterval: 0,
    });
  }
  return client;
}

export async function captureServerEvent(
  distinctId: string,
  event: string,
  properties?: Record<string, unknown>,
) {
  const posthog = getPosthogServerClient();
  posthog.capture({ distinctId, event, properties });
  await posthog.shutdown();
}
