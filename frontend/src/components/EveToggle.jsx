import React from 'react';

/**
 * EveToggle Component:
 * Controls the simulated eavesdropper intercept-resend attack on Bob's quantum channel.
 */
export default function EveToggle({ injectEve, onToggle, disabled = false }) {
  return (
    <div className={`p-4 rounded-xl border transition-all ${
      injectEve
        ? 'bg-rose-950/30 border-rose-600/60 shadow-lg shadow-rose-950/50'
        : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
    }`}>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg ${
            injectEve ? 'bg-rose-500/20 text-rose-400' : 'bg-slate-800 text-slate-400'
          }`}>
            {injectEve ? '⚠️' : '🛡️'}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-white">
                Simulated Eavesdropper (Eve)
              </span>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded uppercase font-semibold ${
                injectEve ? 'bg-rose-500/30 text-rose-300' : 'bg-slate-800 text-slate-400'
              }`}>
                {injectEve ? 'ACTIVE / INTERCEPT-RESEND' : 'INACTIVE'}
              </span>
            </div>

            <p className="text-xs text-slate-400 mt-1 max-w-md">
              {injectEve
                ? 'Eve will intercept Bob’s qubit, measure in random bases, collapse entanglement, and introduce high QBER (> 11%) and Bell inequality breakdown (S < 2.0).'
                : 'Photons traverse the quantum channel undisturbed. Bell inequality is maximally violated (S ≈ 2.82) with minimal error.'}
            </p>
          </div>
        </div>

        {/* Toggle switch */}
        <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
          <input
            type="checkbox"
            checked={injectEve}
            disabled={disabled}
            onChange={(e) => onToggle(e.target.checked)}
            className="sr-only peer"
          />
          <div className={`w-12 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all ${
            disabled ? 'opacity-50 cursor-not-allowed' : ''
          } ${
            injectEve ? 'peer-checked:bg-rose-600' : 'peer-checked:bg-cyan-600'
          }`}></div>
        </label>
      </div>
    </div>
  );
}

