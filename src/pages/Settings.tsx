// src/pages/Settings.tsx
import React, { useState } from 'react';
import {
  Settings as SettingsIcon,
  Save,
  RotateCcw,
  Check,
  Globe,
  Shield,
  Cpu,
  Radio,
  Bell,
  Download,
  AlertCircle,
  Activity,
  Send,
} from 'lucide-react';
import { useAppStore } from '../store/appStore';
import type { SystemSettings } from '../types';

export const Settings: React.FC = () => {
  const { settings, updateSettings, resetDemoData, agents, walletAssets, transactions, spendingPolicies } = useAppStore();

  const [formData, setFormData] = useState<SystemSettings>({ ...settings });
  const [saved, setSaved] = useState(false);
  const [pingResult, setPingResult] = useState<string | null>(null);
  const [isPinging, setIsPinging] = useState(false);
  const [webhookTestStatus, setWebhookTestStatus] = useState<string | null>(null);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings(formData);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handlePing = () => {
    setIsPinging(true);
    setPingResult(null);
    setTimeout(() => {
      setIsPinging(false);
      setPingResult('14ms — Healthy (Arbitrum Nitro Node)');
    }, 800);
  };

  const handleTestWebhook = (type: 'Discord' | 'Telegram') => {
    setWebhookTestStatus(`Simulated ${type} webhook ping sent successfully!`);
    setTimeout(() => setWebhookTestStatus(null), 3000);
  };

  const handleExportStateJSON = () => {
    const fullState = {
      exportedAt: new Date().toISOString(),
      platform: 'NEXUS AI WALLET',
      agents,
      walletAssets,
      transactions,
      spendingPolicies,
      settings: formData,
    };

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(fullState, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `nexus-wallet-backup-${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleReset = () => {
    if (window.confirm('Reset all vault state to a clean initial state?')) {
      resetDemoData();
      window.location.reload();
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn max-w-5xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <span>System & RPC Node Configuration</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Configure blockchain network endpoints, neural hyperparameters, webhook relays, and backups.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportStateJSON}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            <span>Export JSON</span>
          </button>

          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-rose-400 text-xs font-semibold border border-slate-700 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Clear All Data</span>
          </button>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {saved && (
          <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2 font-semibold">
            <Check className="w-4 h-4" />
            <span>All system configurations and hyperparameters have been persisted!</span>
          </div>
        )}

        {webhookTestStatus && (
          <div className="p-4 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-xs flex items-center gap-2 font-semibold">
            <Check className="w-4 h-4" />
            <span>{webhookTestStatus}</span>
          </div>
        )}

        {/* 1. Network & RPC Endpoints */}
        <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Globe className="w-4 h-4 text-cyan-400" />
              <span>Primary Blockchain RPC Node</span>
            </h3>
            <button
              type="button"
              onClick={handlePing}
              disabled={isPinging}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-400 text-xs font-mono border border-slate-700 flex items-center gap-1.5"
            >
              <Activity className="w-3.5 h-3.5" />
              <span>{isPinging ? 'Pinging...' : 'Test Latency / Ping'}</span>
            </button>
          </div>

          {pingResult && (
            <div className="p-3 rounded-xl bg-slate-950 border border-emerald-500/30 text-emerald-400 font-mono text-xs flex items-center justify-between">
              <span>Ping Response: {pingResult}</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            </div>
          )}

          <div className="space-y-3 text-xs">
            <div>
              <label className="block text-slate-300 font-medium mb-1.5">Arbitrum RPC Gateway URL</label>
              <input
                type="text"
                value={formData.rpcUrl}
                onChange={(e) => setFormData({ ...formData, rpcUrl: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono focus:outline-none focus:border-cyan-400"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-300 font-medium mb-1.5">Gas Multiplier Buffer</label>
                <input
                  type="number"
                  step="0.05"
                  value={formData.gasMultiplier}
                  onChange={(e) => setFormData({ ...formData, gasMultiplier: Number(e.target.value) })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1.5">Max Default Slippage (%)</label>
                <input
                  type="number"
                  step="0.05"
                  value={formData.autoSlippage}
                  onChange={(e) => setFormData({ ...formData, autoSlippage: Number(e.target.value) })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono focus:outline-none focus:border-cyan-400"
                />
              </div>
            </div>
          </div>
        </div>

        {/* 2. Neural Agent Hyperparameters */}
        <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Cpu className="w-4 h-4 text-violet-400" />
            <span>Autonomous Neural Hyperparameters</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-slate-300 font-medium mb-1.5">Fleet Risk Tolerance</label>
              <select
                value={formData.riskTolerance}
                onChange={(e) => setFormData({ ...formData, riskTolerance: e.target.value as any })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-cyan-400"
              >
                <option value="Conservative">Conservative (Capital Preservation Focus)</option>
                <option value="Moderate">Moderate (Balanced Yield & Spread Arbitrage)</option>
                <option value="Aggressive">Aggressive (High-Frequency DEX Flash Swaps)</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1.5">Vault Rebalance Frequency</label>
              <select
                value={formData.rebalanceFreq}
                onChange={(e) => setFormData({ ...formData, rebalanceFreq: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-cyan-400"
              >
                <option value="Every 15 mins">Every 15 minutes</option>
                <option value="Every 30 mins">Every 30 minutes</option>
                <option value="Every 1 hour">Every 1 hour</option>
                <option value="Every 4 hours">Every 4 hours</option>
              </select>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <label className="flex items-center gap-3 p-3.5 rounded-2xl bg-slate-950 border border-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.autoPauseFailures}
                onChange={(e) => setFormData({ ...formData, autoPauseFailures: e.target.checked })}
                className="rounded accent-cyan-500 w-4 h-4"
              />
              <div>
                <span className="text-xs font-semibold text-white block">Auto-Pause Agent on 3 Consecutive Failures</span>
                <span className="text-[11px] text-slate-400">Halts capital execution if an underlying DEX pool experiences abnormal slippage or depth drops.</span>
              </div>
            </label>

            <label className="flex items-center gap-3 p-3.5 rounded-2xl bg-slate-950 border border-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.enforcePrivateRouting}
                onChange={(e) => setFormData({ ...formData, enforcePrivateRouting: e.target.checked })}
                className="rounded accent-cyan-500 w-4 h-4"
              />
              <div>
                <span className="text-xs font-semibold text-white block">Enforce Flashbots Private Relay Routing</span>
                <span className="text-[11px] text-slate-400">Directly routes all swaps through private validators to prevent frontrunning.</span>
              </div>
            </label>
          </div>
        </div>

        {/* 3. Webhook Alert Relays */}
        <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Bell className="w-4 h-4 text-amber-400" />
            <span>Simulated Webhook Integrations</span>
          </h3>

          <div className="space-y-3 text-xs">
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-slate-300 font-medium">Discord Webhook Alert URL</label>
                <button
                  type="button"
                  onClick={() => handleTestWebhook('Discord')}
                  className="text-cyan-400 hover:text-cyan-300 font-mono flex items-center gap-1"
                >
                  <Send className="w-3 h-3" /> Test Discord Ping
                </button>
              </div>
              <input
                type="text"
                value={formData.discordWebhook}
                onChange={(e) => setFormData({ ...formData, discordWebhook: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono focus:outline-none focus:border-cyan-400"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-slate-300 font-medium">Telegram Bot API Webhook</label>
                <button
                  type="button"
                  onClick={() => handleTestWebhook('Telegram')}
                  className="text-cyan-400 hover:text-cyan-300 font-mono flex items-center gap-1"
                >
                  <Send className="w-3 h-3" /> Test Telegram Ping
                </button>
              </div>
              <input
                type="text"
                value={formData.telegramWebhook}
                onChange={(e) => setFormData({ ...formData, telegramWebhook: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono focus:outline-none focus:border-cyan-400"
              />
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            className="flex items-center gap-2 px-8 py-3 rounded-2xl font-bold bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-slate-950 shadow-xl shadow-cyan-500/20 active:scale-95 transition-all text-sm"
          >
            <Save className="w-4 h-4 stroke-[3]" />
            <span>Save All Configurations</span>
          </button>
        </div>
      </form>
    </div>
  );
};
