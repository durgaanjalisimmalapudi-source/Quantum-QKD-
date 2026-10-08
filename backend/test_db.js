/**
 * Verifies Step 4 of UC025 specification:
 * Tests basic CRUD on sessions, round_logs, and message_logs.
 */

const {
  pool,
  createSession,
  updateSessionStatus,
  insertRoundLog,
  getSession,
  getSessionRounds,
  getAllSessions,
  insertMessageLog,
  getMessage,
} = require('./db/client');
const crypto = require('crypto');

async function testDbCrud() {
  console.log('Testing Node DB Layer CRUD operations...');
  const testId = crypto.randomUUID();

  try {
    // 1. Create Session
    const session = await createSession({
      id: testId,
      site_a_name: 'Site-A-Alpha',
      site_b_name: 'Site-B-Beta',
      inject_eve: false,
    });
    console.log('Created Session:', session.id, 'Status:', session.status);
    console.assert(session.id === testId, 'Session ID mismatch');

    // 2. Insert Round Logs
    const r1 = await insertRoundLog({
      sessionId: testId,
      roundNum: 1,
      qber: 0.0,
      chshS: 2.8284,
      anomalyFlagged: false,
      discarded: false,
    });
    console.log('Inserted Round 1:', r1.round_num, 'S:', r1.chsh_s);

    const r2 = await insertRoundLog({
      sessionId: testId,
      roundNum: 2,
      qber: 0.05,
      chshS: 2.75,
      anomalyFlagged: false,
      discarded: false,
    });
    console.log('Inserted Round 2:', r2.round_num, 'S:', r2.chsh_s);

    // 3. Query Session and Rounds
    const fetchedSession = await getSession(testId);
    console.assert(fetchedSession.site_a_name === 'Site-A-Alpha', 'Site A name mismatch');

    const rounds = await getSessionRounds(testId);
    console.log(`Fetched ${rounds.length} rounds for session ${testId}`);
    console.assert(rounds.length === 2, 'Should have 2 rounds');

    // 4. Update Session Status
    const updated = await updateSessionStatus(testId, {
      status: 'key_ready',
      final_qber: 0.015,
      final_chsh_s: 2.81,
      key_length_bits: 256,
    });
    console.log('Updated Session:', updated.status, 'Key Bits:', updated.key_length_bits);
    console.assert(updated.status === 'key_ready', 'Status update failed');

    // 5. Insert Message Log (ciphertext only, no key)
    const msg = await insertMessageLog({
      sessionId: testId,
      direction: 'A_to_B',
      ciphertext: '4a6f686e446f65',
      iv: '1a2b3c4d5e6f7a8b9c0d1e2f',
      authTag: 'abcdef0123456789abcdef0123456789',
    });
    console.log('Inserted Message Log ID:', msg.id, 'Direction:', msg.direction);

    const fetchedMsg = await getMessage(msg.id);
    console.assert(fetchedMsg.ciphertext === '4a6f686e446f65', 'Ciphertext mismatch');

    // 6. List sessions
    const all = await getAllSessions();
    console.log(`Total sessions in DB: ${all.length}`);
    console.assert(all.some((s) => s.id === testId), 'Created session should appear in history');

    // Cleanup test record
    await pool.query('DELETE FROM sessions WHERE id = $1', [testId]);
    console.log('Cleaned up test session.');
    console.log('STEP 4 NODE DB CRUD VERIFICATION PASSED!');
  } catch (err) {
    console.error('DB Test Failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

testDbCrud();

