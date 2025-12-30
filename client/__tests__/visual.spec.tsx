/* @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";

vi.mock("@/hooks/use-sse", () => ({ useSSE: () => {} }));

import { createRoot } from "react-dom/client";
import Reception from "@/pages/Reception";
import Queue from "@/pages/Queue";
import Display from "@/pages/Display";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";

function Providers({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient();
  return (
    <QueryClientProvider client={qc}>
      <TooltipProvider>
        <MemoryRouter>{children}</MemoryRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

function render(ui: React.ReactElement) {
  const rootEl = document.createElement("div");
  document.body.appendChild(rootEl);
  const root = createRoot(rootEl);
  root.render(<Providers>{ui}</Providers>);
  return { rootEl, unmount: () => root.unmount() };
}

beforeEach(() => {
  // matchMedia mock for use-mobile hook
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  });

  vi.spyOn(global, "fetch").mockImplementation(async (input: any) => {
    const url = typeof input === "string" ? input : input?.url || "";
    if (url.includes("/api/windows")) {
      return new Response(
        JSON.stringify([
          {
            id: 1,
            name: "Window 1",
            busy: false,
            currentTicketId: null,
            updatedAt: Date.now(),
          },
        ]),
      );
    }
    if (url.includes("/api/display")) {
      return new Response(
        JSON.stringify({
          state: {
            current: [],
            next: { id: "t2", code: "002", createdAt: Date.now() },
            nextAfter: { id: "t3", code: "003", createdAt: Date.now() },
            waiting: [
              { id: "t4", code: "004", createdAt: Date.now() },
              { id: "t5", code: "005", createdAt: Date.now() },
            ],
          },
        }),
      );
    }
    return new Response(JSON.stringify({ ok: true }));
  }) as any;
});

afterEach(() => {
  (global.fetch as any).mockRestore?.();
  document.body.innerHTML = "";
});

describe("Visual snapshots", () => {
  it("Reception renders (mobile)", async () => {
    Object.defineProperty(window, "innerWidth", {
      value: 375,
      configurable: true,
    });
    const { rootEl, unmount } = render(<Reception />);
    expect(rootEl.innerHTML).toMatchSnapshot();
    unmount();
  });

  it("Queue renders (tablet)", async () => {
    Object.defineProperty(window, "innerWidth", {
      value: 834,
      configurable: true,
    });
    const { rootEl, unmount } = render(<Queue />);
    expect(rootEl.innerHTML).toMatchSnapshot();
    unmount();
  });

  it("Display renders (desktop)", async () => {
    Object.defineProperty(window, "innerWidth", {
      value: 1280,
      configurable: true,
    });
    const { rootEl, unmount } = render(<Display />);
    expect(rootEl.innerHTML).toMatchSnapshot();
    unmount();
  });
});
