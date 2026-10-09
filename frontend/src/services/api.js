/**
 * REST API client for UC025 QKD Platform.
 */

let rawBaseUrl = (import.meta.env.VITE_API_URL || '').trim().replace(/\/+$/, '');
if (rawBaseUrl && !rawBaseUrl.startsWith('http://') && !rawBaseUrl.startsWith('https://')) {
  rawBaseUrl = `https://${rawBaseUrl}`;
}
const BASE_URL = rawBaseUrl;

export async function login(email, password) {
  const resp = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: 'Login failed' }));
    throw new Error(err.error || 'Authentication rejected');
  }
  return await resp.json();
}

export async function signup({ name, email, password, siteName }) {
  const resp = await fetch(`${BASE_URL}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password, siteName }),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: 'Signup failed' }));
    throw new Error(err.error || 'Registration rejected');
  }
  return await resp.json();
}

export async function getUsers(excludeEmail = null) {
  const url = excludeEmail
    ? `${BASE_URL}/api/auth/users?exclude=${encodeURIComponent(excludeEmail)}`
    : `${BASE_URL}/api/auth/users`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error('Failed to fetch contact directory');
  return await resp.json();
}

export async function getDemoAccounts() {
  const resp = await fetch(`${BASE_URL}/api/auth/demo-accounts`);
  if (!resp.ok) throw new Error('Failed to fetch demo accounts');
  return await resp.json();
}

export async function getOnlineUsers() {
  const resp = await fetch(`${BASE_URL}/api/auth/online-users`);
  if (!resp.ok) throw new Error('Failed to fetch online users');
  return await resp.json();
}

export async function getActiveChannel(user1, user2) {
  if (!user1 || !user2) return { active: false };
  try {
    const resp = await fetch(
      `${BASE_URL}/api/session/active?user1=${encodeURIComponent(user1)}&user2=${encodeURIComponent(user2)}`
    );
    if (!resp.ok) return { active: false };
    return await resp.json();
  } catch {
    return { active: false };
  }
}

export async function startSession({ siteA, siteB, injectEve, targetKeyBits = 128, roundDelayMs = 25, user1, user2 }) {
  const resp = await fetch(`${BASE_URL}/api/session/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ siteA, siteB, injectEve, targetKeyBits, roundDelayMs, user1, user2 }),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: 'Failed to start session' }));
    throw new Error(err.error || 'Failed to start session');
  }
  return await resp.json();
}

export async function getSessionStatus(sessionId) {
  const resp = await fetch(`${BASE_URL}/api/session/${sessionId}/status`);
  if (!resp.ok) throw new Error('Failed to fetch session status');
  return await resp.json();
}

export async function getSessionRounds(sessionId) {
  const resp = await fetch(`${BASE_URL}/api/session/${sessionId}/rounds`);
  if (!resp.ok) throw new Error('Failed to fetch session rounds');
  return await resp.json();
}

export async function getSessionHistory() {
  const resp = await fetch(`${BASE_URL}/api/session/history`);
  if (!resp.ok) throw new Error('Failed to fetch session history');
  return await resp.json();
}

export async function sendMessage({ sessionId, direction, text, senderEmail, receiverEmail }) {
  const resp = await fetch(`${BASE_URL}/api/message/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, direction, text, senderEmail, receiverEmail }),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: 'Failed to send message' }));
    throw new Error(err.error || 'Failed to send message');
  }
  return await resp.json();
}

export async function getConversationMessages(user1, user2) {
  const resp = await fetch(
    `${BASE_URL}/api/message/conversation?user1=${encodeURIComponent(user1)}&user2=${encodeURIComponent(user2)}`
  );
  if (!resp.ok) throw new Error('Failed to fetch conversation history');
  return await resp.json();
}

export async function getDecryptedMessage(messageId) {
  const resp = await fetch(`${BASE_URL}/api/message/${messageId}/decrypted`);
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: 'Failed to decrypt message' }));
    throw new Error(err.error || 'Failed to decrypt message');
  }
  return await resp.json();
}

export async function getSessionMessages(sessionId) {
  const resp = await fetch(`${BASE_URL}/api/message/session/${sessionId}`);
  if (!resp.ok) throw new Error('Failed to fetch messages');
  return await resp.json();
}

export async function clearConversation(user1, user2) {
  const resp = await fetch(`${BASE_URL}/api/message/clear`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user1, user2 }),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: 'Failed to clear chat' }));
    throw new Error(err.error || 'Failed to clear chat');
  }
  return await resp.json();
}
