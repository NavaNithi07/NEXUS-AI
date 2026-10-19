// src/components/ui/StatCard.tsx
import React from 'react';
import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  subValue?: string;
  change?: string;
  isPositive?: boolean;
  icon: LucideIcon;
  accent?: 'cyan' | 'violet' | 'emerald' | 'amber';
  badge?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subValue,
  change,
  isPositive = true,
  icon: Icon,
  accent = 'cyan',
  badge,
}) => {
  const accentStyles = {
    cyan: {
      borderHover: 'hover:border-cyan-500/40',
      iconBg: 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20',
      glow: 'group-hover:shadow-[0_0_20px_rgba(34,211,238,0.15)]',
    },
    violet: {
      borderHover: 'hover:border-violet-500/40',
      iconBg: 'bg-violet-500/10 text-violet-400 border border-violet-500/20',
      glow: 'group-hover:shadow-[0_0_20px_rgba(167,139,250,0.15)]',
    },
    emerald: {
      borderHover: 'hover:border-emerald-500/40',
      iconBg: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
      glow: 'group-hover:shadow-[0_0_20px_rgba(16,185,129,0.15)]',
    },
    amber: {
      borderHover: 'hover:border-amber-500/40',
      iconBg: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
      glow: 'group-hover:shadow-[0_0_20px_rgba(245,158,11,0.15)]',
    },
  }[accent];

  return (
    <motion.div
      whileHover={{ y: -3, transition: { duration: 0.2 } }}
      className={`group relative rounded-2xl bg-slate-900/80 backdrop-blur-xl border border-slate-800 p-5 transition-all duration-300 ${accentStyles.borderHover} ${accentStyles.glow} shadow-lg shadow-black/20`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
            {title}
          </p>
          <div className="mt-2 flex items-baseline gap-2">
            <h3 className="text-2xl font-bold tracking-tight text-white font-mono">
              {value}
            </h3>
            {badge && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-cyan-400 border border-cyan-500/20">
                {badge}
              </span>
            )}
          </div>
        </div>

        <div className={`p-3 rounded-xl ${accentStyles.iconBg}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>

      {(subValue || change) && (
        <div className="mt-3 flex items-center justify-between text-xs pt-3 border-t border-slate-800/60">
          {change ? (
            <div className={`flex items-center gap-1 font-medium ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
              {isPositive ? (
                <ArrowUpRight className="h-3.5 w-3.5" />
              ) : (
                <ArrowDownRight className="h-3.5 w-3.5" />
              )}
              <span>{change}</span>
              <span className="text-slate-500 font-normal ml-1">vs 24h ago</span>
            </div>
          ) : (
            <span className="text-slate-500">Autonomous Execution</span>
          )}

          {subValue && (
            <span className="text-slate-400 font-mono">{subValue}</span>
          )}
        </div>
      )}
    </motion.div>
  );
};
