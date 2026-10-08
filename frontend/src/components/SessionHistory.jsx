import React, { useEffect, useState } from 'react';
import { getSessionHistory } from '../services/api';

/**
 * SessionHistory Component:
 * Lists historical QKD sessions from PostgreSQL database.
 */
export default function SessionHistory({ onSelectSession, currentSessionId }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchHistory = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getSessionHistory();
      setSessions(data.sessions || []);
    } catch (err) {
      setError(err.message || 'Failed to load session history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-xl backdrop-blur-md">
      <div className="flex items-center justify-between gap-3 mb-4 border-b border-slate-800/80 pb-3">
        <div>
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <span>📜</span> PostgreSQL Session Audit & Security Logs
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Archived sessions, quantum parameter convergence, and eavesdropping audit history
          </p>
        </div>

        <button
          onClick={fetchHistory}
          disabled={loading}
          className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded transition flex items-center gap-1.5"
        >
          {loading ? 'Refreshing...' : '🔄 Refresh Log'}
        </button>
      </div>

      {error && (
        <div className="mb-3 text-xs text-rose-400 bg-rose-950/40 border border-rose-800 p-2 rounded">
          {error}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs font-mono">
          <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 text-[11px] uppercase">
            <tr>
              <th className="py-2.5 px-3">Session ID</th>
              <th className="py-2.5 px-3">Sites</th>
              <th className="py-2.5 px-3">Eve Injected</th>
              <th className="py-2.5 px-3">Status</th>
              <th className="py-2.5 px-3">Final QBER</th>
              <th className="py-2.5 px-3">Final CHSH (S)</th>
              <th className="py-2.5 px-3">Key Bits</th>
              <th className="py-2.5 px-3">Started</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-800/60">
            {sessions.length === 0 ? (
              <tr>
                <td colSpan="8" className="py-6 text-center text-slate-500 font-sans">
                  {loading ? 'Loading sessions...' : 'No past sessions recorded in PostgreSQL yet.'}
                </td>
              </tr>
            ) : (
              sessions.map((s) => {
                const isSelected = s.id === currentSessionId;
                const isAborted = s.status === 'aborted';
                const isKeyReady = s.status === 'key_ready';

                return (
                  <tr
                    key={s.id}
                    onClick={() => onSelectSession && onSelectSession(s.id)}
                    className={`cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-cyan-950/30 text-white'
                        : 'hover:bg-slate-800/40 text-slate-300'
                    }`}
                  >
                    <td className="py-2.5 px-3 text-[11px] text-cyan-300 font-bold">
                      {s.id.slice(0, 8)}...
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="text-white">{s.site_a_name}</span>
                      <span className="text-slate-500 mx-1">➔</span>
                      <span className="text-white">{s.site_b_name}</span>
                    </td>
                    <td className="py-2.5 px-3">
                      {s.inject_eve ? (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-rose-950 border border-rose-600/40 text-rose-300 font-semibold">
                          YES (Eve)
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300">
                          NO
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        isKeyReady
                          ? 'bg-emerald-950 border border-emerald-500/40 text-emerald-300'
                          : isAborted
                          ? 'bg-rose-950 border border-rose-500/40 text-rose-300'
                          : 'bg-slate-800 text-slate-300'
                      }`}>
                        {s.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      {s.final_qber !== null ? (
                        <span className={Number(s.final_qber) > 0.11 ? 'text-rose-400 font-bold' : 'text-slate-200'}>
                          {(Number(s.final_qber) * 100).toFixed(2)}%
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      {s.final_chsh_s !== null ? (
                        <span className={Number(s.final_chsh_s) < 2.0 ? 'text-rose-400 font-bold' : 'text-emerald-400'}>
                          {Number(s.final_chsh_s).toFixed(4)}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      {s.key_length_bits ?? 0}
                    </td>
                    <td className="py-2.5 px-3 text-[10px] text-slate-400">
                      {new Date(s.started_at).toLocaleDateString()} {new Date(s.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

