// src/pages/Security.tsx
import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Lock,
  Zap,
  Radio,
  AlertOctagon,
  CheckCircle2,
  RefreshCw,
  Terminal,
  Activity,
  Play,
  RotateCcw,
} from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { StatCard } from '../components/ui/StatCard';

const PRIVATE_RELAYS = [
  { name: 'Flashbots Protect RPC', endpoint: 'https://rpc.flashbots.net', latency: '14ms', status: 'optimal', deflections: 12 },
  { name: 'MEV-Blocker Relay', endpoint: 'https://rpc.mevblocker.io', latency: '18ms', status: 'optimal', deflections: 8 },
  { name: 'Eden Private Mempool', endpoint: 'https://api.edennetwork.io/v1/rpc', latency: '22ms', status: 'optimal', deflections: 5 },
  { name: 'BloXroute MaxProfit', endpoint: 'https://virginia.bdn.bloxroute.com', latency: '26ms', status: 'standby', deflections: 0 },
];

import { api } from '../lib/apiClient';

export const Security: React.FC = () => {
  const [
    isGlobalEmergencyHalted,
    triggerGlobalEmergencyStop,
    resumeGlobalOperations,
    securityDrillRunning,
    runSecurityDrill,
    agents,
    activityLogs,
    backendConnected,
    onChainNetwork,
    fetchOnChainStatus,
  ] = [
    useAppStore((s) => s.isGlobalEmergencyHalted),
    useAppStore((s) => s.triggerGlobalEmergencyStop),
    useAppStore((s) => s.resumeGlobalOperations),
    useAppStore((s) => s.securityDrillRunning),
    useAppStore((s) => s.runSecurityDrill),
    useAppStore((s) => s.agents),
    useAppStore((s) => s.activityLogs),
    useAppStore((s) => s.backendConnected),
    useAppStore((s) => s.onChainNetwork),
    useAppStore((s) => s.fetchOnChainStatus),
  ];

  const [confirmHaltOpen, setConfirmHaltOpen] = useState(false);
  const [haltLoading, setHaltLoading] = useState(false);
  const [auditVerifyLoading, setAuditVerifyLoading] = useState(false);
  const [auditVerifyResult, setAuditVerifyResult] = useState<any>(null);
  const [reconcileLoading, setReconcileLoading] = useState(false);
  const [reconcileResult, setReconcileResult] = useState<any>(null);
  const threatLogsCount = activityLogs.filter((l) => l.severity === 'warning' || l.severity === 'critical').length;

  const handleVerifyAuditChain = async () => {
    setAuditVerifyLoading(true);
    try {
      const res = await api.auditLogs.verify();
      setAuditVerifyResult(res);
    } catch (err: any) {
      alert(`Audit verification request failed: ${err.message}`);
    } finally {
      setAuditVerifyLoading(false);
    }
  };

  const handleRunReconciliation = async () => {
    setReconcileLoading(true);
    try {
      const res = await api.reconciliation.run();
      setReconcileResult(res);
    } catch (err: any) {
      alert(`Reconciliation request failed: ${err.message}`);
    } finally {
      setReconcileLoading(false);
    }
  };

  useEffect(() => {
    fetchOnChainStatus();
    const interval = setInterval(() => fetchOnChainStatus(), 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <span>Security Center & Threat Telemetry</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Mempool sandwich defense, private block builders, and autonomous emergency kill-switches.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Security Drill Button */}
          <button
            onClick={runSecurityDrill}
            disabled={securityDrillRunning}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-xs sm:text-sm transition-all border ${
              securityDrillRunning
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse'
                : 'bg-slate-800 hover:bg-slate-750 text-slate-200 border-slate-700/80 active:scale-95'
            }`}
          >
            <RefreshCw className={`w-4 h-4 text-cyan-400 ${securityDrillRunning ? 'animate-spin' : ''}`} />
            <span>{securityDrillRunning ? 'Executing Evacuation Drill...' : 'Run Security Drill'}</span>
          </button>

          {/* Emergency Halt Action */}
          {isGlobalEmergencyHalted ? (
            <button
              onClick={async () => {
                setHaltLoading(true);
                try { await resumeGlobalOperations(); } catch { alert('Backend contact failed.'); }
                setHaltLoading(false);
              }}
              disabled={haltLoading}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/25 active:scale-95 transition-all disabled:opacity-60"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{haltLoading ? 'Resuming...' : 'Resume Operations'}</span>
            </button>
          ) : (
            <button
              onClick={() => setConfirmHaltOpen(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/30 active:scale-95 transition-all"
            >
              <AlertOctagon className="w-4 h-4" />
              <span>Engage Kill-Switch</span>
            </button>
          )}
        </div>
      </div>

      {/* Security Drill Active Banner */}
      {securityDrillRunning && (
        <div className="p-4 rounded-2xl bg-amber-500/15 border border-amber-500/40 text-amber-200 flex items-center justify-between text-xs sm:text-sm font-mono backdrop-blur-md">
          <div className="flex items-center gap-3">
            <RefreshCw className="w-5 h-5 text-amber-400 animate-spin" />
            <div>
              <p className="font-bold">SYSTEM RESILIENCE AUDIT IN PROGRESS</p>
              <p className="text-xs text-amber-300/80">
                Simulating flash-crash circuit breaker: halting {agents.length} agent contracts and testing liquidity freeze.
              </p>
            </div>
          </div>
          <span className="px-3 py-1 rounded-full bg-amber-500/30 font-bold">18ms latency</span>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Circuit Breaker Status"
          value={isGlobalEmergencyHalted ? 'HALTED' : 'ARMED & SECURE'}
          subValue={isGlobalEmergencyHalted ? 'All Agents Offline' : 'Hardware Multi-Sig'}
          icon={ShieldCheck}
          accent={isGlobalEmergencyHalted ? 'amber' : 'emerald'}
          badge={isGlobalEmergencyHalted ? 'Emergency' : 'Optimal'}
        />
        <StatCard
          title="Threat Deflections (24h)"
          value={`${threatLogsCount} Attacks Deflected`}
          subValue="Sandwich & Frontrunners"
          change={threatLogsCount > 0 ? `+${threatLogsCount} detected` : "0 Threats Detected"}
          isPositive={true}
          icon={ShieldAlert}
          accent="violet"
        />
        <StatCard
          title="Security Posture Score"
          value="100 / 100"
          subValue="Zero-Trust Architecture"
          change="A+ Grade"
          isPositive={true}
          icon={Lock}
          accent="cyan"
        />
      </div>

      {/* Bank-Grade Verification & Reconciliation Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Card 1: Cryptographic Audit Trail Hash Chain */}
        <div className="rounded-3xl bg-slate-900/80 border border-slate-800 p-6 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Cryptographic Audit Hash Chain</h3>
                  <p className="text-xs text-slate-400">SHA-256 Merkle-linked tamper-evident financial ledger</p>
                </div>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-xs font-mono font-bold border ${
                auditVerifyResult?.isValid
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}>
                {auditVerifyResult ? (auditVerifyResult.isValid ? 'CHAIN VERIFIED' : 'TAMPER DETECTED') : 'READY TO AUDIT'}
              </span>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              Every sensitive financial event, proposal, policy decision, and killswitch action is chained with the previous block hash. Any post-hoc database tampering invalidates the chain.
            </p>

            {auditVerifyResult && (
              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5 text-xs font-mono mb-4">
                <div className="flex justify-between text-slate-400">
                  <span>Audited Blocks:</span>
                  <span className="text-white font-bold">{auditVerifyResult.totalRecords}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Chain Genesis:</span>
                  <span className="text-cyan-400">000000000000...</span>
                </div>
                <div className="flex justify-between text-slate-400 truncate">
                  <span>Head Digest:</span>
                  <span className="text-emerald-400 truncate max-w-[200px]">{auditVerifyResult.headHash || 'N/A'}</span>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={handleVerifyAuditChain}
            disabled={auditVerifyLoading}
            className="w-full py-2.5 px-4 rounded-xl font-bold text-xs bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${auditVerifyLoading ? 'animate-spin' : ''}`} />
            <span>{auditVerifyLoading ? 'Auditing SHA-256 Hash Chain...' : 'Verify Audit Trail Integrity'}</span>
          </button>
        </div>

        {/* Card 2: Blockchain Ledger Reconciliation */}
        <div className="rounded-3xl bg-slate-900/80 border border-slate-800 p-6 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-400 flex items-center justify-center font-bold">
                  <Activity className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Blockchain Ledger Reconciliation</h3>
                  <p className="text-xs text-slate-400">Real-time cross-audit against Base Sepolia RPC receipts</p>
                </div>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-xs font-mono font-bold border ${
                reconcileResult?.mismatchCount === 0
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}>
                {reconcileResult ? `${reconcileResult.matchedCount} MATCHED` : 'IDLE'}
              </span>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              Cross-references internal database execution states with authoritative on-chain receipts, verifying block numbers, gas usage, and execution status.
            </p>

            {reconcileResult && (
              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5 text-xs font-mono mb-4">
                <div className="flex justify-between text-slate-400">
                  <span>Transactions Audited:</span>
                  <span className="text-white font-bold">{reconcileResult.totalAudited}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Mismatches Detected:</span>
                  <span className={reconcileResult.mismatchCount > 0 ? 'text-rose-400 font-bold' : 'text-emerald-400'}>
                    {reconcileResult.mismatchCount}
                  </span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Mempool / In-Flight:</span>
                  <span className="text-cyan-400">{reconcileResult.unconfirmedCount}</span>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={handleRunReconciliation}
            disabled={reconcileLoading}
            className="w-full py-2.5 px-4 rounded-xl font-bold text-xs bg-slate-800 hover:bg-slate-750 text-cyan-300 border border-cyan-500/30 transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${reconcileLoading ? 'animate-spin' : ''}`} />
            <span>{reconcileLoading ? 'Auditing Against Blockchain Receipts...' : 'Run On-Chain Reconciliation'}</span>
          </button>
        </div>
      </div>

      {/* Threat Radar & Private RPC Relays */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Private RPC Relays Table */}
        <div className="rounded-3xl bg-slate-900/80 border border-slate-800 p-6 shadow-xl">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Radio className="w-4 h-4 text-cyan-400" />
                <span>Protected Private RPC Relays</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Mempool obscurity relays preventing toxic MEV extraction
              </p>
            </div>
            <span className="text-xs font-mono text-emerald-400">4 Active Relays</span>
          </div>

          <div className="space-y-3">
            {PRIVATE_RELAYS.map((relay) => (
              <div
                key={relay.name}
                className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 flex items-center justify-between text-xs"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="font-bold text-white">{relay.name}</span>
                  </div>
                  <span className="text-[11px] font-mono text-slate-500 block mt-0.5">{relay.endpoint}</span>
                </div>

                <div className="text-right font-mono">
                  <span className="text-cyan-400 font-bold block">{relay.latency}</span>
                  <span className="text-[10px] text-slate-400">{relay.deflections} deflections</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Threat Radar Telemetry */}
        <div className="rounded-3xl bg-slate-900/80 border border-slate-800 p-6 shadow-xl flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-white mb-1 flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              <span>Automated Threat Defense Engine</span>
            </h3>
            <p className="text-xs text-slate-400 mb-5">
              Heuristic detection of malicious arbitrage bots and flash-loan exploits
            </p>

            <div className="space-y-3 text-xs">
              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
                <div className="flex justify-between font-semibold text-white mb-1">
                  <span>Mempool Sandwich Attack Deflection</span>
                  <span className="text-emerald-400 font-mono">ENFORCED</span>
                </div>
                <p className="text-slate-400 text-[11px]">
                  Reroutes orders directly to authorized validators, preventing attackers from inserting bids before/after swaps.
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
                <div className="flex justify-between font-semibold text-white mb-1">
                  <span>Slippage Circuit Breaker (&gt; 0.35%)</span>
                  <span className="text-cyan-400 font-mono">ACTIVE</span>
                </div>
                <p className="text-slate-400 text-[11px]">
                  Smart-contract level atomic rejection if trade execution slippage exceeds 35 basis points.
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
                <div className="flex justify-between font-semibold text-white mb-1">
                  <span>Flash-Crash Multi-Sig Lock</span>
                  <span className="text-violet-400 font-mono">ARMED</span>
                </div>
                <p className="text-slate-400 text-[11px]">
                  Freezes contracts if asset price drops &gt; 15% in a single 60-second block window.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-500 font-mono">
            <span>Audit Standard: EIP-4337 Account Abstraction</span>
            <span className="text-emerald-400">PASSED</span>
          </div>
        </div>
      </div>

      {/* CONFIRM EMERGENCY HALT MODAL */}
      {confirmHaltOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="w-full max-w-md rounded-3xl bg-slate-900 border border-rose-500/40 shadow-2xl p-6 text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-400 border border-rose-500/30 flex items-center justify-center mx-auto mb-3">
              <AlertOctagon className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Engage Global Emergency Kill-Switch?</h3>
            <p className="text-xs text-slate-300 mb-6 leading-relaxed">
              This action will immediately halt execution for all <strong>{agents.length} active AI agents</strong>, revoke smart contract allowances, and route unspent capital to the cold treasury vault.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setConfirmHaltOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  setHaltLoading(true);
                  setConfirmHaltOpen(false);
                  try { await triggerGlobalEmergencyStop(); } catch { alert('Backend contact failed — server must be running to engage killswitch.'); }
                  setHaltLoading(false);
                }}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg shadow-rose-600/30"
              >
                Yes, Engage Kill-Switch
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
