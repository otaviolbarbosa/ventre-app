// @vitest-environment happy-dom
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PwaProvider } from "./pwa-provider";

function mockMatchMedia() {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockReturnValue({ matches: false }),
  });
}

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("PwaProvider — service worker registration", () => {
  beforeEach(() => {
    mockMatchMedia();
  });

  it("does not register the service worker outside of production", () => {
    vi.stubEnv("NODE_ENV", "development");
    const register = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: { register },
    });

    render(<PwaProvider>{null}</PwaProvider>);

    expect(register).not.toHaveBeenCalled();
  });

  it("registers the service worker in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    const register = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: { register },
    });

    render(<PwaProvider>{null}</PwaProvider>);

    expect(register).toHaveBeenCalledWith("/sw.js");
  });
});
