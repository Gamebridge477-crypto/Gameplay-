import { useEffect, useState } from 'react';
import { Activity, AlertTriangle, ArrowDown, ArrowUp, Play, Wifi } from 'lucide-react';
import { apiRequest } from '../lib/api';
import { evaluateConnectionQuality } from '../shared/logic';
import type { ConnectionTestResult } from '../shared/types';

const NODES = [
  { id: 'Addis Ababa Fiber Relay', label: 'Addis Ababa / East Africa Relay', latencyOffsetMs: 0 },
  { id: 'Middle East (Bahrain / Dubai)', label: 'Middle East Game Servers (Bahrain / Dubai)', latencyOffsetMs: 42 },
  { id: 'EU West (Frankfurt)', label: 'Europe Game Servers (Frankfurt)', latencyOffsetMs: 78 },
];

export function ConnectionCheckerPage() {
  const [selectedNode, setSelectedNode] = useState(NODES[0].id);
  const [testing, setTesting] = useState(false);
  const [progressStep, setProgressStep] = useState<string | null>(null);
  const [result, setResult] = useState<ConnectionTestResult | null>(null);
  const [history, setHistory] = useState<ConnectionTestResult[]>([]);

  const loadHistory = async () => {
    try {
      const data = await apiRequest<{ history: ConnectionTestResult[] }>('/api/network/tests');
      setHistory(data.history);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const runConnectionTest = async () => {
    setTesting(true);
    setProgressStep('Measuring round-trip ping and jitter...');

    try {
      const node = NODES.find((n) => n.id === selectedNode) || NODES[0];
      const pings: number[] = [];

      for (let i = 0; i < 6; i++) {
        const start = performance.now();
        await fetch(`/api/network/ping?i=${i}&t=${Date.now()}`, { cache: 'no-store' });
        const rtt = performance.now() - start;
        pings.push(rtt);
      }

      const sorted = [...pings].sort((a, b) => a - b);
      const avgMeasured = sorted.reduce((acc, v) => acc + v, 0) / sorted.length;
      let jitterSum = 0;
      for (let i = 1; i < pings.length; i++) {
        jitterSum += Math.abs(pings[i] - pings[i - 1]);
      }
      const jitterMs = Number((jitterSum / Math.max(1, pings.length - 1)).toFixed(1));
      const pingMs = Number((avgMeasured + node.latencyOffsetMs).toFixed(1));

      setProgressStep('Measuring download bandwidth...');
      const dlStart = performance.now();
      const dlRes = await fetch(`/api/network/download?t=${Date.now()}`, { cache: 'no-store' });
      const dlBlob = await dlRes.arrayBuffer();
      const dlSeconds = Math.max(0.015, (performance.now() - dlStart) / 1000);
      const downloadMbps = Number((((dlBlob.byteLength * 8) / dlSeconds) / 1_000_000).toFixed(2));

      setProgressStep('Measuring upload bandwidth...');
      const uploadBytes = new Uint8Array(256 * 1024);
      const ulStart = performance.now();
      await fetch('/api/network/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: uploadBytes,
      });
      const ulSeconds = Math.max(0.015, (performance.now() - ulStart) / 1000);
      const uploadMbps = Number((((uploadBytes.byteLength * 8) / ulSeconds) / 1_000_000).toFixed(2));

      const evaluation = evaluateConnectionQuality({
        downloadMbps,
        uploadMbps,
        pingMs,
        jitterMs,
      });

      const saved = await apiRequest<{ id: string; createdAt: string }>('/api/network/tests', {
        method: 'POST',
        body: JSON.stringify({
          regionNode: selectedNode,
          downloadMbps,
          uploadMbps,
          pingMs,
          jitterMs,
          stability: evaluation.stability,
        }),
      });

      setResult({
        id: saved.id,
        regionNode: selectedNode,
        downloadMbps,
        uploadMbps,
        pingMs,
        jitterMs,
        stability: evaluation.stability,
        createdAt: saved.createdAt,
      });
      loadHistory();
    } finally {
      setTesting(false);
      setProgressStep(null);
    }
  };

  const activeEval = result
    ? evaluateConnectionQuality({
        downloadMbps: result.downloadMbps,
        uploadMbps: result.uploadMbps,
        pingMs: result.pingMs,
        jitterMs: result.jitterMs,
      })
    : null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 space-y-8">
      <div className="max-w-3xl">
        <p className="text-xs font-medium text-blue-400">Pre-Match Network Diagnostic</p>
        <h1 className="mt-1 font-display text-2xl sm:text-3xl font-bold text-white">
          Internet Connection Checker
        </h1>
        <p className="mt-2 text-sm text-slate-400 leading-relaxed">
          Evaluate your download speed, upload speed, round-trip ping, and jitter before entering ranked queues or regional tournaments.
        </p>
      </div>

      {/* Explicit Estimate Disclaimer */}
      <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-4 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
        <p className="text-xs text-amber-100 leading-relaxed">
          <strong>Important Estimate Notice:</strong> These measurements are estimates calculated between your browser and the GameBridge application server (with optional regional relay latency offsets). Actual in-game ping and throughput can vary significantly depending on your ISP routing (e.g., Ethio Telecom fiber vs. 4G/LTE), local Wi-Fi congestion, and the specific game publisher’s server location.
        </p>
      </div>

      {/* Test Control Panel */}
      <div className="rounded-xl border border-slate-800 bg-[#0B1120] p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="flex-1 max-w-md">
            <label htmlFor="node-select" className="block text-xs font-medium text-slate-300 mb-1.5">
              Target Server Route Profile
            </label>
            <select
              id="node-select"
              value={selectedNode}
              onChange={(e) => setSelectedNode(e.target.value)}
              disabled={testing}
              className="w-full rounded-lg border border-slate-700 bg-[#060A14] px-3.5 py-2.5 text-sm text-white min-h-[44px]"
            >
              {NODES.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.label}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            disabled={testing}
            onClick={runConnectionTest}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-sm font-semibold text-white transition-colors min-h-[44px]"
          >
            <Play className="w-4 h-4" aria-hidden="true" />
            <span>{testing ? 'Testing Connection...' : 'Run Connection Test'}</span>
          </button>
        </div>

        {progressStep && (
          <p className="text-xs font-mono text-blue-300">{progressStep}</p>
        )}

        {/* 4 Metric Readouts */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-2 border-t border-slate-800/80">
          <div className="rounded-lg border border-slate-800 bg-[#070B16] p-4">
            <p className="text-xs text-slate-400 flex items-center gap-1.5">
              <ArrowDown className="w-3.5 h-3.5 text-blue-400" aria-hidden="true" />
              <span>Download Speed</span>
            </p>
            <p className="mt-2 font-mono text-2xl font-semibold text-white tabular-nums">
              {result ? `${result.downloadMbps} Mbps` : '—'}
            </p>
          </div>

          <div className="rounded-lg border border-slate-800 bg-[#070B16] p-4">
            <p className="text-xs text-slate-400 flex items-center gap-1.5">
              <ArrowUp className="w-3.5 h-3.5 text-violet-400" aria-hidden="true" />
              <span>Upload Speed</span>
            </p>
            <p className="mt-2 font-mono text-2xl font-semibold text-white tabular-nums">
              {result ? `${result.uploadMbps} Mbps` : '—'}
            </p>
          </div>

          <div className="rounded-lg border border-slate-800 bg-[#070B16] p-4">
            <p className="text-xs text-slate-400 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-blue-400" aria-hidden="true" />
              <span>Estimated Ping / Jitter</span>
            </p>
            <p className="mt-2 font-mono text-2xl font-semibold text-white tabular-nums">
              {result ? `${result.pingMs} ms` : '—'}
            </p>
            {result && (
              <p className="text-[11px] font-mono tabular-nums text-slate-400 mt-0.5">
                Jitter: {result.jitterMs} ms
              </p>
            )}
          </div>

          <div className="rounded-lg border border-slate-800 bg-[#070B16] p-4">
            <p className="text-xs text-slate-400 flex items-center gap-1.5">
              <Wifi className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
              <span>Connection Stability</span>
            </p>
            <p className="mt-2 font-display text-2xl font-semibold text-white">
              {result ? result.stability : 'Ready'}
            </p>
          </div>
        </div>

        {activeEval && (
          <div className="rounded-lg border border-slate-800 bg-[#070B16] p-5 space-y-3">
            <p className="text-sm font-semibold text-white">Assessment: {activeEval.stability}</p>
            <p className="text-xs text-slate-300 leading-relaxed">{activeEval.summary}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 text-xs">
              <div>
                <p className="font-semibold text-slate-200 mb-1">Recommended Game Genres</p>
                <ul className="space-y-1 text-slate-400">
                  {activeEval.suitableGenres.map((g) => (
                    <li key={g}>· {g}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="font-semibold text-slate-200 mb-1">Optimization Tips</p>
                <ul className="space-y-1 text-slate-400">
                  {activeEval.guidance.map((tip) => (
                    <li key={tip}>· {tip}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Educational Explanation & History */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 rounded-xl border border-slate-800 bg-[#0B1120] p-6 space-y-4">
          <h2 className="font-display text-lg font-semibold text-white">
            How Internet Quality Affects Online Gaming
          </h2>
          <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
            <div>
              <p className="font-semibold text-white">1. Ping / Latency (ms)</p>
              <p className="text-slate-400 mt-0.5">
                Measures how long packets take to travel from your PC or console to the game server and back. Under 60ms feels snappy; 80–120ms is playable in MOBAs and Battle Royales; above 150ms causes noticeable shot registration delay.
              </p>
            </div>
            <div>
              <p className="font-semibold text-white">2. Jitter & Packet Stability</p>
              <p className="text-slate-400 mt-0.5">
                Jitter is the variation in ping over time. Even if average ping is 70ms, high jitter (&gt;25ms) on congested mobile hotspots causes teleporting ("rubber-banding"). Wired Ethernet stabilizes jitter dramatically.
              </p>
            </div>
            <div>
              <p className="font-semibold text-white">3. Download & Upload Bandwidth (Mbps)</p>
              <p className="text-slate-400 mt-0.5">
                Online gameplay itself typically uses 1–5 Mbps, but stable upload speed prevents voice-chat distortion and tick-rate drops when teammates share a home router.
              </p>
            </div>
          </div>
        </div>

        <div className="lg:col-span-6 rounded-xl border border-slate-800 bg-[#0B1120] p-6">
          <h2 className="font-display text-lg font-semibold text-white mb-4">
            Recent Diagnostic History
          </h2>
          {history.length === 0 ? (
            <p className="text-xs text-slate-400">Run your first test above to record results.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="pb-2 font-medium">Route</th>
                    <th className="pb-2 font-medium text-right">Down</th>
                    <th className="pb-2 font-medium text-right">Up</th>
                    <th className="pb-2 font-medium text-right">Ping</th>
                    <th className="pb-2 font-medium text-right">Rating</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {history.map((h, idx) => (
                    <tr key={h.id || idx} className="h-9">
                      <td className="pr-2 text-slate-200">{h.regionNode}</td>
                      <td className="px-2 text-right font-mono tabular-nums text-slate-300">{h.downloadMbps}</td>
                      <td className="px-2 text-right font-mono tabular-nums text-slate-300">{h.uploadMbps}</td>
                      <td className="px-2 text-right font-mono tabular-nums text-slate-300">{h.pingMs} ms</td>
                      <td className="pl-2 text-right font-medium text-blue-400">{h.stability}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
