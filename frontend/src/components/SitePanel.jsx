import React from 'react';

/**
 * SitePanel Component:
 * Quantum Optical Bench & Dual-Site Terminal Visualizer.
 * Displays live entangled photon emission, polarizer orientations,
 * quantum state collapse, and Eve intercept-resend visual tapping.
 */
export default function SitePanel({
  siteA = 'Station Alpha',
  siteB = 'Station Beta',
  currentRound = null,
  keyLengthBits = 0,
  targetKeyBits = 128,
  status = 'idle',
  injectEve = false,
}) {
  const isKeyRound = currentRound?.is_key_round;
  const isDiscarded = currentRound?.discarded;
  const isAnomaly = currentRound?.anomaly_flagged;
  const progressPct = Math.min(100, Math.round((keyLengthBits / targetKeyBits) * 100));

  // Determine polarizer angle in degrees for visual needle rotation
  const getAliceAngleDeg = (basis) => {
    if (!basis) return 0;
    if (basis.includes('0°')) return 0;
    if (basis.includes('45°')) return 45;
    if (basis.includes('90°')) return 90;
    return 0;
  };

  const getBobAngleDeg = (basis) => {
    if (!basis) return 45;
    if (basis.includes('45°')) return 45;
    if (basis.includes('90°')) return 90;
    if (basis.includes('135°')) return 135;
    return 45;
  };

  const aliceAngle = getAliceAngleDeg(currentRound?.alice_basis);
  const bobAngle = getBobAngleDeg(currentRound?.bob_basis);

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-2xl backdrop-blur-md">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500/20 to-purple-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-300">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-bold text-white tracking-wide flex items-center gap-2">
              Quantum Optical Channel & Dual-Terminal Bench
            </h3>
            <p className="text-[11px] text-slate-400">
              State: <span className="font-mono text-purple-400 font-semibold">|Φ⁺⟩ = (|00⟩ + |11⟩)/√2</span> · Photons polarized on Poincare sphere
            </p>
          </div>
        </div>

        {/* Key Accumulator Progress */}
        <div className="flex items-center gap-3 bg-slate-950 px-3.5 py-1.5 rounded-lg border border-slate-800">
          <div className="text-right">
            <div className="text-[10px] text-slate-400 uppercase font-mono tracking-wider">Sifted Key Progress</div>
            <div className="text-xs font-mono font-bold text-cyan-400">
              {keyLengthBits} / {targetKeyBits} <span className="text-[10px] text-slate-500">bits</span>
            </div>
          </div>
          <div className="w-24 bg-slate-800 h-2.5 rounded-full overflow-hidden p-0.5">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                status === 'key_ready'
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-400 shadow-[0_0_10px_#10b981]'
                  : 'bg-gradient-to-r from-cyan-500 to-blue-500 shadow-[0_0_10px_#06b6d4]'
              }`}
              style={{ width: `${progressPct}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Optical Bench Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-11 gap-4 items-center">
        {/* Site A (Alice) */}
        <div className="lg:col-span-4 bg-slate-950/90 border border-cyan-500/30 rounded-xl p-4 shadow-lg shadow-cyan-950/20 relative overflow-hidden group hover:border-cyan-500/60 transition-all">
          <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/5 rounded-full blur-2xl pointer-events-none"></div>

          <div className="flex justify-between items-start mb-3">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-widest text-cyan-400 font-bold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
                TRANSMITTER TERMINAL
              </span>
              <h4 className="text-sm font-bold text-white mt-0.5">{siteA}</h4>
              <span className="text-[11px] text-slate-500 font-mono">Node ID: ALICE-TX-01</span>
            </div>

            {/* Polarizer Angle Dial */}
            <div className="relative w-11 h-11 rounded-full border border-cyan-500/40 bg-slate-900 flex items-center justify-center">
              <div
                className="w-8 h-0.5 bg-cyan-400 transition-transform duration-300 rounded shadow-[0_0_8px_#22d3ee]"
                style={{ transform: `rotate(${aliceAngle}deg)` }}
              ></div>
              <span className="absolute text-[8px] font-mono text-cyan-300 font-bold bottom-0.5">
                {aliceAngle}°
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-800/80 text-xs font-mono">
            <div className="bg-slate-900/80 p-2 rounded border border-slate-800">
              <span className="text-slate-500 text-[10px] block">Basis Selected</span>
              <span className="text-cyan-300 font-bold text-xs">{currentRound?.alice_basis || 'a1 (0°)'}</span>
            </div>
            <div className="bg-slate-900/80 p-2 rounded border border-slate-800">
              <span className="text-slate-500 text-[10px] block">Measurement Outcome</span>
              <span className="text-white font-bold text-xs">
                {currentRound?.alice_bit !== undefined ? (
                  <span className="text-cyan-400 text-sm">Bit: {currentRound.alice_bit}</span>
                ) : (
                  <span className="text-slate-500">—</span>
                )}
              </span>
            </div>
          </div>
        </div>

        {/* Center: Quantum Channel & Fiber Optics Simulation */}
        <div className="lg:col-span-3 flex flex-col items-center justify-center py-2 px-1 relative">
          {/* Fiber Channel Track */}
          <div className="relative w-full h-12 bg-slate-950 border border-slate-800 rounded-lg flex items-center justify-center overflow-hidden px-2 shadow-inner">
            {/* Optical Fiber Core */}
            <div className="absolute inset-x-2 h-1 bg-gradient-to-r from-cyan-500 via-purple-500 to-emerald-500 rounded opacity-60"></div>

            {/* Animated Laser Photon */}
            {status === 'running' && (
              <div
                className={`photon-particle ${
                  injectEve
                    ? 'bg-rose-400 shadow-[0_0_12px_#f43f5e]'
                    : 'bg-cyan-300 shadow-[0_0_12px_#22d3ee]'
                }`}
              ></div>
            )}

            {/* Eve Interception Node (If Active) */}
            {injectEve && (
              <div className="absolute z-10 flex flex-col items-center animate-pulse">
                <div className="w-7 h-7 rounded-full bg-rose-600/90 border-2 border-rose-400 text-white flex items-center justify-center text-xs font-bold shadow-[0_0_15px_#f43f5e]">
                  👁
                </div>
                <span className="text-[9px] font-mono font-bold bg-rose-950/90 text-rose-300 px-1 rounded mt-0.5 border border-rose-800">
                  EVE TAPPING
                </span>
              </div>
            )}
          </div>

          {/* Telemetry Pills for this specific round */}
          <div className="mt-2 text-center w-full">
            {isKeyRound && !isDiscarded && (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 text-[10px] font-mono font-bold shadow-[0_0_10px_rgba(16,185,129,0.3)]">
                <span>✓</span> BASES MATCH: KEY SIFTED
              </div>
            )}
            {isDiscarded && (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-950/80 border border-rose-500/50 text-rose-300 text-[10px] font-mono font-bold shadow-[0_0_10px_rgba(244,63,94,0.3)]">
                <span>✗</span> PERTURBED: ROUND DISCARDED
              </div>
            )}
            {!isKeyRound && !isDiscarded && (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-950/80 border border-purple-500/50 text-purple-300 text-[10px] font-mono font-bold">
                <span>⚖</span> CHSH BELL TEST ROUND
              </div>
            )}
          </div>
        </div>

        {/* Site B (Bob) */}
        <div className="lg:col-span-4 bg-slate-950/90 border border-emerald-500/30 rounded-xl p-4 shadow-lg shadow-emerald-950/20 relative overflow-hidden group hover:border-emerald-500/60 transition-all">
          <div className="absolute top-0 left-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none"></div>

          <div className="flex justify-between items-start mb-3">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-400 font-bold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                RECEIVER TERMINAL
              </span>
              <h4 className="text-sm font-bold text-white mt-0.5">{siteB}</h4>
              <span className="text-[11px] text-slate-500 font-mono">Node ID: BOB-RX-02</span>
            </div>

            {/* Polarizer Angle Dial */}
            <div className="relative w-11 h-11 rounded-full border border-emerald-500/40 bg-slate-900 flex items-center justify-center">
              <div
                className="w-8 h-0.5 bg-emerald-400 transition-transform duration-300 rounded shadow-[0_0_8px_#34d399]"
                style={{ transform: `rotate(${bobAngle}deg)` }}
              ></div>
              <span className="absolute text-[8px] font-mono text-emerald-300 font-bold bottom-0.5">
                {bobAngle}°
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-800/80 text-xs font-mono">
            <div className="bg-slate-900/80 p-2 rounded border border-slate-800">
              <span className="text-slate-500 text-[10px] block">Basis Selected</span>
              <span className="text-emerald-300 font-bold text-xs">{currentRound?.bob_basis || 'b1 (45°)'}</span>
            </div>
            <div className="bg-slate-900/80 p-2 rounded border border-slate-800">
              <span className="text-slate-500 text-[10px] block">Measurement Outcome</span>
              <span className="text-white font-bold text-xs">
                {currentRound?.bob_bit !== undefined ? (
                  <span className="text-emerald-400 text-sm">Bit: {currentRound.bob_bit}</span>
                ) : (
                  <span className="text-slate-500">—</span>
                )}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
