// src/pages/Agents.tsx
import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Bot,
  Plus,
  Search,
  Filter,
  ArrowUpDown,
  Play,
  Pause,
  Trash2,
  Eye,
  Edit3,
  X,
  AlertCircle,
  CheckCircle2,
  DollarSign,
  Activity,
  Layers,
  ArrowUpRight,
  Shield,
  Zap,
  Sparkles,
  ExternalLink,
  Loader2,
  ShieldAlert,
} from 'lucide-react';
import { useAppStore } from '../store/appStore';
import type { Agent, AgentStatus, AgentType } from '../types';
import { StatusBadge } from '../components/ui/StatusBadge';
import { StatCard } from '../components/ui/StatCard';

const AGENT_TYPES: AgentType[] = [
  'Arbitrage Bot',
  'Yield Optimizer',
  'DEX Liquidity',
  'DeFi Rebalancer',
  'Treasury Manager',
  'Risk Sentinel',
];

export const Agents: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    agents,
    addAgent,
    updateAgent,
    deleteAgent,
    pauseAgent,
    resumeAgent,
    setAgentStatus,
    transactions,
    activityLogs,
    executeAgentTask,
    onChainNetwork,
    onChainAddress,
  } = useAppStore();

  // Search, filter, and sort state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | AgentStatus>('all');
  const [sortBy, setSortBy] = useState<'name' | 'spending' | 'balance'>('spending');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [viewingAgent, setViewingAgent] = useState<Agent | null>(null);
  const [agentToDelete, setAgentToDelete] = useState<Agent | null>(null);
  const [executingAgent, setExecutingAgent] = useState<Agent | null>(null);
  const [taskGoal, setTaskGoal] = useState('Send 0.001 ETH to 0x70997970C51812dc3A010C7d01b50e0d17dc79C8 for liquidity reserve');
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<any>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'Arbitrage Bot' as AgentType,
    balance: 25000,
    dailyLimit: 15000,
    maxTxAmount: 5000,
    status: 'active' as AgentStatus,
  });

  const [formError, setFormError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Handle URL params for opening Create Modal automatically if ?action=new
  useEffect(() => {
    if (searchParams.get('action') === 'new') {
      setIsCreateModalOpen(true);
      searchParams.delete('action');
      setSearchParams(searchParams);
    }
  }, [searchParams, setSearchParams]);

  // Derived Summary Counts
  const totalAgents = agents.length;
  const activeAgents = agents.filter((a) => a.status === 'active').length;
  const pausedAgents = agents.filter((a) => a.status === 'paused').length;
  const totalSpending = agents.reduce((sum, a) => sum + a.spentToday, 0);

  // Filter and Sort Agents
  const filteredAndSortedAgents = useMemo(() => {
    return agents
      .filter((agent) => {
        const matchesSearch =
          agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          agent.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
          agent.type.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = statusFilter === 'all' || agent.status === statusFilter;
        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => {
        let comparison = 0;
        if (sortBy === 'name') {
          comparison = a.name.localeCompare(b.name);
        } else if (sortBy === 'spending') {
          comparison = a.spentToday - b.spentToday;
        } else if (sortBy === 'balance') {
          comparison = a.balance - b.balance;
        }
        return sortOrder === 'desc' ? -comparison : comparison;
      });
  }, [agents, searchQuery, statusFilter, sortBy, sortOrder]);

  // Open Create Modal
  const handleOpenCreateModal = () => {
    setFormData({
      name: '',
      description: '',
      type: 'Arbitrage Bot',
      balance: 20000,
      dailyLimit: 10000,
      maxTxAmount: 2500,
      status: 'active',
    });
    setFormError(null);
    setEditingAgent(null);
    setIsCreateModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (agent: Agent) => {
    setEditingAgent(agent);
    setFormData({
      name: agent.name,
      description: agent.description,
      type: (agent.type as AgentType) || 'Arbitrage Bot',
      balance: agent.balance,
      dailyLimit: agent.dailyLimit,
      maxTxAmount: agent.maxTxAmount,
      status: agent.status,
    });
    setFormError(null);
    setIsCreateModalOpen(true);
  };

  // Handle Form Submission (Create or Edit)
  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Validation
    if (!formData.name.trim()) {
      setFormError('Agent name is required.');
      return;
    }
    if (!formData.description.trim()) {
      setFormError('Agent purpose/description is required.');
      return;
    }
    if (formData.balance < 0) {
      setFormError('Initial wallet balance must be 0 or positive.');
      return;
    }
    if (formData.dailyLimit <= 0) {
      setFormError('Daily spending limit must be greater than 0.');
      return;
    }
    if (formData.maxTxAmount <= 0) {
      setFormError('Maximum transaction amount must be greater than 0.');
      return;
    }
    if (formData.maxTxAmount > formData.dailyLimit) {
      setFormError('Maximum transaction amount cannot exceed daily spending limit.');
      return;
    }

    if (editingAgent) {
      updateAgent(editingAgent.id, {
        name: formData.name.trim(),
        description: formData.description.trim(),
        type: formData.type,
        balance: Number(formData.balance),
        dailyLimit: Number(formData.dailyLimit),
        maxTxAmount: Number(formData.maxTxAmount),
        status: formData.status,
      });
      setSuccessToast(`Agent "${formData.name}" successfully updated!`);
    } else {
      addAgent({
        name: formData.name.trim(),
        description: formData.description.trim(),
        type: formData.type,
        balance: Number(formData.balance),
        dailyLimit: Number(formData.dailyLimit),
        maxTxAmount: Number(formData.maxTxAmount),
        status: formData.status,
      });
      setSuccessToast(`New agent "${formData.name}" deployed successfully!`);
    }

    setIsCreateModalOpen(false);
    setEditingAgent(null);
    setTimeout(() => setSuccessToast(null), 4000);
  };

  // Confirm Delete
  const handleConfirmDelete = () => {
    if (agentToDelete) {
      deleteAgent(agentToDelete.id);
      setSuccessToast(`Agent "${agentToDelete.name}" was deprovisioned.`);
      setAgentToDelete(null);
      setTimeout(() => setSuccessToast(null), 4000);
    }
  };

  // Autonomous Execution Handlers
  const handleOpenExecuteModal = (agent: Agent) => {
    setExecutingAgent(agent);
    setTaskGoal('Send 0.001 ETH to 0x70997970C51812dc3A010C7d01b50e0d17dc79C8 for liquidity reserve');
    setExecutionResult(null);
  };

  const handleRunAutonomousTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!executingAgent || !taskGoal.trim() || isExecuting) return;

    setIsExecuting(true);
    setExecutionResult(null);

    const result = await executeAgentTask(executingAgent.id, taskGoal.trim());
    setExecutionResult(result);
    setIsExecuting(false);
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Toast Notification */}
      {successToast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-2xl bg-emerald-500 text-slate-950 font-semibold text-xs sm:text-sm shadow-2xl animate-bounce">
          <CheckCircle2 className="w-5 h-5 text-slate-950" />
          <span>{successToast}</span>
        </div>
      )}

      {/* Header & Create Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <span>Autonomous AI Agent Fleet</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Configure algorithmic parameters, budget velocity limits, and monitor live execution states.
          </p>
        </div>

        <button
          onClick={handleOpenCreateModal}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/25 active:scale-95 transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>Deploy New Agent</span>
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Registered Agents"
          value={totalAgents}
          subValue="Registry v2.4"
          icon={Bot}
          accent="cyan"
        />
        <StatCard
          title="Active On-Chain Agents"
          value={activeAgents}
          subValue={`${totalAgents > 0 ? Math.round((activeAgents / totalAgents) * 100) : 0}% fleet active`}
          icon={Zap}
          accent="emerald"
        />
        <StatCard
          title="Paused / Inactive"
          value={pausedAgents}
          subValue="Standby reserve"
          icon={Pause}
          accent="amber"
        />
        <StatCard
          title="Total Agent Spending Today"
          value={`$${totalSpending.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
          subValue="Hard-capped budget"
          icon={DollarSign}
          accent="violet"
        />
      </div>

      {/* Filters, Search & Sort Bar */}
      <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 shadow-lg">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search agents by name, type, or purpose..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-950/80 border border-slate-750 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition-colors"
          />
        </div>

        {/* Controls: Filter & Sort */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="bg-slate-950 border border-slate-750 text-xs text-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:border-cyan-400"
            >
              <option value="all">All Statuses ({agents.length})</option>
              <option value="active">Active Only</option>
              <option value="paused">Paused Only</option>
              <option value="stopped">Stopped Only</option>
            </select>
          </div>

          {/* Sort By */}
          <div className="flex items-center gap-2">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-slate-950 border border-slate-750 text-xs text-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:border-cyan-400"
            >
              <option value="spending">Sort by Today's Spending</option>
              <option value="balance">Sort by Wallet Balance</option>
              <option value="name">Sort by Name</option>
            </select>
            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="px-2.5 py-2 rounded-xl bg-slate-800 text-xs text-slate-300 hover:text-white border border-slate-700"
              title="Toggle Sort Direction"
            >
              {sortOrder.toUpperCase()}
            </button>
          </div>
        </div>
      </div>

      {/* Agents Grid */}
      {filteredAndSortedAgents.length === 0 ? (
        <div className="p-12 text-center rounded-3xl bg-slate-900/40 border border-dashed border-slate-800">
          <Bot className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-white">No AI Agents Found</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            {searchQuery
              ? `No agents matching "${searchQuery}". Clear your search or deploy a new agent.`
              : 'No agents registered in this category. Click Deploy New Agent to configure one.'}
          </p>
          <button
            onClick={handleOpenCreateModal}
            className="mt-4 px-4 py-2 rounded-xl bg-cyan-500 text-slate-950 font-bold text-xs hover:bg-cyan-400 transition-colors"
          >
            Deploy Agent
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredAndSortedAgents.map((agent) => {
            const spentPercent = Math.min(100, Math.round((agent.spentToday / (agent.dailyLimit || 1)) * 100));

            return (
              <div
                key={agent.id}
                className="group rounded-3xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 p-6 flex flex-col justify-between transition-all duration-300 shadow-xl hover:shadow-cyan-500/5 relative overflow-hidden"
              >
                {/* Status indicator bar on top */}
                <div
                  className={`absolute top-0 left-0 right-0 h-1 ${
                    agent.status === 'active'
                      ? 'bg-gradient-to-r from-cyan-400 to-emerald-400'
                      : agent.status === 'paused'
                      ? 'bg-amber-400'
                      : 'bg-rose-500'
                  }`}
                />

                <div>
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-violet-500/20 border border-cyan-500/30 text-cyan-300 flex items-center justify-center font-bold text-lg shadow-inner">
                        <Bot className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="font-bold text-base text-white group-hover:text-cyan-300 transition-colors">
                          {agent.name}
                        </h3>
                        <span className="text-[11px] font-mono font-medium text-slate-400">
                          {agent.type}
                        </span>
                      </div>
                    </div>
                    <StatusBadge status={agent.status} size="sm" />
                  </div>

                  {/* Purpose / Description */}
                  <p className="text-xs text-slate-300 line-clamp-2 min-h-[32px] leading-relaxed mb-4">
                    {agent.description}
                  </p>

                  {/* Financial Metrics Box */}
                  <div className="grid grid-cols-2 gap-3 p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80 mb-4 text-xs font-mono">
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Wallet Balance</span>
                      <span className="text-sm font-bold text-white">
                        ${agent.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Daily Limit</span>
                      <span className="text-sm font-bold text-slate-200">
                        ${agent.dailyLimit.toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Spent Today</span>
                      <span className="text-xs font-semibold text-cyan-400">
                        ${agent.spentToday.toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Max Single Tx</span>
                      <span className="text-xs font-semibold text-slate-300">
                        ${agent.maxTxAmount.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* Daily Budget Progress Bar */}
                  <div className="mb-4">
                    <div className="flex justify-between text-[11px] font-mono text-slate-400 mb-1">
                      <span>Daily Budget Utilization</span>
                      <span className={spentPercent > 80 ? 'text-rose-400 font-bold' : 'text-slate-300'}>
                        {spentPercent}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-1.5 rounded-full transition-all duration-500 ${
                          spentPercent > 85 ? 'bg-rose-500' : spentPercent > 50 ? 'bg-amber-400' : 'bg-cyan-400'
                        }`}
                        style={{ width: `${spentPercent}%` }}
                      />
                    </div>
                  </div>

                  {/* Extra Metadata: Tx Count & Last Active */}
                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 pt-3 border-t border-slate-800/80">
                    <span className="flex items-center gap-1">
                      <Activity className="w-3 h-3 text-cyan-400" />
                      <span>{agent.txCount} txs today</span>
                    </span>
                    <span className="text-slate-400">Active: {agent.lastActive}</span>
                  </div>
                </div>

                {/* Card Action Buttons */}
                <div className="mt-5 pt-3 border-t border-slate-800 flex items-center justify-between gap-1.5 flex-wrap">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {/* View Details */}
                    <button
                      onClick={() => setViewingAgent(agent)}
                      className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                      title="View Agent Telemetry & Logs"
                    >
                      <Eye className="w-4 h-4" />
                    </button>

                    {/* Edit */}
                    <button
                      onClick={() => handleOpenEditModal(agent)}
                      className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                      title="Edit Agent Parameters"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>

                    {/* Pause / Resume Toggle */}
                    {agent.status === 'active' ? (
                      <button
                        onClick={() => pauseAgent(agent.id)}
                        className="p-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 transition-colors"
                        title="Pause Agent Execution"
                      >
                        <Pause className="w-4 h-4" />
                      </button>
                    ) : (
                      <button
                        onClick={() => resumeAgent(agent.id)}
                        className="p-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 transition-colors"
                        title="Resume Agent Execution"
                      >
                        <Play className="w-4 h-4" />
                      </button>
                    )}

                    {/* Execute Autonomous Task */}
                    <button
                      onClick={() => handleOpenExecuteModal(agent)}
                      disabled={agent.status !== 'active'}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-xl font-bold text-xs transition-all ${
                        agent.status === 'active'
                          ? 'bg-gradient-to-r from-cyan-500/20 to-violet-500/20 border border-cyan-500/40 text-cyan-300 hover:border-cyan-400 hover:from-cyan-500/30 hover:to-violet-500/30 shadow-md shadow-cyan-500/10 active:scale-95'
                          : 'bg-slate-800/40 text-slate-600 border border-slate-800 cursor-not-allowed'
                      }`}
                      title={agent.status === 'active' ? 'Assign Autonomous Financial Goal' : 'Agent Paused - Resume to execute'}
                    >
                      <Zap className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Execute Task</span>
                    </button>
                  </div>

                  {/* Delete button */}
                  <button
                    onClick={() => setAgentToDelete(agent)}
                    className="p-2 rounded-xl text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/30 border border-transparent transition-colors"
                    title="Terminate and Deprovision Agent"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE / EDIT AGENT MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="w-full max-w-xl rounded-3xl bg-slate-900 border border-slate-750 shadow-2xl p-6 sm:p-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center font-bold">
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">
                    {editingAgent ? 'Edit Autonomous Agent' : 'Deploy Autonomous AI Agent'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {editingAgent ? 'Update parameters and safety guardrails' : 'Provision on-chain execution credentials and balance limits'}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="mb-6 p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2 font-medium">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitForm} className="space-y-4 text-xs font-sans">
              <div>
                <label className="block text-slate-300 font-medium mb-1.5">Agent Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Cross-DEX Flash Arbitrageur"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1.5">Agent Purpose & Execution Strategy *</label>
                <textarea
                  required
                  rows={2}
                  placeholder="Describe strategy, DEX pairs, or yield vault targets..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-300 font-medium mb-1.5">Agent Type</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as AgentType })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-cyan-400"
                  >
                    {AGENT_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1.5">Initial Operating Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as AgentStatus })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-cyan-400"
                  >
                    <option value="active">Active (Deploy Immediately)</option>
                    <option value="paused">Paused (Standby)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <div>
                  <label className="block text-slate-300 font-medium mb-1.5">Initial Capital ($)</label>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={formData.balance}
                    onChange={(e) => setFormData({ ...formData, balance: Number(e.target.value) })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono focus:outline-none focus:border-cyan-400"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1.5">Daily Limit ($)</label>
                  <input
                    type="number"
                    min="1"
                    step="100"
                    value={formData.dailyLimit}
                    onChange={(e) => setFormData({ ...formData, dailyLimit: Number(e.target.value) })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono focus:outline-none focus:border-cyan-400"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1.5">Max Single Tx ($)</label>
                  <input
                    type="number"
                    min="1"
                    step="100"
                    value={formData.maxTxAmount}
                    onChange={(e) => setFormData({ ...formData, maxTxAmount: Number(e.target.value) })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono focus:outline-none focus:border-cyan-400"
                  />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-cyan-950/40 border border-cyan-800/40 text-[11px] text-cyan-300 flex items-center gap-2 mt-4">
                <Shield className="w-4 h-4 flex-shrink-0 text-cyan-400" />
                <span>Safety Guardrail: Max single transaction limit cannot exceed daily spending quota.</span>
              </div>

              <div className="flex items-center justify-end gap-3 pt-6 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-slate-400 hover:text-white font-medium hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl font-bold bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/20 active:scale-95 transition-all"
                >
                  {editingAgent ? 'Save Changes' : 'Deploy Agent'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW AGENT DETAILS MODAL */}
      {viewingAgent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="w-full max-w-2xl rounded-3xl bg-slate-900 border border-slate-750 shadow-2xl p-6 sm:p-8 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-start justify-between pb-4 border-b border-slate-800 mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 flex items-center justify-center font-bold text-xl">
                  <Bot className="w-7 h-7" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-bold text-white">{viewingAgent.name}</h3>
                    <StatusBadge status={viewingAgent.status} size="sm" />
                  </div>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">
                    ID: {viewingAgent.id} • Type: {viewingAgent.type} • Created: {viewingAgent.createdAt}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setViewingAgent(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Description */}
            <div className="mb-6 p-4 rounded-2xl bg-slate-950 border border-slate-800">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 block mb-1">
                Strategy Description & Directives
              </span>
              <p className="text-xs text-slate-200 leading-relaxed">
                {viewingAgent.description}
              </p>
            </div>

            {/* Financial Parameters */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              <div className="p-3 rounded-2xl bg-slate-800/50 border border-slate-750 font-mono">
                <span className="text-[10px] text-slate-400 block">Balance</span>
                <span className="text-sm font-bold text-white">${viewingAgent.balance.toLocaleString()}</span>
              </div>
              <div className="p-3 rounded-2xl bg-slate-800/50 border border-slate-750 font-mono">
                <span className="text-[10px] text-slate-400 block">Daily Limit</span>
                <span className="text-sm font-bold text-slate-200">${viewingAgent.dailyLimit.toLocaleString()}</span>
              </div>
              <div className="p-3 rounded-2xl bg-slate-800/50 border border-slate-750 font-mono">
                <span className="text-[10px] text-slate-400 block">Spent Today</span>
                <span className="text-sm font-bold text-cyan-400">${viewingAgent.spentToday.toLocaleString()}</span>
              </div>
              <div className="p-3 rounded-2xl bg-slate-800/50 border border-slate-750 font-mono">
                <span className="text-[10px] text-slate-400 block">Max Single Tx</span>
                <span className="text-sm font-bold text-slate-300">${viewingAgent.maxTxAmount.toLocaleString()}</span>
              </div>
            </div>

            {/* Simulated Agent Transactions */}
            <div className="mb-6">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono mb-3 flex items-center justify-between">
                <span>Recent Simulated Transactions</span>
                <span className="text-cyan-400 text-[11px] font-normal">{viewingAgent.txCount} lifetime txs</span>
              </h4>
              <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                {transactions.slice(0, 3).map((tx) => (
                  <div key={tx.id} className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs flex items-center justify-between">
                    <div>
                      <p className="font-medium text-white">{tx.asset}</p>
                      <p className="text-[10px] text-slate-400 font-mono">{tx.destination} • {tx.timestamp}</p>
                    </div>
                    <div className="text-right font-mono">
                      <span className="text-slate-200 font-bold">${tx.amount.toLocaleString()}</span>
                      <span className="block text-[10px] text-emerald-400">Gas: ${tx.gasFee}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Agent Activity Logs */}
            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono mb-3">
                Live Audit Logs
              </h4>
              <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                {activityLogs.slice(0, 3).map((log) => (
                  <div key={log.id} className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs">
                    <div className="flex justify-between text-[10px] text-slate-400 mb-0.5">
                      <span className="text-cyan-300 font-semibold">{log.action}</span>
                      <span className="font-mono">{log.timestamp}</span>
                    </div>
                    <p className="text-slate-400 text-[11px]">{log.details}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="mt-6 pt-4 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setViewingAgent(null)}
                className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs transition-colors"
              >
                Close View
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE MODAL */}
      {agentToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="w-full max-w-md rounded-3xl bg-slate-900 border border-rose-500/30 shadow-2xl p-6 text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-400 border border-rose-500/30 flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Deprovision Agent?</h3>
            <p className="text-xs text-slate-300 mb-6 leading-relaxed">
              Are you sure you want to delete <strong>{agentToDelete.name}</strong>? This will revoke on-chain execution authority and return remaining balance to the treasury.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setAgentToDelete(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg shadow-rose-600/30 transition-colors"
              >
                Yes, Terminate Agent
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AUTONOMOUS EXECUTION ENCLAVE MODAL */}
      {executingAgent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
          <div className="w-full max-w-2xl rounded-3xl bg-slate-900 border border-cyan-500/30 shadow-2xl p-6 sm:p-8 max-h-[92vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-start justify-between pb-4 border-b border-slate-800 mb-5">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-violet-500/20 border border-cyan-500/40 text-cyan-300 flex items-center justify-center font-bold shadow-inner">
                  <Zap className="w-6 h-6 text-cyan-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-white">Autonomous Agent Execution Enclave</h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono uppercase bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 font-bold">
                      {onChainNetwork}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Agent: <strong className="text-white">{executingAgent.name}</strong> • Signer Enclave: <span className="font-mono text-cyan-400">{onChainAddress.slice(0, 8)}...{onChainAddress.slice(-6)}</span>
                  </p>
                </div>
              </div>

              <button
                onClick={() => setExecutingAgent(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Agent Limits Info Bar */}
            <div className="grid grid-cols-3 gap-2.5 p-3 rounded-2xl bg-slate-950/80 border border-slate-800 mb-5 text-[11px] font-mono">
              <div>
                <span className="text-slate-500 block text-[10px] uppercase">Daily Limit</span>
                <span className="font-bold text-slate-200">{executingAgent.dailyLimit} ETH / $</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] uppercase">Max Single Tx</span>
                <span className="font-bold text-cyan-400">{executingAgent.maxTxAmount} ETH / $</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] uppercase">Security Enclave</span>
                <span className="font-bold text-emerald-400 flex items-center gap-1">
                  <Shield className="w-3 h-3" /> Server Guard
                </span>
              </div>
            </div>

            {/* FinTechathon Demonstration Preset Triggers */}
            <div className="mb-4">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block mb-2 font-semibold">
                FinTechathon Evaluation Scenarios:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setTaskGoal('Send 0.001 ETH to 0x70997970C51812dc3A010C7d01b50e0d17dc79C8 for liquidity reserve')}
                  className="p-2.5 rounded-xl bg-slate-950 hover:bg-slate-850 border border-slate-800 hover:border-cyan-500/50 text-left transition-all group"
                >
                  <span className="text-xs font-bold text-emerald-400 block flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> 1. Authorized Action
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5 line-clamp-1">
                    0.001 ETH within safe limit
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setTaskGoal('Send 0.05 ETH to 0x70997970C51812dc3A010C7d01b50e0d17dc79C8')}
                  className="p-2.5 rounded-xl bg-slate-950 hover:bg-slate-850 border border-slate-800 hover:border-rose-500/50 text-left transition-all group"
                >
                  <span className="text-xs font-bold text-rose-400 block flex items-center gap-1">
                    <ShieldAlert className="w-3.5 h-3.5" /> 2. Limit Breach
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5 line-clamp-1">
                    0.05 ETH exceeds single-tx cap
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setTaskGoal('Send 0.001 ETH to 0x000000000000000000000000000000000000dead')}
                  className="p-2.5 rounded-xl bg-slate-950 hover:bg-slate-850 border border-slate-800 hover:border-amber-500/50 text-left transition-all group"
                >
                  <span className="text-xs font-bold text-amber-400 block flex items-center gap-1">
                    <Shield className="w-3.5 h-3.5" /> 3. Allowlist Breach
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5 line-clamp-1">
                    Unapproved recipient block
                  </span>
                </button>
              </div>
            </div>

            {/* Input Form */}
            <form onSubmit={handleRunAutonomousTask} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Financial Objective / Task Goal (Natural Language)</span>
                </label>
                <textarea
                  rows={2}
                  required
                  value={taskGoal}
                  onChange={(e) => setTaskGoal(e.target.value)}
                  placeholder="e.g., Transfer 0.001 ETH to 0x70997970C51812dc3A010C7d01b50e0d17dc79C8 for gas relayer subsidy"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-750 text-white font-mono text-xs focus:outline-none focus:border-cyan-400"
                />
              </div>

              {/* Execution Pipeline Steps Visualizer */}
              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-[11px] font-mono space-y-2">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="font-bold text-slate-300">Enclave Execution Pipeline:</span>
                  <span className="text-cyan-400">AI Planner &rarr; Policy Gate &rarr; Viem Enclave</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
                  <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300">
                    <span className="block font-bold text-cyan-300">1. AI Parsing</span>
                    <span>Extracts proposal</span>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300">
                    <span className="block font-bold text-amber-300">2. Policy Check</span>
                    <span>Rejects breaches</span>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300">
                    <span className="block font-bold text-emerald-300">3. Base Sepolia</span>
                    <span>Cryptographic sign</span>
                  </div>
                </div>
              </div>

              {/* Feedback Result Banner */}
              {executionResult && (
                <div
                  className={`p-4 rounded-2xl border text-xs font-mono animate-fadeIn ${
                    executionResult.success
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                      : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    {executionResult.success ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                    ) : (
                      <ShieldAlert className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
                    )}
                    <div className="space-y-1.5 flex-1">
                      <div className="font-bold text-sm text-white flex items-center justify-between">
                        <span>
                          {executionResult.success
                            ? 'Autonomous Execution Verified & Recorded'
                            : 'Execution Blocked by Server Policy Engine'}
                        </span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                            executionResult.success
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-rose-500/20 text-rose-400'
                          }`}
                        >
                          {executionResult.status}
                        </span>
                      </div>

                      {/* Details & Violations */}
                      {executionResult.violations && executionResult.violations.length > 0 && (
                        <div className="text-[11px] text-rose-300 bg-rose-950/40 p-2 rounded-xl border border-rose-800/40">
                          <strong className="block text-rose-200 mb-0.5">Policy Violations Detected (Pre-Signing):</strong>
                          <ul className="list-disc list-inside space-y-0.5 text-rose-300">
                            {executionResult.violations.map((v: string, idx: number) => (
                              <li key={idx}>{v}</li>
                            ))}
                          </ul>
                          <span className="block text-[10px] text-rose-400/80 mt-1">
                            &bull; Private signing key was NOT touched. Zero gas wasted.
                          </span>
                        </div>
                      )}

                      {/* Success Job info */}
                      {executionResult.job && (
                        <div className="space-y-1 text-[11px] pt-1">
                          {executionResult.job.txHash && (
                            <div className="flex items-center justify-between">
                              <span className="text-slate-400">Transaction Hash:</span>
                              <span className="text-cyan-300 font-mono">
                                {executionResult.job.txHash.slice(0, 10)}...{executionResult.job.txHash.slice(-8)}
                              </span>
                            </div>
                          )}
                          {executionResult.job.blockNumber && (
                            <div className="flex items-center justify-between">
                              <span className="text-slate-400">Block Number:</span>
                              <span className="text-white">#{executionResult.job.blockNumber}</span>
                            </div>
                          )}
                          {executionResult.job.explorerUrl && (
                            <div className="pt-1">
                              <a
                                href={executionResult.job.explorerUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1.5 text-cyan-400 hover:text-cyan-300 hover:underline font-bold"
                              >
                                <span>Inspect on BaseScan Sepolia Explorer</span>
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            </div>
                          )}
                          {executionResult.job.error && (
                            <p className="text-[10px] text-slate-400 mt-1">{executionResult.job.error}</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setExecutingAgent(null)}
                  className="px-4 py-2.5 rounded-xl text-slate-400 hover:text-white font-medium hover:bg-slate-800 transition-colors text-xs"
                >
                  Dismiss
                </button>
                <button
                  type="submit"
                  disabled={isExecuting}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/25 active:scale-95 transition-all text-xs disabled:opacity-50"
                >
                  {isExecuting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                      <span>Planning & Enforcing...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4 text-slate-950 stroke-[3]" />
                      <span>Plan & Dispatch Task</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
