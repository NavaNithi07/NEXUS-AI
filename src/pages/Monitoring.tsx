// src/pages/Monitoring.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  Activity,
  Terminal,
  Filter,
  Trash2,
  Play,
  Pause,
  Bot,
  Zap,
  Cpu,
  Clock,
  Sparkles,
  Layers,
  ArrowDownCircle,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useAppStore } from '../store/appStore';
import { StatCard } from '../components/ui/StatCard';
import type { ActivityLog } from '../types';

const latencyData = [
  { time: '00:00', latency: 18, gasSavings: 35 },
  { time: '02:00', latency: 14, gasSavings: 38 },
  { time: '04:00', latency: 22, gasSavings: 32 },
  { time: '06:00', latency: 12, gasSavings: 42 },
  { time: '08:00', latency: 16, gasSavings: 40 },
  { time: '10:00', latency: 19, gasSavings: 36 },
  { time: '12:00', latency: 15, gasSavings: 39 },
];

export const Monitoring: React.FC = () => {
  const { activityLogs, clearActivityLogs, agents } = useAppStore();
  const [backendAuditLogs, setBackendAuditLogs] = useState<any[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  const [severityFilter, setSeverityFilter] = useState('all');
  const [agentFilter, setAgentFilter] = useState('all');
  const [autoScroll, setAutoScroll] = useState(true);
  const [isStreaming, setIsStreaming] = useState(true);
  const [showBackendLogs, setShowBackendLogs] = useState(true);

  const consoleEndRef = useRef<HTMLDivElement>(null);

  // Fetch backend audit logs
  const fetchAuditLogs = async () => {
    try {
      setAuditLoading(true);
      const res = await fetch('/api/audit-logs');
      if (res.ok) {
        const data = await res.json();
        setBackendAuditLogs(data || []);
      }
    } catch { /* silent */ } finally {
      setAuditLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditLogs();
    const interval = setInterval(fetchAuditLogs, 10000);
    return () => clearInterval(interval);
  }, []);

  // Auto-scroll logic
  useEffect(() => {
    if (autoScroll && consoleEndRef.current) {
      consoleEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activityLogs, autoScroll]);

  const filteredLogs = activityLogs.filter((log) => {
    const matchSeverity = severityFilter === 'all' || log.severity === severityFilter;
    const matchAgent = agentFilter === 'all' || log.agentName === agentFilter;
    return matchSeverity && matchAgent;
  });

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <span>Kernel Telemetry & Audit Logs</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Sub-second autonomous execution events, smart-contract calls, gas consumption, and neural metrics.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsStreaming(!isStreaming)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-mono transition-colors border ${
              isStreaming
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
          >
            {isStreaming ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{isStreaming ? 'Stream Active' : 'Stream Paused'}</span>
          </button>

          <button
            onClick={clearActivityLogs}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-mono border border-slate-700 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear Logs</span>
          </button>
        </div>
      </div>

      {/* Telemetry Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <StatCard
          title="Kernel Latency"
          value="14.8 ms"
          subValue="Sub-block response"
          icon={Clock}
          accent="cyan"
          badge="Real-time"
        />
        <StatCard
          title="Gas Optimization"
          value="-38.2%"
          subValue="vs. Public Mempool"
          icon={Zap}
          accent="emerald"
          badge="Flashbots"
        />
        <StatCard
          title="Active Telemetry Threads"
          value="8 Threads"
          subValue="Zero context drops"
          icon={Cpu}
          accent="violet"
          badge="Multicore"
        />
        <StatCard
          title="Total Events Logged"
          value={activityLogs.length}
          subValue="Persistent ledger"
          icon={Activity}
          accent="amber"
          badge="Audit trail"
        />
      </div>

      {/* Latency & Gas Savings Performance Chart */}
      <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h3 className="text-base font-bold text-white">Execution Latency & Gas Efficiency Curve</h3>
            <p className="text-xs text-slate-400">Continuous telemetry over the last 12-hour epoch</p>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" /> Latency (ms)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" /> Gas Savings (%)
            </span>
          </div>
        </div>

        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={latencyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <XAxis dataKey="time" stroke="#64748b" fontSize={11} tickLine={false} />
              <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  borderColor: '#334155',
                  borderRadius: '12px',
                  color: '#f8fafc',
                  fontSize: '12px',
                }}
              />
              <Area type="monotone" dataKey="latency" name="Latency (ms)" stroke="#06b6d4" fill="#06b6d4" fillOpacity={0.2} strokeWidth={2} />
              <Area type="monotone" dataKey="gasSavings" name="Gas Savings (%)" stroke="#10b981" fill="#10b981" fillOpacity={0.15} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Terminal Log Console */}
      <div className="rounded-3xl bg-slate-950 border border-slate-800 shadow-2xl overflow-hidden font-mono">
        {/* Terminal Header */}
        <div className="px-5 py-3.5 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5">
              <span className="w-3 h-3 rounded-full bg-rose-500/80" />
              <span className="w-3 h-3 rounded-full bg-amber-500/80" />
              <span className="w-3 h-3 rounded-full bg-emerald-500/80" />
            </div>
            <span className="text-slate-400 text-xs ml-2 font-bold">nexus-agent-kernel.log</span>
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse ml-2" />
          </div>

          <div className="flex items-center gap-3">
            {/* Auto-scroll toggle */}
            <label className="flex items-center gap-1.5 text-[11px] text-slate-400 cursor-pointer">
              <input
                type="checkbox"
                checked={autoScroll}
                onChange={(e) => setAutoScroll(e.target.checked)}
                className="rounded accent-cyan-500 w-3.5 h-3.5"
              />
              <span>Auto-scroll</span>
            </label>

            {/* Severity Filter */}
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-[11px] text-slate-300 rounded-lg px-2.5 py-1 focus:outline-none"
            >
              <option value="all">All Severities</option>
              <option value="info">INFO</option>
              <option value="success">SUCCESS</option>
              <option value="warning">WARNING</option>
              <option value="critical">CRITICAL</option>
            </select>

            {/* Agent Filter */}
            <select
              value={agentFilter}
              onChange={(e) => setAgentFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-[11px] text-slate-300 rounded-lg px-2.5 py-1 focus:outline-none"
            >
              <option value="all">All Agents</option>
              {agents.map((a) => (
                <option key={a.id} value={a.name}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Terminal Logs Body */}
        <div className="p-5 space-y-2.5 max-h-[440px] overflow-y-auto text-xs">
          {filteredLogs.length === 0 ? (
            <div className="py-12 px-4 text-center font-mono text-slate-500 space-y-1">
              <p className="text-cyan-400 font-bold">[KERNEL INITIALIZED]</p>
              <p className="text-xs text-slate-400">Listening on Arbitrum Nitro private RPC endpoint.</p>
              <p className="text-[11px] text-slate-600">Awaiting autonomous agent triggers and contract events...</p>
            </div>
          ) : (
            filteredLogs.map((log) => {
              let badgeColor = 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30';
              if (log.severity === 'warning') badgeColor = 'text-amber-400 bg-amber-500/10 border-amber-500/30';
              if (log.severity === 'critical') badgeColor = 'text-rose-400 bg-rose-500/10 border-rose-500/30';
              if (log.severity === 'success') badgeColor = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';

              return (
                <div
                  key={log.id}
                  className="p-3 rounded-xl bg-slate-900/60 border border-slate-850 hover:bg-slate-900 transition-colors"
                >
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="text-slate-500 text-[10px]">[{log.timestamp}]</span>
                    <span className="font-bold text-white">{log.agentName}</span>
                    <span className={`px-2 py-0.2 rounded text-[9px] border font-semibold ${badgeColor}`}>
                      {log.severity.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-cyan-300 font-medium text-xs">{log.action}</p>
                  <p className="text-slate-400 text-[11px] font-sans mt-0.5">{log.details}</p>
                </div>
              );
            })
          )}
          <div ref={consoleEndRef} />
        </div>
      </div>

      {/* Backend Execution Audit Trail */}
      <div className="rounded-3xl bg-slate-900/80 border border-slate-800 shadow-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-violet-400 animate-pulse" />
            <span className="font-bold text-white text-sm">Backend Execution Audit Trail</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-300 border border-violet-500/20 font-mono">SQLite Persisted</span>
          </div>
          <div className="flex items-center gap-3">
            {auditLoading && <span className="text-xs text-slate-400 animate-pulse">Refreshing...</span>}
            <span className="text-xs text-slate-500">{backendAuditLogs.length} records</span>
            <button onClick={fetchAuditLogs} className="text-xs text-cyan-400 hover:text-cyan-300 font-mono border border-slate-700 px-2 py-1 rounded-lg">↻ Refresh</button>
          </div>
        </div>
        <div className="divide-y divide-slate-800/60 max-h-[400px] overflow-y-auto">
          {backendAuditLogs.length === 0 ? (
            <div className="p-8 text-center text-slate-500 font-mono text-xs">
              <p className="text-violet-400 font-bold mb-2">[AUDIT LEDGER READY]</p>
              <p>No execution records yet. Run an agent task to see on-chain audit events here.</p>
            </div>
          ) : (
            backendAuditLogs.map((record: any) => (
              <div key={record.id} className="px-5 py-4 hover:bg-slate-800/30 transition-colors">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold border ${
                    record.outcome === 'confirmed' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' :
                    record.outcome === 'rejected' ? 'text-rose-400 bg-rose-500/10 border-rose-500/30' :
                    'text-amber-400 bg-amber-500/10 border-amber-500/30'
                  }`}>{record.outcome?.toUpperCase()}</span>
                  <span className="text-white text-xs font-semibold">{record.agentName}</span>
                  <span className="text-slate-500 text-[10px] font-mono">{new Date(record.timestamp).toLocaleString()}</span>
                </div>
                <p className="text-xs text-slate-300 mb-1 font-mono">Goal: <span className="text-cyan-300">{record.taskGoal}</span></p>
                <p className="text-[11px] text-slate-400">{record.details}</p>
                {record.txHash && (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-[10px] font-mono text-emerald-400">TX:</span>
                    {record.explorerUrl ? (
                      <a href={record.explorerUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] font-mono text-cyan-400 hover:text-cyan-300 underline break-all">{record.txHash}</a>
                    ) : (
                      <span className="text-[10px] font-mono text-slate-400 break-all">{record.txHash}</span>
                    )}
                    {record.blockNumber && <span className="text-[10px] font-mono text-slate-500">Block #{record.blockNumber}</span>}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
