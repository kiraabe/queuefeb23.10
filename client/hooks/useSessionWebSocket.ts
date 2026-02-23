import { useEffect, useRef, useState } from "react";
import type { SessionSummary } from "@shared/api";

interface UseSessionWebSocketReturn {
  sessions: SessionSummary[];
  isConnected: boolean;
  error: string | null;
  isLoading: boolean;
}

/**
 * Custom hook for session updates via polling
 * Uses HTTP polling to fetch session data at regular intervals
 */
export function useSessionWebSocket(): UseSessionWebSocketReturn {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

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

  // Initialize polling
  useEffect(() => {
    // Fetch initial data immediately
    fetchSessions();

    // Start polling for updates
    startPolling();

    // Cleanup
    return () => {
      stopPolling();

      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
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
