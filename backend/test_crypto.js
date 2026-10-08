/**
 * Verifies Step 7 of UC025 specification:
 * Tests AES-256-GCM encryption/decryption, HKDF derivation, and in-memory key storage.
 */

const { deriveAesKey, encrypt, decrypt } = require('./services/cryptoService');
const sessionKeyStore = require('./services/sessionKeyStore');
const crypto = require('crypto');

function testCrypto() {
  console.log('Testing Crypto Service & Session Key Store...');

  // 1. Direct 32-byte key
  const rawKey32 = crypto.randomBytes(32).toString('hex');
  const derivedKey1 = deriveAesKey(rawKey32);
  console.assert(derivedKey1.length === 32, 'Derived key 1 should be 32 bytes');

  // 2. Short key (e.g. 16 bytes) -> HKDF expansion
  const rawKeyShort = crypto.randomBytes(16).toString('hex');
  const derivedKey2 = deriveAesKey(rawKeyShort, 'session-test-id');
  console.assert(derivedKey2.length === 32, 'Derived key 2 should be 32 bytes via HKDF');

  // 3. Encrypt & Decrypt test
  const message = 'CRITICAL INFRASTRUCTURE: Grid Substation 4 status normal.';
  const encrypted = encrypt(message, derivedKey1);
  console.log('Encrypted:', encrypted);
  console.assert(encrypted.ciphertext && encrypted.iv && encrypted.authTag, 'Missing encrypted fields');

  const decrypted = decrypt(encrypted.ciphertext, encrypted.iv, encrypted.authTag, derivedKey1);
  console.log('Decrypted:', decrypted);
  console.assert(decrypted === message, 'Decrypted text does not match plaintext!');

  // 4. Authentication tag tampering test (GCM integrity)
  let tampered = false;
  try {
    const badCiphertext = (encrypted.ciphertext.slice(0, -2) + (encrypted.ciphertext.slice(-2) === 'aa' ? 'bb' : 'aa'));
    decrypt(badCiphertext, encrypted.iv, encrypted.authTag, derivedKey1);
  } catch (err) {
    tampered = true;
    console.log('Successfully rejected tampered ciphertext:', err.message);
  }
  console.assert(tampered, 'Tampered ciphertext must fail authentication!');

  // 5. Test Key Store
  const testSessionId = 'test-session-crypto-1';
  sessionKeyStore.setKey(testSessionId, derivedKey1);
  console.assert(sessionKeyStore.hasKey(testSessionId), 'Key store should have key');
  console.assert(sessionKeyStore.getKey(testSessionId).equals(derivedKey1), 'Key retrieved matches');

  sessionKeyStore.clearKey(testSessionId);
  console.assert(!sessionKeyStore.hasKey(testSessionId), 'Key should be cleared');
  console.assert(sessionKeyStore.getKey(testSessionId) === null, 'Key should be null');

  console.log('CRYPTO AND KEY STORE TESTS PASSED!');
}

testCrypto();

