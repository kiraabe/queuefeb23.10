import { useEffect, useRef } from "react";
import type { QueueEvent } from "@shared/api";

export function useSSE(url: string, onEvent: (ev: QueueEvent) => void) {
  const handlerRef = useRef(onEvent);
  handlerRef.current = onEvent;

  useEffect(() => {
    let es: EventSource | null = null;
    let attempts = 0;
    let lastMessageAt = Date.now();
    let heartbeatTimer: any;
    const types: QueueEvent["type"][] = [
      "init",
      "window.updated",
      "ticket.created",
      "ticket.updated",
      "display.updated",
      "transfer.success",
      "transfer.received",
    ];

    const attach = () => {
      es = new EventSource(url, { withCredentials: true });
      const offFns: Array<() => void> = [];

      const add = (evt: string, fn: any) => {
        es!.addEventListener(evt, fn as any);
        offFns.push(() => es && es.removeEventListener(evt, fn as any));
      };

      types.forEach((t) =>
        add(t, (e: MessageEvent) => {
          try {
            const payload = JSON.parse(e.data);
            lastMessageAt = Date.now();
            handlerRef.current({ type: t, payload } as QueueEvent);
          } catch {}
        }),
      );

      add("ping", () => {
        lastMessageAt = Date.now();
      });

      const onOpen = () => {
        attempts = 0;
        lastMessageAt = Date.now();
      };
      const onError = () => {
        cleanup();
        scheduleReconnect();
      };
      es!.addEventListener("open", onOpen as any);
      es!.addEventListener("error", onError as any);
      offFns.push(() => es && es.removeEventListener("open", onOpen as any));
      offFns.push(() => es && es.removeEventListener("error", onError as any));

      const cleanup = () => {
        try {
          offFns.forEach((off) => off());
        } catch {}
        if (es) {
          try {
            es.close();
          } catch {}
          es = null;
        }
      };

      const scheduleReconnect = () => {
        attempts += 1;
        const delay = Math.min(30000, 1000 * Math.pow(2, attempts));
        setTimeout(() => attach(), delay);
      };

      // Heartbeat watchdog: if no messages for 60s, restart connection
      clearInterval(heartbeatTimer);
      heartbeatTimer = setInterval(() => {
        if (Date.now() - lastMessageAt > 60000) {
          cleanup();
          scheduleReconnect();
        }
      }, 10000);

      return cleanup;
    };

    const cleanup = attach();

    return () => {
      clearInterval(heartbeatTimer);
      cleanup?.();
    };
  }, [url]);
}
