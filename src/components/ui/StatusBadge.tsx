// src/components/ui/StatusBadge.tsx
import React from 'react';
import type { AgentStatus } from '../../types';

interface StatusBadgeProps {
  status: AgentStatus | string;
  size?: 'sm' | 'md' | 'lg';
  showPulse?: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  size = 'md',
  showPulse = true,
}) => {
  const normalized = status.toLowerCase();

  let colorClasses = 'bg-slate-800 text-slate-300 border-slate-700';
  let dotColor = 'bg-slate-400';
  let label = status;

  if (normalized === 'active' || normalized === 'completed' || normalized === 'success' || normalized === 'confirmed') {
    colorClasses = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
    dotColor = 'bg-emerald-400';
    label = normalized === 'active' ? 'Active' : 'Confirmed';
  } else if (normalized === 'reverted') {
    colorClasses = 'bg-purple-500/10 text-purple-400 border-purple-500/30';
    dotColor = 'bg-purple-400';
    label = 'Reverted';
  } else if (normalized === 'paused' || normalized === 'pending' || normalized === 'warning' || normalized === 'submitted_pending' || normalized === 'pending_reconciliation') {
    colorClasses = 'bg-amber-500/10 text-amber-400 border-amber-500/30';
    dotColor = 'bg-amber-400';
    label = normalized === 'paused' ? 'Paused' : (normalized === 'warning' ? 'Warning' : 'Pending');
  } else if (normalized === 'stopped' || normalized === 'failed' || normalized === 'critical' || normalized === 'rejected') {
    colorClasses = 'bg-rose-500/10 text-rose-400 border-rose-500/30';
    dotColor = 'bg-rose-400';
    label = normalized === 'rejected' ? 'Rejected' : (normalized === 'stopped' ? 'Stopped' : 'Failed');
  }

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5 gap-1.5',
    md: 'text-xs font-medium px-2.5 py-1 gap-1.5',
    lg: 'text-sm font-semibold px-3 py-1.5 gap-2',
  }[size];

  return (
    <span
      className={`inline-flex items-center rounded-full border tracking-wide uppercase font-mono ${sizeClasses} ${colorClasses}`}
    >
      <span className="relative flex h-2 w-2">
        {showPulse && normalized === 'active' && (
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${dotColor}`}></span>
        )}
        <span className={`relative inline-flex rounded-full h-2 w-2 ${dotColor}`}></span>
      </span>
      <span>{label}</span>
    </span>
  );
};
