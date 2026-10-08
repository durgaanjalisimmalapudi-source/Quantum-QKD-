/**
 * Main Server Entry Point for UC025 QKD Platform Backend.
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const http = require('http');
const express = require('express');
const cors = require('cors');
const { initSocket } = require('./socket');
const sessionRoutes = require('./routes/session');
const messageRoutes = require('./routes/message');
const authRoutes = require('./routes/auth');

const app = express();
const server = http.createServer(app);

// Initialize Socket.IO
initSocket(server);

// Middleware
app.use(cors({ origin: '*' }));
app.use(express.json());

// Request logging for API calls (without logging sensitive data)
app.use((req, res, next) => {
  if (req.path !== '/health') {
    console.log(`[API] ${req.method} ${req.path}`);
  }
  next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/session', sessionRoutes);
app.use('/api/message', messageRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'qkd-backend',
    timestamp: new Date().toISOString(),
  });
});

// Serve static frontend in production if built
const frontendDist = path.resolve(__dirname, '../frontend/dist');
const fs = require('fs');
if (fs.existsSync(frontendDist)) {
  console.log(`[Production] Serving static frontend from ${frontendDist}`);
  app.use(express.static(frontendDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/health') || req.path.startsWith('/socket.io')) {
      return next();
    }
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

const PORT = process.env.PORT || 5001;

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`======================================================`);
    console.log(`🚀 UC025 QKD Backend Server running on port ${PORT}`);
    console.log(`📡 REST API: http://localhost:${PORT}/api`);
    console.log(`⚡ WebSocket / Socket.IO ready`);
    console.log(`======================================================`);
  });
}

module.exports = { app, server };
