// src/pages/Dashboard.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Wallet,
  Bot,
  TrendingUp,
  Clock,
  Plus,
  ArrowRight,
  ShieldAlert,
  Zap,
  Repeat,
  Shield,
  Activity,
  Layers,
  ServerCrash,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { motion } from 'framer-motion';
import { useAppStore } from '../store/appStore';
import { StatCard } from '../components/ui/StatCard';
import { StatusBadge } from '../components/ui/StatusBadge';
import { spendingChartData } from '../data/mockData';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const {
    agents, transactions, activityLogs, walletAssets,
    isGlobalEmergencyHalted, triggerGlobalEmergencyStop, resumeGlobalOperations,
    onChainAddress, onChainBalanceEth, onChainNetwork, onChainChainId, backendConnected,
    syncFromBackend,
  } = useAppStore();
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d' | '90d'>('24h');
  const [emergencyLoading, setEmergencyLoading] = useState(false);

  // Sync from backend on mount
  useEffect(() => {
    syncFromBackend();
    // Refresh every 30 seconds
    const interval = setInterval(() => syncFromBackend(), 30000);
    return () => clearInterval(interval);
  }, []);

  // Computed metrics
  const realEthBalance = parseFloat(onChainBalanceEth) || 0;
  const totalBalance = walletAssets.reduce((sum, a) => sum + a.valueUsd, 0) + agents.reduce((sum, a) => sum + a.balance, 0);
  const activeAgentsCount = agents.filter((a) => a.status === 'active').length;
  const spentToday = agents.reduce((sum, a) => sum + a.spentToday, 0);
  const confirmedTxs = transactions.filter((t) => t.status === 'completed').length;
  const pendingTxs = transactions.filter((t) => t.status === 'pending').length;

  const currentChartData = spendingChartData[timeRange];

  const handleEmergencyStop = async () => {
    if (!window.confirm('Trigger backend emergency shutdown of all on-chain execution?')) return;
    setEmergencyLoading(true);
    try { await triggerGlobalEmergencyStop(); } catch (e) { alert('Failed to contact backend — check server is running.'); }
    setEmergencyLoading(false);
  };

  const handleResume = async () => {
    setEmergencyLoading(true);
    try { await resumeGlobalOperations(); } catch (e) { alert('Failed to contact backend — check server is running.'); }
    setEmergencyLoading(false);
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Top Banner / Welcome with Quick Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-6 rounded-3xl bg-gradient-to-r from-navy-900 via-navy-850 to-navy-900 border border-slate-800/80 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl -z-10 pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-violet-500/5 rounded-full blur-3xl -z-10 pointer-events-none" />

        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
            <span className="text-xs font-mono font-medium tracking-wider text-cyan-400 uppercase">
              Autonomous Liquidity Protocol • Base Sepolia Testnet Enclave
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            NEXUS AI WALLET
          </h2>
          <p className="text-sm text-slate-400 max-w-xl">
            Autonomous on-chain agent execution orchestrator with server-enforced spending policies and circuit breaker defense. All balances and transactions on Base Sepolia carry zero fiat value.
          </p>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => navigate('/agents?action=new')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-xs sm:text-sm bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/20 active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Create AI Agent</span>
          </button>

          <button
            onClick={() => navigate('/transactions')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-xs sm:text-sm bg-slate-800/80 hover:bg-slate-750 text-slate-200 border border-slate-700/80 hover:border-slate-600 active:scale-95 transition-all"
          >
            <Repeat className="w-4 h-4 text-cyan-400" />
            <span>Transactions</span>
          </button>

          {/* Backend status indicator */}
          <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono border ${
            backendConnected
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${backendConnected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
            {backendConnected ? `${onChainNetwork}` : 'Backend Offline'}
          </span>

          {isGlobalEmergencyHalted ? (
            <button
              onClick={handleResume}
              disabled={emergencyLoading}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-xs sm:text-sm bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/20 active:scale-95 transition-all disabled:opacity-60"
            >
              <Zap className="w-4 h-4" />
              <span>{emergencyLoading ? 'Resuming...' : 'Resume Fleet'}</span>
            </button>
          ) : (
            <button
              onClick={handleEmergencyStop}
              disabled={emergencyLoading}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-xs sm:text-sm bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 active:scale-95 transition-all disabled:opacity-60"
            >
              <ShieldAlert className="w-4 h-4" />
              <span>{emergencyLoading ? 'Stopping...' : 'Emergency Stop'}</span>
            </button>
          )}
        </div>
      </div>

      {/* 4 Stat Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Wallet Balance"
          value={`$${totalBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
          subValue={`${walletAssets.filter((a) => a.balance > 0).length} Assets Active`}
          change={totalBalance > 0 ? 'Treasury Funded' : '$0.00'}
          isPositive={totalBalance > 0}
          icon={Wallet}
          accent="cyan"
          badge="Treasury"
        />

        <StatCard
          title="Active AI Agents"
          value={`${activeAgentsCount} / ${agents.length}`}
          subValue={`${agents.filter((a) => a.status === 'paused').length} Paused`}
          change={agents.length > 0 ? `${activeAgentsCount} Active` : '0 Deployed'}
          isPositive={activeAgentsCount > 0}
          icon={Bot}
          accent="violet"
          badge="Live"
        />

        <StatCard
          title="Today's Spending"
          value={`$${spentToday.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
          subValue={agents.length > 0 ? 'Within limits' : 'No active spending'}
          change={spentToday > 0 ? 'Active Fleet' : '$0.00 Today'}
          isPositive={true}
          icon={TrendingUp}
          accent="emerald"
          badge="Hard-Capped"
        />

        <StatCard
          title="Pending Transactions"
          value={`${pendingTxs} Orders`}
          subValue={pendingTxs > 0 ? 'Mempool active' : 'Mempool idle'}
          change="Optimal gas"
          isPositive={true}
          icon={Clock}
          accent="amber"
          badge="Mempool"
        />
      </div>

      {/* Spending Overview Chart & Agent Allocation */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Chart */}
        <div className="lg:col-span-2 rounded-3xl bg-slate-900/80 border border-slate-800 p-6 flex flex-col justify-between shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white tracking-wide">
                  Agent Spending & Yield Curve
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                  REAL-TIME
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Cumulative capital deployed vs. arbitrage return over time
              </p>
            </div>

            {/* Time-Range Selector Buttons */}
            <div className="flex items-center gap-1 bg-slate-800/80 p-1 rounded-xl border border-slate-700/60 self-start sm:self-auto">
              {(['24h', '7d', '30d', '90d'] as const).map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`px-3 py-1 text-xs font-mono font-medium rounded-lg transition-all ${
                    timeRange === range
                      ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20 font-bold'
                      : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                  }`}
                >
                  {range.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Recharts Area Chart */}
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={currentChartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="spentGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="time" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis
                  stroke="#64748b"
                  fontSize={11}
                  tickLine={false}
                  tickFormatter={(val) => `$${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '12px',
                    color: '#f8fafc',
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
                  }}
                  itemStyle={{ fontSize: '12px' }}
                  labelStyle={{ fontWeight: 'bold', color: '#38bdf8' }}
                  formatter={(value: any) => [`$${Number(value).toLocaleString()}`, '']}
                />
                <Area
                  type="monotone"
                  dataKey="spent"
                  name="Capital Deployed"
                  stroke="#06b6d4"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#spentGradient)"
                />
                <Area
                  type="monotone"
                  dataKey="profit"
                  name="Yield / Arbitrage Net"
                  stroke="#a78bfa"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#profitGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
                Capital Deployed
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-violet-400" />
                Yield Generated
              </span>
            </div>
            <span className="font-mono text-cyan-400">Yield: {agents.length > 0 ? '0.00% (Base Sepolia Testnet)' : '0.0%'}</span>
          </div>
        </div>

        {/* Fleet Status Snapshot */}
        <div className="rounded-3xl bg-slate-900/80 border border-slate-800 p-6 flex flex-col justify-between shadow-xl">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-white tracking-wide flex items-center gap-2">
                <Bot className="w-4 h-4 text-cyan-400" />
                <span>Agent Fleet Matrix</span>
              </h3>
              <button
                onClick={() => navigate('/agents')}
                className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-medium transition-colors"
              >
                <span>View All</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {agents.length === 0 ? (
              <div className="py-10 px-4 text-center rounded-2xl bg-slate-950/40 border border-dashed border-slate-800">
                <Bot className="w-9 h-9 text-slate-600 mx-auto mb-2 opacity-60" />
                <p className="text-xs font-semibold text-slate-300">No AI Agents Deployed</p>
                <p className="text-[11px] text-slate-500 mt-1 max-w-[200px] mx-auto">Configure your first automated strategy to run on-chain</p>
                <button
                  onClick={() => navigate('/agents?action=new')}
                  className="mt-3.5 px-3.5 py-1.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 text-xs font-semibold transition-all active:scale-95"
                >
                  + Deploy Agent
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {agents.slice(0, 4).map((agent) => {
                  const percent = Math.min(100, Math.round((agent.spentToday / (agent.dailyLimit || 1)) * 100));
                  return (
                    <div
                      key={agent.id}
                      onClick={() => navigate('/agents')}
                      className="p-3 rounded-2xl bg-slate-800/40 hover:bg-slate-800/70 border border-slate-750 transition-all cursor-pointer group"
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-xs">
                            {agent.name.charAt(0)}
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-white group-hover:text-cyan-300 transition-colors">
                              {agent.name}
                            </p>
                            <p className="text-[10px] text-slate-400">{agent.type}</p>
                          </div>
                        </div>
                        <StatusBadge status={agent.status} size="sm" />
                      </div>

                      <div className="mt-2">
                        <div className="flex justify-between text-[10px] text-slate-400 font-mono mb-1">
                          <span>Spent: ${agent.spentToday.toLocaleString()}</span>
                          <span>Limit: ${agent.dailyLimit.toLocaleString()}</span>
                        </div>
                        <div className="w-full bg-slate-700/60 rounded-full h-1 overflow-hidden">
                          <div
                            className={`h-1 rounded-full ${
                              percent > 85 ? 'bg-rose-500' : percent > 50 ? 'bg-amber-400' : 'bg-cyan-400'
                            }`}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between">
            <span className="text-xs text-slate-400">Total Capital in Fleet</span>
            <span className="text-sm font-mono font-bold text-white">
              ${agents.reduce((sum, a) => sum + a.balance, 0).toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* Recent Transactions & Real-time AI Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Transactions Table */}
        <div className="rounded-3xl bg-slate-900/80 border border-slate-800 p-6 shadow-xl">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Repeat className="w-4 h-4 text-cyan-400" />
                <span>Recent Agent Transactions</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Automated swaps, stakes and protocol approvals</p>
            </div>
            <button
              onClick={() => navigate('/transactions')}
              className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-medium transition-colors"
            >
              <span>Full Ledger</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-mono text-[11px]">
                  <th className="pb-3 font-medium">AGENT / CALL</th>
                  <th className="pb-3 font-medium">AMOUNT</th>
                  <th className="pb-3 font-medium">DESTINATION</th>
                  <th className="pb-3 font-medium text-right">STATUS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-sans">
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-10 text-center text-slate-500 text-xs">
                      <Repeat className="w-7 h-7 text-slate-600 mx-auto mb-2 opacity-50" />
                      No transactions recorded yet. On-chain executions will stream here.
                    </td>
                  </tr>
                ) : (
                  transactions.slice(0, 5).map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3">
                        <p className="font-semibold text-white">{tx.agentName}</p>
                        <p className="text-[10px] text-slate-400 font-mono uppercase">{tx.type} • {tx.timestamp}</p>
                      </td>
                      <td className="py-3 font-mono font-medium text-slate-200">
                        ${tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        <span className="block text-[10px] text-slate-400">{tx.asset}</span>
                      </td>
                      <td className="py-3 text-slate-300 text-[11px] font-mono">
                        {tx.destination}
                      </td>
                      <td className="py-3 text-right">
                        <StatusBadge status={tx.status} size="sm" />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* AI Activity & Telemetry Feed */}
        <div className="rounded-3xl bg-slate-900/80 border border-slate-800 p-6 shadow-xl">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Activity className="w-4 h-4 text-violet-400" />
                <span>Autonomous Activity Stream</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Live neural heuristics, risk checks, and execution events</p>
            </div>
            <button
              onClick={() => navigate('/monitoring')}
              className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-medium transition-colors"
            >
              <span>View Logs</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3.5 max-h-[340px] overflow-y-auto pr-1">
            {activityLogs.length === 0 ? (
              <div className="py-12 px-4 text-center rounded-2xl bg-slate-950/40 border border-dashed border-slate-800 text-slate-500 text-xs">
                <Activity className="w-7 h-7 text-slate-600 mx-auto mb-2 opacity-50" />
                System standing by. Neural telemetry events will stream here.
              </div>
            ) : (
              activityLogs.slice(0, 5).map((log) => {
                let dotBg = 'bg-cyan-400';
                if (log.severity === 'warning') dotBg = 'bg-amber-400';
                if (log.severity === 'critical') dotBg = 'bg-rose-500';
                if (log.severity === 'success') dotBg = 'bg-emerald-400';

                return (
                  <div
                    key={log.id}
                    className="p-3 rounded-2xl bg-slate-800/40 border border-slate-800 hover:border-slate-750 transition-colors"
                  >
                    <div className="flex items-center justify-between text-xs mb-1">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${dotBg}`} />
                        <span className="font-semibold text-slate-200">{log.agentName}</span>
                      </div>
                      <span className="font-mono text-[10px] text-slate-400">{log.timestamp}</span>
                    </div>
                    <p className="text-xs font-medium text-cyan-300 ml-4">{log.action}</p>
                    <p className="text-[11px] text-slate-400 ml-4 mt-0.5">{log.details}</p>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
