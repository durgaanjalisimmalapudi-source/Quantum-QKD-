/**
 * AES-256-GCM Cryptographic Service for UC025 QKD Platform.
 *
 * Implements:
 * - Key derivation: uses 32-byte sifted key directly, or HKDF-SHA256 if shorter.
 * - AES-256-GCM authenticated encryption (12-byte random IV, 16-byte auth tag).
 * - AES-256-GCM authenticated decryption with tag verification.
 */

const crypto = require('crypto');

/**
 * Derives a 32-byte (256-bit) AES key from raw QKD sifted bytes/hex string.
 * @param {string|Buffer} rawSiftedKey - Sifted key as hex string or Buffer.
 * @param {string} sessionId - Optional context salt for HKDF.
 * @returns {Buffer} 32-byte Buffer.
 */
function deriveAesKey(rawSiftedKey, sessionId = '') {
  let keyBuffer;
  if (typeof rawSiftedKey === 'string') {
    keyBuffer = Buffer.from(rawSiftedKey, 'hex');
  } else if (Buffer.isBuffer(rawSiftedKey)) {
    keyBuffer = rawSiftedKey;
  } else {
    throw new Error('rawSiftedKey must be a hex string or Buffer');
  }

  // If already exactly 32 bytes (256 bits), use directly per spec
  if (keyBuffer.length === 32) {
    return keyBuffer;
  }

  // If shorter or different length, expand/derive via HKDF-SHA256
  const salt = crypto.createHash('sha256').update(sessionId).digest();
  const info = Buffer.from('E91-QKD-AES-256-GCM-DERIVATION');
  const derived = crypto.hkdfSync('sha256', keyBuffer, salt, info, 32);
  return Buffer.from(derived);
}

/**
 * Encrypts plaintext string using AES-256-GCM.
 * @param {string} plaintext - The message to encrypt.
 * @param {Buffer} keyBuffer - 32-byte AES key.
 * @returns {{ ciphertext: string, iv: string, authTag: string }} Hex-encoded components.
 */
function encrypt(plaintext, keyBuffer) {
  if (!Buffer.isBuffer(keyBuffer) || keyBuffer.length !== 32) {
    throw new Error('Key buffer must be exactly 32 bytes for AES-256-GCM');
  }

  // 12-byte IV recommended for GCM
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', keyBuffer, iv);

  const ciphertextBuf = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return {
    ciphertext: ciphertextBuf.toString('hex'),
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
  };
}

/**
 * Decrypts AES-256-GCM ciphertext and authenticates against authTag.
 * @param {string} ciphertextHex - Hex-encoded ciphertext.
 * @param {string} ivHex - Hex-encoded 12-byte IV.
 * @param {string} authTagHex - Hex-encoded 16-byte authentication tag.
 * @param {Buffer} keyBuffer - 32-byte AES key.
 * @returns {string} Plaintext string. Throws error if tag fails.
 */
function decrypt(ciphertextHex, ivHex, authTagHex, keyBuffer) {
  if (!Buffer.isBuffer(keyBuffer) || keyBuffer.length !== 32) {
    throw new Error('Key buffer must be exactly 32 bytes for AES-256-GCM');
  }

  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const ciphertext = Buffer.from(ciphertextHex, 'hex');

  const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuffer, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}

module.exports = {
  deriveAesKey,
  encrypt,
  decrypt,
};
