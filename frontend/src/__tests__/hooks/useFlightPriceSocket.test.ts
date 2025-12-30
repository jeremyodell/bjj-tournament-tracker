import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useFlightPriceSocket } from '@/hooks/useFlightPriceSocket';

// Mock WebSocket
class MockWebSocket {
  static instances: MockWebSocket[] = [];
  url: string;
  readyState: number = WebSocket.CONNECTING;
  onopen: ((ev: Event) => void) | null = null;
  onclose: ((ev: CloseEvent) => void) | null = null;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  close() {
    this.readyState = WebSocket.CLOSED;
    if (this.onclose) {
      this.onclose({ code: 1000, reason: 'Normal closure' } as CloseEvent);
    }
  }

  simulateOpen() {
    this.readyState = WebSocket.OPEN;
    if (this.onopen) {
      this.onopen(new Event('open'));
    }
  }

  simulateMessage(data: object) {
    if (this.onmessage) {
      this.onmessage({ data: JSON.stringify(data) } as MessageEvent);
    }
  }

  simulateError() {
    if (this.onerror) {
      this.onerror(new Event('error'));
    }
  }

  static clear() {
    MockWebSocket.instances = [];
  }

  static getLastInstance(): MockWebSocket | undefined {
    return MockWebSocket.instances[MockWebSocket.instances.length - 1];
  }
}

// Store original WebSocket
const OriginalWebSocket = global.WebSocket;

describe('useFlightPriceSocket', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    MockWebSocket.clear();
    // @ts-expect-error - mocking WebSocket
    global.WebSocket = MockWebSocket;
    // Set env var
    process.env.NEXT_PUBLIC_WEBSOCKET_URL = 'wss://test.example.com/dev';
  });

  afterEach(() => {
    global.WebSocket = OriginalWebSocket;
    delete process.env.NEXT_PUBLIC_WEBSOCKET_URL;
  });

  describe('connection', () => {
    it('should not connect when userId is not provided', () => {
      renderHook(() => useFlightPriceSocket({ userId: null }));

      expect(MockWebSocket.instances).toHaveLength(0);
    });

    it('should connect when userId is provided', () => {
      renderHook(() => useFlightPriceSocket({ userId: 'user-123' }));

      expect(MockWebSocket.instances).toHaveLength(1);
      expect(MockWebSocket.getLastInstance()?.url).toBe(
        'wss://test.example.com/dev?userId=user-123'
      );
    });

    it('should start with connecting state', () => {
      const { result } = renderHook(() =>
        useFlightPriceSocket({ userId: 'user-123' })
      );

      expect(result.current.isConnecting).toBe(true);
      expect(result.current.isConnected).toBe(false);
    });

    it('should update to connected state when socket opens', async () => {
      const { result } = renderHook(() =>
        useFlightPriceSocket({ userId: 'user-123' })
      );

      act(() => {
        MockWebSocket.getLastInstance()?.simulateOpen();
      });

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
        expect(result.current.isConnecting).toBe(false);
      });
    });

    it('should close socket on unmount', () => {
      const { unmount } = renderHook(() =>
        useFlightPriceSocket({ userId: 'user-123' })
      );

      const socket = MockWebSocket.getLastInstance();
      expect(socket).toBeDefined();

      unmount();

      expect(socket?.readyState).toBe(WebSocket.CLOSED);
    });
  });

  describe('messages', () => {
    it('should call onPricesReady when prices_ready message received', async () => {
      const onPricesReady = vi.fn();
      renderHook(() =>
        useFlightPriceSocket({ userId: 'user-123', onPricesReady })
      );

      act(() => {
        MockWebSocket.getLastInstance()?.simulateOpen();
      });

      act(() => {
        MockWebSocket.getLastInstance()?.simulateMessage({
          type: 'prices_ready',
          airport: 'DFW',
        });
      });

      await waitFor(() => {
        expect(onPricesReady).toHaveBeenCalledWith({ airport: 'DFW' });
      });
    });

    it('should ignore unknown message types', async () => {
      const onPricesReady = vi.fn();
      renderHook(() =>
        useFlightPriceSocket({ userId: 'user-123', onPricesReady })
      );

      act(() => {
        MockWebSocket.getLastInstance()?.simulateOpen();
      });

      act(() => {
        MockWebSocket.getLastInstance()?.simulateMessage({
          type: 'unknown_type',
          data: 'something',
        });
      });

      // Give it a moment to process
      await new Promise((r) => setTimeout(r, 50));

      expect(onPricesReady).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should set error state on connection error', async () => {
      const { result } = renderHook(() =>
        useFlightPriceSocket({ userId: 'user-123' })
      );

      act(() => {
        MockWebSocket.getLastInstance()?.simulateError();
      });

      await waitFor(() => {
        expect(result.current.error).toBe('WebSocket connection error');
      });
    });

    it('should handle missing WebSocket URL gracefully', () => {
      delete process.env.NEXT_PUBLIC_WEBSOCKET_URL;

      const { result } = renderHook(() =>
        useFlightPriceSocket({ userId: 'user-123' })
      );

      expect(result.current.isConnected).toBe(false);
      expect(result.current.isConnecting).toBe(false);
      expect(MockWebSocket.instances).toHaveLength(0);
    });
  });
});
