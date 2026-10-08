/**
 * Session Routes for UC025 QKD Platform.
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const {
  createSession,
  getSession,
  getSessionRounds,
  getAllSessions,
} = require('../db/client');
const quantumEngineClient = require('../services/quantumEngineClient');
const sessionKeyStore = require('../services/sessionKeyStore');
const {
  emitRoundStats,
  emitEavesdropAlert,
  emitKeyReady,
  emitChannelStarted,
  emitChannelEstablished,
} = require('../socket');

/**
 * GET /api/session/active?user1=...&user2=...
 * Checks if an active, shared quantum channel exists between two operators.
 */
router.get('/active', (req, res) => {
  const { user1, user2 } = req.query;
  if (!user1 || !user2) {
    return res.status(400).json({ error: 'Both user1 and user2 query parameters are required' });
  }

  const activeChannel = sessionKeyStore.getActiveChannelForPair(user1, user2);
  if (activeChannel) {
    return res.json({
      active: true,
      sessionId: activeChannel.sessionId,
      status: activeChannel.status,
      keyLengthBits: activeChannel.keyLengthBits,
      createdAt: activeChannel.createdAt,
    });
  }

  return res.json({ active: false });
});

/**
 * POST /api/session/start
 * Starts a new E91 QKD session between two sites / users.
 */
router.post('/start', async (req, res) => {
  try {
    const {
      siteA = 'Station Alpha',
      siteB = 'Station Beta',
      injectEve = false,
      targetKeyBits = 256,
      roundDelayMs = 30,
      user1,
      user2,
    } = req.body;

    const sessionId = crypto.randomUUID();

    // 1. Create session in PostgreSQL
    const session = await createSession({
      id: sessionId,
      site_a_name: siteA,
      site_b_name: siteB,
      inject_eve: Boolean(injectEve),
    });

    if (user1 && user2) {
      emitChannelStarted({
        sessionId,
        user1: user1.trim().toLowerCase(),
        user2: user2.trim().toLowerCase(),
      });
    }

    // 2. Start session on Quantum Engine
    await quantumEngineClient.startSession({
      sessionId,
      injectEve,
      targetKeyBits,
      maxRounds: 1500,
      roundDelayMs,
    });

    // 3. Connect to Quantum Engine WS stream and relay to Socket.IO & DB
    quantumEngineClient.streamEngineEvents(sessionId, {
      onRoundStats: (roundData) => {
        emitRoundStats(sessionId, roundData);
      },
      onEavesdropAlert: (alertData) => {
        emitEavesdropAlert(sessionId, alertData);
      },
      onSessionFinished: (summary) => {
        emitKeyReady(sessionId, summary);

        // If key ready, set the active shared channel for BOTH participants!
        if (summary.status === 'key_ready' && user1 && user2) {
          sessionKeyStore.setActiveChannelForPair(
            user1,
            user2,
            sessionId,
            'key_ready',
            summary.key_length_bits || targetKeyBits
          );
          emitChannelEstablished({
            sessionId,
            user1: user1.trim().toLowerCase(),
            user2: user2.trim().toLowerCase(),
            status: 'key_ready',
            keyLengthBits: summary.key_length_bits || targetKeyBits,
          });
        }
      },
      onError: (err) => {
        console.error(`[SessionRoute] Engine stream error for ${sessionId}:`, err.message);
      },
    });

    return res.status(201).json({
      success: true,
      sessionId: session.id,
      session,
    });
  } catch (err) {
    console.error('[SessionRoute] Error starting session:', err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/session/history
 * Returns past sessions for history view.
 */
router.get('/history', async (req, res) => {
  try {
    const sessions = await getAllSessions();
    return res.json({ success: true, sessions });
  } catch (err) {
    console.error('[SessionRoute] Error fetching history:', err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/session/:id/status
 * Returns current status of a session and whether key is available in memory.
 */
router.get('/:id/status', async (req, res) => {
  try {
    const session = await getSession(req.params.id);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const hasInMemoryKey = sessionKeyStore.hasKey(session.id);

    return res.json({
      success: true,
      session,
      hasKey: hasInMemoryKey,
    });
  } catch (err) {
    console.error('[SessionRoute] Error fetching status:', err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/session/:id/rounds
 * Returns round logs for the session (for chart rendering).
 */
router.get('/:id/rounds', async (req, res) => {
  try {
    const rounds = await getSessionRounds(req.params.id);
    return res.json({ success: true, rounds });
  } catch (err) {
    console.error('[SessionRoute] Error fetching rounds:', err);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;

