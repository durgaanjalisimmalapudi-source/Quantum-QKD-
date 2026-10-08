import React from 'react';
import RealChart from './RealChart';
import EveToggle from './EveToggle';
import QuantumCircuitViewer from './QuantumCircuitViewer';

/**
 * QkdSidePanel Component:
 * Collapsible side panel inside the chat view, providing full control
 * and live Chart.js visualization of the E91 quantum key exchange.
 */
export default function QkdSidePanel({
  isOpen,
  onClose,
  sessionId,
  sessionStatus,
  rounds = [],
  currentRound = null,
  keyLengthBits = 0,
  targetBits = 128,
  setTargetBits,
  injectEve,
  setInjectEve,
  onStartSession,
  isStarting,
  activeAlert,
  siteA,
  siteB,
}) {
  if (!isOpen) return null;

  const progressPct = Math.min(100, Math.round((keyLengthBits / targetBits) * 100));

  return (
    <aside className="fixed inset-y-0 right-0 w-full sm:w-[420px] md:relative md:w-[420px] lg:w-[460px] bg-[#111b21] border-l border-[#222d34] flex flex-col h-full z-40 shadow-2xl transition-all">
      {/* Side Panel Header */}
      <div className="h-16 px-4 bg-[#202c33] border-b border-[#222d34] flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#00a884]/20 text-[#00a884] flex items-center justify-center border border-[#00a884]/30">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#e9edef] leading-tight">
              Quantum Channel & E91 Session
            </h3>
            <span className="text-[11px] text-[#8696a0]">
              Per-Round Bell Inequality & QBER Monitor
            </span>
          </div>
        </div>

        <button
          onClick={onClose}
          className="text-[#8696a0] hover:text-white p-1.5 rounded-full hover:bg-[#111b21] transition"
          title="Close Side Panel"
        >
          ✕
        </button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Threat Alert Notice if Eve detected */}
        {activeAlert && (
          <div className="bg-[#ea4335]/20 border border-[#ea4335] rounded-xl p-3 text-white text-xs space-y-1 alert-pulse shadow-lg">
            <div className="flex items-center justify-between font-bold text-[#fca5a5]">
              <span className="flex items-center gap-1.5">
                <span>🚨</span> EAVESDROPPER DETECTED
              </span>
              <span className="text-[10px] bg-[#ea4335] px-1.5 py-0.5 rounded text-white font-mono">
                Round #{activeAlert.roundNum}
              </span>
            </div>
            <p className="text-[11px] text-white/90">
              {activeAlert.reason}. Bell inequality broken or QBER &gt; 11%. Perturbed photon bits discarded immediately!
            </p>
          </div>
        )}

        {/* Channel Status Card */}
        <div className="bg-[#202c33] border border-[#222d34] rounded-xl p-3.5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#8696a0]">Channel Status</span>
            <span className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded ${
              sessionStatus === 'key_ready'
                ? 'bg-[#00a884]/20 text-[#00a884] border border-[#00a884]/40'
                : sessionStatus === 'running'
                ? 'bg-[#00d2d3]/20 text-[#00d2d3] border border-[#00d2d3]/40 animate-pulse'
                : sessionStatus === 'aborted'
                ? 'bg-[#ea4335]/20 text-[#ea4335] border border-[#ea4335]/40'
                : 'bg-[#ffd279]/15 text-[#ffd279] border border-[#ffd279]/30'
            }`}>
              {sessionStatus === 'key_ready'
                ? '● KEY READY (ARMED)'
                : sessionStatus === 'running'
                ? '● EXCHANGING PHOTONS'
                : sessionStatus === 'aborted'
                ? '● ABORTED (EVE)'
                : '○ NOT INITIALIZED'}
            </span>
          </div>

          {/* Progress bar */}
          <div>
            <div className="flex justify-between text-[11px] font-mono text-[#8696a0] mb-1">
              <span>Sifted Key Bits</span>
              <span className="text-[#00d2d3] font-bold">{keyLengthBits} / {targetBits} bits</span>
            </div>
            <div className="w-full bg-[#111b21] h-2 rounded-full overflow-hidden p-0.5 border border-[#222d34]">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  sessionStatus === 'key_ready' ? 'bg-[#00a884]' : 'bg-[#00d2d3]'
                }`}
                style={{ width: `${progressPct}%` }}
              ></div>
            </div>
          </div>

          {/* Live telemetry row */}
          <div className="grid grid-cols-2 gap-2 pt-1 font-mono text-xs">
            <div className="bg-[#111b21] p-2 rounded-lg border border-[#222d34]">
              <span className="text-[10px] text-[#8696a0] block">Bell CHSH (S)</span>
              <span className={`font-bold text-sm ${
                (currentRound?.chsh_s ?? (injectEve ? 1.4142 : 2.8284)) < 2.0 ? 'text-[#ea4335]' : 'text-[#00d2d3]'
              }`}>
                {(currentRound?.chsh_s ?? (injectEve ? 1.4142 : 2.8284)).toFixed(4)}
              </span>
              <span className="text-[9px] text-[#8696a0] block">
                {(currentRound?.chsh_s ?? (injectEve ? 1.4142 : 2.8284)) < 2.0 ? 'Broken (<= 2.0)' : 'Quantum: > 2.0'}
              </span>
            </div>
            <div className="bg-[#111b21] p-2 rounded-lg border border-[#222d34]">
              <span className="text-[10px] text-[#8696a0] block">QBER Error Rate</span>
              <span className="font-bold text-sm text-[#ea4335]">
                {((currentRound?.qber ?? (injectEve ? 0.2500 : 0.0080)) * 100).toFixed(2)}%
              </span>
              <span className="text-[9px] text-[#8696a0] block">Abort limit: 11%</span>
            </div>
          </div>
        </div>

        {/* Real-Time Quantum Circuit Running Diagram */}
        <QuantumCircuitViewer
          currentRound={currentRound}
          sessionStatus={sessionStatus}
          injectEve={injectEve}
          compact={true}
        />

        {/* Real Chart.js Dual Graph */}
        <div className="bg-[#202c33] border border-[#222d34] rounded-xl p-3.5 space-y-2">
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs font-bold text-[#e9edef] flex items-center gap-1.5">
              <span>📈</span> Live Real-Time Graphs
            </span>
            <span className="text-[10px] text-[#8696a0] font-mono">HTML5 Canvas</span>
          </div>

          <RealChart rounds={rounds} currentRound={currentRound} />
        </div>

        {/* Current Round Optics Inspection */}
        {currentRound && (
          <div className="bg-[#202c33] border border-[#222d34] rounded-xl p-3 text-xs font-mono space-y-2">
            <div className="flex justify-between text-[#8696a0] border-b border-[#222d34] pb-1.5 text-[11px]">
              <span>Round #{currentRound.round_num} Optical State</span>
              <span className={currentRound.discarded ? 'text-[#ea4335] font-bold' : 'text-[#00a884] font-bold'}>
                {currentRound.discarded ? 'DISCARDED' : 'KEY SIFTED'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div>
                <span className="text-[#8696a0]">Alice Basis:</span>{' '}
                <span className="text-[#00d2d3] font-bold">{currentRound.alice_basis}</span>
              </div>
              <div>
                <span className="text-[#8696a0]">Bob Basis:</span>{' '}
                <span className="text-[#00a884] font-bold">{currentRound.bob_basis}</span>
              </div>
            </div>
          </div>
        )}

        {/* Eavesdropper Injection Toggle */}
        <div className="bg-[#202c33] border border-[#222d34] rounded-xl p-3.5 space-y-3">
          <div className="text-xs font-bold text-[#e9edef] flex items-center justify-between">
            <span>Eavesdropping Simulation</span>
            <span className="text-[10px] font-mono text-[#8696a0]">Eve Intercept-Resend</span>
          </div>

          <EveToggle
            injectEve={injectEve}
            onToggle={setInjectEve}
            disabled={sessionStatus === 'running'}
          />

          {/* Target bits selector */}
          <div>
            <label className="block text-[11px] text-[#8696a0] mb-1 font-mono">
              Target Key Size:
            </label>
            <select
              value={targetBits}
              onChange={(e) => setTargetBits(Number(e.target.value))}
              disabled={sessionStatus === 'running'}
              className="w-full bg-[#111b21] border border-[#222d34] rounded-lg px-3 py-1.5 text-xs text-[#e9edef] focus:outline-none focus:border-[#00a884] font-mono"
            >
              <option value={64}>64 bits (8 bytes — Fast test)</option>
              <option value={128}>128 bits (16 bytes — Standard verification)</option>
              <option value={256}>256 bits (32 bytes — Full AES-256 Key)</option>
            </select>
          </div>

          {/* Trigger Button */}
          <button
            onClick={onStartSession}
            disabled={sessionStatus === 'running' || isStarting}
            className={`w-full py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition shadow-lg flex items-center justify-center gap-2 ${
              sessionStatus === 'running'
                ? 'bg-[#111b21] text-[#8696a0] cursor-not-allowed'
                : injectEve
                ? 'bg-[#ea4335] hover:bg-[#d93025] text-white shadow-[#ea4335]/20'
                : 'bg-[#00a884] hover:bg-[#009272] text-white shadow-[#00a884]/20'
            }`}
          >
            {sessionStatus === 'running' ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                Exchanging Photons...
              </>
            ) : (
              <>
                <span>⚡</span>
                {injectEve ? 'Run Exchange (With Eve Attack)' : 'Run Clean E91 Key Exchange'}
              </>
            )}
          </button>
        </div>
      </div>
    </aside>
  );
}

