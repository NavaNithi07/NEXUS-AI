// src/pages/Policies.tsx
import React, { useState } from 'react';
import {
  Sliders,
  ShieldCheck,
  AlertTriangle,
  Plus,
  Trash2,
  Power,
  X,
  AlertCircle,
  CheckCircle2,
  Lock,
  Layers,
  Bot,
} from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { StatCard } from '../components/ui/StatCard';
import type { SpendingPolicy } from '../types';

const AVAILABLE_TOKENS = ['ETH', 'WETH', 'USDC', 'USDT', 'WBTC', 'ARB', 'LINK', 'DAI'];

export const Policies: React.FC = () => {
  const { spendingPolicies, addPolicy, deletePolicy, togglePolicyStatus, agents } = useAppStore();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [testBreachOpen, setTestBreachOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    targetAgent: agents[0]?.name || 'All Fleet Agents',
    maxDailySpend: 25000,
    maxSingleTx: 5000,
    requireApprovalAbove: 4000,
    allowedTokens: ['USDC', 'ETH', 'WBTC'],
  });

  const activePoliciesCount = spendingPolicies.filter((p) => p.status === 'active').length;
  const totalDailyCap = spendingPolicies.reduce((sum, p) => p.status === 'active' ? sum + p.maxDailySpend : sum, 0);

  const handleCreatePolicy = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formData.name.trim()) {
      setFormError('Policy rule name is required.');
      return;
    }
    if (formData.maxDailySpend <= 0) {
      setFormError('Daily spend limit must be greater than $0.');
      return;
    }
    if (formData.maxSingleTx <= 0) {
      setFormError('Max single transaction limit must be greater than $0.');
      return;
    }
    if (formData.maxSingleTx > formData.maxDailySpend) {
      setFormError('Single transaction cap cannot exceed daily limit.');
      return;
    }
    if (formData.allowedTokens.length === 0) {
      setFormError('Please select at least one whitelisted asset token.');
      return;
    }

    addPolicy({
      name: formData.name.trim(),
      description: formData.description.trim() || 'Custom automated velocity cap.',
      targetAgent: formData.targetAgent,
      maxDailySpend: Number(formData.maxDailySpend),
      maxSingleTx: Number(formData.maxSingleTx),
      requireApprovalAbove: Number(formData.requireApprovalAbove),
      allowedTokens: formData.allowedTokens,
      status: 'active',
    });

    setToastMsg(`Policy "${formData.name}" enacted and enforced!`);
    setIsModalOpen(false);
    setFormData({
      name: '',
      description: '',
      targetAgent: agents[0]?.name || 'All Fleet Agents',
      maxDailySpend: 25000,
      maxSingleTx: 5000,
      requireApprovalAbove: 4000,
      allowedTokens: ['USDC', 'ETH', 'WBTC'],
    });
    setTimeout(() => setToastMsg(null), 4000);
  };

  const toggleToken = (token: string) => {
    if (formData.allowedTokens.includes(token)) {
      setFormData({
        ...formData,
        allowedTokens: formData.allowedTokens.filter((t) => t !== token),
      });
    } else {
      setFormData({
        ...formData,
        allowedTokens: [...formData.allowedTokens, token],
      });
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-2xl bg-emerald-500 text-slate-950 font-semibold text-xs sm:text-sm shadow-2xl animate-bounce">
          <CheckCircle2 className="w-5 h-5 text-slate-950" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <span>Autonomous Spending Policies</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Programmatic guardrails, capital velocity thresholds, and automatic multi-sig tripwires.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setTestBreachOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs sm:text-sm font-semibold border border-slate-700/80 active:scale-95 transition-all"
          >
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span>Simulate Breach</span>
          </button>

          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/20 active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>New Policy Rule</span>
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Active Guardrails"
          value={`${activePoliciesCount} Enforced`}
          subValue={`${spendingPolicies.length} Total Rules`}
          icon={Sliders}
          accent="cyan"
          badge="Live Rules"
        />
        <StatCard
          title="Cumulative Daily Cap"
          value={`$${totalDailyCap.toLocaleString()}`}
          subValue={totalDailyCap > 0 ? "Hard Capital Limit" : "No Limits Set"}
          icon={ShieldCheck}
          accent="emerald"
          badge="Hard Stop"
        />
        <StatCard
          title="Multi-Sig Escalation"
          value={spendingPolicies.length > 0 ? "Armed" : "Standby"}
          subValue={spendingPolicies.length > 0 ? "Zero Slippage Breaches" : "No rules active"}
          icon={Lock}
          accent="violet"
          badge="Verified"
        />
      </div>

      {/* Policy Rules Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {spendingPolicies.length === 0 ? (
          <div className="col-span-full py-14 px-4 text-center rounded-3xl bg-slate-900/40 border border-dashed border-slate-800">
            <Sliders className="w-10 h-10 text-slate-600 mx-auto mb-3 opacity-60" />
            <h3 className="text-base font-bold text-white">No Spending Policies Configured</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Define velocity limits, max transaction bounds, and allowed token whitelists to safeguard autonomous agent operations.
            </p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="mt-4 px-4 py-2 rounded-xl bg-cyan-500 text-slate-950 font-bold text-xs hover:bg-cyan-400 transition-colors"
            >
              + Create First Policy
            </button>
          </div>
        ) : (
          spendingPolicies.map((policy) => {
          const isActive = policy.status === 'active';

          return (
            <div
              key={policy.id}
              className={`p-6 rounded-3xl bg-slate-900/80 border transition-all duration-300 flex flex-col justify-between shadow-xl relative overflow-hidden ${
                isActive ? 'border-slate-800 hover:border-slate-700' : 'border-slate-800/40 opacity-60'
              }`}
            >
              <div
                className={`absolute top-0 left-0 right-0 h-1 ${
                  isActive ? 'bg-gradient-to-r from-cyan-400 to-violet-500' : 'bg-slate-700'
                }`}
              />

              <div>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <span
                    className={`text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full border ${
                      isActive
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                    {isActive ? 'ACTIVE & ENFORCED' : 'DISABLED'}
                  </span>
                  <span className="text-[11px] font-mono text-cyan-400 flex items-center gap-1">
                    <Bot className="w-3 h-3" /> {policy.targetAgent}
                  </span>
                </div>

                <h3 className="text-base font-bold text-white mb-1.5">{policy.name}</h3>
                <p className="text-xs text-slate-300 leading-relaxed mb-4 min-h-[36px]">
                  {policy.description}
                </p>

                {/* Constraint Metrics */}
                <div className="space-y-2 p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800/80 text-xs font-mono mb-4">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Max Daily Limit:</span>
                    <span className="font-bold text-cyan-400">${policy.maxDailySpend.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Max Single Tx:</span>
                    <span className="font-bold text-white">${policy.maxSingleTx.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Multi-Sig Approval:</span>
                    <span className="font-bold text-amber-400">&gt; ${policy.requireApprovalAbove.toLocaleString()}</span>
                  </div>
                </div>

                {/* Whitelisted Tokens */}
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 block mb-1.5">
                    Authorized Asset Whitelist
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {policy.allowedTokens.map((t) => (
                      <span key={t} className="px-2 py-0.5 rounded-md bg-slate-800 text-[10px] font-mono text-slate-300 border border-slate-700/60">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between">
                <button
                  onClick={() => togglePolicyStatus(policy.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono font-semibold transition-colors ${
                    isActive
                      ? 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20'
                      : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                  }`}
                >
                  <Power className="w-3 h-3" />
                  <span>{isActive ? 'Pause Rule' : 'Activate Rule'}</span>
                </button>

                <button
                  onClick={() => deletePolicy(policy.id)}
                  className="p-2 rounded-xl text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                  title="Delete Policy"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        }))}
      </div>

      {/* CREATE POLICY MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="w-full max-w-lg rounded-3xl bg-slate-900 border border-slate-750 shadow-2xl p-6 sm:p-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center font-bold">
                  <Sliders className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Create Spending Guardrail</h3>
                  <p className="text-xs text-slate-400">Configure programmable algorithmic spending limits</p>
                </div>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-2 rounded-xl text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleCreatePolicy} className="space-y-4 text-xs font-sans">
              <div>
                <label className="block text-slate-300 font-medium mb-1.5">Policy Rule Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Yield Vault Safety Ceiling"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1.5">Target Agent</label>
                <select
                  value={formData.targetAgent}
                  onChange={(e) => setFormData({ ...formData, targetAgent: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-cyan-400"
                >
                  <option value="All Fleet Agents">All Fleet Agents (Global Rule)</option>
                  {agents.map((a) => (
                    <option key={a.id} value={a.name}>
                      {a.name} ({a.type})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1.5">Daily Limit ($)</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.maxDailySpend}
                    onChange={(e) => setFormData({ ...formData, maxDailySpend: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono focus:outline-none focus:border-cyan-400"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1.5">Max Single Tx ($)</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.maxSingleTx}
                    onChange={(e) => setFormData({ ...formData, maxSingleTx: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono focus:outline-none focus:border-cyan-400"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1.5">Multi-Sig Above ($)</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.requireApprovalAbove}
                    onChange={(e) => setFormData({ ...formData, requireApprovalAbove: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono focus:outline-none focus:border-cyan-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1.5">Authorized Whitelisted Assets</label>
                <div className="flex flex-wrap gap-2">
                  {AVAILABLE_TOKENS.map((token) => {
                    const selected = formData.allowedTokens.includes(token);
                    return (
                      <button
                        type="button"
                        key={token}
                        onClick={() => toggleToken(token)}
                        className={`px-3 py-1 rounded-lg font-mono text-xs transition-colors border ${
                          selected
                            ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 font-bold'
                            : 'bg-slate-950 text-slate-400 border-slate-800'
                        }`}
                      >
                        {token}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl font-bold bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-lg shadow-cyan-500/20 active:scale-95 transition-all"
                >
                  Enforce Policy
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* BREACH DEFENSE SIMULATOR MODAL */}
      {testBreachOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="w-full max-w-md rounded-3xl bg-slate-900 border border-amber-500/30 shadow-2xl p-6 text-center">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center justify-center mx-auto mb-3">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Policy Guardrail Test Drill</h3>
            <p className="text-xs text-slate-300 mb-4 leading-relaxed">
              Simulating an AI agent attempting a single transaction of <strong>$50,000 USDC</strong>, which exceeds the active <strong>$15,000</strong> single-tx guardrail cap.
            </p>
            <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-left font-mono text-[11px] mb-6 space-y-1">
              <div className="text-amber-400 flex items-center gap-1.5 font-bold">
                <Lock className="w-3.5 h-3.5" /> ATOMIC REJECTION TRIGGERED
              </div>
              <div className="text-slate-400">Reason: PolicyViolation_ExceedsSingleTxCap</div>
              <div className="text-emerald-400">Result: 0 Funds Dispatched. Agent safe.</div>
            </div>
            <button
              onClick={() => setTestBreachOpen(false)}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold"
            >
              Dismiss Simulation
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
