import React, { useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

/**
 * RealChart Component:
 * Production-grade HTML5 Canvas graphs powered by Chart.js.
 * Renders real Bell inequality CHSH S-statistic and QBER with actual axes,
 * grid lines, crosshairs, and live points.
 */
export default function RealChart({ rounds = [], currentRound = null }) {
  const [activeMetric, setActiveMetric] = useState('both'); // 'both' | 'chsh' | 'qber'

  // Take recent 50 rounds for smooth, readable real-time plotting
  const sample = rounds.slice(-50);
  const labels = sample.map((r) => `R${r.round_num}`);

  const chshData = sample.map((r) => r.chsh_s);
  const qberData = sample.map((r) => Number((r.qber * 100).toFixed(2)));

  // CHSH Chart configuration
  const chshChartData = {
    labels,
    datasets: [
      {
        label: 'CHSH S-statistic',
        data: chshData,
        borderColor: '#00d2d3',
        backgroundColor: 'rgba(0, 210, 211, 0.08)',
        fill: true,
        tension: 0.35,
        borderWidth: 2.5,
        pointRadius: sample.length > 30 ? 2 : 3.5,
        pointHoverRadius: 6,
        pointBackgroundColor: sample.map((r) => (r.chsh_s < 2.0 || r.anomaly_flagged ? '#ea4335' : '#00d2d3')),
        pointBorderColor: '#0b141a',
      },
      {
        label: 'Classical Bound (S = 2.0)',
        data: Array(sample.length).fill(2.0),
        borderColor: '#f59e0b',
        borderWidth: 1.5,
        borderDash: [5, 5],
        pointRadius: 0,
        fill: false,
      },
      {
        label: 'Quantum Max (2√2 ≈ 2.83)',
        data: Array(sample.length).fill(2.8284),
        borderColor: '#a855f7',
        borderWidth: 1.2,
        borderDash: [3, 3],
        pointRadius: 0,
        fill: false,
      },
    ],
  };

  const chshOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 300 },
    scales: {
      x: {
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: { color: '#8696a0', font: { family: 'monospace', size: 9 }, maxTicksLimit: 10 },
      },
      y: {
        min: 1.0,
        max: 3.2,
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: { color: '#8696a0', font: { family: 'monospace', size: 10 }, stepSize: 0.4 },
      },
    },
    plugins: {
      legend: {
        position: 'top',
        labels: { color: '#e9edef', font: { size: 10, family: 'sans-serif' }, boxWidth: 12, usePointStyle: true },
      },
      tooltip: {
        backgroundColor: '#111b21',
        titleColor: '#00d2d3',
        bodyColor: '#e9edef',
        borderColor: '#222d34',
        borderWidth: 1,
        padding: 10,
        callbacks: {
          label: (ctx) => ` ${ctx.dataset.label}: ${Number(ctx.parsed.y).toFixed(4)}`,
        },
      },
    },
  };

  // QBER Chart configuration
  const qberChartData = {
    labels,
    datasets: [
      {
        label: 'QBER Error Rate (%)',
        data: qberData,
        borderColor: '#ea4335',
        backgroundColor: 'rgba(234, 67, 53, 0.08)',
        fill: true,
        tension: 0.35,
        borderWidth: 2.5,
        pointRadius: sample.length > 30 ? 2 : 3.5,
        pointHoverRadius: 6,
        pointBackgroundColor: sample.map((r) => (r.qber > 0.11 || r.anomaly_flagged ? '#ea4335' : '#34d399')),
        pointBorderColor: '#0b141a',
      },
      {
        label: 'Abort Limit (11%)',
        data: Array(sample.length).fill(11.0),
        borderColor: '#ea4335',
        borderWidth: 1.5,
        borderDash: [5, 5],
        pointRadius: 0,
        fill: false,
      },
    ],
  };

  const qberOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 300 },
    scales: {
      x: {
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: { color: '#8696a0', font: { family: 'monospace', size: 9 }, maxTicksLimit: 10 },
      },
      y: {
        min: 0,
        max: 40,
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: {
          color: '#8696a0',
          font: { family: 'monospace', size: 10 },
          callback: (val) => `${val}%`,
          stepSize: 10,
        },
      },
    },
    plugins: {
      legend: {
        position: 'top',
        labels: { color: '#e9edef', font: { size: 10, family: 'sans-serif' }, boxWidth: 12, usePointStyle: true },
      },
      tooltip: {
        backgroundColor: '#111b21',
        titleColor: '#ea4335',
        bodyColor: '#e9edef',
        borderColor: '#222d34',
        borderWidth: 1,
        padding: 10,
        callbacks: {
          label: (ctx) => ` ${ctx.dataset.label}: ${Number(ctx.parsed.y).toFixed(2)}%`,
        },
      },
    },
  };

  return (
    <div className="space-y-4">
      {/* Metric Selector Tabs */}
      <div className="flex items-center justify-between border-b border-[#222d34] pb-2">
        <span className="text-xs font-semibold text-[#8696a0] uppercase tracking-wider">
          Real Canvas Telemetry ({sample.length} rounds)
        </span>
        <div className="flex items-center gap-1 bg-[#111b21] p-1 rounded-lg border border-[#222d34] text-xs">
          <button
            onClick={() => setActiveMetric('both')}
            className={`px-2.5 py-1 rounded-md transition font-medium ${
              activeMetric === 'both' ? 'bg-[#00a884] text-white' : 'text-[#8696a0] hover:text-white'
            }`}
          >
            Dual View
          </button>
          <button
            onClick={() => setActiveMetric('chsh')}
            className={`px-2.5 py-1 rounded-md transition font-medium ${
              activeMetric === 'chsh' ? 'bg-[#00a884] text-white' : 'text-[#8696a0] hover:text-white'
            }`}
          >
            CHSH (S)
          </button>
          <button
            onClick={() => setActiveMetric('qber')}
            className={`px-2.5 py-1 rounded-md transition font-medium ${
              activeMetric === 'qber' ? 'bg-[#00a884] text-white' : 'text-[#8696a0] hover:text-white'
            }`}
          >
            QBER (%)
          </button>
        </div>
      </div>

      {/* CHSH Canvas Graph */}
      {(activeMetric === 'both' || activeMetric === 'chsh') && (
        <div className="bg-[#111b21] border border-[#222d34] rounded-xl p-3 shadow-md">
          <div className="flex justify-between items-center mb-1 text-xs">
            <span className="font-semibold text-[#e9edef]">Bell CHSH Correlation (S)</span>
            <span className="font-mono text-[11px] text-[#00d2d3]">
              Current: {(currentRound?.chsh_s ?? 2.828).toFixed(4)}
            </span>
          </div>
          <div className="h-44 w-full">
            {sample.length > 0 ? (
              <Line data={chshChartData} options={chshOptions} />
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-[#8696a0]">
                Awaiting quantum round transmission data...
              </div>
            )}
          </div>
        </div>
      )}

      {/* QBER Canvas Graph */}
      {(activeMetric === 'both' || activeMetric === 'qber') && (
        <div className="bg-[#111b21] border border-[#222d34] rounded-xl p-3 shadow-md">
          <div className="flex justify-between items-center mb-1 text-xs">
            <span className="font-semibold text-[#e9edef]">Quantum Bit Error Rate (QBER)</span>
            <span className="font-mono text-[11px] text-[#ea4335]">
              Current: {((currentRound?.qber ?? 0.0) * 100).toFixed(2)}%
            </span>
          </div>
          <div className="h-40 w-full">
            {sample.length > 0 ? (
              <Line data={qberChartData} options={qberOptions} />
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-[#8696a0]">
                Awaiting quantum round transmission data...
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

