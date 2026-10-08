/**
 * Socket.IO client setup for UC025 QKD Platform.
 */

import { io } from 'socket.io-client';

// Connects to specified VITE_API_URL or defaults to localhost:5001 (dev) or origin (prod)
let apiUrl = (import.meta.env.VITE_API_URL || '').trim().replace(/\/+$/, '');
if (apiUrl && !apiUrl.startsWith('http://') && !apiUrl.startsWith('https://')) {
  apiUrl = `https://${apiUrl}`;
}
const SOCKET_URL = apiUrl || (window.location.port === '3000' ? 'http://localhost:5001' : window.location.origin);

export const socket = io(SOCKET_URL, {
  transports: ['websocket', 'polling'],
  autoConnect: true,
});

socket.on('connect', () => {
  console.log('[Socket.IO Frontend] Connected to backend, ID:', socket.id);
});

socket.on('disconnect', () => {
  console.log('[Socket.IO Frontend] Disconnected from backend');
});
