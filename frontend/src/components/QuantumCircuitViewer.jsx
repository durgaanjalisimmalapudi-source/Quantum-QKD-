import React, { useMemo } from 'react';

/**
 * QuantumCircuitViewer Component:
 * Real-time Qiskit-style Quantum Circuit Diagram for E91 QKD protocol.
 * 
 * Visualizes:
 * - Qubit Wire q0 (Alice / Source): |0⟩ -> H -> CNOT Control -> Ry(-θ_A) -> Measure -> c0
 * - Qubit Wire q1 (Bob / Receiver): |0⟩ --------> CNOT Target  -> [Eve Tap] -> Ry(-θ_B) -> Measure -> c1
 * - Live animated photon packet pulses traveling along wires in real time
 * - Live basis rotations, measurement bit outcomes, and key sifting verdicts.
 */
export default function QuantumCircuitViewer({
  currentRound = null,
  sessionStatus = 'idle',
  injectEve = false,
  compact = false,
}) {
  const isRunning = sessionStatus === 'running';

  // Extract active round parameters or fall back to nominal defaults
  const roundNum = currentRound?.round_num ?? 0;
  const aliceBasis = currentRound?.alice_basis ?? 'a1 (0°)';
  const bobBasis = currentRound?.bob_basis ?? 'b1 (45°)';
  const aliceBit = currentRound?.alice_bit ?? 0;
  const bobBit = currentRound?.bob_bit ?? 0;
  const isKeyRound = currentRound?.is_key_round ?? false;
  const isChshRound = currentRound?.is_chsh_round ?? true;
  const isDiscarded = currentRound?.discarded ?? false;
  const anomalyFlagged = currentRound?.anomaly_flagged ?? false;
  const eveIntercepted = currentRound?.eve_intercepted ?? injectEve;
  const eveAngleDeg = currentRound?.eve_angle_deg ?? (injectEve ? 45 : null);
  const eveBit = currentRound?.eve_bit ?? null;

  // Sifting verdict pill styling
  const verdict = useMemo(() => {
    if (!currentRound) {
      return {
        text: 'Standby: Quantum circuit initialized and awaiting photon pairs',
        color: 'text-[#8696a0]',
        bg: 'bg-[#111b21] border-[#222d34]',
      };
    }
    if (anomalyFlagged || (eveIntercepted && isDiscarded)) {
      return {
        text: '🚨 EVE ANOMALY: Bell state perturbed. Discarded to preserve security.',
        color: 'text-[#ea4335]',
        bg: 'bg-[#ea4335]/15 border-[#ea4335]/40',
      };
    }
    if (isKeyRound && !isDiscarded) {
      return {
        text: `✅ SIFTED KEY BIT: Alice (${aliceBit}) = Bob (${bobBit}) · Identical basis match`,
        color: 'text-[#00a884]',
        bg: 'bg-[#00a884]/15 border-[#00a884]/40',
      };
    }
    if (isChshRound) {
      return {
        text: `🔬 CHSH TEST: Correlation sample ⟨A,B⟩ measured for Bell inequality (S > 2.0)`,
        color: 'text-[#00d2d3]',
        bg: 'bg-[#00d2d3]/15 border-[#00d2d3]/40',
      };
    }
    return {
      text: 'Bases uncorrelated. Discarded per E91 protocol rule.',
      color: 'text-[#8696a0]',
      bg: 'bg-[#111b21] border-[#222d34]',
    };
  }, [currentRound, anomalyFlagged, eveIntercepted, isDiscarded, isKeyRound, aliceBit, bobBit, isChshRound]);

  return (
    <div className={`bg-[#0b141a] border border-[#222d34] rounded-xl p-3.5 sm:p-4 text-white font-mono shadow-inner ${
      compact ? 'text-xs' : 'text-xs sm:text-sm'
    }`}>
      {/* Header with Live Status & Qiskit Brand */}
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#222d34] text-[11px]">
        <div className="flex items-center gap-2 font-bold text-[#e9edef]">
          <span className={`w-2 h-2 rounded-full ${
            isRunning ? 'bg-[#00d2d3] animate-ping' : sessionStatus === 'key_ready' ? 'bg-[#00a884]' : 'bg-[#f59e0b]'
          }`}></span>
          <span className="tracking-wide">QUANTUM CIRCUIT (E91 BELL STATE)</span>
        </div>

        <div className="flex items-center gap-2">
          {isRunning && (
            <span className="px-2 py-0.5 rounded bg-[#00d2d3]/20 text-[#00d2d3] font-bold text-[10px] animate-pulse">
              LIVE ROUND #{roundNum}
            </span>
          )}
          <span className="text-[#8696a0] text-[10px]">Qiskit 2-Qubit System</span>
        </div>
      </div>

      {/* Circuit Diagram SVG Canvas */}
      <div className="relative overflow-x-auto py-2">
        <svg
          viewBox="0 0 620 180"
          className="w-full min-w-[560px] h-auto select-none overflow-visible"
        >
          <defs>
            {/* Animated Laser Photon Pulse for Wire 0 (Alice) */}
            <linearGradient id="alicePhotonBeam" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#00d2d3" stopOpacity="0" />
              <stop offset="50%" stopColor="#00d2d3" stopOpacity="1" />
              <stop offset="100%" stopColor="#25d366" stopOpacity="0" />
            </linearGradient>

            {/* Animated Laser Photon Pulse for Wire 1 (Bob) */}
            <linearGradient id="bobPhotonBeam" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#ffd279" stopOpacity="0" />
              <stop offset="50%" stopColor={eveIntercepted ? "#ea4335" : "#00d2d3"} stopOpacity="1" />
              <stop offset="100%" stopColor="#25d366" stopOpacity="0" />
            </linearGradient>

            {/* Glowing filter */}
            <filter id="circuitGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* ============================================================ */}
          {/* WIRE LABELS & BASE WIRES                                     */}
          {/* ============================================================ */}

          {/* Wire 0 (Alice) */}
          <text x="15" y="45" fill="#8696a0" fontSize="12" fontWeight="bold">q₀: |0⟩</text>
          <line x1="65" y1="40" x2="550" y2="40" stroke="#374151" strokeWidth="2" strokeDasharray={isRunning ? "4 2" : "none"} />

          {/* Wire 1 (Bob) */}
          <text x="15" y="115" fill="#8696a0" fontSize="12" fontWeight="bold">q₁: |0⟩</text>
          <line x1="65" y1="110" x2="550" y2="110" stroke="#374151" strokeWidth="2" strokeDasharray={isRunning ? "4 2" : "none"} />

          {/* Classical Readout Double Wire c */}
          <line x1="65" y1="158" x2="580" y2="158" stroke="#222d34" strokeWidth="1.5" />
          <line x1="65" y1="162" x2="580" y2="162" stroke="#222d34" strokeWidth="1.5" />
          <text x="15" y="163" fill="#64748b" fontSize="10">c: /2</text>

          {/* Animated Photon Pulses on wires when running */}
          {isRunning && (
            <>
              <line
                x1="65"
                y1="40"
                x2="550"
                y2="40"
                stroke="url(#alicePhotonBeam)"
                strokeWidth="4"
                className="animate-pulse"
                filter="url(#circuitGlow)"
              />
              <line
                x1="65"
                y1="110"
                x2="550"
                y2="110"
                stroke="url(#bobPhotonBeam)"
                strokeWidth="4"
                className="animate-pulse"
                filter="url(#circuitGlow)"
              />
            </>
          )}

          {/* ============================================================ */}
          {/* STAGE 1: BELL STATE PREPARATION |Φ⁺⟩ = (|00⟩ + |11⟩)/√2     */}
          {/* ============================================================ */}

          {/* Hadamard Gate H on q0 */}
          <g transform="translate(85, 23)">
            <rect
              width="34"
              height="34"
              rx="6"
              fill="#1e293b"
              stroke="#00d2d3"
              strokeWidth="1.5"
              className={isRunning ? "filter drop-shadow-[0_0_6px_rgba(0,210,211,0.5)]" : ""}
            />
            <text x="17" y="22" fill="#00d2d3" fontSize="14" fontWeight="bold" textAnchor="middle">H</text>
          </g>

          {/* CNOT Entangler: Control • on q0, Target ⊕ on q1 */}
          <g transform="translate(150, 40)">
            {/* Vertical Entanglement Bus */}
            <line x1="0" y1="0" x2="0" y2="70" stroke="#00a884" strokeWidth="2" strokeDasharray="2 2" />
            
            {/* Control Point */}
            <circle cx="0" cy="0" r="5" fill="#00a884" />

            {/* Target ⊕ */}
            <circle cx="0" cy="70" r="12" fill="#1e293b" stroke="#00a884" strokeWidth="2" />
            <line x1="-12" y1="70" x2="12" y2="70" stroke="#00a884" strokeWidth="2" />
            <line x1="0" y1="58" x2="0" y2="82" stroke="#00a884" strokeWidth="2" />

            {/* Bell State Tag */}
            <text x="0" y="-12" fill="#00a884" fontSize="9" fontWeight="bold" textAnchor="middle">
              EPR |Φ⁺⟩
            </text>
          </g>

          {/* ============================================================ */}
          {/* STAGE 2: TRANSMISSION CHANNEL / EVE INTERCEPTION              */}
          {/* ============================================================ */}

          {/* Optical Link Channel Separator */}
          <g transform="translate(195, 10)">
            <rect x="0" y="0" width="120" height="135" fill="none" stroke="#222d34" strokeDasharray="3 3" rx="8" />
            <text x="60" y="-3" fill="#64748b" fontSize="8" textAnchor="middle" letterSpacing="1">
              OPTICAL QUANTUM LINK
            </text>
          </g>

          {/* If Eve is active: Intercept-Resend Tap on q1 channel */}
          {eveIntercepted ? (
            <g transform="translate(205, 93)">
              <rect
                width="100"
                height="34"
                rx="6"
                fill="#450a0a"
                stroke="#ea4335"
                strokeWidth="1.5"
                className="animate-pulse"
                filter="url(#circuitGlow)"
              />
              <text x="50" y="16" fill="#fca5a5" fontSize="10" fontWeight="bold" textAnchor="middle">
                👁️ EVE: Ry({eveAngleDeg ?? 45}°)
              </text>
              <text x="50" y="27" fill="#f87171" fontSize="8" textAnchor="middle">
                Intercept & Resend
              </text>
            </g>
          ) : (
            <g transform="translate(255, 110)">
              <circle cx="0" cy="0" r="3" fill="#00d2d3" />
              <text x="0" y="16" fill="#00a884" fontSize="8" textAnchor="middle">
                Free-Space Link
              </text>
            </g>
          )}

          {/* ============================================================ */}
          {/* STAGE 3: MEASUREMENT BASIS ROTATIONS Ry(-θ)                  */}
          {/* ============================================================ */}

          {/* Alice's Rotation Gate Ry(-θA) on q0 */}
          <g transform="translate(345, 23)">
            <rect
              width="82"
              height="34"
              rx="6"
              fill="#1e293b"
              stroke="#00d2d3"
              strokeWidth="1.5"
              className={isRunning ? "filter drop-shadow-[0_0_6px_rgba(0,210,211,0.4)]" : ""}
            />
            <text x="41" y="16" fill="#00d2d3" fontSize="11" fontWeight="bold" textAnchor="middle">
              Ry(-θ_A)
            </text>
            <text x="41" y="28" fill="#e9edef" fontSize="9" fontWeight="bold" textAnchor="middle">
              {aliceBasis}
            </text>
          </g>

          {/* Bob's Rotation Gate Ry(-θB) on q1 */}
          <g transform="translate(345, 93)">
            <rect
              width="82"
              height="34"
              rx="6"
              fill="#1e293b"
              stroke="#00a884"
              strokeWidth="1.5"
              className={isRunning ? "filter drop-shadow-[0_0_6px_rgba(0,168,132,0.4)]" : ""}
            />
            <text x="41" y="16" fill="#00a884" fontSize="11" fontWeight="bold" textAnchor="middle">
              Ry(-θ_B)
            </text>
            <text x="41" y="28" fill="#e9edef" fontSize="9" fontWeight="bold" textAnchor="middle">
              {bobBasis}
            </text>
          </g>

          {/* ============================================================ */}
          {/* STAGE 4: MEASUREMENT DETECTORS [ M ] & OUTCOMES              */}
          {/* ============================================================ */}

          {/* Alice Detector [M_A] */}
          <g transform="translate(455, 23)">
            <rect
              width="44"
              height="34"
              rx="6"
              fill="#111827"
              stroke="#60a5fa"
              strokeWidth="1.5"
            />
            {/* Meter Icon */}
            <path d="M 12 26 A 12 12 0 0 1 32 26" stroke="#60a5fa" strokeWidth="1.5" fill="none" />
            <line x1="22" y1="26" x2="28" y2="15" stroke="#60a5fa" strokeWidth="1.5" />
            <text x="22" y="12" fill="#60a5fa" fontSize="8" fontWeight="bold" textAnchor="middle">M_A</text>

            {/* Classical Drop Line to Register c0 */}
            <line x1="22" y1="34" x2="22" y2="137" stroke="#60a5fa" strokeWidth="1.5" strokeDasharray="3 2" />
            <polygon points="19,134 22,139 25,134" fill="#60a5fa" />
          </g>

          {/* Alice Measured Bit Outcome on c0 */}
          <g transform="translate(520, 26)">
            <rect width="28" height="28" rx="6" fill="#1e293b" stroke="#60a5fa" strokeWidth="1.5" />
            <text x="14" y="19" fill="#93c5fd" fontSize="14" fontWeight="bold" textAnchor="middle">
              {aliceBit}
            </text>
            <text x="14" y="38" fill="#8696a0" fontSize="8" textAnchor="middle">bit a</text>
          </g>

          {/* Bob Detector [M_B] */}
          <g transform="translate(455, 93)">
            <rect
              width="44"
              height="34"
              rx="6"
              fill="#111827"
              stroke="#34d399"
              strokeWidth="1.5"
            />
            {/* Meter Icon */}
            <path d="M 12 26 A 12 12 0 0 1 32 26" stroke="#34d399" strokeWidth="1.5" fill="none" />
            <line x1="22" y1="26" x2="28" y2="15" stroke="#34d399" strokeWidth="1.5" />
            <text x="22" y="12" fill="#34d399" fontSize="8" fontWeight="bold" textAnchor="middle">M_B</text>

            {/* Classical Drop Line to Register c1 */}
            <line x1="22" y1="34" x2="22" y2="67" stroke="#34d399" strokeWidth="1.5" strokeDasharray="3 2" />
            <polygon points="19,64 22,69 25,64" fill="#34d399" />
          </g>

          {/* Bob Measured Bit Outcome on c1 */}
          <g transform="translate(520, 96)">
            <rect width="28" height="28" rx="6" fill="#1e293b" stroke="#34d399" strokeWidth="1.5" />
            <text x="14" y="19" fill="#86efac" fontSize="14" fontWeight="bold" textAnchor="middle">
              {bobBit}
            </text>
            <text x="14" y="38" fill="#8696a0" fontSize="8" textAnchor="middle">bit b</text>
          </g>

          {/* Classical Register Output Box */}
          <g transform="translate(558, 148)">
            <rect width="52" height="24" rx="4" fill="#1e293b" stroke="#00a884" strokeWidth="1" />
            <text x="26" y="16" fill="#00a884" fontSize="11" fontWeight="bold" textAnchor="middle">
              {aliceBit}{bobBit}₂
            </text>
          </g>
        </svg>
      </div>

      {/* Real-time Verdict Bar */}
      <div className={`mt-3 p-2.5 rounded-lg border flex items-center justify-between gap-2 text-[11px] leading-tight ${verdict.bg}`}>
        <span className={`font-medium truncate ${verdict.color}`}>
          {verdict.text}
        </span>
        <span className="font-mono text-[#8696a0] text-[10px] flex-shrink-0">
          Bell State: |Φ⁺⟩ = (|00⟩ + |11⟩)/√2
        </span>
      </div>
    </div>
  );
}

