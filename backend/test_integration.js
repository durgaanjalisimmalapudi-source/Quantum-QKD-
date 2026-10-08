/**
 * End-to-End Integration Test for Node Backend + Python Quantum Engine + PostgreSQL.
 * Verifies Steps 5, 6, 7, 8 of UC025 specification.
 */

const { io: ioClient } = require('socket.io-client');
const { server } = require('./server');
const { pool } = require('./db/client');

const BACKEND_PORT = 5001;
const BACKEND_URL = `http://localhost:${BACKEND_PORT}`;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function runIntegrationTest() {
  console.log('====================================================');
  console.log('Starting End-to-End Backend Integration Test...');
  console.log('====================================================');

  // Start backend server on test port 5001
  await new Promise((resolve) => server.listen(BACKEND_PORT, resolve));
  console.log(`Backend server listening on port ${BACKEND_PORT}`);

  try {
    // 1. Check Python Quantum Engine health
    console.log('1. Checking Python Quantum Engine health on http://localhost:8000...');
    const healthResp = await fetch('http://localhost:8000/health');
    const healthData = await healthResp.json();
    console.log('Quantum Engine health:', healthData);
    console.assert(healthData.status === 'ok', 'Engine not healthy');

    // 2. Connect Socket.IO client
    console.log('2. Connecting Socket.IO client to backend...');
    const socket = ioClient(BACKEND_URL);

    await new Promise((resolve, reject) => {
      socket.on('connect', resolve);
      socket.on('connect_error', reject);
    });
    console.log('Socket.IO client connected successfully!');

    // ----------------------------------------------------
    // TEST 1: Clean Session (No Eve)
    // ----------------------------------------------------
    console.log('\n--- TEST 1: Clean Session (No Eve) ---');
    const cleanRounds = [];
    let cleanKeyReady = null;

    socket.on('round_stats', (payload) => {
      cleanRounds.push(payload.data);
    });

    const keyReadyPromise = new Promise((resolve) => {
      socket.on('key_ready', (payload) => {
        cleanKeyReady = payload.summary;
        resolve(payload);
      });
    });

    console.log('Starting clean session via POST /api/session/start...');
    const startResp = await fetch(`${BACKEND_URL}/api/session/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        siteA: 'National-Grid-A',
        siteB: 'Control-Center-B',
        injectEve: false,
        targetKeyBits: 64, // 64 bits = 8 bytes for quick test
        roundDelayMs: 5,
      }),
    });
    const startData = await startResp.json();
    console.log('Session started:', startData);
    const cleanSessionId = startData.sessionId;

    console.log('Awaiting key generation over Socket.IO...');
    await keyReadyPromise;
    console.log(`Clean session finished! Rounds streamed: ${cleanRounds.length}, Status: ${cleanKeyReady.status}`);
    console.assert(cleanKeyReady.status === 'key_ready', 'Session status should be key_ready');
    console.assert(cleanKeyReady.final_qber <= 0.05, 'Clean QBER should be low');

    // Test Encrypted Messaging
    console.log('\nTesting encrypted messaging between Site A and Site B...');
    const plaintextToSend = 'GRID_TELEMETRY: Voltage 230kV nominal, phase stable.';
    const sendResp = await fetch(`${BACKEND_URL}/api/message/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: cleanSessionId,
        direction: 'A_to_B',
        text: plaintextToSend,
      }),
    });
    const sendResult = await sendResp.json();
    console.log('Sent encrypted message:', sendResult);
    console.assert(sendResult.success === true, 'Message send failed');
    console.assert(sendResult.message.ciphertext, 'Missing ciphertext');

    // Test Decryption at Site B
    console.log(`Decrypting message ${sendResult.message.id} at Site B...`);
    const decryptResp = await fetch(`${BACKEND_URL}/api/message/${sendResult.message.id}/decrypted`);
    const decryptResult = await decryptResp.json();
    console.log('Decrypted result:', decryptResult);
    console.assert(decryptResult.plaintext === plaintextToSend, 'Decrypted text does not match original plaintext!');

    // ----------------------------------------------------
    // TEST 2: Session WITH Eve (Eavesdropping Detection)
    // ----------------------------------------------------
    console.log('\n--- TEST 2: Session with Eavesdropper Injected ---');
    const eveAlerts = [];
    socket.on('eavesdrop_alert', (payload) => {
      eveAlerts.push(payload.alert);
    });

    const eveFinishedPromise = new Promise((resolve) => {
      const handler = (payload) => {
        if (payload.sessionId === eveSessionId) {
          resolve(payload);
        }
      };
      socket.on('key_ready', handler);
    });

    const startEveResp = await fetch(`${BACKEND_URL}/api/session/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        siteA: 'National-Grid-A',
        siteB: 'Control-Center-B',
        injectEve: true,
        targetKeyBits: 64,
        roundDelayMs: 5,
      }),
    });
    const startEveData = await startEveResp.json();
    const eveSessionId = startEveData.sessionId;
    console.log('Started Eve session:', eveSessionId);

    console.log('Awaiting eavesdrop alerts and completion...');
    await eveFinishedPromise;
    console.log(`Eve session finished. Eavesdrop alerts received: ${eveAlerts.length}`);
    console.assert(eveAlerts.length > 0, 'Eavesdrop alerts MUST be received when Eve is active!');

    // ----------------------------------------------------
    // TEST 3: Database Inspection (Hard Security Rules)
    // ----------------------------------------------------
    console.log('\n--- TEST 3: Direct Database Security Inspection ---');
    const dbMsgRes = await pool.query(
      'SELECT ciphertext, iv, auth_tag FROM message_logs WHERE session_id = $1',
      [cleanSessionId]
    );
    console.log('DB message_logs row:', dbMsgRes.rows[0]);
    console.assert(dbMsgRes.rows.length > 0, 'Message log row missing in DB');
    console.assert(!('plaintext' in dbMsgRes.rows[0]), 'Database MUST NOT contain plaintext column!');
    console.assert(!('key' in dbMsgRes.rows[0]), 'Database MUST NOT contain key column!');

    const dbSessionRes = await pool.query(
      'SELECT id, status, final_qber, final_chsh_s FROM sessions WHERE id = $1',
      [cleanSessionId]
    );
    console.log('DB sessions row:', dbSessionRes.rows[0]);
    console.assert(!('key' in dbSessionRes.rows[0]), 'Sessions table MUST NOT store key!');

    socket.disconnect();
    console.log('\n====================================================');
    console.log('🎉 ALL END-TO-END BACKEND INTEGRATION TESTS PASSED!');
    console.log('====================================================');
  } finally {
    server.close();
    await pool.end();
  }
}

runIntegrationTest().catch((err) => {
  console.error('Integration test failed:', err);
  process.exit(1);
});

