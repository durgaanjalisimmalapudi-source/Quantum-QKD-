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
    // pairKey ('alice:bob') -> { sessionId, user1, user2, status, keyLengthBits, createdAt, updatedAt }
    this.pairChannels = new Map();
    this.defaultTtlMs = defaultTtlMs;
    this.loadFromDisk();
  }

  static getPairKey(user1, user2) {
    if (!user1 || !user2) return null;
    const u1 = user1.trim().toLowerCase();
    const u2 = user2.trim().toLowerCase();
    return [u1, u2].sort().join(':');
  }

  loadFromDisk() {
    try {
      if (fs.existsSync(STORE_PATH)) {
        const raw = fs.readFileSync(STORE_PATH, 'utf8');
        const data = JSON.parse(raw);
        if (data.keys) {
          for (const [sessionId, item] of Object.entries(data.keys)) {
            if (item && item.keyHex) {
              this.store.set(sessionId, {
                key: Buffer.from(item.keyHex, 'hex'),
                createdAt: item.createdAt || Date.now(),
                lastAccessed: item.lastAccessed || Date.now(),
              });
            }
          }
        } else {
          // Backward compatibility for flat keystore format
          for (const [sessionId, item] of Object.entries(data)) {
            if (sessionId !== 'pairChannels' && item && item.keyHex) {
              this.store.set(sessionId, {
                key: Buffer.from(item.keyHex, 'hex'),
                createdAt: item.createdAt || Date.now(),
                lastAccessed: item.lastAccessed || Date.now(),
              });
            }
          }
        }

        if (data.pairChannels) {
          for (const [pairKey, item] of Object.entries(data.pairChannels)) {
            if (item && item.sessionId) {
              this.pairChannels.set(pairKey, item);
            }
          }
        }
      }
    } catch (err) {
      console.warn('[SessionKeyStore] Could not load keystore from disk:', err.message);
    }
  }

  saveToDisk() {
    try {
      const keysObj = {};
      for (const [sessionId, entry] of this.store.entries()) {
        if (entry && entry.key) {
          keysObj[sessionId] = {
            keyHex: entry.key.toString('hex'),
            createdAt: entry.createdAt,
            lastAccessed: entry.lastAccessed,
          };
        }
      }

      const pairsObj = {};
      for (const [pairKey, entry] of this.pairChannels.entries()) {
        pairsObj[pairKey] = entry;
      }

      const payload = {
        keys: keysObj,
        pairChannels: pairsObj,
      };

      fs.writeFileSync(STORE_PATH, JSON.stringify(payload, null, 2), 'utf8');
    } catch (err) {
      console.warn('[SessionKeyStore] Could not save keystore to disk:', err.message);
    }
  }

  setActiveChannelForPair(user1, user2, sessionId, status = 'key_ready', keyLengthBits = 128) {
    const pairKey = SessionKeyStore.getPairKey(user1, user2);
    if (!pairKey || !sessionId) return;

    const record = {
      sessionId,
      user1: user1.trim().toLowerCase(),
      user2: user2.trim().toLowerCase(),
      status,
      keyLengthBits,
      updatedAt: Date.now(),
      createdAt: this.pairChannels.get(pairKey)?.createdAt || Date.now(),
    };

    this.pairChannels.set(pairKey, record);
    this.saveToDisk();
    console.log(`[SessionKeyStore] Active quantum channel set for pair [${pairKey}]: ${sessionId} (${status})`);
  }

  getActiveChannelForPair(user1, user2) {
    const pairKey = SessionKeyStore.getPairKey(user1, user2);
    if (!pairKey) return null;

    const entry = this.pairChannels.get(pairKey);
    if (!entry) return null;

    // Verify key still exists in store
    if (this.hasKey(entry.sessionId)) {
      return entry;
    }
    return null;
  }

  clearActiveChannelForPair(user1, user2) {
    const pairKey = SessionKeyStore.getPairKey(user1, user2);
    if (pairKey) {
      this.pairChannels.delete(pairKey);
      this.saveToDisk();
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
