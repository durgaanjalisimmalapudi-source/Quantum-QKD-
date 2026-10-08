import React, { useState, useEffect, useCallback } from 'react';
import { sendMessage, getDecryptedMessage, getUsers } from '../services/api';
import { socket } from '../services/socket';
import QuantumCircuitViewer from './QuantumCircuitViewer';

/**
 * WhatsAppChat Component:
 * - Real contacts loaded from PostgreSQL database
 * - Live real-time update when new users sign up
 * - Per-contact conversation isolation (no cross-contamination of messages)
 * - Single-dispatch message handling (NO duplicate messages)
 */
export default function WhatsAppChat({
  currentUser,
  onLogout,
  sessionId,
  keyReady = false,
  sessionStatus = 'idle',
  messages = [],
  onSelectContact,
  selectedContact,
  onToggleSidePanel,
  isSidePanelOpen,
  activeAlert,
  onMessageSent,
  onlineUserEmails = new Set(),
  onStartSession,
  isStarting = false,
  keyLengthBits = 0,
  targetBits = 128,
  currentRound = null,
  injectEve = false,
}) {
  const [contacts, setContacts] = useState([]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [decryptedMap, setDecryptedMap] = useState(() => {
    try {
      const cached = localStorage.getItem('qkd_decrypted_cache');
      return cached ? JSON.parse(cached) : {};
    } catch {
      return {};
    }
  });
  const [expandedCipherId, setExpandedCipherId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const updateDecryptedMap = useCallback((newEntries) => {
    setDecryptedMap((prev) => {
      const next = { ...prev, ...newEntries };
      try {
        localStorage.setItem('qkd_decrypted_cache', JSON.stringify(next));
      } catch (e) {}
      return next;
    });
  }, []);

  // Quick infrastructure telemetry prompt chips
  const quickChips = [
    '⚡ Grid SCADA: High-voltage transformer nominal load 74.2%',
    '🔒 Grid Command: Open primary circuit breaker BKR-104',
    '📡 Phase Monitor: Frequency 60.00 Hz locked to atomic clock',
  ];

  // Fetch registered contacts from PostgreSQL
  const fetchContacts = async () => {
    try {
      const res = await getUsers(currentUser?.email);
      const list = res.users || [];
      setContacts(list);

      // Default select first contact if none selected
      if (!selectedContact && list.length > 0) {
        onSelectContact(list[0]);
      }
    } catch (err) {
      console.error('Error fetching contacts:', err);
    }
  };

  useEffect(() => {
    fetchContacts();

    // Listen for new users registering in real-time
    const handleNewUser = (payload) => {
      if (payload.user && payload.user.email !== currentUser?.email) {
        setContacts((prev) => {
          if (prev.some((c) => c.email.toLowerCase() === payload.user.email.toLowerCase())) {
            return prev;
          }
          return [...prev, payload.user];
        });
      }
    };

    socket.on('user_registered', handleNewUser);
    return () => {
      socket.off('user_registered', handleNewUser);
    };
  }, [currentUser?.email]);

  // Pre-decrypt messages for instant viewing
  useEffect(() => {
    messages.forEach((m) => {
      if (!decryptedMap[m.id]) {
        getDecryptedMessage(m.id)
          .then((res) => {
            if (res.plaintext) {
              updateDecryptedMap({ [m.id]: res.plaintext });
            }
          })
          .catch(() => {});
      }
    });
  }, [messages, decryptedMap, updateDecryptedMap]);

  const handleSend = async (textToSend) => {
    const text = (textToSend || inputText).trim();
    if (!text || !selectedContact) return;

    if (!keyReady) {
      alert('The quantum key exchange is not ready yet. Please open the Quantum Channel side panel and click "Run Clean E91 Key Exchange".');
      return;
    }

    setSending(true);
    try {
      const res = await sendMessage({
        sessionId,
        direction: 'A_to_B',
        text,
        senderEmail: currentUser.email,
        receiverEmail: selectedContact.email,
      });

      // Cache decrypted text immediately for sender view
      if (res.message && res.message.id) {
        updateDecryptedMap({ [res.message.id]: text });
        if (onMessageSent) {
          onMessageSent(res.message);
        }
      }

      setInputText('');
    } catch (err) {
      alert(`Send failed: ${err.message}`);
    } finally {
      setSending(false);
    }
  };

  const filteredContacts = contacts.filter((c) =>
    (c.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.email || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex-1 flex overflow-hidden bg-[#0c1317]">
      {/* ---------------------------------------------------- */}
      {/* Left Sidebar: Real Registered Contact Directory     */}
      {/* ---------------------------------------------------- */}
      <aside className={`
        ${selectedContact ? 'hidden md:flex' : 'flex'}
        w-full md:w-80 lg:w-96 bg-[#111b21] border-r border-[#222d34] flex-col flex-shrink-0 h-full
      `}>
        {/* User Profile Header */}
        <div className="h-16 px-4 bg-[#202c33] flex items-center justify-between border-b border-[#222d34]">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src={currentUser?.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${currentUser?.email}`}
              alt={currentUser?.name}
              className="w-10 h-10 rounded-full object-cover border border-[#222d34] flex-shrink-0"
            />
            <div className="min-w-0">
              <div className="text-sm font-semibold text-[#e9edef] leading-tight truncate">
                {currentUser?.name || 'Authorized Operator'}
              </div>
              <div className="text-[11px] text-[#00a884] font-medium flex items-center gap-1 truncate">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00a884]"></span>
                {currentUser?.email}
              </div>
            </div>
          </div>

          <button
            onClick={onLogout}
            title="Sign Out"
            className="text-[#8696a0] hover:text-[#ea4335] text-xs font-mono px-2 py-1 rounded hover:bg-[#111b21] transition flex-shrink-0 border border-transparent hover:border-[#ea4335]/30"
          >
            Logout
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-2.5 border-b border-[#222d34]">
          <div className="bg-[#202c33] rounded-lg px-3 py-1.5 flex items-center gap-2.5 text-xs text-[#8696a0]">
            <span>🔍</span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search contacts..."
              className="bg-transparent border-none text-[#e9edef] placeholder-[#8696a0] focus:outline-none w-full text-xs"
            />
          </div>
        </div>

        {/* Registered Contacts List */}
        <div className="flex-1 overflow-y-auto divide-y divide-[#222d34]/40">
          {filteredContacts.length === 0 ? (
            <div className="p-6 text-center text-xs text-[#8696a0]">
              No other operators registered yet.
              <br />
              Open an incognito window and sign up another user to see them appear here!
            </div>
          ) : (
            filteredContacts.map((contact) => {
              const isSelected = selectedContact?.email === contact.email;
              const isOnline = onlineUserEmails?.has(contact.email?.toLowerCase());

              return (
                <div
                  key={contact.id || contact.email}
                  onClick={() => onSelectContact(contact)}
                  className={`px-3.5 py-3 flex items-center gap-3 cursor-pointer transition ${
                    isSelected ? 'bg-[#2a3942]' : 'hover:bg-[#202c33]/70'
                  }`}
                >
                  <div className="relative">
                    <img
                      src={contact.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${contact.email}`}
                      alt={contact.name}
                      className="w-12 h-12 rounded-full object-cover border border-[#222d34]"
                    />
                    <span
                      className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-[#111b21] transition-colors ${
                        isOnline ? 'bg-[#00a884] ring-2 ring-[#00a884]/30' : 'bg-[#64748b]'
                      }`}
                      title={isOnline ? 'Operator Online' : 'Operator Offline'}
                    ></span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-0.5">
                      <h4 className="text-sm font-semibold text-[#e9edef] truncate">
                        {contact.name}
                      </h4>
                      <span className={`text-[10px] font-mono font-medium flex items-center gap-1 ${
                        isOnline ? 'text-[#00a884]' : 'text-[#8696a0]'
                      }`}>
                        {isOnline ? (
                          <>
                            <span className="w-1.5 h-1.5 rounded-full bg-[#00a884]"></span>
                            ONLINE
                          </>
                        ) : (
                          'OFFLINE'
                        )}
                      </span>
                    </div>
                    <div className="text-[11px] text-[#8696a0] truncate font-mono">
                      {contact.site_name || contact.email}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Directory Counter */}
        <div className="p-2.5 bg-[#111b21] border-t border-[#222d34] text-[11px] text-[#8696a0] text-center font-mono">
          {contacts.length} Registered Operators in Network
        </div>
      </aside>

      {/* ---------------------------------------------------- */}
      {/* Center: Conversation Window                          */}
      {/* ---------------------------------------------------- */}
      <section className={`
        ${selectedContact ? 'flex' : 'hidden md:flex'}
        flex-1 flex-col h-full bg-[#0b141a] relative overflow-hidden
      `}>
        {/* Header Bar */}
        <div className="h-16 px-3 sm:px-4 bg-[#202c33] border-b border-[#222d34] flex items-center justify-between flex-shrink-0 z-10 gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            {selectedContact && (
              <button
                type="button"
                onClick={() => onSelectContact(null)}
                className="md:hidden p-2 -ml-1 text-[#8696a0] hover:text-[#e9edef] rounded-full hover:bg-[#111b21] transition flex items-center justify-center flex-shrink-0"
                title="Back to contacts"
                aria-label="Back to contacts"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}

            {selectedContact ? (
              <>
                <div className="relative flex-shrink-0">
                  <img
                    src={selectedContact.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${selectedContact.email}`}
                    alt={selectedContact.name}
                    className="w-9 h-9 sm:w-10 sm:h-10 rounded-full object-cover border border-[#222d34]"
                  />
                  <span
                    className={`absolute bottom-0 right-0 w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full border-2 border-[#202c33] ${
                      onlineUserEmails?.has(selectedContact.email?.toLowerCase())
                        ? 'bg-[#00a884]'
                        : 'bg-[#64748b]'
                    }`}
                  ></span>
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold text-[#e9edef] leading-tight flex items-center gap-1.5 truncate">
                    <span className="truncate">{selectedContact.name}</span>
                    <span className="hidden sm:inline-block text-[10px] bg-[#00a884]/20 text-[#00a884] px-1.5 py-0.5 rounded font-mono font-bold flex-shrink-0">
                      {selectedContact.site_name || 'PARTNER NODE'}
                    </span>
                  </h3>
                  <p className="text-[11px] text-[#8696a0] truncate">
                    {onlineUserEmails?.has(selectedContact.email?.toLowerCase()) ? (
                      keyReady ? (
                        <span className="text-[#00a884] font-medium flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#00a884]"></span>
                          <span className="hidden sm:inline">online · </span>Quantum Channel Armed
                        </span>
                      ) : sessionStatus === 'running' ? (
                        <span className="text-[#00d2d3] font-medium flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#00d2d3] animate-pulse"></span>
                          <span className="hidden sm:inline">online · </span>Exchanging ({keyLengthBits}/{targetBits}b)...
                        </span>
                      ) : sessionStatus === 'aborted' ? (
                        <span className="text-[#ea4335] font-medium flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#ea4335]"></span>
                          <span className="hidden sm:inline">online · </span>Intrusion Detected
                        </span>
                      ) : (
                        <span className="text-[#ffd279] font-medium flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#00a884]"></span>
                          <span className="hidden sm:inline">online · </span>Channel Required
                        </span>
                      )
                    ) : (
                      <span className="text-[#8696a0] font-medium flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#64748b]"></span>
                        offline · Standby
                      </span>
                    )}
                  </p>
                </div>
              </>
            ) : (
              <div className="text-sm text-[#8696a0]">Select an operator to begin</div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 flex-shrink-0">
            <div className={`flex items-center gap-1 text-[11px] font-mono font-semibold px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full border ${
              keyReady
                ? 'bg-[#00a884]/15 border-[#00a884]/40 text-[#00a884]'
                : sessionStatus === 'running'
                ? 'bg-[#00d2d3]/15 border-[#00d2d3]/40 text-[#00d2d3] animate-pulse'
                : 'bg-[#f59e0b]/15 border-[#f59e0b]/40 text-[#f59e0b]'
            }`}>
              <span>{keyReady ? '🔒' : '⏳'}</span>
              <span className="hidden sm:inline">
                {keyReady ? 'AES Key Ready' : sessionStatus === 'running' ? 'Exchanging Photons...' : 'Channel Required'}
              </span>
            </div>

            <button
              onClick={onToggleSidePanel}
              className={`px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shadow-sm ${
                isSidePanelOpen
                  ? 'bg-[#00a884] text-white shadow-[#00a884]/20'
                  : 'bg-[#111b21] hover:bg-[#202c33] text-[#e9edef] border border-[#222d34]'
              }`}
              title="Quantum Channel & Metrics"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
              </svg>
              <span className="hidden sm:inline">Quantum Channel</span>
              <span>{isSidePanelOpen ? '◀' : '▶'}</span>
            </button>
          </div>
        </div>

        {/* Threat Flash Banner if Eve detected */}
        {activeAlert && (
          <div className="bg-[#ea4335] text-white px-4 py-2 text-xs flex items-center justify-between shadow-md z-10 animate-pulse font-medium">
            <span className="flex items-center gap-2">
              <span>🚨</span>
              <span>
                <strong>Eavesdropper Intercept Detected (Round #{activeAlert.roundNum})!</strong> {activeAlert.reason}. Bell inequality broken. Key material discarded.
              </span>
            </span>
          </div>
        )}

        {/* Message Stream */}
        <div className="flex-1 overflow-y-auto p-2.5 sm:p-6 space-y-3">
          {/* Security Chip Notice */}
          <div className="flex justify-center my-1.5 sm:my-2">
            <div className="max-w-md text-center bg-[#182229] border border-[#222d34] text-[#ffd279] text-[10px] sm:text-[11px] p-2 sm:p-2.5 rounded-lg shadow-sm leading-relaxed">
              <span className="font-bold">🔒 End-to-End Quantum Encryption:</span> Messages between{' '}
              <strong className="text-white">{currentUser?.name}</strong> and{' '}
              <strong className="text-white">{selectedContact?.name || 'Recipient'}</strong> are secured with AES-256-GCM using keys derived from E91 entangled photon measurements. Plaintext is never stored in PostgreSQL.
            </div>
          </div>

          {/* Mandatory Quantum Channel Gate when Key is NOT Ready */}
          {!keyReady && (
            <div className="my-3 sm:my-6 mx-auto max-w-xl">
              {sessionStatus === 'running' ? (
                /* 1. Photon Exchange in Progress with Real-Time Circuit */
                <div className="bg-[#111b21] border border-[#00d2d3]/40 rounded-2xl p-3.5 sm:p-5 shadow-2xl text-center space-y-3 sm:space-y-4">
                  <div className="flex items-center justify-between border-b border-[#222d34] pb-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#00d2d3] animate-ping"></span>
                      <h3 className="font-bold text-white tracking-wide text-xs sm:text-sm">
                        Establishing Quantum Channel (E91 Real-Time)
                      </h3>
                    </div>
                    <span className="font-mono text-[#00d2d3] font-bold text-[11px] sm:text-xs">
                      {keyLengthBits} / {targetBits} bits
                    </span>
                  </div>

                  {/* Real-Time Running Quantum Circuit */}
                  <QuantumCircuitViewer
                    currentRound={currentRound}
                    sessionStatus={sessionStatus}
                    injectEve={injectEve}
                  />

                  {/* Sifted Key Progress Bar */}
                  <div className="space-y-1.5">
                    <div className="w-full bg-[#202c33] h-2.5 rounded-full overflow-hidden p-0.5 border border-[#222d34]">
                      <div
                        className="bg-gradient-to-r from-[#00d2d3] to-[#00a884] h-full rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(100, Math.round((keyLengthBits / targetBits) * 100))}%` }}
                      ></div>
                    </div>
                  </div>

                  <div className="text-[11px] text-[#8696a0] font-mono flex items-center justify-between pt-1">
                    <span>Bell S: <strong className="text-[#00d2d3]">{currentRound ? currentRound.chsh_s.toFixed(3) : 'Testing...'}</strong></span>
                    <span>QBER: <strong className="text-[#ea4335]">{currentRound ? (currentRound.qber * 100).toFixed(1) + '%' : '0.0%'}</strong></span>
                    <span className="text-[#00d2d3] font-medium flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#00d2d3] animate-pulse"></span>
                      WebSocket Stream
                    </span>
                  </div>
                </div>
              ) : sessionStatus === 'aborted' ? (
                /* 2. Intrusion Aborted Alert */
                <div className="bg-[#ea4335]/15 border border-[#ea4335]/40 rounded-2xl p-4 sm:p-6 shadow-2xl text-center space-y-3 sm:space-y-3.5">
                  <div className="text-2xl sm:text-3xl">🚨</div>
                  <div>
                    <h3 className="text-xs sm:text-sm font-bold text-[#fca5a5] tracking-wide">
                      Quantum Channel Aborted: Eavesdropper Detected!
                    </h3>
                    <p className="text-[11px] sm:text-xs text-white/80 mt-1 max-w-sm mx-auto">
                      Bell inequality violated classical limit (CHSH S &lt; 2.0) or QBER exceeded 11%. Perturbed photon bits have been discarded immediately.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (!isSidePanelOpen) onToggleSidePanel();
                      if (onStartSession) onStartSession();
                    }}
                    disabled={isStarting}
                    className="px-5 sm:px-6 py-2 sm:py-2.5 bg-[#ea4335] hover:bg-[#d93025] text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-lg transition flex items-center justify-center gap-2 mx-auto"
                  >
                    <span>🔄</span> Re-establish Quantum Channel
                  </button>
                </div>
              ) : (
                /* 3. Idle / Channel Required Gate */
                <div className="bg-[#111b21] border border-[#222d34] rounded-2xl p-4 sm:p-6 shadow-2xl text-center space-y-3.5 sm:space-y-4">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 mx-auto rounded-2xl bg-[#00a884]/15 border border-[#00a884]/30 flex items-center justify-center text-xl sm:text-2xl text-[#00a884] shadow-inner">
                    🔒
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-white tracking-wide">
                      Quantum Channel Required
                    </h3>
                    <p className="text-[11px] sm:text-xs text-[#8696a0] mt-1 sm:mt-1.5 leading-relaxed max-w-sm mx-auto">
                      To initiate communication with <strong className="text-white">{selectedContact?.name || 'Operator'}</strong>, you must establish an E91 entangled photon channel to negotiate an authenticated AES-256 key.
                    </p>
                  </div>

                  {/* Circuit Preview in Standby Mode */}
                  <QuantumCircuitViewer
                    currentRound={null}
                    sessionStatus="idle"
                    injectEve={injectEve}
                    compact={true}
                  />

                  <div>
                    <button
                      type="button"
                      onClick={() => {
                        if (!isSidePanelOpen) onToggleSidePanel();
                        if (onStartSession) onStartSession();
                      }}
                      disabled={isStarting}
                      className="px-5 sm:px-6 py-2.5 sm:py-3 bg-[#00a884] hover:bg-[#009272] disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-[#00a884]/25 flex items-center justify-center gap-2 mx-auto transition hover:scale-105 active:scale-95"
                    >
                      {isStarting ? (
                        <>
                          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                          Initializing Channel...
                        </>
                      ) : (
                        <>
                          <span>⚡</span> Initialize Quantum Channel
                        </>
                      )}
                    </button>
                  </div>

                  <div className="pt-2.5 sm:pt-3 border-t border-[#222d34] flex flex-wrap items-center justify-center gap-2 sm:gap-4 text-[10px] sm:text-[11px] text-[#8696a0] font-mono">
                    <span>✓ Bell S &gt; 2.0 Check</span>
                    <span>✓ QBER &lt; 11% Guarantee</span>
                    <span>✓ Zero Classical Leakage</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Existing Messages */}
          {messages.length === 0 ? (
            keyReady && (
              <div className="text-center py-12 text-[#8696a0] text-xs">
                <div className="text-3xl mb-2">💬</div>
                <p>Quantum channel established! Send your first encrypted message below.</p>
              </div>
            )
          ) : (
            messages.map((m) => {
              // Message is outgoing if sent by current user
              const isOutgoing =
                m.senderEmail?.toLowerCase() === currentUser?.email.toLowerCase() ||
                m.sender_email?.toLowerCase() === currentUser?.email.toLowerCase();

              const decrypted = decryptedMap[m.id];
              const isCipherExpanded = expandedCipherId === m.id;

              return (
                <div
                  key={m.id}
                  className={`flex flex-col ${isOutgoing ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[85%] sm:max-w-[70%] rounded-2xl px-3.5 py-2 shadow-md relative ${
                      isOutgoing
                        ? 'bg-[#005c4b] text-[#e9edef] rounded-tr-none'
                        : 'bg-[#202c33] text-[#e9edef] rounded-tl-none'
                    }`}
                  >
                    {/* Message Body */}
                    <div className="text-[13px] leading-relaxed break-words font-sans">
                      {decrypted ? (
                        <span>{decrypted}</span>
                      ) : (
                        <div className="flex items-center gap-2 text-xs text-[#8696a0] py-0.5">
                          <span className="w-3.5 h-3.5 border-2 border-[#00a884] border-t-transparent rounded-full animate-spin flex-shrink-0"></span>
                          <span className="italic">Decrypting authenticated quantum ciphertext...</span>
                        </div>
                      )}
                    </div>

                    {/* Metadata & Checkmark */}
                    <div className="flex items-center justify-end gap-1.5 mt-1 text-[10px] text-white/60 font-mono">
                      <span>
                        {m.sentAt || m.sent_at
                          ? new Date(m.sentAt || m.sent_at).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : 'Now'}
                      </span>
                      {isOutgoing && (
                        <span className="text-[#53bdeb] font-bold">✓✓</span>
                      )}
                    </div>

                    {/* Toggle Stored PostgreSQL Ciphertext Inspector */}
                    <button
                      onClick={() => setExpandedCipherId(isCipherExpanded ? null : m.id)}
                      className="mt-1.5 pt-1.5 border-t border-white/10 text-[10px] text-white/70 hover:text-white flex items-center justify-between w-full font-mono"
                    >
                      <span>🔒 View PostgreSQL Ciphertext</span>
                      <span>{isCipherExpanded ? '▲' : '▼'}</span>
                    </button>

                    {/* Expanded Ciphertext Drawer */}
                    {isCipherExpanded && (
                      <div className="mt-2 p-2 bg-[#0b141a] rounded border border-white/10 text-[10px] font-mono space-y-1 text-white/90 break-all select-all">
                        <div className="text-[#ffd279] font-bold">Stored in PostgreSQL message_logs:</div>
                        <div><strong className="text-white/60">Ciphertext:</strong> {m.ciphertext}</div>
                        <div><strong className="text-white/60">IV (12B):</strong> {m.iv}</div>
                        <div><strong className="text-white/60">Tag (16B):</strong> {m.authTag || m.auth_tag}</div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Quick Telemetry Chips */}
        {keyReady && (
          <div className="px-4 py-2 bg-[#111b21]/90 border-t border-[#222d34] flex items-center gap-2 overflow-x-auto">
            <span className="text-[10px] font-mono text-[#8696a0] uppercase flex-shrink-0">
              Quick Telemetry:
            </span>
            {quickChips.map((chip, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSend(chip)}
                disabled={sending}
                className="text-[11px] font-sans bg-[#202c33] hover:bg-[#2a3942] text-[#00a884] px-2.5 py-1 rounded-full border border-[#222d34] whitespace-nowrap transition"
              >
                {chip}
              </button>
            ))}
          </div>
        )}

        {/* Input Bar */}
        <div className="p-2 sm:p-3 bg-[#202c33] border-t border-[#222d34] flex items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            disabled={!keyReady}
            className="hidden sm:inline-block text-[#8696a0] hover:text-[#e9edef] p-1.5 text-lg transition disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
            title="Emoji"
          >
            😊
          </button>

          <button
            type="button"
            disabled={!keyReady}
            className="hidden sm:inline-block text-[#8696a0] hover:text-[#e9edef] p-1.5 text-lg transition disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
            title="Attach Document"
          >
            📎
          </button>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex-1 flex items-center gap-1.5 sm:gap-2 min-w-0"
          >
            <div className="relative flex-1 min-w-0">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                disabled={!keyReady || sending}
                placeholder={
                  keyReady
                    ? `Message (AES-256 Armed)...`
                    : '🔒 Quantum channel required...'
                }
                className="w-full bg-[#2a3942] border-none rounded-xl px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm text-[#e9edef] placeholder-[#8696a0] focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed"
              />
              {!keyReady && (
                <span className="absolute right-2.5 top-2 sm:top-2.5 text-[10px] text-[#ffd279] font-mono pointer-events-none font-bold">
                  LOCKED
                </span>
              )}
            </div>

            <button
              type="submit"
              disabled={!keyReady || !inputText.trim() || sending}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#00a884] hover:bg-[#009272] disabled:bg-[#2a3942] disabled:text-[#8696a0] text-white flex items-center justify-center transition flex-shrink-0 shadow-md disabled:cursor-not-allowed text-sm"
              title={keyReady ? 'Send Encrypted Message' : 'Establish Quantum Channel First'}
            >
              {sending ? (
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
              ) : keyReady ? (
                '➤'
              ) : (
                '🔒'
              )}
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
