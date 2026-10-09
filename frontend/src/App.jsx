import React, { useState, useEffect, useCallback } from 'react';
import { socket } from './services/socket';
import {
  startSession,
  getSessionRounds,
  getSessionStatus,
  getConversationMessages,
  clearConversation,
  getOnlineUsers,
  getActiveChannel,
} from './services/api';

import LoginScreen from './components/LoginScreen';
import WhatsAppChat from './components/WhatsAppChat';
import QkdSidePanel from './components/QkdSidePanel';
import SessionHistory from './components/SessionHistory';

export default function App() {
  // Authentication State
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const stored = localStorage.getItem('qkd_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const [selectedContact, setSelectedContact] = useState(null);

  // QKD Session Configuration & Telemetry State
  const [siteA, setSiteA] = useState('Station Alpha');
  const [siteB, setSiteB] = useState('Station Beta');
  const [injectEve, setInjectEve] = useState(false);
  const [targetBits, setTargetBits] = useState(128);

  const [activeSessionId, setActiveSessionId] = useState(null);
  const [sessionStatus, setSessionStatus] = useState('idle'); // 'idle' | 'running' | 'key_ready' | 'aborted'
  const [rounds, setRounds] = useState([]);
  const [currentRound, setCurrentRound] = useState(null);
  const [keyLengthBits, setKeyLengthBits] = useState(0);
  const [messages, setMessages] = useState([]);
  const [activeAlert, setActiveAlert] = useState(null);
  const [isStarting, setIsStarting] = useState(false);

  // Real-time online presence state (Set of lowercase emails)
  const [onlineUserEmails, setOnlineUserEmails] = useState(new Set());

  // UI state
  const [isSidePanelOpen, setIsSidePanelOpen] = useState(true);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  // Register user presence and track online operators
  useEffect(() => {
    if (!currentUser?.email) return;

    // Register active presence
    socket.emit('register_presence', { email: currentUser.email });

    // Initial snapshot of online users
    getOnlineUsers()
      .then((res) => {
        if (res.onlineEmails) {
          setOnlineUserEmails(new Set(res.onlineEmails.map((e) => e.toLowerCase())));
        }
      })
      .catch((err) => console.error('Failed to get online users:', err));

    const handlePresenceUpdate = (payload) => {
      if (payload?.onlineEmails) {
        setOnlineUserEmails(new Set(payload.onlineEmails.map((e) => e.toLowerCase())));
      }
    };

    socket.on('presence_update', handlePresenceUpdate);
    return () => {
      socket.off('presence_update', handlePresenceUpdate);
    };
  }, [currentUser?.email]);

  // Reset quantum channel state so each login and contact link requires establishing a channel
  const resetQuantumChannel = useCallback(() => {
    setActiveSessionId(null);
    setSessionStatus('idle');
    setRounds([]);
    setCurrentRound(null);
    setKeyLengthBits(0);
    setActiveAlert(null);
    setIsStarting(false);
  }, []);

  // When currentUser or selectedContact changes, update Site names and fetch conversation
  useEffect(() => {
    if (currentUser) {
      setSiteA(currentUser.site_name || currentUser.name || 'Station Alpha');
    }
    if (selectedContact) {
      setSiteB(selectedContact.site_name || selectedContact.name || 'Station Beta');
      loadConversation(selectedContact.email);
    }
  }, [currentUser, selectedContact]);

  const handleSelectContact = useCallback(async (contact) => {
    if (selectedContact?.email?.toLowerCase() !== contact?.email?.toLowerCase()) {
      setSelectedContact(contact);
      loadConversation(contact?.email);

      // Check if an active shared quantum channel was already established between these two users
      if (currentUser?.email && contact?.email) {
        try {
          const channelInfo = await getActiveChannel(currentUser.email, contact.email);
          if (channelInfo && channelInfo.active && channelInfo.sessionId) {
            console.log(`[QKD] Found existing active quantum channel with ${contact.name}:`, channelInfo.sessionId);
            setActiveSessionId(channelInfo.sessionId);
            setSessionStatus(channelInfo.status || 'key_ready');
            setKeyLengthBits(channelInfo.keyLengthBits || 128);
            socket.emit('join_session', channelInfo.sessionId);
            return;
          }
        } catch (e) {
          console.warn('[QKD] Error checking active channel:', e);
        }
      }

      // No active channel yet between this pair
      resetQuantumChannel();
    }
  }, [selectedContact, currentUser, resetQuantumChannel]);

  const loadConversation = async (contactEmail) => {
    if (!currentUser?.email || !contactEmail) return;
    try {
      const res = await getConversationMessages(currentUser.email, contactEmail);
      setMessages(res.messages || []);
    } catch (err) {
      console.error('Error loading conversation:', err);
    }
  };

  // Helper to add message with strict string ID deduplication
  const appendMessageUnique = useCallback((msg) => {
    setMessages((prev) => {
      if (prev.some((m) => String(m.id) === String(msg.id))) {
        return prev;
      }
      return [...prev, msg];
    });
  }, []);

  // Socket.IO event listeners
  useEffect(() => {
    const handleRoundStats = (payload) => {
      const { sessionId, data } = payload;
      if (activeSessionId && sessionId !== activeSessionId) return;

      setCurrentRound(data);
      setRounds((prev) => [...prev, data]);
      setKeyLengthBits(data.sifted_bits_count ?? 0);
    };

    const handleEavesdropAlert = (payload) => {
      const { sessionId, alert } = payload;
      if (activeSessionId && sessionId !== activeSessionId) return;

      setActiveAlert({
        roundNum: alert.round_num,
        qber: alert.qber,
        chshS: alert.chsh_s,
        reason: alert.reason,
        timestamp: new Date().toLocaleTimeString(),
      });
    };

    const handleKeyReady = (payload) => {
      const { sessionId, summary } = payload;
      if (activeSessionId && sessionId !== activeSessionId) return;

      setSessionStatus(summary.status);
      setKeyLengthBits(summary.key_length_bits);
    };

    // Shared channel events: syncs both Alice and Bob simultaneously
    const handleChannelStarted = (payload) => {
      const { sessionId, user1, user2 } = payload;
      if (!currentUser?.email || !selectedContact?.email) return;

      const myEmail = currentUser.email.toLowerCase();
      const peerEmail = selectedContact.email.toLowerCase();
      const u1 = (user1 || '').toLowerCase();
      const u2 = (user2 || '').toLowerCase();

      if ((u1 === myEmail && u2 === peerEmail) || (u2 === myEmail && u1 === peerEmail)) {
        console.log(`[Socket.IO] Quantum channel started between ${u1} and ${u2}:`, sessionId);
        setActiveSessionId(sessionId);
        setSessionStatus('running');
        setRounds([]);
        setCurrentRound(null);
        setActiveAlert(null);
        setKeyLengthBits(0);
        socket.emit('join_session', sessionId);
      }
    };

    const handleChannelEstablished = (payload) => {
      const { sessionId, user1, user2, status, keyLengthBits: bits } = payload;
      if (!currentUser?.email || !selectedContact?.email) return;

      const myEmail = currentUser.email.toLowerCase();
      const peerEmail = selectedContact.email.toLowerCase();
      const u1 = (user1 || '').toLowerCase();
      const u2 = (user2 || '').toLowerCase();

      if ((u1 === myEmail && u2 === peerEmail) || (u2 === myEmail && u1 === peerEmail)) {
        console.log(`[Socket.IO] Quantum channel established between ${u1} and ${u2}:`, sessionId);
        setActiveSessionId(sessionId);
        setSessionStatus(status || 'key_ready');
        setKeyLengthBits(bits || 128);
        socket.emit('join_session', sessionId);
      }
    };

    const handleEncryptedMessage = (payload) => {
      const msg = payload.message || payload;
      if (!msg || !currentUser) return;

      // Only display message if it belongs to current active conversation
      const msgSender = (msg.senderEmail || msg.sender_email || '').toLowerCase();
      const msgReceiver = (msg.receiverEmail || msg.receiver_email || '').toLowerCase();
      const curEmail = (currentUser.email || '').toLowerCase();
      const contactEmail = (selectedContact?.email || '').toLowerCase();

      const belongsToCurrentChat =
        (msgSender === curEmail && msgReceiver === contactEmail) ||
        (msgSender === contactEmail && msgReceiver === curEmail);

      if (belongsToCurrentChat) {
        appendMessageUnique(msg);
      }
    };

    const handleChatCleared = (payload) => {
      const { user1, user2 } = payload || {};
      if (!currentUser?.email || !selectedContact?.email) return;

      const myEmail = currentUser.email.toLowerCase();
      const peerEmail = selectedContact.email.toLowerCase();
      const u1 = (user1 || '').toLowerCase();
      const u2 = (user2 || '').toLowerCase();

      if ((u1 === myEmail && u2 === peerEmail) || (u2 === myEmail && u1 === peerEmail)) {
        setMessages([]);
      }
    };

    socket.on('round_stats', handleRoundStats);
    socket.on('eavesdrop_alert', handleEavesdropAlert);
    socket.on('key_ready', handleKeyReady);
    socket.on('channel_started', handleChannelStarted);
    socket.on('channel_established', handleChannelEstablished);
    socket.on('encrypted_message', handleEncryptedMessage);
    socket.on('chat_cleared', handleChatCleared);

    return () => {
      socket.off('round_stats', handleRoundStats);
      socket.off('eavesdrop_alert', handleEavesdropAlert);
      socket.off('key_ready', handleKeyReady);
      socket.off('channel_started', handleChannelStarted);
      socket.off('channel_established', handleChannelEstablished);
      socket.off('encrypted_message', handleEncryptedMessage);
      socket.off('chat_cleared', handleChatCleared);
    };
  }, [activeSessionId, currentUser, selectedContact, appendMessageUnique]);

  const handleClearChat = useCallback(async () => {
    if (!currentUser?.email || !selectedContact?.email) return;
    await clearConversation(currentUser.email, selectedContact.email);
    setMessages([]);
  }, [currentUser, selectedContact]);

  // Start E91 Quantum Key Distribution
  const handleStartSession = async () => {
    setIsStarting(true);
    setRounds([]);
    setCurrentRound(null);
    setActiveAlert(null);
    setKeyLengthBits(0);
    setSessionStatus('running');

    try {
      const res = await startSession({
        siteA,
        siteB,
        injectEve,
        targetKeyBits: Number(targetBits),
        roundDelayMs: 25,
        user1: currentUser?.email,
        user2: selectedContact?.email,
      });

      setActiveSessionId(res.sessionId);
      socket.emit('join_session', res.sessionId);
      setIsSidePanelOpen(true);
    } catch (err) {
      alert(`Failed to start quantum session: ${err.message}`);
      setSessionStatus('idle');
    } finally {
      setIsStarting(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('qkd_user');
    localStorage.removeItem('qkd_auth_token');
    resetQuantumChannel();
    setCurrentUser(null);
    setSelectedContact(null);
    setMessages([]);
  };

  const handleLoginSuccess = (user) => {
    resetQuantumChannel();
    setCurrentUser(user);
  };

  const handleSelectHistorySession = async (sessionId) => {
    try {
      const statusRes = await getSessionStatus(sessionId);
      const roundsRes = await getSessionRounds(sessionId);

      setActiveSessionId(sessionId);
      setSiteA(statusRes.session.site_a_name);
      setSiteB(statusRes.session.site_b_name);
      setInjectEve(statusRes.session.inject_eve);
      setSessionStatus(statusRes.session.status);
      setRounds(roundsRes.rounds || []);
      setCurrentRound(roundsRes.rounds?.[roundsRes.rounds.length - 1] || null);
      setKeyLengthBits(statusRes.session.key_length_bits || 0);
      setActiveAlert(null);
      setShowHistoryModal(false);
      setIsSidePanelOpen(true);
    } catch (err) {
      console.error('Error loading session history:', err);
    }
  };

  // If user not authenticated, show Login/Signup portal
  if (!currentUser) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-[#0c1317] overflow-hidden font-sans text-[#e9edef] antialiased">
      {/* Top Protocol Status Bar */}
      <header className="h-11 sm:h-12 bg-[#202c33] border-b border-[#222d34] px-3 sm:px-4 flex items-center justify-between text-xs flex-shrink-0 z-20">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#00a884] animate-pulse"></span>
          <span className="font-bold text-white tracking-wide text-[11px] sm:text-xs">
            QUANTUM SECURE NETWORK
          </span>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => setShowHistoryModal(true)}
            className="px-2 py-0.5 sm:px-2.5 sm:py-1 bg-[#111b21] hover:bg-[#2a3942] text-[#8696a0] hover:text-[#e9edef] border border-[#222d34] rounded transition font-mono flex items-center gap-1 text-[11px]"
          >
            <span>📜</span> <span className="hidden sm:inline">Audit </span>History
          </button>

          <div className="text-[10px] sm:text-[11px] font-mono bg-[#111b21] px-2 py-0.5 rounded border border-[#222d34] text-[#00a884] font-bold max-w-[100px] sm:max-w-none truncate">
            {currentUser.name}
          </div>
        </div>
      </header>

      {/* Main WhatsApp-style Chat Layout with QKD Side Panel */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* WhatsApp Chat Conversation */}
        <WhatsAppChat
          currentUser={currentUser}
          onLogout={handleLogout}
          sessionId={activeSessionId}
          keyReady={sessionStatus === 'key_ready'}
          sessionStatus={sessionStatus}
          messages={messages}
          selectedContact={selectedContact}
          onSelectContact={handleSelectContact}
          onToggleSidePanel={() => setIsSidePanelOpen(!isSidePanelOpen)}
          isSidePanelOpen={isSidePanelOpen}
          activeAlert={activeAlert}
          onMessageSent={appendMessageUnique}
          onlineUserEmails={onlineUserEmails}
          onStartSession={handleStartSession}
          isStarting={isStarting}
          keyLengthBits={keyLengthBits}
          targetBits={targetBits}
          currentRound={currentRound}
          injectEve={injectEve}
          onClearChat={handleClearChat}
        />

        {/* Mobile Backdrop for Side Panel Drawer */}
        {isSidePanelOpen && (
          <div
            onClick={() => setIsSidePanelOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 md:hidden transition-opacity"
            aria-hidden="true"
          />
        )}

        {/* Quantum Channel & Real Chart Side Panel */}
        <QkdSidePanel
          isOpen={isSidePanelOpen}
          onClose={() => setIsSidePanelOpen(false)}
          sessionId={activeSessionId}
          sessionStatus={sessionStatus}
          rounds={rounds}
          currentRound={currentRound}
          keyLengthBits={keyLengthBits}
          targetBits={targetBits}
          setTargetBits={setTargetBits}
          injectEve={injectEve}
          setInjectEve={setInjectEve}
          onStartSession={handleStartSession}
          isStarting={isStarting}
          activeAlert={activeAlert}
          siteA={siteA}
          siteB={siteB}
        />
      </div>

      {/* Audit History Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111b21] border border-[#222d34] rounded-2xl max-w-4xl w-full p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex justify-between items-center border-b border-[#222d34] pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>📜</span> PostgreSQL Audit Log & Past Sessions
              </h3>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="text-[#8696a0] hover:text-white p-1 rounded-full text-lg"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              <SessionHistory
                currentSessionId={activeSessionId}
                onSelectSession={handleSelectHistorySession}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
