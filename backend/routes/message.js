/**
 * Encrypted Message Routes for UC025 QKD Platform.
 *
 * HARD SECURITY RULE:
 * Plaintext messages are never stored in the database.
 * Only AES-256-GCM ciphertext, IV, and auth tag are persisted.
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const {
  insertMessageLog,
  getMessage,
  getSessionMessages,
  getConversationMessages,
} = require('../db/client');
const { encrypt, decrypt } = require('../services/cryptoService');
const sessionKeyStore = require('../services/sessionKeyStore');
const { emitEncryptedMessage } = require('../socket');

/**
 * POST /api/message/send
 * Body: { sessionId, direction, text, senderEmail, receiverEmail }
 */
router.post('/send', async (req, res) => {
  try {
    let {
      sessionId,
      direction = 'A_to_B',
      text,
      senderEmail = 'alice@qkd.org',
      receiverEmail = 'bob@qkd.org',
    } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Text message is required' });
    }

    // Try finding key by sessionId first
    let key = sessionId ? sessionKeyStore.getKey(sessionId) : null;

    // If key not found or sessionId not passed, look up active shared channel between sender & receiver
    if (!key && senderEmail && receiverEmail) {
      const activePair = sessionKeyStore.getActiveChannelForPair(senderEmail, receiverEmail);
      if (activePair && activePair.sessionId) {
        sessionId = activePair.sessionId;
        key = sessionKeyStore.getKey(sessionId);
        console.log(`[MessageRoute] Auto-resolved active quantum channel ${sessionId} for pair ${senderEmail} <-> ${receiverEmail}`);
      }
    }

    if (!key) {
      return res.status(400).json({
        error: 'Quantum channel required. Neither operator has initialized an active E91 quantum channel for this chat yet.',
      });
    }

    const targetSessionId = sessionId;

    // If targetSessionId still missing, generate a dummy session UUID for DB foreign key
    // or retrieve latest session from DB
    if (!targetSessionId) {
      targetSessionId = crypto.randomUUID();
    }

    // Encrypt message using AES-256-GCM
    const { ciphertext, iv, authTag } = encrypt(text, key);

    // Persist ciphertext only to PostgreSQL message_logs
    const savedLog = await insertMessageLog({
      sessionId: targetSessionId,
      direction,
      ciphertext,
      iv,
      authTag,
      senderEmail: senderEmail.trim().toLowerCase(),
      receiverEmail: receiverEmail.trim().toLowerCase(),
    });

    const messagePayload = {
      id: savedLog.id,
      sessionId: savedLog.session_id,
      direction: savedLog.direction,
      ciphertext: savedLog.ciphertext,
      iv: savedLog.iv,
      authTag: savedLog.auth_tag,
      senderEmail: savedLog.sender_email,
      receiverEmail: savedLog.receiver_email,
      sentAt: savedLog.sent_at,
    };

    // Emit live encrypted message over Socket.IO
    emitEncryptedMessage(targetSessionId, messagePayload);

    return res.status(201).json({
      success: true,
      message: messagePayload,
    });
  } catch (err) {
    console.error('[MessageRoute] Error sending message:', err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/message/conversation
 * Query: ?user1=email1&user2=email2
 * Returns isolated private message log between two contacts.
 */
router.get('/conversation', async (req, res) => {
  try {
    const { user1, user2 } = req.query;
    if (!user1 || !user2) {
      return res.status(400).json({ error: 'user1 and user2 query parameters are required' });
    }

    const messages = await getConversationMessages(user1, user2);
    return res.json({ success: true, messages });
  } catch (err) {
    console.error('[MessageRoute] Error fetching conversation:', err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/message/:id/decrypted
 * Retrieves message ciphertext and decrypts it using in-memory session key.
 */
router.get('/:id/decrypted', async (req, res) => {
  try {
    const messageId = req.params.id;
    const msg = await getMessage(messageId);

    if (!msg) {
      return res.status(404).json({ error: 'Message not found' });
    }

    let plaintext = null;

    // 1. Try directly with session key
    const directKey = sessionKeyStore.getKey(msg.session_id);
    if (directKey) {
      try {
        plaintext = decrypt(msg.ciphertext, msg.iv, msg.auth_tag || msg.authTag, directKey);
      } catch (e) {
        // session key did not match authTag
      }
    }

    // 2. Try findWorkingKey across all stored session keys in KMS
    if (!plaintext) {
      const match = sessionKeyStore.findWorkingKey(
        msg.ciphertext,
        msg.iv,
        msg.auth_tag || msg.authTag,
        decrypt
      );
      if (match) {
        plaintext = match.plaintext;
      }
    }

    if (!plaintext) {
      return res.status(400).json({
        error: 'Quantum session key expired or unavailable. Unable to decrypt ciphertext.',
      });
    }

    return res.json({
      success: true,
      id: msg.id,
      sessionId: msg.session_id,
      direction: msg.direction,
      senderEmail: msg.sender_email || msg.senderEmail,
      receiverEmail: msg.receiver_email || msg.receiverEmail,
      sentAt: msg.sent_at || msg.sentAt,
      plaintext,
    });
  } catch (err) {
    console.error('[MessageRoute] Error decrypting message:', err);
    return res.status(500).json({ error: `Decryption failed: ${err.message}` });
  }
});

/**
 * GET /api/message/session/:sessionId
 */
router.get('/session/:sessionId', async (req, res) => {
  try {
    const messages = await getSessionMessages(req.params.sessionId);
    return res.json({ success: true, messages });
  } catch (err) {
    console.error('[MessageRoute] Error fetching session messages:', err);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
