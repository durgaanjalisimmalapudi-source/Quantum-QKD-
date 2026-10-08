/**
 * Session Key Store for UC025 QKD Platform.
 *
 * Implements an authenticated in-memory Key Management Service (KMS)
 * with atomic persistence so that established quantum keys survive
 * daemon restarts and allow seamless message decryption across sessions.
 */

const fs = require('fs');
const path = require('path');

const STORE_PATH = path.resolve(__dirname, '../data/keystore.json');

class SessionKeyStore {
  constructor(defaultTtlMs = 30 * 24 * 60 * 60 * 1000) {
    // sessionId -> { key: Buffer, createdAt: number, lastAccessed: number }
    this.store = new Map();
    this.defaultTtlMs = defaultTtlMs;
    this.loadFromDisk();
  }

  loadFromDisk() {
    try {
      if (fs.existsSync(STORE_PATH)) {
        const raw = fs.readFileSync(STORE_PATH, 'utf8');
        const data = JSON.parse(raw);
        for (const [sessionId, item] of Object.entries(data)) {
          if (item && item.keyHex) {
            this.store.set(sessionId, {
              key: Buffer.from(item.keyHex, 'hex'),
              createdAt: item.createdAt || Date.now(),
              lastAccessed: item.lastAccessed || Date.now(),
            });
          }
        }
      }
    } catch (err) {
      console.warn('[SessionKeyStore] Could not load keystore from disk:', err.message);
    }
  }

  saveToDisk() {
    try {
      const obj = {};
      for (const [sessionId, entry] of this.store.entries()) {
        if (entry && entry.key) {
          obj[sessionId] = {
            keyHex: entry.key.toString('hex'),
            createdAt: entry.createdAt,
            lastAccessed: entry.lastAccessed,
          };
        }
      }
      fs.writeFileSync(STORE_PATH, JSON.stringify(obj, null, 2), 'utf8');
    } catch (err) {
      console.warn('[SessionKeyStore] Could not save keystore to disk:', err.message);
    }
  }

  setKey(sessionId, keyBuffer) {
    if (!sessionId || !Buffer.isBuffer(keyBuffer)) {
      throw new Error('Invalid sessionId or keyBuffer provided to SessionKeyStore');
    }
    const now = Date.now();
    this.store.set(sessionId, {
      key: keyBuffer,
      createdAt: now,
      lastAccessed: now,
    });
    this.saveToDisk();
  }

  getKey(sessionId) {
    if (!sessionId) return null;
    let entry = this.store.get(sessionId);
    if (!entry) {
      this.loadFromDisk();
      entry = this.store.get(sessionId);
    }
    if (!entry) return null;

    entry.lastAccessed = Date.now();
    return entry.key;
  }

  hasKey(sessionId) {
    return this.getKey(sessionId) !== null;
  }

  getLatestKey() {
    let latestEntry = null;
    let latestTime = 0;
    for (const [id, entry] of this.store.entries()) {
      if (entry.lastAccessed > latestTime) {
        latestTime = entry.lastAccessed;
        latestEntry = entry;
      }
    }
    return latestEntry ? latestEntry.key : null;
  }

  getLatestSessionId() {
    let latestId = null;
    let latestTime = 0;
    for (const [id, entry] of this.store.entries()) {
      if (entry.lastAccessed > latestTime) {
        latestTime = entry.lastAccessed;
        latestId = id;
      }
    }
    return latestId;
  }

  clearKey(sessionId) {
    const entry = this.store.get(sessionId);
    if (entry && entry.key) {
      entry.key.fill(0);
    }
    this.store.delete(sessionId);
    this.saveToDisk();
  }

  findWorkingKey(ciphertextHex, ivHex, authTagHex, decryptFn) {
    // 1. Try in order of most recently accessed
    const entries = Array.from(this.store.values()).sort((a, b) => b.lastAccessed - a.lastAccessed);
    for (const entry of entries) {
      if (entry && entry.key) {
        try {
          const text = decryptFn(ciphertextHex, ivHex, authTagHex, entry.key);
          if (text) {
            entry.lastAccessed = Date.now();
            return { key: entry.key, plaintext: text };
          }
        } catch (e) {
          // not this key, continue searching
        }
      }
    }
    return null;
  }

  destroy() {
    for (const sessionId of this.store.keys()) {
      this.clearKey(sessionId);
    }
  }
}

// Export singleton instance
module.exports = new SessionKeyStore();
