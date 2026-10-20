// src/components/TransactionBuilder.tsx
import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Send,
  Fuel,
  ArrowRight,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Clock,
  Layers,
  Sparkles,
  Cpu,
  Lock,
  ArrowUpRight,
  ArrowDownLeft,
  Info,
  Copy,
  Check,
} from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { getAuthToken } from '../lib/apiClient';

interface SimulationDetails {
  valid: boolean;
  chainId: number;
  network: string;
  sender: string;
  recipient: string;
  amountEth: number;
  calldata: string;
  simulation: {
    outcome: 'success' | 'failed' | 'unsupported_provider' | 'timeout';
    provider: 'alchemy' | 'evm_call' | 'none';
    assetChanges: Array<{
      assetType: string;
      changeType: string;
      from: string;
      to: string;
      amount: string;
      symbol: string;
    }>;
    gasUsed?: string;
    rawError?: string;
  };
  gas: {
    gasLimit: string;
    maxFeePerGasWei: string;
    maxPriorityFeePerGasWei: string;
    maxFeePerGasGwei: string;
    estimatedFeeEth: string;
    maxFeeEth: string;
    maxTotalCostEth: string;
  };
  affordability: {
    currentBalanceEth: string;
    sufficientForValue: boolean;
    sufficientForMaxCost: boolean;
    shortfallEth?: string;
  };
  policyResult: {
    approved: boolean;
    violations: string[];
    checks: {
      agentActive: boolean;
      killswitchDisengaged: boolean;
      recipientAllowlisted: boolean;
      singleTxLimitPassed: boolean;
      dailyBudgetPassed: boolean;
      networkSupported: boolean;
      balanceSufficient: boolean;
    };
  };
  warnings: string[];
  preparedPayloadHash: string;
  timestamp: string;
}

interface TransactionBuilderProps {
  onSuccess?: (txResult: any) => void;
  onClose?: () => void;
  initialRecipient?: string;
}

export const TransactionBuilder: React.FC<TransactionBuilderProps> = ({
  onSuccess,
  onClose,
  initialRecipient = '',
}) => {
  const { onChainAddress, onChainBalanceEth } = useAppStore();
  const authToken = getAuthToken();

  // Form states
  const [recipient, setRecipient] = useState(initialRecipient);
  const [amountEth, setAmountEth] = useState<string>('0.005');
  const [calldata, setCalldata] = useState<string>('0x');
  const [selectedPreset, setSelectedPreset] = useState<string>('0.005');

  // Workflow states
  const [step, setStep] = useState<'input' | 'review' | 'submitting' | 'confirmed' | 'failed'>('input');
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationResult, setSimulationResult] = useState<SimulationDetails | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submittedTx, setSubmittedTx] = useState<any | null>(null);
  const [copiedHash, setCopiedHash] = useState(false);

  // Address validation helper
  const isValidAddress = (addr: string) => /^0x[a-fA-F0-9]{40}$/.test(addr.trim());

  const handlePresetSelect = (val: string) => {
    setSelectedPreset(val);
    setAmountEth(val);
    if (simulationResult) {
      setSimulationResult(null); // Reset simulation if parameters change
    }
  };

  // Pre-Flight Simulation Handler
  const handleSimulate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage(null);

    const cleanRecipient = recipient.trim();
    if (!isValidAddress(cleanRecipient)) {
      setErrorMessage('Please enter a valid 40-character hexadecimal Ethereum address.');
      return;
    }

    const numAmount = parseFloat(amountEth);
    if (isNaN(numAmount) || numAmount <= 0) {
      setErrorMessage('Please enter a valid transfer amount greater than 0.');
      return;
    }

    try {
      setIsSimulating(true);
      const res = await fetch('/api/wallet/simulate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({
          recipient: cleanRecipient,
          amountEth: numAmount,
          calldata: calldata.trim() || '0x',
          chainId: 84532,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || 'Simulation failed on server');
      }

      setSimulationResult(data);
      setStep('review');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to simulate transaction');
    } finally {
      setIsSimulating(false);
    }
  };

  // Authorize & Execute Safe Transfer
  const handleAuthorizeAndExecute = async () => {
    if (!simulationResult) return;
    setErrorMessage(null);
    setStep('submitting');

    const idempotencyKey = `idemp-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

    try {
      const res = await fetch('/api/wallet/execute-safe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Idempotency-Key': idempotencyKey,
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({
          recipient: simulationResult.recipient,
          amountEth: simulationResult.amountEth,
          calldata: simulationResult.calldata,
          chainId: simulationResult.chainId,
          preparedPayloadHash: simulationResult.preparedPayloadHash,
          idempotencyKey,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        const errorMsg = data.violations?.length
          ? data.violations.join('; ')
          : (data.error || data.message || 'Execution failed on-chain');
        setErrorMessage(errorMsg);
        if (data.job?.txHash) {
          setSubmittedTx(data.job);
        }
        setStep('failed');
        return;
      }

      setSubmittedTx(data.job);
      setStep('confirmed');
      if (onSuccess) onSuccess(data.job);
    } catch (err: any) {
      setErrorMessage(err.message || 'Network error during transaction submission');
      setStep('failed');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  return (
    <div className="bg-[#111827] border border-cyan-500/20 rounded-xl overflow-hidden shadow-2xl">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between bg-[#0B0F19]/80">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white tracking-wide">
                Transaction Simulator & Safe Transfer Builder
              </h2>
              <span className="px-2 py-0.5 text-xs font-semibold rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                EIP-1559 Safe
              </span>
            </div>
            <p className="text-xs text-gray-400">
              Pre-flight asset simulation, dynamic buffered fee estimation & NEXUS policy enforcement
            </p>
          </div>
        </div>

        {/* Network Indicator Badge */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-900 border border-gray-800 text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-gray-300 font-medium">Base Sepolia</span>
            <span className="text-gray-500 font-mono">(84532)</span>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-gray-800 transition-colors"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Main Body */}
      <div className="p-6 space-y-6">
        {/* Step Indicator */}
        <div className="flex items-center justify-between max-w-md mx-auto text-xs font-medium">
          <div className={`flex items-center gap-1.5 ${step === 'input' ? 'text-cyan-400' : 'text-gray-400'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold ${step === 'input' ? 'bg-cyan-500/20 border border-cyan-400 text-cyan-400' : 'bg-gray-800 text-gray-500'}`}>
              1
            </span>
            <span>Configure</span>
          </div>
          <div className="h-0.5 w-12 bg-gray-800"></div>
          <div className={`flex items-center gap-1.5 ${step === 'review' || step === 'submitting' ? 'text-cyan-400' : 'text-gray-400'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold ${step === 'review' || step === 'submitting' ? 'bg-cyan-500/20 border border-cyan-400 text-cyan-400' : 'bg-gray-800 text-gray-500'}`}>
              2
            </span>
            <span>Simulate & Policy</span>
          </div>
          <div className="h-0.5 w-12 bg-gray-800"></div>
          <div className={`flex items-center gap-1.5 ${step === 'confirmed' || step === 'failed' ? 'text-cyan-400' : 'text-gray-400'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold ${step === 'confirmed' ? 'bg-emerald-500/20 border border-emerald-400 text-emerald-400' : step === 'failed' ? 'bg-rose-500/20 border border-rose-400 text-rose-400' : 'bg-gray-800 text-gray-500'}`}>
              3
            </span>
            <span>Execute & Receipt</span>
          </div>
        </div>

        {/* Global Error Banner */}
        {errorMessage && (
          <div className="p-4 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-start gap-3">
            <XCircle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-rose-300">Action Required</p>
              <p className="text-xs text-rose-200/80 leading-relaxed">{errorMessage}</p>
            </div>
          </div>
        )}

        {/* ── STEP 1: INPUT CONFIGURATION ───────────────────────────────── */}
        {step === 'input' && (
          <form onSubmit={handleSimulate} className="space-y-5">
            {/* Sender Signer Readout */}
            <div className="p-3 rounded-lg bg-gray-900/60 border border-gray-800 flex items-center justify-between text-xs">
              <span className="text-gray-400">Vault Signer Enclave:</span>
              <span className="font-mono text-cyan-400">{onChainAddress || '0x2836a264976f67178BE78F1b963f545c7BB5f657'}</span>
            </div>

            {/* Recipient Address */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider">
                Destination Recipient Address (EIP-55 Hex)
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="0x..."
                  value={recipient}
                  onChange={(e) => {
                    setRecipient(e.target.value);
                    setSimulationResult(null);
                  }}
                  className="w-full px-4 py-2.5 rounded-lg bg-gray-900 border border-gray-700 text-white font-mono text-sm placeholder-gray-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                />
                {recipient && (
                  <div className="absolute right-3 top-2.5">
                    {isValidAddress(recipient) ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-amber-400" />
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Transfer Amount & Presets */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
                  Transfer Amount (ETH)
                </label>
                <span className="text-xs text-gray-400">
                  Current Vault Balance: <span className="text-cyan-400 font-semibold">{onChainBalanceEth || '0.0000'} ETH</span>
                </span>
              </div>
              <div className="flex gap-2">
                <input
                  type="number"
                  step="0.0001"
                  min="0.0001"
                  value={amountEth}
                  onChange={(e) => {
                    setAmountEth(e.target.value);
                    setSelectedPreset('');
                    setSimulationResult(null);
                  }}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-gray-900 border border-gray-700 text-white font-mono text-sm focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                />
                <div className="flex gap-1.5">
                  {['0.001', '0.005', '0.01'].map((preset) => (
                    <button
                      type="button"
                      key={preset}
                      onClick={() => handlePresetSelect(preset)}
                      className={`px-3 py-2 rounded-lg text-xs font-mono font-medium transition-colors ${
                        selectedPreset === preset
                          ? 'bg-cyan-500 text-black font-bold'
                          : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Optional Calldata */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
                  Calldata (Optional Hex)
                </label>
                <span className="text-xs text-gray-500">Defaults to 0x for standard transfer</span>
              </div>
              <input
                type="text"
                placeholder="0x"
                value={calldata}
                onChange={(e) => setCalldata(e.target.value)}
                className="w-full px-4 py-2 rounded-lg bg-gray-900 border border-gray-800 text-gray-400 font-mono text-xs focus:outline-none focus:border-cyan-500"
              />
            </div>

            {/* Simulate Button */}
            <button
              type="submit"
              disabled={isSimulating || !recipient || !amountEth}
              className="w-full py-3 px-4 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-cyan-500/20"
            >
              {isSimulating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Running Pre-Flight Simulation & Policy Check...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Run Pre-Flight Simulation & Validate Policy
                </>
              )}
            </button>
          </form>
        )}

        {/* ── STEP 2: REVIEW SIMULATION & POLICY ────────────────────────── */}
        {(step === 'review' || step === 'submitting') && simulationResult && (
          <div className="space-y-5">
            {/* Simulation Outcome Card */}
            <div className="p-4 rounded-xl bg-gray-900/80 border border-gray-800 space-y-4">
              <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                <div className="flex items-center gap-2">
                  {simulationResult.simulation.outcome === 'success' ? (
                    <div className="px-2.5 py-1 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      SIMULATION PASSED
                    </div>
                  ) : simulationResult.simulation.outcome === 'unsupported_provider' ? (
                    <div className="px-2.5 py-1 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      EVM SIMULATION FALLBACK
                    </div>
                  ) : (
                    <div className="px-2.5 py-1 rounded bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-bold flex items-center gap-1.5">
                      <XCircle className="w-3.5 h-3.5" />
                      SIMULATION FAILED
                    </div>
                  )}
                  <span className="text-xs text-gray-400">
                    Provider: <span className="text-gray-200 font-mono capitalize">{simulationResult.simulation.provider === 'alchemy' ? 'Alchemy Enhanced' : 'Base Sepolia EVM Call'}</span>
                  </span>
                </div>
                <span className="text-xs text-gray-500 font-mono">
                  {new Date(simulationResult.timestamp).toLocaleTimeString()}
                </span>
              </div>

              {/* Asset Changes Flow */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Simulated Asset Inflow / Outflow
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-[#0B0F19] border border-gray-800 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-1 text-xs text-rose-400 font-medium">
                        <ArrowUpRight className="w-3.5 h-3.5" />
                        Sender Outflow
                      </div>
                      <div className="text-base font-bold text-white font-mono mt-0.5">
                        -{simulationResult.amountEth} ETH
                      </div>
                    </div>
                    <span className="text-xs font-mono text-gray-500 truncate max-w-[80px]">
                      {simulationResult.sender.slice(0, 6)}...
                    </span>
                  </div>

                  <div className="p-3 rounded-lg bg-[#0B0F19] border border-gray-800 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-1 text-xs text-emerald-400 font-medium">
                        <ArrowDownLeft className="w-3.5 h-3.5" />
                        Recipient Inflow
                      </div>
                      <div className="text-base font-bold text-emerald-400 font-mono mt-0.5">
                        +{simulationResult.amountEth} ETH
                      </div>
                    </div>
                    <span className="text-xs font-mono text-gray-500 truncate max-w-[80px]">
                      {simulationResult.recipient.slice(0, 6)}...
                    </span>
                  </div>
                </div>
              </div>

              {/* Gas & Affordability Breakdown */}
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="p-2.5 rounded-lg bg-[#0B0F19] border border-gray-800">
                  <div className="text-gray-500 flex items-center gap-1">
                    <Fuel className="w-3 h-3 text-cyan-400" />
                    Gas Limit
                  </div>
                  <div className="font-mono text-white font-semibold mt-1">
                    {parseInt(simulationResult.gas.gasLimit).toLocaleString()}
                  </div>
                </div>
                <div className="p-2.5 rounded-lg bg-[#0B0F19] border border-gray-800">
                  <div className="text-gray-500">Max Fee (+20% buf)</div>
                  <div className="font-mono text-white font-semibold mt-1">
                    {simulationResult.gas.maxFeeEth} ETH
                  </div>
                </div>
                <div className="p-2.5 rounded-lg bg-[#0B0F19] border border-gray-800">
                  <div className="text-gray-500">Max Total Cost</div>
                  <div className="font-mono text-cyan-400 font-bold mt-1">
                    {simulationResult.gas.maxTotalCostEth} ETH
                  </div>
                </div>
              </div>
            </div>

            {/* Policy Check Results */}
            <div className="p-4 rounded-xl bg-gray-900/80 border border-gray-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    NEXUS Policy Engine Verification
                  </span>
                </div>
                <span
                  className={`px-2 py-0.5 text-xs font-bold rounded ${
                    simulationResult.policyResult.approved
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                  }`}
                >
                  {simulationResult.policyResult.approved ? 'POLICY APPROVED' : 'POLICY REJECTED'}
                </span>
              </div>

              {/* Policy Checks Grid */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center justify-between p-2 rounded bg-[#0B0F19] border border-gray-800/80">
                  <span className="text-gray-400">Circuit Breaker Disengaged:</span>
                  {simulationResult.policyResult.checks.killswitchDisengaged ? (
                    <span className="text-emerald-400 font-semibold">Pass</span>
                  ) : (
                    <span className="text-rose-400 font-semibold">HALTED</span>
                  )}
                </div>
                <div className="flex items-center justify-between p-2 rounded bg-[#0B0F19] border border-gray-800/80">
                  <span className="text-gray-400">Single Tx Cap:</span>
                  {simulationResult.policyResult.checks.singleTxLimitPassed ? (
                    <span className="text-emerald-400 font-semibold">Pass</span>
                  ) : (
                    <span className="text-rose-400 font-semibold">Exceeded</span>
                  )}
                </div>
                <div className="flex items-center justify-between p-2 rounded bg-[#0B0F19] border border-gray-800/80">
                  <span className="text-gray-400">Daily Spending Budget:</span>
                  {simulationResult.policyResult.checks.dailyBudgetPassed ? (
                    <span className="text-emerald-400 font-semibold">Pass</span>
                  ) : (
                    <span className="text-rose-400 font-semibold">Exceeded</span>
                  )}
                </div>
                <div className="flex items-center justify-between p-2 rounded bg-[#0B0F19] border border-gray-800/80">
                  <span className="text-gray-400">Wallet Gas Affordability:</span>
                  {simulationResult.affordability.sufficientForMaxCost ? (
                    <span className="text-emerald-400 font-semibold">Sufficient</span>
                  ) : (
                    <span className="text-amber-400 font-semibold">Low Balance</span>
                  )}
                </div>
              </div>

              {simulationResult.policyResult.violations.length > 0 && (
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 space-y-1">
                  <p className="text-xs font-semibold text-rose-300">Policy Violations:</p>
                  <ul className="list-disc list-inside text-xs text-rose-200/80 space-y-0.5">
                    {simulationResult.policyResult.violations.map((v, i) => (
                      <li key={i}>{v}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Warnings & Disclaimers */}
            <div className="p-3.5 rounded-lg bg-amber-500/5 border border-amber-500/20 space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-400">
                <Info className="w-3.5 h-3.5" />
                Security & Affordability Advisory
              </div>
              <ul className="text-xs text-amber-200/80 space-y-1 leading-relaxed">
                {simulationResult.warnings.map((w, i) => (
                  <li key={i}>• {w}</li>
                ))}
              </ul>
            </div>

            {/* Binding Hash Readout */}
            <div className="px-3 py-2 rounded bg-[#0B0F19] border border-gray-800 flex items-center justify-between text-xs">
              <span className="text-gray-500 font-mono">Payload Hash:</span>
              <span className="font-mono text-gray-400 truncate max-w-[200px]">
                {simulationResult.preparedPayloadHash}
              </span>
            </div>

            {/* Actions: Back vs Authorize */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep('input')}
                disabled={step === 'submitting'}
                className="flex-1 py-2.5 px-4 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-semibold transition-colors"
              >
                Modify Parameters
              </button>
              <button
                type="button"
                onClick={handleAuthorizeAndExecute}
                disabled={
                  step === 'submitting' ||
                  !simulationResult.policyResult.approved ||
                  simulationResult.simulation.outcome === 'failed'
                }
                className="flex-1 py-2.5 px-4 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/20"
              >
                {step === 'submitting' ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Signing & Awaiting Receipt...
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    Authorize & Sign On-Chain
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 3: EXECUTION CONFIRMED ──────────────────────────────── */}
        {step === 'confirmed' && submittedTx && (
          <div className="space-y-5 text-center py-4">
            <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-bold text-white">Transaction Confirmed On-Chain</h3>
              <p className="text-xs text-gray-400">
                Receipt authoritatively verified on Base Sepolia block #{submittedTx.blockNumber}
              </p>
            </div>

            {/* Transaction Hash & Explorer Link */}
            <div className="p-4 rounded-xl bg-gray-900 border border-gray-800 text-left space-y-3">
              <div>
                <span className="text-xs text-gray-400 block mb-1">Transaction Hash:</span>
                <div className="flex items-center justify-between p-2 rounded bg-[#0B0F19] border border-gray-800 text-xs font-mono text-cyan-400">
                  <span className="truncate">{submittedTx.txHash}</span>
                  <button
                    onClick={() => copyToClipboard(submittedTx.txHash)}
                    className="p-1 hover:text-white transition-colors"
                  >
                    {copiedHash ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 rounded bg-[#0B0F19] border border-gray-800">
                  <span className="text-gray-400">Gas Used:</span>
                  <span className="font-mono text-white font-semibold ml-1.5">{submittedTx.gasUsed || '21000'}</span>
                </div>
                <div className="p-2 rounded bg-[#0B0F19] border border-gray-800">
                  <span className="text-gray-400">Status:</span>
                  <span className="font-bold text-emerald-400 ml-1.5">Confirmed (Success)</span>
                </div>
              </div>

              {submittedTx.explorerUrl && (
                <a
                  href={submittedTx.explorerUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full py-2 px-3 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                >
                  View on BaseScan Explorer
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>

            <button
              onClick={() => {
                setStep('input');
                setSimulationResult(null);
                setSubmittedTx(null);
              }}
              className="py-2.5 px-6 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-semibold transition-colors"
            >
              Prepare Another Transfer
            </button>
          </div>
        )}

        {/* ── STEP 3: EXECUTION FAILED ─────────────────────────────────── */}
        {step === 'failed' && (
          <div className="space-y-4 text-center py-4">
            <div className="w-14 h-14 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto">
              <XCircle className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-bold text-white">Execution Halted</h3>
              <p className="text-xs text-gray-400">
                Transaction was safely aborted before signing or halted during confirmation
              </p>
            </div>

            {submittedTx?.txHash && (
              <div className="p-3 rounded-xl bg-gray-900 border border-gray-800 text-left space-y-2 max-w-md mx-auto">
                <span className="text-xs text-amber-400 font-semibold block flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Submitted Transaction Hash (Preserved for Reconciliation):
                </span>
                <div className="flex items-center justify-between p-2 rounded bg-[#0B0F19] text-xs font-mono text-cyan-400">
                  <span className="truncate">{submittedTx.txHash}</span>
                  <button onClick={() => copyToClipboard(submittedTx.txHash)} className="p-1 hover:text-white">
                    {copiedHash ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
                {submittedTx.explorerUrl && (
                  <a
                    href={submittedTx.explorerUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="py-1.5 px-3 rounded bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 text-xs font-semibold flex items-center justify-center gap-1"
                  >
                    Inspect on BaseScan <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            )}

            <button
              onClick={() => {
                setStep('input');
                setSimulationResult(null);
              }}
              className="py-2.5 px-6 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-bold transition-colors"
            >
              Return to Builder Configuration
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
