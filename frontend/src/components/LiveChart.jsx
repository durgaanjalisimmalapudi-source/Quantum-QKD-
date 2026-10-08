import React, { useState } from 'react';

/**
 * LiveChart Component:
 * Real-Time Bell Inequality (CHSH S-statistic) & Quantum Bit Error Rate (QBER) Visualizer.
 * Streams every single quantum round dynamically.
 */
export default function LiveChart({ rounds = [], currentRound = null }) {
  const [hoveredIndex, setHoveredIndex] = useState(null);

  // Take recent 100 rounds for clean, crisp visualization
  const displayRounds = rounds.slice(-100);

  const width = 720;
  const heightCHSH = 170;
  const heightQBER = 140;
  const padding = { top: 25, right: 35, bottom: 25, left: 50 };

  // Scale for CHSH S (1.0 to 3.2)
  const minS = 1.0;
  const maxS = 3.2;
  const getY_CHSH = (val) => {
    const clamped = Math.max(minS, Math.min(maxS, val));
    return heightCHSH - padding.bottom - ((clamped - minS) / (maxS - minS)) * (heightCHSH - padding.top - padding.bottom);
  };

  // Scale for QBER (0.0 to 0.45)
  const minQ = 0.0;
  const maxQ = 0.45;
  const getY_QBER = (val) => {
    const clamped = Math.max(minQ, Math.min(maxQ, val));
    return heightQBER - padding.bottom - ((clamped - minQ) / (maxQ - minQ)) * (heightQBER - padding.top - padding.bottom);
  };

  const getX = (idx, total) => {
    if (total <= 1) return padding.left;
    return padding.left + (idx / (total - 1)) * (width - padding.left - padding.right);
  };

  // SVG Paths
  const chshPoints = displayRounds.map((r, i) => `${getX(i, displayRounds.length)},${getY_CHSH(r.chsh_s)}`);
  const chshPath = chshPoints.length > 0 ? `M ${chshPoints.join(' L ')}` : '';

  const qberPoints = displayRounds.map((r, i) => `${getX(i, displayRounds.length)},${getY_QBER(r.qber)}`);
  const qberPath = qberPoints.length > 0 ? `M ${qberPoints.join(' L ')}` : '';

  // Critical threshold lines
  const yS_quantumMax = getY_CHSH(2.8284);
  const yS_classicalLimit = getY_CHSH(2.0);
  const yQ_threshold = getY_QBER(0.11);

  const activeData = hoveredIndex !== null && displayRounds[hoveredIndex] ? displayRounds[hoveredIndex] : currentRound;

  // Quantum violation margin
  const sValue = currentRound?.chsh_s ?? 2.8284;
  const violationMargin = sValue - 2.0;

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-2xl backdrop-blur-md">
      {/* Chart Header with Telemetry Badges */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
            📈
          </div>
          <div>
            <h3 className="text-sm font-bold text-white tracking-wide flex items-center gap-2">
              Bell Inequality & Error Rate Telemetry
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
            </h3>
            <p className="text-[11px] text-slate-400">
              Per-round computation of CHSH Bell parameter <span className="font-mono text-cyan-300">S</span> and quantum bit error rate
            </p>
          </div>
        </div>

        {/* Live Gauges */}
        <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
          <div className="bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 flex items-center gap-2">
            <span className="text-slate-500">Round:</span>
            <span className="text-white font-bold">{currentRound?.round_num ?? rounds.length}</span>
          </div>

          <div className={`px-3 py-1.5 rounded-lg border flex items-center gap-2 ${
            sValue >= 2.0
              ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300'
              : 'bg-rose-950/60 border-rose-500/50 text-rose-300'
          }`}>
            <span className="text-slate-400">CHSH S:</span>
            <span className="font-bold text-sm">{sValue.toFixed(4)}</span>
            <span className="text-[10px] opacity-80">
              {violationMargin >= 0 ? `(+${violationMargin.toFixed(3)})` : `(${violationMargin.toFixed(3)})`}
            </span>
          </div>

          <div className={`px-3 py-1.5 rounded-lg border flex items-center gap-2 ${
            (currentRound?.qber ?? 0.0) <= 0.11
              ? 'bg-cyan-950/60 border-cyan-500/50 text-cyan-300'
              : 'bg-rose-950/60 border-rose-500/50 text-rose-300'
          }`}>
            <span className="text-slate-400">QBER:</span>
            <span className="font-bold text-sm">{((currentRound?.qber ?? 0.0) * 100).toFixed(2)}%</span>
          </div>
        </div>
      </div>

      {/* CHSH Graph (S Parameter) */}
      <div className="mb-5">
        <div className="flex justify-between items-center text-xs mb-1.5">
          <span className="font-semibold text-cyan-300 flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee]"></span>
            CHSH Correlation Parameter (S = |E₁₁ - E₁₃ + E₃₁ + E₃₃|)
          </span>
          <div className="flex items-center gap-3 text-[11px] font-mono text-slate-400">
            <span className="text-cyan-400 flex items-center gap-1">
              <span className="w-2 h-0.5 bg-cyan-400 inline-block"></span> 2√2 ≈ 2.8284 (Quantum Limit)
            </span>
            <span className="text-amber-400 flex items-center gap-1">
              <span className="w-2 h-0.5 bg-amber-400 inline-block"></span> S = 2.0 (Bell Bound)
            </span>
          </div>
        </div>

        <div className="relative w-full bg-slate-950 border border-slate-800 rounded-xl overflow-hidden p-1 shadow-inner">
          <svg viewBox={`0 0 ${width} ${heightCHSH}`} className="w-full h-44">
            <defs>
              <linearGradient id="chshGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.0" />
              </linearGradient>
              <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* Shaded Quantum Violation Zone (S > 2.0) */}
            <rect
              x={padding.left}
              y={padding.top}
              width={width - padding.left - padding.right}
              height={Math.max(0, yS_classicalLimit - padding.top)}
              fill="rgba(6, 182, 212, 0.04)"
            />

            {/* Reference Line: 2.8284 (Tsirelson's Quantum Maximum) */}
            <line
              x1={padding.left}
              y1={yS_quantumMax}
              x2={width - padding.right}
              y2={yS_quantumMax}
              stroke="#06b6d4"
              strokeDasharray="4 4"
              strokeWidth="1.2"
              opacity="0.7"
            />
            <text x={width - padding.right - 5} y={yS_quantumMax - 4} fill="#06b6d4" fontSize="9" textAnchor="end" fontFamily="monospace">
              Tsirelson's Bound (2.8284)
            </text>

            {/* Reference Line: 2.0 (Classical Local-Realism Threshold) */}
            <line
              x1={padding.left}
              y1={yS_classicalLimit}
              x2={width - padding.right}
              y2={yS_classicalLimit}
              stroke="#f59e0b"
              strokeDasharray="4 4"
              strokeWidth="1.5"
            />
            <text x={width - padding.right - 5} y={yS_classicalLimit - 4} fill="#f59e0b" fontSize="9" textAnchor="end" fontFamily="monospace">
              Classical Limit S = 2.0 (Eavesdropping / Separable Bound)
            </text>

            {/* Y Axis Labels */}
            <text x={padding.left - 8} y={getY_CHSH(3.0)} fill="#64748b" fontSize="9" textAnchor="end" fontFamily="monospace">3.0</text>
            <text x={padding.left - 8} y={getY_CHSH(2.8284)} fill="#06b6d4" fontSize="9" textAnchor="end" fontFamily="monospace">2.82</text>
            <text x={padding.left - 8} y={getY_CHSH(2.0)} fill="#f59e0b" fontSize="9" textAnchor="end" fontFamily="monospace">2.00</text>
            <text x={padding.left - 8} y={getY_CHSH(1.2)} fill="#64748b" fontSize="9" textAnchor="end" fontFamily="monospace">1.20</text>

            {/* S-Curve Path */}
            {chshPath && (
              <>
                <path
                  d={chshPath}
                  fill="none"
                  stroke="#0891b2"
                  strokeWidth="5"
                  opacity="0.25"
                />
                <path
                  d={chshPath}
                  fill="none"
                  stroke="#22d3ee"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </>
            )}

            {/* Interactive Data Dots */}
            {displayRounds.map((r, i) => {
              const cx = getX(i, displayRounds.length);
              const cy = getY_CHSH(r.chsh_s);
              const isCompromised = r.chsh_s < 2.0 || r.anomaly_flagged;
              return (
                <circle
                  key={i}
                  cx={cx}
                  cy={cy}
                  r={isCompromised ? 3.5 : 2}
                  fill={isCompromised ? '#f43f5e' : '#22d3ee'}
                  stroke="#020617"
                  strokeWidth="1"
                  className="cursor-pointer transition-all hover:scale-150"
                  onMouseEnter={() => setHoveredIndex(i)}
                  onMouseLeave={() => setHoveredIndex(null)}
                />
              );
            })}
          </svg>
        </div>
      </div>

      {/* QBER Graph */}
      <div>
        <div className="flex justify-between items-center text-xs mb-1.5">
          <span className="font-semibold text-rose-300 flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-400 shadow-[0_0_8px_#f43f5e]"></span>
            Quantum Bit Error Rate (QBER on Matching Key Bases)
          </span>
          <span className="text-[11px] font-mono text-rose-400">
            Standard QKD Abort Threshold: 11.0%
          </span>
        </div>

        <div className="relative w-full bg-slate-950 border border-slate-800 rounded-xl overflow-hidden p-1 shadow-inner">
          <svg viewBox={`0 0 ${width} ${heightQBER}`} className="w-full h-36">
            {/* 11% Abort Threshold Line */}
            <line
              x1={padding.left}
              y1={yQ_threshold}
              x2={width - padding.right}
              y2={yQ_threshold}
              stroke="#f43f5e"
              strokeDasharray="4 4"
              strokeWidth="1.5"
            />
            <text x={width - padding.right - 5} y={yQ_threshold - 4} fill="#f43f5e" fontSize="9" textAnchor="end" fontFamily="monospace">
              Abort Limit: 11%
            </text>

            {/* Y Axis Labels */}
            <text x={padding.left - 8} y={getY_QBER(0.40)} fill="#64748b" fontSize="9" textAnchor="end" fontFamily="monospace">40%</text>
            <text x={padding.left - 8} y={getY_QBER(0.25)} fill="#64748b" fontSize="9" textAnchor="end" fontFamily="monospace">25%</text>
            <text x={padding.left - 8} y={getY_QBER(0.11)} fill="#f43f5e" fontSize="9" textAnchor="end" fontFamily="monospace">11%</text>
            <text x={padding.left - 8} y={getY_QBER(0.0)} fill="#64748b" fontSize="9" textAnchor="end" fontFamily="monospace">0%</text>

            {/* QBER Curve */}
            {qberPath && (
              <>
                <path
                  d={qberPath}
                  fill="none"
                  stroke="#e11d48"
                  strokeWidth="5"
                  opacity="0.25"
                />
                <path
                  d={qberPath}
                  fill="none"
                  stroke="#fb7185"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </>
            )}

            {/* Data Dots */}
            {displayRounds.map((r, i) => {
              const cx = getX(i, displayRounds.length);
              const cy = getY_QBER(r.qber);
              const isHigh = r.qber > 0.11 || r.anomaly_flagged;
              return (
                <circle
                  key={i}
                  cx={cx}
                  cy={cy}
                  r={isHigh ? 3.5 : 2}
                  fill={isHigh ? '#f43f5e' : '#fb7185'}
                  stroke="#020617"
                  strokeWidth="1"
                  className="cursor-pointer transition-all hover:scale-150"
                  onMouseEnter={() => setHoveredIndex(i)}
                  onMouseLeave={() => setHoveredIndex(null)}
                />
              );
            })}
          </svg>
        </div>
      </div>

      {/* Live Inspector Strip */}
      {activeData && (
        <div className="mt-4 p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono flex flex-wrap items-center justify-between gap-3 text-slate-300 shadow-md">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
            <span className="text-slate-500">Inspecting Round:</span>
            <span className="text-white font-bold">#{activeData.round_num}</span>
          </div>

          <div>
            <span className="text-slate-500">Alice:</span>{' '}
            <span className="text-cyan-400 font-semibold">{activeData.alice_basis}</span>
            <span className="text-slate-600 mx-1.5">vs</span>
            <span className="text-slate-500">Bob:</span>{' '}
            <span className="text-emerald-400 font-semibold">{activeData.bob_basis}</span>
          </div>

          <div>
            <span className="text-slate-500">Protocol Action:</span>{' '}
            <span className={activeData.discarded ? 'text-rose-400 font-bold' : 'text-emerald-400 font-bold'}>
              {activeData.discarded ? 'DISCARDED (Compromised / Perturbed)' : 'SIFTED (Valid Key Material)'}
            </span>
          </div>

          {activeData.reason && activeData.reason !== 'Normal quantum transmission' && (
            <div className="w-full text-[11px] text-rose-300 bg-rose-950/40 border border-rose-900/60 p-1.5 rounded">
              Trigger: {activeData.reason}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
