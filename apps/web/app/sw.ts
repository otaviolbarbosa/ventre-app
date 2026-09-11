/// <reference no-default-lib="true" />
/// <reference lib="esnext" />
/// <reference lib="webworker" />
import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { NetworkOnly, Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // defaultCache's catch-all for cross-origin GETs (NetworkFirst, falling
    // back to cache) can hang indefinitely under Android WebView's Service
    // Worker implementation instead of honoring its own networkTimeoutSeconds
    // — seen with setSession() never resolving after the native Google
    // sign-in bridge hands back tokens. Same category of issue as the
    // /api/auth/* exclusion further down; NetworkOnly bypasses the
    // cache-fallback race entirely for Supabase's Auth API.
    ...(SUPABASE_URL
      ? [
          {
            matcher: ({ url }: { url: URL }) => url.href.startsWith(SUPABASE_URL),
            handler: new NetworkOnly(),
          },
        ]
      : []),
    ...defaultCache,
  ],
});

serwist.addEventListeners();
