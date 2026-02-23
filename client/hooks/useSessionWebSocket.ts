import { useEffect, useRef, useState } from "react";
import type { SessionSummary } from "@shared/api";

interface UseSessionWebSocketReturn {
  sessions: SessionSummary[];
  isConnected: boolean;
  error: string | null;
  isLoading: boolean;
}

/**
 * Custom hook for real-time session updates via WebSocket
 * Automatically manages connection, reconnection, and fallback to polling
 */
export function useSessionWebSocket(): UseSessionWebSocketReturn {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const maxReconnectAttempts = 5;
  const reconnectDelay = 3000; // 3 seconds

  // Fetch sessions via HTTP (fallback and initial load)
  const fetchSessions = async () => {
    try {
      const response = await fetch("/api/admin/sessions", {
        method: "GET",
        credentials: "include",
        headers: {
          "X-Requested-With": "XMLHttpRequest",
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setSessions(data.sessions || []);
      setError(null);
      setIsLoading(false);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setError(errMsg);
      setIsLoading(false);
    }
  };

  // Establish WebSocket connection
  const connectWebSocket = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/ws/admin/sessions`;
      console.log("[SessionWS] Connecting to:", wsUrl);

      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log("[SessionWS] Connected");
        setIsConnected(true);
        setError(null);
        reconnectAttemptsRef.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === "init" || message.type === "update") {
            setSessions(message.sessions || []);
            setError(null);
            setIsLoading(false);
          }
        } catch (err) {
          console.error("[SessionWS] Error parsing message:", err);
        }
      };

      ws.onerror = (event) => {
        console.error("[SessionWS] WebSocket error:", event);
        setError("WebSocket connection error");
      };

      ws.onclose = () => {
        console.log("[SessionWS] Disconnected");
        setIsConnected(false);
        wsRef.current = null;

        // Attempt reconnect with exponential backoff
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          const delay = reconnectDelay * Math.pow(2, reconnectAttemptsRef.current);
          console.log(
            `[SessionWS] Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current + 1}/${maxReconnectAttempts})`
          );
          reconnectAttemptsRef.current += 1;
          reconnectTimeoutRef.current = setTimeout(connectWebSocket, delay);
        } else {
          console.log(
            "[SessionWS] Max reconnect attempts reached, falling back to polling"
          );
          setError("WebSocket disconnected - using polling");
          // Start polling as fallback
          startPolling();
        }
      };

      wsRef.current = ws;
    } catch (err) {
      console.error("[SessionWS] Connection error:", err);
      setError("Failed to connect to WebSocket");
      // Fall back to polling
      startPolling();
    }
  };

  // Start polling as fallback
  const startPolling = () => {
    if (pollIntervalRef.current) return;

    console.log("[SessionWS] Starting polling fallback (5 second interval)");
    pollIntervalRef.current = setInterval(fetchSessions, 5000);
    // Also fetch immediately
    fetchSessions();
  };

  // Stop polling
  const stopPolling = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  };

  // Send keepalive ping to maintain connection
  useEffect(() => {
    if (!isConnected || !wsRef.current) return;

    const pingInterval = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "ping" }));
      }
    }, 30000); // Ping every 30 seconds

    return () => clearInterval(pingInterval);
  }, [isConnected]);

  // Initialize connection
  useEffect(() => {
    // Fetch initial data immediately
    fetchSessions();

    // Try to connect to WebSocket
    connectWebSocket();

    // Cleanup
    return () => {
      stopPolling();

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }

      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  return {
    sessions,
    isConnected,
    error,
    isLoading,
  };
}
