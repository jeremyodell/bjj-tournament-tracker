'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

export interface PricesReadyMessage {
  airport: string;
}

interface UseFlightPriceSocketOptions {
  userId: string | null;
  onPricesReady?: (message: PricesReadyMessage) => void;
}

interface UseFlightPriceSocketReturn {
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
}

export function useFlightPriceSocket({
  userId,
  onPricesReady,
}: UseFlightPriceSocketOptions): UseFlightPriceSocketReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const onPricesReadyRef = useRef(onPricesReady);

  // Keep callback ref updated
  useEffect(() => {
    onPricesReadyRef.current = onPricesReady;
  }, [onPricesReady]);

  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === 'prices_ready' && onPricesReadyRef.current) {
        onPricesReadyRef.current({ airport: data.airport });
      }
    } catch {
      // Ignore malformed messages
    }
  }, []);

  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_WEBSOCKET_URL;

    // Don't connect without userId or URL
    if (!userId || !wsUrl) {
      setIsConnecting(false);
      setIsConnected(false);
      return;
    }

    setIsConnecting(true);
    setError(null);

    const url = `${wsUrl}?userId=${encodeURIComponent(userId)}`;
    const socket = new WebSocket(url);
    socketRef.current = socket;

    socket.onopen = () => {
      setIsConnected(true);
      setIsConnecting(false);
      setError(null);
    };

    socket.onclose = () => {
      setIsConnected(false);
      setIsConnecting(false);
    };

    socket.onerror = () => {
      setError('WebSocket connection error');
      setIsConnecting(false);
    };

    socket.onmessage = handleMessage;

    // Cleanup on unmount or userId change
    return () => {
      socket.close();
      socketRef.current = null;
    };
  }, [userId, handleMessage]);

  return {
    isConnected,
    isConnecting,
    error,
  };
}
