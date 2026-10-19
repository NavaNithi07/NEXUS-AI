import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Menu,
  ShieldAlert,
  ShieldCheck,
  Bell,
  Copy,
  Check,
  Globe,
  Sparkles,
  LogOut,
  User,
} from 'lucide-react';
import { useAppStore } from '../../store/appStore';

interface HeaderProps {
  onToggleSidebar: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onToggleSidebar }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    isGlobalEmergencyHalted,
    triggerGlobalEmergencyStop,
    resumeGlobalOperations,
    activityLogs,
    logout,
    currentUser,
    onChainAddress,
    onChainNetwork,
  } = useAppStore();
  const [copied, setCopied] = useState(false);
  const [showLogsDropdown, setShowLogsDropdown] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const getPageTitle = (pathname: string) => {
    switch (pathname) {
      case '/':
        return { title: 'Autonomous Command Center', subtitle: 'Real-time agent execution & on-chain treasury monitoring' };
      case '/agents':
        return { title: 'AI Agent Fleet Management', subtitle: 'Configure, deploy, and audit autonomous trading and yield agents' };
      case '/wallet':
        return { title: 'Multi-Chain Asset Vault', subtitle: 'Smart contract custody and multi-asset reserves' };
      case '/transactions':
        return { title: 'On-Chain Transaction Stream', subtitle: 'Immutable ledger of autonomous agent calls and swaps' };
      case '/policies':
        return { title: 'Autonomous Spending Policies', subtitle: 'Programmable guardrails, velocity limits, and multi-sig triggers' };
      case '/security':
        return { title: 'Security & Circuit Breakers', subtitle: 'Mempool MEV protection, threat telemetry, and emergency controls' };
      case '/monitoring':
        return { title: 'Real-Time Telemetry & Logs', subtitle: 'Kernel execution audit trails and state changes' };
      case '/settings':
        return { title: 'System & RPC Configuration', subtitle: 'Manage networks, keys, model hyperparameters, and webhooks' };
      default:
        return { title: 'Autonomous AI Platform', subtitle: 'Decentralized automated finance' };
    }
  };

  const { title, subtitle } = getPageTitle(location.pathname);
  const displayAddress = onChainAddress ? `${onChainAddress.slice(0, 6)}...${onChainAddress.slice(-4)}` : '0x2836...f657';

  const copyAddress = () => {
    navigator.clipboard.writeText(onChainAddress || '0x2836a264976f67178BE78F1b963f545c7BB5f657');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <header className="sticky top-0 z-30 h-20 bg-navy-900/90 backdrop-blur-md border-b border-slate-800/80 px-4 sm:px-8 flex items-center justify-between">
      {/* Left Title & Mobile Menu */}
      <div className="flex items-center gap-4">
        <button
          onClick={onToggleSidebar}
          className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/60 lg:hidden transition-colors"
          aria-label="Toggle Navigation"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-white flex items-center gap-2">
              {title}
            </h1>
            <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5 animate-pulse" /> LIVE ENCLAVE
            </span>
          </div>
          <p className="text-xs text-slate-400 hidden md:block">
            {subtitle}
          </p>
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Network Badge */}
        <div className="hidden xl:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs">
          <Globe className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-slate-300 font-medium">{onChainNetwork || 'Base Sepolia'}</span>
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
        </div>

        {/* Emergency Stop / Circuit Breaker Quick Action */}
        {isGlobalEmergencyHalted ? (
          <button
            onClick={resumeGlobalOperations}
            className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-all shadow-md shadow-emerald-500/20 active:scale-95"
            title="Resume All System Operations"
          >
            <ShieldCheck className="w-4 h-4" />
            <span className="hidden sm:inline">Resume System</span>
          </button>
        ) : (
          <button
            onClick={() => {
              if (window.confirm('EMERGENCY STOP WARNING:\n\nAre you sure you want to trigger the global circuit breaker? This will halt ALL active autonomous agents immediately.')) {
                triggerGlobalEmergencyStop();
              }
            }}
            className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs font-semibold bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 border border-rose-500/30 transition-all active:scale-95"
            title="Emergency Circuit Breaker"
          >
            <ShieldAlert className="w-4 h-4" />
            <span className="hidden sm:inline">Emergency Halt</span>
          </button>
        )}

        {/* Notifications & Log Feed Popover */}
        <div className="relative">
          <button
            onClick={() => setShowLogsDropdown(!showLogsDropdown)}
            className="relative p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 transition-colors"
            aria-label="Activity Feed"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-cyan-400"></span>
          </button>

          {showLogsDropdown && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-slate-900/95 backdrop-blur-xl border border-slate-700 shadow-2xl p-4 z-50">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <span className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                  Live Agent Telemetry
                </span>
                <span className="text-[11px] text-cyan-400 font-mono">
                  {activityLogs.length} Events
                </span>
              </div>
              <div className="mt-3 max-h-72 overflow-y-auto space-y-2.5 pr-1">
                {activityLogs.slice(0, 5).map((log) => (
                  <div key={log.id} className="p-2.5 rounded-xl bg-slate-800/40 border border-slate-800 text-xs">
                    <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                      <span className="font-semibold text-cyan-300">{log.agentName}</span>
                      <span className="font-mono text-[10px]">{log.timestamp}</span>
                    </div>
                    <p className="text-white font-medium">{log.action}</p>
                    <p className="text-slate-400 text-[11px] mt-0.5 line-clamp-2">{log.details}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* On-Chain Signer Enclave Pill */}
        <div
          onClick={copyAddress}
          className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs font-mono text-slate-300 hover:border-cyan-500/40 cursor-pointer transition-colors"
          title="Click to copy vault address"
        >
          <div className="w-2 h-2 rounded-full bg-cyan-400" />
          <span>{displayAddress}</span>
          {copied ? (
            <Check className="w-3.5 h-3.5 text-emerald-400" />
          ) : (
            <Copy className="w-3.5 h-3.5 text-slate-500" />
          )}
        </div>

        {/* Operator Profile & Logout Button */}
        <div className="flex items-center gap-1.5 pl-1 sm:pl-2 border-l border-slate-800">
          <div className="hidden md:flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs">
            <div className="w-5 h-5 rounded-lg bg-gradient-to-br from-cyan-500/20 to-violet-500/20 border border-cyan-500/30 text-cyan-300 flex items-center justify-center font-bold text-[10px]">
              <User className="w-3 h-3" />
            </div>
            <span className="text-slate-300 font-medium text-[11px]">
              {currentUser?.name || 'Operator'}
            </span>
          </div>

          <button
            onClick={handleLogout}
            className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
            title="Log Out of Vault"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
