// src/components/layout/AppLayout.tsx
import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { ShieldAlert, AlertTriangle } from 'lucide-react';
import { useAppStore } from '../../store/appStore';

export const AppLayout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { isGlobalEmergencyHalted, resumeGlobalOperations, fetchOnChainStatus } = useAppStore();

  React.useEffect(() => {
    fetchOnChainStatus();
    const interval = setInterval(fetchOnChainStatus, 10000);
    return () => clearInterval(interval);
  }, [fetchOnChainStatus]);

  return (
    <div className="min-h-screen bg-navy-950 text-slate-100 flex flex-col font-sans">
      {/* Sidebar navigation */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main wrapper shifted on desktop */}
      <div className="lg:pl-72 flex flex-col min-h-screen">
        {/* Global Emergency Banner if triggered */}
        {isGlobalEmergencyHalted && (
          <div className="bg-rose-500/20 border-b border-rose-500/40 text-rose-300 px-4 py-2.5 flex items-center justify-between text-xs sm:text-sm font-mono backdrop-blur-md sticky top-0 z-40">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-400 animate-pulse" />
              <span>
                <strong>GLOBAL EMERGENCY HALT ACTIVE:</strong> All autonomous on-chain trading & liquidity execution paused.
              </span>
            </div>
            <button
              onClick={resumeGlobalOperations}
              className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold transition-colors"
            >
              Resume All
            </button>
          </div>
        )}

        {/* Global Header */}
        <Header onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />

        {/* Dynamic Page Outlet */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>

        {/* Clean Footer */}
        <footer className="py-4 px-6 border-t border-slate-800/60 bg-navy-950 text-slate-500 text-xs flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-slate-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span>NEXUS AI WALLET — Autonomous On-Chain Execution Enclave</span>
          </div>
          <div className="font-mono text-[11px] text-slate-500">
            CRYPTOGRAPHIC AUDIT TRAIL • ZERO-TRUST PERMISSIONS
          </div>
        </footer>
      </div>
    </div>
  );
};
