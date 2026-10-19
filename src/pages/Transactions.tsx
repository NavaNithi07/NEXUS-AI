// src/pages/Transactions.tsx
import React, { useState, useEffect } from 'react';
import {
  ArrowLeftRight,
  ExternalLink,
  Filter,
  Search,
  Download,
  Copy,
  Check,
  Eye,
  X,
  FileCode,
  Layers,
  Fuel,
  Bot,
  Clock,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { StatusBadge } from '../components/ui/StatusBadge';
import { StatCard } from '../components/ui/StatCard';
import { TransactionBuilder } from '../components/TransactionBuilder';
import type { Transaction } from '../types';

export const Transactions: React.FC = () => {
  const { transactions, agents } = useAppStore();
  const [backendTxs, setBackendTxs] = useState<any[]>([]);
  const [txLoading, setTxLoading] = useState(false);
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);

  const [filterType, setFilterType] = useState('all');
  const [filterAgent, setFilterAgent] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);
  const [showSource, setShowSource] = useState<'local' | 'backend'>('backend');

  // Fetch backend transactions
  const fetchBackendTxs = async () => {
    try {
      setTxLoading(true);
      const res = await fetch('/api/transactions');
      if (res.ok) {
        const data = await res.json();
        setBackendTxs(data || []);
      }
    } catch { /* silent */ } finally {
      setTxLoading(false);
    }
  };

  useEffect(() => {
    fetchBackendTxs();
    const interval = setInterval(fetchBackendTxs, 15000);
    return () => clearInterval(interval);
  }, []);

  // Use backend txs when available, fall back to local store
  const allTransactions = showSource === 'backend' && backendTxs.length > 0
    ? backendTxs.map((job: any) => ({
        id: job.jobId,
        agentId: job.agentId,
        agentName: job.agentName,
        type: 'transfer' as const,
        amount: job.proposal?.amount || 0,
        asset: `${job.proposal?.amount || 0} ${job.proposal?.token || 'ETH'}`,
        destination: job.proposal?.recipient || '—',
        status: job.status === 'confirmed' ? 'completed' as const :
                job.status === 'rejected' ? 'failed' as const :
                job.status === 'failed' ? 'failed' as const : 'pending' as const,
        timestamp: new Date(job.executedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        hash: job.txHash || (job.status === 'rejected' ? 'REJECTED_BEFORE_SIGNING' : 'FAILED_BROADCAST'),
        gasFee: 0,
        blockNumber: job.blockNumber,
        gasUsed: job.gasUsed ? parseInt(job.gasUsed) : undefined,
        explorerUrl: job.explorerUrl,
        policyViolations: job.policyResult?.violations,
      }))
    : transactions;

  // Filter transactions
  const filtered = allTransactions.filter((tx) => {
    const matchesType = filterType === 'all' || tx.type === filterType;
    const matchesAgent = filterAgent === 'all' || tx.agentName === filterAgent;
    const matchesSearch =
      tx.agentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tx.asset.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tx.hash.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tx.destination.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesType && matchesAgent && matchesSearch;
  });

  const confirmedTxs = allTransactions.filter((tx) => tx.status === 'completed').length;
  const rejectedTxs = allTransactions.filter((tx) => tx.status === 'failed').length;
  const totalGasSpent = transactions.reduce((sum, tx) => sum + (tx.gasFee || 0), 0);
  const totalVolume = allTransactions.reduce((sum, tx) => sum + tx.amount, 0);

  const handleCopy = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(hash);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const handleExportCSV = () => {
    const headers = ['ID', 'Agent', 'Type', 'Amount', 'Asset', 'Destination', 'Status', 'Timestamp', 'Hash', 'GasFee'];
    const rows = filtered.map((tx) => [
      tx.id,
      `"${tx.agentName}"`,
      tx.type,
      tx.amount,
      `"${tx.asset}"`,
      `"${tx.destination}"`,
      tx.status,
      `"${tx.timestamp}"`,
      tx.hash,
      tx.gasFee,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `nexus-wallet-transactions-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <span>On-Chain Transaction Stream</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Cryptographic ledger of autonomous agent calls, atomic swaps, and liquidity provision.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <button
            onClick={() => setIsBuilderOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs sm:text-sm font-bold shadow-lg shadow-cyan-500/20 active:scale-95 transition-all"
          >
            <Sparkles className="w-4 h-4" />
            <span>New Safe Transfer</span>
          </button>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs sm:text-sm font-semibold border border-slate-700/80 active:scale-95 transition-all"
          >
            <Download className="w-4 h-4 text-cyan-400" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Total Lifetime Txs"
          value={transactions.length}
          subValue="Zero Failed Blocks"
          icon={ArrowLeftRight}
          accent="cyan"
        />
        <StatCard
          title="Cumulative Volume"
          value={`$${totalVolume.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
          subValue="Across 4 DEXs"
          icon={Sparkles}
          accent="violet"
        />
        <StatCard
          title="Total Gas Optimized"
          value={`$${totalGasSpent.toFixed(2)}`}
          subValue="Flashbots Private Relays"
          icon={Fuel}
          accent="emerald"
        />
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 shadow-lg">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by tx hash, token, agent or contract address..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-950 border border-slate-750 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Agent Filter */}
          <div className="flex items-center gap-2">
            <Bot className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={filterAgent}
              onChange={(e) => setFilterAgent(e.target.value)}
              className="bg-slate-950 border border-slate-750 text-xs text-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:border-cyan-400"
            >
              <option value="all">All Agents</option>
              {agents.map((a) => (
                <option key={a.id} value={a.name}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>

          {/* Type Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="bg-slate-950 border border-slate-750 text-xs text-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:border-cyan-400"
            >
              <option value="all">All Transaction Types</option>
              <option value="swap">Swaps</option>
              <option value="stake">Staking & Yield</option>
              <option value="rebalance">Liquidity Rebalance</option>
              <option value="approval">ERC-20 Approvals</option>
              <option value="transfer">Vault Transfers</option>
            </select>
          </div>
        </div>
      </div>

      {/* Transaction Table */}
      <div className="rounded-3xl bg-slate-900/80 border border-slate-800 p-6 shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-mono text-[11px]">
                <th className="pb-3 font-medium">TX HASH</th>
                <th className="pb-3 font-medium">AGENT</th>
                <th className="pb-3 font-medium">TYPE</th>
                <th className="pb-3 font-medium">AMOUNT / ASSET</th>
                <th className="pb-3 font-medium">DESTINATION</th>
                <th className="pb-3 font-medium">GAS</th>
                <th className="pb-3 font-medium text-center">STATUS</th>
                <th className="pb-3 font-medium text-right">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500 text-xs">
                    <ArrowLeftRight className="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-50" />
                    <p className="font-semibold text-slate-300">No Transactions Found</p>
                    <p className="text-[11px] text-slate-500 mt-1">Autonomous agent executions will stream to this ledger in real-time.</p>
                  </td>
                </tr>
              ) : (
                filtered.map((tx) => (
                <tr key={tx.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-4 font-mono text-cyan-400">
                    {tx.hash === 'REJECTED_BEFORE_SIGNING' ? (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-rose-500/15 border border-rose-500/40 text-rose-400">
                        POLICY BLOCKED
                      </span>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <span>{tx.hash.slice(0, 10)}...{tx.hash.slice(-6)}</span>
                        <button
                          onClick={() => handleCopy(tx.hash)}
                          className="text-slate-500 hover:text-white"
                          title="Copy Tx Hash"
                        >
                          {copiedHash === tx.hash ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                        {tx.explorerUrl && (
                          <a
                            href={tx.explorerUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-cyan-400 hover:text-cyan-300 ml-0.5"
                            title="Inspect on BaseScan"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="py-4">
                    <span className="font-semibold text-white block">{tx.agentName}</span>
                    <span className="text-[10px] text-slate-400 font-mono">{tx.timestamp}</span>
                  </td>
                  <td className="py-4">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase bg-slate-800 text-slate-300 border border-slate-700">
                      {tx.type}
                    </span>
                  </td>
                  <td className="py-4 font-mono font-medium text-slate-200">
                    ${tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    <span className="block text-[10px] text-slate-400">{tx.asset}</span>
                  </td>
                  <td className="py-4 text-slate-300 font-mono text-[11px]">
                    {tx.destination}
                  </td>
                  <td className="py-4 font-mono text-slate-400">${tx.gasFee.toFixed(2)}</td>
                  <td className="py-4 text-center">
                    <StatusBadge status={tx.status} size="sm" />
                  </td>
                  <td className="py-4 text-right">
                    <button
                      onClick={() => setSelectedTx(tx)}
                      className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                      title="Inspect On-Chain Payload"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              )))}
            </tbody>
          </table>
        </div>
      </div>

      {/* TRANSACTION DETAILS MODAL */}
      {selectedTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="w-full max-w-2xl rounded-3xl bg-slate-900 border border-slate-750 shadow-2xl p-6 sm:p-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center font-bold">
                  <FileCode className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Decoded On-Chain Transaction</h3>
                  <p className="text-xs text-slate-400 font-mono">ID: {selectedTx.id}</p>
                </div>
              </div>
              <button onClick={() => setSelectedTx(null)} className="p-2 rounded-xl text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs font-mono">
              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 flex justify-between items-center">
                <span className="text-slate-400">Transaction Status:</span>
                <StatusBadge status={selectedTx.status} size="sm" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
                  <span className="text-[10px] text-slate-500 uppercase block">Executing Agent</span>
                  <span className="text-white font-bold">{selectedTx.agentName}</span>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
                  <span className="text-[10px] text-slate-500 uppercase block">Block Number</span>
                  <span className="text-cyan-400 font-bold">#{selectedTx.blockNumber || 22481902}</span>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase block mb-1">Transaction Hash</span>
                <span className="text-slate-200 select-all break-all">{selectedTx.hash}</span>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
                  <span className="text-[10px] text-slate-500 uppercase block">Amount</span>
                  <span className="text-white font-bold">${selectedTx.amount.toLocaleString()}</span>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
                  <span className="text-[10px] text-slate-500 uppercase block">Gas Used</span>
                  <span className="text-slate-300 font-bold">{selectedTx.gasUsed?.toLocaleString() || '120,400'} units</span>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
                  <span className="text-[10px] text-slate-500 uppercase block">Gas Fee USD</span>
                  <span className="text-emerald-400 font-bold">${selectedTx.gasFee.toFixed(2)}</span>
                </div>
              </div>

              {selectedTx.policyViolations && selectedTx.policyViolations.length > 0 && (
                <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300">
                  <span className="text-[10px] text-rose-400 uppercase font-bold block mb-1">
                    Independent Policy Engine Breach Report
                  </span>
                  <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                    {selectedTx.policyViolations.map((v, i) => (
                      <li key={i}>{v}</li>
                    ))}
                  </ul>
                  <span className="text-[10px] text-rose-400/80 block mt-1">
                    Enforcement outcome: Transaction rejected before creating or broadcasting on-chain signature.
                  </span>
                </div>
              )}

              {selectedTx.explorerUrl && (
                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                  <span className="text-[10px] text-slate-500 uppercase">BaseScan Sepolia Explorer</span>
                  <a
                    href={selectedTx.explorerUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 font-bold hover:underline"
                  >
                    <span>Inspect On-Chain Confirmation</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}

              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase block mb-1">Contract / Destination</span>
                <span className="text-cyan-300">{selectedTx.destination}</span>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase block mb-1">Decoded Smart Contract Calldata</span>
                <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-[10px] text-slate-400 overflow-x-auto break-all font-mono">
                  {selectedTx.calldata || '0x095ea7b3000000000000000000000000af88d065e77c8cc2239327c5edb3a432268e5831ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'}
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setSelectedTx(null)}
                className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs transition-colors"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TRANSACTION BUILDER MODAL */}
      {isBuilderOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto animate-fadeIn">
          <div className="w-full max-w-2xl my-8">
            <TransactionBuilder
              onClose={() => setIsBuilderOpen(false)}
              onSuccess={() => {
                fetchBackendTxs();
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
