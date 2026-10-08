import React, { useState } from 'react';
import { sendMessage, getDecryptedMessage } from '../services/api';

/**
 * ChatPanel Component:
 * Authenticated AES-256-GCM Secure Channel.
 * Encrypts with ephemeral QKD key stored strictly in backend memory.
 */
export default function ChatPanel({
  sessionId,
  siteA = 'Station Alpha',
  siteB = 'Station Beta',
  keyReady = false,
  messages = [],
  onMessageSent,
}) {
  const [inputText, setInputText] = useState('');
  const [direction, setDirection] = useState('A_to_B');
  const [sending, setSending] = useState(false);
  const [decryptedMap, setDecryptedMap] = useState({});
  const [decryptingId, setDecryptingId] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  // Critical infrastructure sample messages
  const quickTemplates = [
    '⚡ SCADA_TELEMETRY: Station Alpha 500kV transformer load 74.2% nominal',
    '🔒 EMERGENCY_CMD: Open breaker BKR-104 on North feeder line',
    '📡 SENSOR_HEARTBEAT: Phase alignment 0.04 deg, harmonic distortion < 1%',
  ];

  const handleSend = async (textToSend) => {
    const text = (textToSend || inputText).trim();
    if (!text || !sessionId || !keyReady) return;

    setSending(true);
    setErrorMsg('');
    try {
      const res = await sendMessage({
        sessionId,
        direction,
        text,
      });

      // Automatically decrypt for the receiving site's preview
      if (res.message && res.message.id) {
        try {
          const dec = await getDecryptedMessage(res.message.id);
          setDecryptedMap((prev) => ({ ...prev, [res.message.id]: dec.plaintext }));
        } catch (decErr) {
          console.warn('Auto-decrypt pending:', decErr);
        }
      }

      if (onMessageSent) onMessageSent(res.message);
      setInputText('');
    } catch (err) {
      setErrorMsg(err.message || 'Failed to encrypt and transmit message');
    } finally {
      setSending(false);
    }
  };

  const handleManualDecrypt = async (messageId) => {
    setDecryptingId(messageId);
    try {
      const res = await getDecryptedMessage(messageId);
      setDecryptedMap((prev) => ({ ...prev, [messageId]: res.plaintext }));
    } catch (err) {
      alert(`Decryption failed: ${err.message}`);
    } finally {
      setDecryptingId(null);
    }
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-2xl backdrop-blur-md">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 border-b border-slate-800 pb-3">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <span>🛡️</span> AES-256-GCM Authenticated Quantum-Secured Channel
          </h3>
          <p className="text-[11px] text-slate-400 mt-0.5">
            End-to-end encrypted using the derived 256-bit symmetric session key
          </p>
        </div>

        <div>
          <span className={`text-xs px-3 py-1 rounded-full font-mono font-semibold flex items-center gap-2 border ${
            keyReady
              ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/50 shadow-[0_0_12px_rgba(16,185,129,0.3)]'
              : 'bg-amber-950/80 text-amber-300 border-amber-500/50'
          }`}>
            <span className={`w-2 h-2 rounded-full ${keyReady ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}></span>
            {keyReady ? 'AES-256-GCM Key Armed in Memory' : 'Key Exchange Incomplete'}
          </span>
        </div>
      </div>

      {/* Security Architecture Guarantee Callout */}
      <div className="mb-4 bg-slate-950/90 border border-slate-800 rounded-lg p-3 text-xs text-slate-300 flex items-start gap-2.5">
        <span className="text-cyan-400 text-sm mt-0.5">🔐</span>
        <div className="text-[11px] leading-relaxed">
          <span className="font-semibold text-white">PostgreSQL Zero-Storage Guarantee:</span> Only ciphertext, 96-bit IV, and 128-bit authentication tag are stored in <code className="text-cyan-300 font-mono">message_logs</code>. The raw QKD key and plaintext message never touch disk or database tables.
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="h-64 overflow-y-auto space-y-3 pr-1 mb-4 bg-slate-950 border border-slate-800 rounded-xl p-3.5 shadow-inner">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs">
            <span className="text-2xl mb-1">💬</span>
            <span className="font-medium">No encrypted transmissions in this session yet.</span>
            {!keyReady && (
              <span className="mt-1 text-slate-400 text-[11px]">
                Complete an E91 key distribution session above to generate the shared AES key.
              </span>
            )}
          </div>
        ) : (
          messages.map((m) => {
            const isFromA = m.direction === 'A_to_B';
            const senderName = isFromA ? siteA : siteB;
            const receiverName = isFromA ? siteB : siteA;
            const decrypted = decryptedMap[m.id];

            return (
              <div
                key={m.id}
                className="bg-slate-900 border border-slate-800 rounded-lg p-3 space-y-2 text-xs font-mono transition-all hover:border-slate-700"
              >
                <div className="flex items-center justify-between text-slate-400 border-b border-slate-800/80 pb-1.5">
                  <span className="font-bold text-cyan-300 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
                    {senderName} ➔ {receiverName}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {m.sentAt || m.sent_at ? new Date(m.sentAt || m.sent_at).toLocaleTimeString() : 'Just now'}
                  </span>
                </div>

                {/* Ciphertext Representation */}
                <div className="bg-slate-950 p-2.5 rounded border border-slate-800/80 text-[11px] break-all">
                  <div className="text-slate-400 text-[10px] font-semibold mb-1 flex justify-between">
                    <span>Stored In PostgreSQL (Ciphertext Only):</span>
                    <span className="text-amber-400 font-mono">AES-256-GCM</span>
                  </div>
                  <div className="text-amber-300 font-bold tracking-tight bg-slate-900/60 p-1.5 rounded border border-slate-800 font-mono">
                    {m.ciphertext}
                  </div>
                  <div className="mt-1.5 text-slate-400 text-[10px] flex flex-wrap gap-3 font-mono">
                    <span>IV: <span className="text-slate-300">{m.iv}</span></span>
                    <span>Tag: <span className="text-slate-300">{m.authTag || m.auth_tag}</span></span>
                  </div>
                </div>

                {/* Plaintext Outcome */}
                <div className="flex items-center justify-between bg-emerald-950/40 border border-emerald-900/50 p-2.5 rounded">
                  <div>
                    <span className="text-emerald-400 font-bold block text-[10px] uppercase tracking-wider">
                      Decrypted Plaintext at {receiverName}:
                    </span>
                    <span className="text-white text-xs font-sans font-medium mt-0.5 block">
                      {decrypted ?? (
                        <span className="text-slate-400 italic font-mono text-[11px]">Awaiting decryption...</span>
                      )}
                    </span>
                  </div>

                  {!decrypted && (
                    <button
                      onClick={() => handleManualDecrypt(m.id)}
                      disabled={decryptingId === m.id}
                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] rounded font-semibold transition"
                    >
                      {decryptingId === m.id ? 'Decrypting...' : 'Decrypt with Key'}
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Quick Infrastructure Message Chips */}
      {keyReady && (
        <div className="mb-3">
          <div className="text-[10px] uppercase font-mono text-slate-400 mb-1.5 font-semibold">
            Quick Telemetry Templates:
          </div>
          <div className="flex flex-wrap gap-1.5">
            {quickTemplates.map((tpl, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleSend(tpl)}
                disabled={sending}
                className="text-[10px] font-mono bg-slate-950 hover:bg-slate-800 text-cyan-300 border border-slate-800 px-2 py-1 rounded transition text-left truncate max-w-xs"
              >
                {tpl}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Form Input */}
      <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="space-y-3">
        {errorMsg && (
          <div className="text-xs text-rose-400 bg-rose-950/50 border border-rose-800 p-2.5 rounded-lg">
            {errorMsg}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {/* Direction toggle */}
          <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-lg p-1 text-xs font-mono">
            <button
              type="button"
              onClick={() => setDirection('A_to_B')}
              className={`px-3 py-1.5 rounded-md transition font-semibold ${
                direction === 'A_to_B' ? 'bg-cyan-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              Site A ➔ Site B
            </button>
            <button
              type="button"
              onClick={() => setDirection('B_to_A')}
              className={`px-3 py-1.5 rounded-md transition font-semibold ${
                direction === 'B_to_A' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              Site B ➔ Site A
            </button>
          </div>

          <div className="flex-1 flex gap-2">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              disabled={!keyReady || sending}
              placeholder={
                keyReady
                  ? 'Type command or telemetry to encrypt with derived QKD key...'
                  : 'Channel locked. Run quantum key distribution to arm encryption.'
              }
              className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 disabled:opacity-50"
            />

            <button
              type="submit"
              disabled={!keyReady || !inputText.trim() || sending}
              className="px-5 py-2 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-white text-xs font-bold rounded-lg transition-all shadow-md flex items-center gap-2 flex-shrink-0"
            >
              {sending ? (
                <>
                  <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  Encrypting...
                </>
              ) : (
                <>
                  <span>🔒</span> Encrypt & Send
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
