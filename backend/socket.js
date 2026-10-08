/**
 * Socket.IO Server configuration for UC025 QKD Platform.
 * Streams live round-by-round quantum stats, security alerts, and encrypted messages.
 */

const { Server } = require('socket.io');

let io = null;

// Map of lowercase email -> Set of active socket IDs
const onlineUsers = new Map();

function getOnlineEmails() {
  return Array.from(onlineUsers.keys());
}

function broadcastPresence() {
  if (!io) return;
  const onlineEmails = getOnlineEmails();
  io.emit('presence_update', { onlineEmails });
}

function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    console.log(`[Socket.IO] Client connected: ${socket.id}`);

    // Register user presence upon connection or login
    socket.on('register_presence', (payload) => {
      const email = payload?.email;
      if (!email) return;
      const cleanEmail = email.trim().toLowerCase();
      socket.userEmail = cleanEmail;

      if (!onlineUsers.has(cleanEmail)) {
        onlineUsers.set(cleanEmail, new Set());
      }
      onlineUsers.get(cleanEmail).add(socket.id);
      console.log(`[Presence] Operator ${cleanEmail} is ONLINE (socket ${socket.id})`);
      broadcastPresence();
    });

    // Request immediate presence snapshot
    socket.on('get_presence', () => {
      socket.emit('presence_update', { onlineEmails: getOnlineEmails() });
    });

    // Allow client to subscribe to a specific session
    socket.on('join_session', (sessionId) => {
      socket.join(`session:${sessionId}`);
      console.log(`[Socket.IO] Client ${socket.id} joined room session:${sessionId}`);
    });

    socket.on('leave_session', (sessionId) => {
      socket.leave(`session:${sessionId}`);
      console.log(`[Socket.IO] Client ${socket.id} left room session:${sessionId}`);
    });

    socket.on('disconnect', () => {
      console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
      if (socket.userEmail) {
        const userSockets = onlineUsers.get(socket.userEmail);
        if (userSockets) {
          userSockets.delete(socket.id);
          if (userSockets.size === 0) {
            onlineUsers.delete(socket.userEmail);
            console.log(`[Presence] Operator ${socket.userEmail} is OFFLINE`);
          }
        }
        broadcastPresence();
      }
    });
  });

  return io;
}

function getIo() {
  if (!io) {
    throw new Error('Socket.IO has not been initialized');
  }
  return io;
}

function emitRoundStats(sessionId, data) {
  if (!io) return;
  io.to(`session:${sessionId}`).emit('round_stats', { sessionId, data });
  io.emit('round_stats', { sessionId, data }); // Also emit globally for dashboards
}

function emitEavesdropAlert(sessionId, alert) {
  if (!io) return;
  io.to(`session:${sessionId}`).emit('eavesdrop_alert', { sessionId, alert });
  io.emit('eavesdrop_alert', { sessionId, alert });
}

function emitKeyReady(sessionId, summary) {
  if (!io) return;
  io.to(`session:${sessionId}`).emit('key_ready', { sessionId, summary });
  io.emit('key_ready', { sessionId, summary });
}

function emitEncryptedMessage(sessionId, message) {
  if (!io) return;
  io.to(`session:${sessionId}`).emit('encrypted_message', { sessionId, message });
  io.emit('encrypted_message', { sessionId, message });
}

module.exports = {
  initSocket,
  getIo,
  getOnlineEmails,
  broadcastPresence,
  emitRoundStats,
  emitEavesdropAlert,
  emitKeyReady,
  emitEncryptedMessage,
};

