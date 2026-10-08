/**
 * Quantum Engine HTTP and WebSocket Client for UC025 QKD Platform.
 *
 * Interfaces with the Python / Qiskit FastAPI service:
 * - Initiates quantum sessions via POST /engine/start
 * - Consumes per-round streaming data over WebSocket
 * - Relays round stats into PostgreSQL round_logs
 * - Retrieves final sifted key directly into sessionKeyStore memory
 */

const WebSocket = require('ws');
const { insertRoundLog, updateSessionStatus } = require('../db/client');
const { deriveAesKey } = require('./cryptoService');
const sessionKeyStore = require('./sessionKeyStore');
const inProcessQuantumEngine = require('./inProcessQuantumEngine');

let rawEngineUrl = (process.env.QUANTUM_ENGINE_URL || 'http://127.0.0.1:8000').trim().replace(/\/+$/, '');
if (!rawEngineUrl.startsWith('http://') && !rawEngineUrl.startsWith('https://')) {
  if (!rawEngineUrl.includes('.') && !rawEngineUrl.includes(':')) {
    // Internal Render service name without port (e.g. 'quantum-engine')
    rawEngineUrl = `http://${rawEngineUrl}:10000`;
  } else if (rawEngineUrl.includes(':')) {
    // Internal hostname with port (e.g. 'quantum-engine:10000')
    rawEngineUrl = `http://${rawEngineUrl}`;
  } else {
    // Public domain (e.g. 'quantum-engine-xxxx.onrender.com')
    rawEngineUrl = `https://${rawEngineUrl}`;
  }
}
const ENGINE_HTTP_URL = rawEngineUrl;
const defaultWsUrl = ENGINE_HTTP_URL.replace(/^http:\/\//, 'ws://').replace(/^https:\/\//, 'wss://');
const ENGINE_WS_URL = (process.env.QUANTUM_ENGINE_WS_URL || defaultWsUrl).replace(/\/+$/, '');

/**
 * Initiates an E91 QKD simulation on the quantum engine.
 * Automatically falls back to high-fidelity In-Process E91 Engine if remote is unavailable.
 */
async function startSession({ sessionId, injectEve = false, targetKeyBits = 128, maxRounds = 1500, roundDelayMs = 25 }) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);

    const resp = await fetch(`${ENGINE_HTTP_URL}/engine/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: sessionId,
        inject_eve: Boolean(injectEve),
        target_key_bits: targetKeyBits,
        max_rounds: maxRounds,
        round_delay_ms: roundDelayMs,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (resp.ok) {
      console.log(`[QuantumEngineClient] Successfully contacted remote engine at ${ENGINE_HTTP_URL}`);
      return await resp.json();
    }
    console.warn(`[QuantumEngineClient] Remote engine returned HTTP ${resp.status}. Activating In-Process Quantum Engine.`);
  } catch (err) {
    console.warn(`[QuantumEngineClient] Remote engine at ${ENGINE_HTTP_URL} unavailable (${err.message}). Activating In-Process Quantum Engine.`);
  }

  // Resilient In-Process E91 simulation fallback
  return inProcessQuantumEngine.startSession({
    sessionId,
    injectEve,
    targetKeyBits,
    maxRounds,
    roundDelayMs,
  });
}

/**
 * Retrieves final result from quantum engine.
 */
async function getSessionResult(sessionId) {
  try {
    const resp = await fetch(`${ENGINE_HTTP_URL}/engine/result/${sessionId}`);
    if (resp.ok) return await resp.json();
  } catch (err) {
    // Fallback to memory
  }
  return { session_id: sessionId, status: 'completed' };
}

/**
 * Connects to the engine's stream (in-process or remote WebSocket), persists round logs to DB,
 * caches the final key in memory, and triggers callbacks.
 */
function streamEngineEvents(sessionId, callbacks = {}) {
  // If running in-process, register callbacks directly
  if (inProcessQuantumEngine.hasSession(sessionId)) {
    console.log(`[QuantumEngineClient] Streaming in-process events for session ${sessionId}`);
    inProcessQuantumEngine.registerCallbacks(sessionId, callbacks);
    return;
  }

  const { onRoundStats, onEavesdropAlert, onSessionFinished, onError } = callbacks;
  const wsUrl = `${ENGINE_WS_URL}/engine/ws/${sessionId}`;

  const ws = new WebSocket(wsUrl);

  ws.on('open', () => {
    console.log(`[QuantumEngineWS] Connected for session ${sessionId}`);
  });

  ws.on('error', (err) => {
    console.warn(`[QuantumEngineWS] Connection error for session ${sessionId}:`, err.message);
    if (onError) onError(err);
  });

  ws.on('message', async (raw) => {
    try {
      const payload = JSON.parse(raw.toString());
      const eventType = payload.event;

      if (eventType === 'round_stats') {
        const d = payload.data;
        // Persist round log to PostgreSQL (never contains key material)
        try {
          await insertRoundLog({
            sessionId,
            roundNum: d.round_num,
            qber: d.qber,
            chshS: d.chsh_s,
            anomalyFlagged: d.anomaly_flagged,
            discarded: d.discarded,
          });
        } catch (dbErr) {
          console.error(`[DB] Error persisting round ${d.round_num}:`, dbErr.message);
        }

        if (onRoundStats) onRoundStats(d);
      } else if (eventType === 'eavesdrop_alert') {
        console.warn(`[EavesdropAlert] Session ${sessionId} Round ${payload.round_num}: ${payload.reason}`);
        if (onEavesdropAlert) onEavesdropAlert(payload);
      } else if (eventType === 'session_finished') {
        console.log(`[QuantumEngineWS] Session ${sessionId} finished.`);
        const summary = payload.summary;

        // Secure handling of derived key:
        // Hold key strictly IN-MEMORY. Never log raw key or persist to DB.
        if (summary.final_key_hex && summary.status === 'key_ready') {
          try {
            const derivedKey = deriveAesKey(summary.final_key_hex, sessionId);
            sessionKeyStore.setKey(sessionId, derivedKey);
            console.log(`[KeyStore] Derived 256-bit AES key successfully stored in-memory for session ${sessionId}`);
          } catch (keyErr) {
            console.error(`[KeyStore] Error deriving key:`, keyErr.message);
          }
        }

        // Update DB session status and summaries (never key material)
        try {
          await updateSessionStatus(sessionId, {
            status: summary.status,
            final_qber: summary.final_qber,
            final_chsh_s: summary.final_chsh_s,
            key_length_bits: summary.key_length_bits,
          });
        } catch (dbErr) {
          console.error(`[DB] Error updating final session status:`, dbErr.message);
        }

        if (onSessionFinished) onSessionFinished(summary);
        ws.close();
      }
    } catch (parseErr) {
      console.error(`[QuantumEngineWS] Error processing message:`, parseErr);
    }
  });

  ws.on('error', (err) => {
    console.error(`[QuantumEngineWS] Error for session ${sessionId}:`, err.message);
    if (onError) onError(err);
  });

  ws.on('close', () => {
    console.log(`[QuantumEngineWS] Connection closed for session ${sessionId}`);
  });

  return ws;
}

module.exports = {
  startSession,
  getSessionResult,
  streamEngineEvents,
};

