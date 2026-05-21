import { io, type Socket } from 'socket.io-client';
import { BASE } from './router.js';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    // The FastAPI harness mounts Socket.IO under /clutch-app/socket.io so it
    // doesn't collide with any other WebSockets the main app may expose.
    // Standalone mode falls back to the default /socket.io.
    socket = io('/', {
      path: `${BASE}/socket.io`,
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 500,
      reconnectionDelayMax: 30_000,
      reconnectionAttempts: Infinity,
      // Polling-first establishes the session over plain HTTP, then upgrades
      // to WebSocket async. This survives proxies that block WS upgrades
      // (e.g. Cloudflare zones with WebSockets disabled) where ['websocket',
      // 'polling'] would never fall back and loop forever in "Reconnecting".
      transports: ['polling', 'websocket'],
    });
  }
  return socket;
}

export function emitAck<T = unknown>(event: string, payload: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    const s = getSocket();
    const timeout = setTimeout(() => reject(new Error('timeout')), 10_000);
    s.emit(event, payload, (ack: T) => {
      clearTimeout(timeout);
      resolve(ack);
    });
  });
}
