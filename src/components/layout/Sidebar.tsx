// src/components/layout/Sidebar.tsx
import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Bot,
  Wallet,
  ArrowLeftRight,
  Sliders,
  ShieldCheck,
  Activity,
  Settings,
  Cpu,
  Radio,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { CyberFoxLogo } from '../ui/CyberFoxLogo';

interface SidebarProps {
  isOpen: boolean;
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { agents, isGlobalEmergencyHalted } = useAppStore();
  const activeCount = agents.filter((a) => a.status === 'active').length;

  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'AI Agents', path: '/agents', icon: Bot, badge: agents.length },
    { name: 'Wallet & Assets', path: '/wallet', icon: Wallet },
    { name: 'Transactions', path: '/transactions', icon: ArrowLeftRight },
    { name: 'Spending Policies', path: '/policies', icon: Sliders },
    { name: 'Security Center', path: '/security', icon: ShieldCheck, alert: isGlobalEmergencyHalted },
    { name: 'Monitoring & Logs', path: '/monitoring', icon: Activity },
    { name: 'Settings', path: '/settings', icon: Settings },
  ];

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden transition-opacity"
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-72 bg-navy-900 border-r border-slate-800/80 flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="h-20 flex items-center justify-between px-6 border-b border-slate-800/70 bg-navy-950/60">
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center w-11 h-11 rounded-2xl bg-slate-900/90 border border-cyan-500/30 shadow-lg shadow-cyan-500/20">
              <CyberFoxLogo size="sm" showGlow={false} />
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-navy-900" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-base tracking-wider text-white">NEXUS</span>
                <span className="text-xs px-1.5 py-0.2 rounded font-mono font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                  AI
                </span>
              </div>
              <p className="text-[10px] font-mono text-slate-400 tracking-tight">AUTONOMOUS VAULT</p>
            </div>
          </div>
        </div>

        {/* Status Pill Indicator */}
        <div className="px-5 py-3 border-b border-slate-800/60 bg-slate-900/40">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <Radio className={`w-3.5 h-3.5 ${isGlobalEmergencyHalted ? 'text-rose-500' : 'text-emerald-400 animate-pulse'}`} />
              <span className="text-slate-400 text-[11px] font-mono">
                {isGlobalEmergencyHalted ? 'SYSTEM HALTED' : 'AGENTS ACTIVE'}
              </span>
            </div>
            <span className="font-mono text-[11px] font-semibold text-cyan-400 bg-cyan-950/60 border border-cyan-800/40 px-2 py-0.5 rounded-full">
              {activeCount} / {agents.length} Online
            </span>
          </div>
        </div>

        {/* Navigation items */}
        <nav className="flex-1 overflow-y-auto px-4 py-4 space-y-1.5">
          <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500 px-3 py-1 font-semibold">
            Core Modules
          </div>

          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={onClose}
              className={({ isActive }) =>
                `group relative flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-gradient-to-r from-cyan-500/15 to-violet-500/10 text-cyan-300 border border-cyan-500/30 shadow-sm shadow-cyan-950'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <div className="flex items-center gap-3">
                    <item.icon
                      className={`w-4 h-4 transition-colors ${
                        isActive ? 'text-cyan-400' : 'text-slate-400 group-hover:text-cyan-300'
                      }`}
                    />
                    <span>{item.name}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {item.badge !== undefined && (
                      <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                        {item.badge}
                      </span>
                    )}
                    {item.alert && (
                      <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                    )}
                    {isActive && (
                      <ChevronRight className="w-3.5 h-3.5 text-cyan-400" />
                    )}
                  </div>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Agent Telemetry Card */}
        <div className="p-4 border-t border-slate-800/80 bg-navy-950/80">
          <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono text-slate-400 text-[10px] uppercase tracking-wider">Gas Optimization</span>
              <span className="text-emerald-400 font-mono text-[11px] font-bold">-38% Gwei</span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
              <div className="bg-gradient-to-r from-cyan-400 to-violet-500 h-1.5 rounded-full w-4/5" />
            </div>
            <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400">
              <span className="flex items-center gap-1">
                <Cpu className="w-3 h-3 text-cyan-400" />
                <span>v2.4 Kernel</span>
              </span>
              <span className="text-cyan-400/80 font-mono flex items-center gap-0.5">
                On-Chain <ExternalLink className="w-2.5 h-2.5" />
              </span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
