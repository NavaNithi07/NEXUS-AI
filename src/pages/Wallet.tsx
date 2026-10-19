// src/pages/Wallet.tsx
import React, { useState } from 'react';
import {
  Wallet as WalletIcon,
  ArrowUpRight,
  ArrowDownLeft,
  RefreshCw,
  Send,
  ShieldCheck,
  Coins,
  QrCode,
  Copy,
  Check,
  X,
  AlertCircle,
  ExternalLink,
  Layers,
  Globe,
  Lock,
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useAppStore } from '../store/appStore';
import { StatCard } from '../components/ui/StatCard';
import { supportedNetworks } from '../data/mockData';
import { TransactionBuilder } from '../components/TransactionBuilder';

const COLORS = ['#22d3ee', '#8b5cf6', '#f59e0b', '#10b981', '#ec4899'];

export const Wallet: React.FC = () => {
  const {
    walletAssets,
    transferAsset,
    depositAsset,
    agents,
    activeNetwork,
    setActiveNetwork,
    onChainAddress,
    onChainBalanceEth,
    onChainNetwork,
    backendConnected,
  } = useAppStore();

  // Modals state
  const [isSendOpen, setIsSendOpen] = useState(false);
  const [isReceiveOpen, setIsReceiveOpen] = useState(false);

  // Send Form state
  const [sendSymbol, setSendSymbol] = useState(walletAssets[0]?.symbol || 'ETH');
  const [sendAmount, setSendAmount] = useState<number | ''>('');
  const [sendRecipient, setSendRecipient] = useState('');
  const [sendError, setSendError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Receive Form state
  const [depositAmount, setDepositAmount] = useState<number | ''>('');
  const [depositSymbol, setDepositSymbol] = useState('USDC');
  const [copiedAddress, setCopiedAddress] = useState(false);

  const vaultAddress = onChainAddress || '0x2836a264976f67178BE78F1b963f545c7BB5f657';

  // Derived financial metrics
  const totalAssetsValue = walletAssets.reduce((sum, a) => sum + a.valueUsd, 0);
  const agentCapital = agents.reduce((sum, a) => sum + a.balance, 0);
  const coldStorageReserves = Math.max(0, totalAssetsValue - agentCapital);

  // Pie chart data
  const pieData = walletAssets.map((asset) => ({
    name: asset.symbol,
    value: Math.round(asset.valueUsd),
  }));

  const selectedAsset = walletAssets.find((a) => a.symbol === sendSymbol);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    setSendError(null);

    if (!sendRecipient || !sendRecipient.startsWith('0x') || sendRecipient.length < 10) {
      setSendError('Please enter a valid Ethereum/Arbitrum hex recipient address.');
      return;
    }

    const numAmount = Number(sendAmount);
    if (!numAmount || numAmount <= 0) {
      setSendError('Please enter a valid transfer amount greater than 0.');
      return;
    }

    if (!selectedAsset || selectedAsset.balance < numAmount) {
      setSendError(`Insufficient balance. You have ${selectedAsset?.balance.toFixed(4) || 0} ${sendSymbol}.`);
      return;
    }

    const success = transferAsset(sendSymbol, numAmount, sendRecipient);
    if (success) {
      setToastMessage(`Simulated transfer of ${numAmount} ${sendSymbol} submitted successfully!`);
      setIsSendOpen(false);
      setSendAmount('');
      setSendRecipient('');
      setTimeout(() => setToastMessage(null), 4000);
    } else {
      setSendError('Transfer execution failed.');
    }
  };

  const handleDeposit = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = Number(depositAmount);
    if (!numAmount || numAmount <= 0) return;

    depositAsset(depositSymbol, numAmount);
    setToastMessage(`Simulated deposit of ${numAmount} ${depositSymbol} credited to treasury!`);
    setIsReceiveOpen(false);
    setDepositAmount('');
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(vaultAddress);
    setCopiedAddress(true);
    setTimeout(() => setCopiedAddress(false), 2000);
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-2xl bg-emerald-500 text-slate-950 font-semibold text-xs sm:text-sm shadow-2xl animate-bounce">
          <Check className="w-5 h-5 text-slate-950" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header & Quick Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <span>Multi-Chain Treasury Vault</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Smart contract reserves, multi-chain liquidity, and algorithmic agent balances.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setIsReceiveOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs sm:text-sm font-semibold border border-slate-700/80 active:scale-95 transition-all"
          >
            <ArrowDownLeft className="w-4 h-4 text-cyan-400" />
            <span>Deposit / Receive</span>
          </button>

          <button
            onClick={() => setIsSendOpen(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/20 active:scale-95 transition-all"
          >
            <Send className="w-4 h-4" />
            <span>Send Asset</span>
          </button>
        </div>
      </div>

      {/* Network Switcher Bar */}
      <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 shadow-lg">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Globe className="w-4 h-4 text-cyan-400" />
          <span className="font-semibold text-slate-300">Active Multi-Chain Gateway:</span>
          <span className="text-cyan-400 font-mono font-bold">{activeNetwork}</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {supportedNetworks.map((net) => (
            <button
              key={net.id}
              onClick={() => setActiveNetwork(net.name)}
              className={`px-3 py-1.5 rounded-xl text-xs font-mono transition-all flex items-center gap-2 ${
                activeNetwork === net.name
                  ? 'bg-cyan-500/15 border border-cyan-500/40 text-cyan-300 font-bold'
                  : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${activeNetwork === net.name ? 'bg-cyan-400 animate-pulse' : 'bg-slate-600'}`} />
              <span>{net.name}</span>
              <span className="text-[10px] text-slate-500">({net.gasGwei} Gwei)</span>
            </button>
          ))}
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Total Net Treasury"
          value={`$${totalAssetsValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
          subValue="Multi-Token Reserves"
          change={totalAssetsValue > 0 ? 'Treasury Funded' : '$0.00'}
          isPositive={totalAssetsValue > 0}
          icon={WalletIcon}
          accent="cyan"
          badge="Treasury"
        />

        <StatCard
          title="Active Agent Liquidity"
          value={`$${agentCapital.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
          subValue={`${totalAssetsValue > 0 ? Math.round((agentCapital / totalAssetsValue) * 100) : 0}% of vault`}
          change={agentCapital > 0 ? 'Active Strategies' : 'Idle'}
          isPositive={agentCapital > 0}
          icon={Coins}
          accent="violet"
          badge="In Strategies"
        />

        <StatCard
          title="Cold Storage Reserve"
          value={`$${coldStorageReserves.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
          subValue="Multi-Sig Time-Locked"
          change="Protected"
          isPositive={true}
          icon={ShieldCheck}
          accent="emerald"
          badge="Safe"
        />
      </div>

      {/* Holdings & Asset Allocation Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Token Holdings Table */}
        <div className="lg:col-span-2 rounded-3xl bg-slate-900/80 border border-slate-800 p-6 shadow-xl">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Coins className="w-4 h-4 text-cyan-400" />
                <span>Treasury Token Holdings</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                On-chain tokens available for algorithmic swaps, staking, and arbitrage
              </p>
            </div>
            <span className="text-xs font-mono text-cyan-400">
              {walletAssets.length} Assets
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-mono text-[11px]">
                  <th className="pb-3 font-medium">ASSET</th>
                  <th className="pb-3 font-medium">BALANCE</th>
                  <th className="pb-3 font-medium">USD VALUE</th>
                  <th className="pb-3 font-medium">NETWORK</th>
                  <th className="pb-3 font-medium text-right">24H CHANGE</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-sans">
                {walletAssets.map((asset) => (
                  <tr key={asset.symbol} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-4">
                      <div className="flex items-center gap-3">
                        <img src={asset.icon} alt={asset.name} className="w-8 h-8 rounded-full bg-slate-800 p-1" />
                        <div>
                          <span className="font-bold text-white block">{asset.name}</span>
                          <span className="text-[10px] text-slate-400 font-mono">{asset.symbol}</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 font-mono font-medium text-slate-200">
                      {asset.balance.toLocaleString(undefined, { maximumFractionDigits: 4 })} {asset.symbol}
                    </td>
                    <td className="py-4 font-mono font-bold text-white">
                      ${asset.valueUsd.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-4 font-mono text-slate-300 text-[11px]">
                      {asset.network}
                    </td>
                    <td className="py-4 text-right font-mono font-semibold">
                      <span className={asset.change24h >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                        {asset.change24h >= 0 ? `+${asset.change24h}%` : `${asset.change24h}%`}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Portfolio Distribution Donut Chart */}
        <div className="rounded-3xl bg-slate-900/80 border border-slate-800 p-6 shadow-xl flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-white mb-1">Asset Allocation</h3>
            <p className="text-xs text-slate-400 mb-4">Capital weight distribution by token</p>

            <div className="h-56 w-full flex items-center justify-center">
              {totalAssetsValue === 0 ? (
                <div className="flex flex-col items-center justify-center text-center p-4">
                  <div className="w-20 h-20 rounded-full border-2 border-dashed border-slate-800 flex items-center justify-center mb-2">
                    <Coins className="w-8 h-8 text-slate-600 opacity-60" />
                  </div>
                  <p className="text-xs text-slate-500 font-medium">Vault Empty</p>
                  <p className="text-[10px] text-slate-600 mt-0.5">Deposit tokens to visualize weights</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={80}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {pieData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: any) => [`$${Number(value).toLocaleString()}`, 'Value']}
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        borderColor: '#334155',
                        borderRadius: '12px',
                        color: '#f8fafc',
                        fontSize: '12px',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="space-y-2 mt-2">
              {walletAssets.map((asset, idx) => {
                const percent = totalAssetsValue > 0 ? ((asset.valueUsd / totalAssetsValue) * 100).toFixed(1) : '0';
                return (
                  <div key={asset.symbol} className="flex items-center justify-between text-xs font-mono">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                      <span className="text-slate-300 font-medium">{asset.symbol}</span>
                    </div>
                    <span className="text-slate-400">{percent}%</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] text-slate-500 font-mono flex items-center justify-between">
            <span>Security Layer:</span>
            <span className="text-cyan-400 flex items-center gap-1">
              <Lock className="w-3 h-3" /> Safe Multi-Sig
            </span>
          </div>
        </div>
      </div>

      {/* SEND MODAL / TRANSACTION BUILDER */}
      {isSendOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto animate-fadeIn">
          <div className="w-full max-w-2xl my-8">
            <TransactionBuilder
              onClose={() => setIsSendOpen(false)}
              onSuccess={(tx) => {
                setToastMessage(`Safe transfer submitted! Hash: ${tx.txHash ? tx.txHash.slice(0, 10) + '...' : 'Confirmed'}`);
                setTimeout(() => setToastMessage(null), 5000);
              }}
            />
          </div>
        </div>
      )}

      {/* RECEIVE / DEPOSIT MODAL */}
      {isReceiveOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="w-full max-w-md rounded-3xl bg-slate-900 border border-slate-750 shadow-2xl p-6 sm:p-8 text-center">
            <div className="flex justify-end">
              <button onClick={() => setIsReceiveOpen(false)} className="p-1 rounded-lg text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 flex items-center justify-center mx-auto mb-3">
              <QrCode className="w-6 h-6" />
            </div>

            <h3 className="text-lg font-bold text-white mb-1">Deposit Funds to Vault</h3>
            <p className="text-xs text-slate-400 mb-4">
              Send tokens to your autonomous multi-chain smart vault address below.
            </p>

            {/* QR Mock graphic */}
            <div className="w-40 h-40 bg-white p-3 rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-lg">
              <div className="w-full h-full bg-slate-900 rounded-xl flex items-center justify-center text-cyan-400 font-mono text-[10px] text-center p-2 border border-slate-750">
                [NEXUS VAULT QR CODE]
              </div>
            </div>

            {/* Address with copy */}
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs font-mono text-slate-300 mb-3">
              <span className="truncate pr-2">{vaultAddress}</span>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-400 text-xs transition-colors flex-shrink-0"
              >
                {copiedAddress ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedAddress ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            <div className="mb-6 flex justify-center">
              <a
                href={`https://sepolia.basescan.org/address/${vaultAddress}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-[11px] text-cyan-400 hover:text-cyan-300 font-mono hover:underline"
              >
                <span>Inspect Vault on BaseScan Sepolia</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            {/* Simulated Deposit form */}
            <form onSubmit={handleDeposit} className="pt-3 border-t border-slate-800 text-left">
              <span className="text-[11px] font-mono uppercase text-slate-400 block mb-2 font-semibold">
                Simulate Instant Test Deposit
              </span>
              <div className="flex gap-2">
                <select
                  value={depositSymbol}
                  onChange={(e) => setDepositSymbol(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs"
                >
                  <option value="USDC">USDC</option>
                  <option value="ETH">ETH</option>
                  <option value="WBTC">WBTC</option>
                  <option value="ARB">ARB</option>
                </select>
                <input
                  type="number"
                  placeholder="Amount"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value === '' ? '' : Number(e.target.value))}
                  className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono text-xs"
                />
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs"
                >
                  Credit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
