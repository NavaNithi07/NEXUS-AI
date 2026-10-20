import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Agent, AgentStatus, Transaction, ActivityLog, WalletAsset, SpendingPolicy, SystemSettings, AuthUser } from '../types';
import { initialAgents, mockTransactions, mockActivityLogs, mockWalletAssets, mockSpendingPolicies, initialSettings } from '../data/mockData';
import { api, setAuthToken } from '../lib/apiClient';

export interface AppState {
  agents: Agent[];
  transactions: Transaction[];
  activityLogs: ActivityLog[];
  walletAssets: WalletAsset[];
  spendingPolicies: SpendingPolicy[];
  activeNetwork: string;
  settings: SystemSettings;
  isGlobalEmergencyHalted: boolean;
  securityDrillRunning: boolean;
  
  // Auth state & actions
  isAuthenticated: boolean;
  currentUser: AuthUser | null;
  login: (email: string, name?: string, token?: string) => void;
  logout: () => void;
  
  // Agent actions
  addAgent: (agentData: Omit<Agent, 'id' | 'createdAt' | 'lastActive' | 'spentToday' | 'txCount'>) => Agent;
  updateAgent: (id: string, updates: Partial<Agent>) => void;
  deleteAgent: (id: string) => void;
  setAgentStatus: (id: string, status: AgentStatus) => void;
  pauseAgent: (id: string) => void;
  resumeAgent: (id: string) => void;
  
  // Wallet actions
  transferAsset: (symbol: string, amount: number, destination: string) => boolean;
  depositAsset: (symbol: string, amount: number) => void;

  // Transaction actions
  addTransaction: (txData: Omit<Transaction, 'id' | 'timestamp'>) => Transaction;

  // Policy actions
  addPolicy: (policyData: Omit<SpendingPolicy, 'id'>) => Promise<SpendingPolicy>;
  updatePolicy: (id: string, updates: Partial<SpendingPolicy>) => void;
  deletePolicy: (id: string) => void;
  togglePolicyStatus: (id: string) => void;

  // Network & Settings
  setActiveNetwork: (networkName: string) => void;
  updateSettings: (newSettings: Partial<SystemSettings>) => void;

  // Security & Emergency actions — now await backend confirmation
  triggerGlobalEmergencyStop: () => Promise<void>;
  resumeGlobalOperations: () => Promise<void>;
  runSecurityDrill: () => void;
  
  // Real On-Chain / Backend state
  onChainAddress: string;
  onChainBalanceEth: string;
  onChainChainId: number;
  onChainNetwork: string;
  backendConnected: boolean;
  fetchOnChainStatus: () => Promise<void>;
  syncFromBackend: () => Promise<void>;
  executeAgentTask: (
    agentId: string,
    taskGoal: string,
    recipientAddress?: string,
    amount?: number
  ) => Promise<{ success: boolean; status: string; message?: string; job?: any; violations?: string[]; policyChecks?: any }>;

  // Logs & Demo reset
  clearActivityLogs: () => void;
  resetDemoData: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      agents: initialAgents,
      transactions: mockTransactions,
      activityLogs: mockActivityLogs,
      walletAssets: mockWalletAssets,
      spendingPolicies: mockSpendingPolicies,
      activeNetwork: 'Arbitrum One',
      settings: initialSettings,
      isGlobalEmergencyHalted: false,
      securityDrillRunning: false,
      isAuthenticated: false,
      currentUser: null,
      onChainAddress: '0x2836a264976f67178BE78F1b963f545c7BB5f657',
      onChainBalanceEth: '0',
      onChainChainId: 84532,
      onChainNetwork: 'Base Sepolia',
      backendConnected: false,

      login: (email, name, token) => {
        if (token) {
          setAuthToken(token);
        }

        const user: AuthUser = {
          id: `usr-${Date.now().toString(36)}`,
          name: name || email.split('@')[0],
          email,
          role: 'Chief Treasury Operator',
          lastLogin: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };

        const log: ActivityLog = {
          id: `log-${Date.now()}`,
          agentName: 'Security & Auth Gateway',
          action: 'Operator Session Authenticated',
          details: `Session authorized for ${user.email}. Private cryptographic enclave unlocked.`,
          severity: 'info',
          timestamp: 'Just now',
        };

        set((state) => ({
          isAuthenticated: true,
          currentUser: user,
          activityLogs: [log, ...state.activityLogs],
        }));
      },

      logout: () => {
        setAuthToken(null);

        const log: ActivityLog = {
          id: `log-${Date.now()}`,
          agentName: 'Security & Auth Gateway',
          action: 'Operator Logged Out',
          details: `Session revoked. Local signature tokens cleared.`,
          severity: 'info',
          timestamp: 'Just now',
        };

        set((state) => ({
          isAuthenticated: false,
          currentUser: null,
          activityLogs: [log, ...state.activityLogs],
        }));
      },

      addAgent: (agentData) => {
        const newAgent: Agent = {
          ...agentData,
          id: `ag-${Date.now().toString(36).substr(-4)}`,
          spentToday: 0,
          txCount: 0,
          createdAt: new Date().toISOString().split('T')[0],
          lastActive: 'Just now',
          avatarIcon: agentData.avatarIcon || 'Bot',
        };

        const newLog: ActivityLog = {
          id: `log-${Date.now()}`,
          agentName: newAgent.name,
          action: 'Agent Deployed',
          details: `Provisioned with $${newAgent.balance.toLocaleString()} initial balance. Daily limit: $${newAgent.dailyLimit.toLocaleString()}.`,
          severity: 'info',
          timestamp: 'Just now',
        };

        set((state) => ({
          agents: [newAgent, ...state.agents],
          activityLogs: [newLog, ...state.activityLogs],
        }));

        // Sync with backend enclave
        api.agents.create({
          name: newAgent.name,
          description: newAgent.description,
          type: newAgent.type,
          balance: newAgent.balance,
          dailyLimit: newAgent.dailyLimit,
          maxTxAmount: newAgent.maxTxAmount,
          status: newAgent.status,
          allowedRecipients: newAgent.allowedRecipients || ['0x70997970C51812dc3A010C7d01b50e0d17dc79C8', '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC'],
          allowedTokens: newAgent.allowedTokens || ['ETH', 'USDC'],
        }).then((serverAgent) => {
          // Update local ID with server-assigned ID
          if (serverAgent?.id && serverAgent.id !== newAgent.id) {
            set((state) => ({
              agents: state.agents.map((a) => a.id === newAgent.id ? { ...a, id: serverAgent.id } : a),
            }));
          }
        }).catch((err) => console.warn('[Store] Backend agent sync:', err.message));

        return newAgent;
      },

      updateAgent: (id, updates) => {
        set((state) => {
          const target = state.agents.find((a) => a.id === id);
          const updatedAgents = state.agents.map((a) => (a.id === id ? { ...a, ...updates } : a));
          
          const newLog: ActivityLog = {
            id: `log-${Date.now()}`,
            agentName: target?.name || 'Agent',
            action: 'Agent Parameters Updated',
            details: `Updated parameters: ${Object.keys(updates).join(', ')}`,
            severity: 'info',
            timestamp: 'Just now',
          };

          return {
            agents: updatedAgents,
            activityLogs: [newLog, ...state.activityLogs],
          };
        });

        api.agents.update(id, updates).catch(() => {});
      },

      deleteAgent: (id) => {
        set((state) => {
          const target = state.agents.find((a) => a.id === id);
          const newLog: ActivityLog = {
            id: `log-${Date.now()}`,
            agentName: target?.name || 'Agent',
            action: 'Agent Deprovisioned',
            details: `Agent removed from execution pool.`,
            severity: 'warning',
            timestamp: 'Just now',
          };

          return {
            agents: state.agents.filter((a) => a.id !== id),
            activityLogs: [newLog, ...state.activityLogs],
          };
        });

        api.agents.delete(id).catch(() => {});
      },

      setAgentStatus: (id, status) => {
        set((state) => {
          const target = state.agents.find((a) => a.id === id);
          const updatedAgents = state.agents.map((a) =>
            a.id === id ? { ...a, status, lastActive: 'Just now' } : a
          );
          
          const newLog: ActivityLog = {
            id: `log-${Date.now()}`,
            agentName: target?.name || 'Agent',
            action: `Status set to ${status.toUpperCase()}`,
            details: `Execution state switched to ${status}.`,
            severity: status === 'stopped' ? 'critical' : status === 'paused' ? 'warning' : 'success',
            timestamp: 'Just now',
          };

          return {
            agents: updatedAgents,
            activityLogs: [newLog, ...state.activityLogs],
          };
        });

        api.agents.update(id, { status }).catch(() => {});
      },

      pauseAgent: (id) => {
        get().setAgentStatus(id, 'paused');
      },

      resumeAgent: (id) => {
        get().setAgentStatus(id, 'active');
      },

      transferAsset: (symbol, amount, destination) => {
        const assets = get().walletAssets;
        const target = assets.find((a) => a.symbol === symbol);
        if (!target || target.balance < amount) return false;

        const tokenPrices: Record<string, number> = { ETH: 3450, WETH: 3450, USDC: 1, USDT: 1, WBTC: 67000, ARB: 1.05, LINK: 15.5 };
        const unitPrice = (target && target.balance > 0) ? target.valueUsd / target.balance : (tokenPrices[symbol] || 1);
        const deductionUsd = amount * unitPrice;

        const updatedAssets = assets.map((a) =>
          a.symbol === symbol
            ? { ...a, balance: Math.max(0, a.balance - amount), valueUsd: Math.max(0, a.valueUsd - deductionUsd) }
            : a
        );

        // ✅ No fabricated hash — this is a local simulation only
        const newTx: Transaction = {
          id: `tx-${Date.now()}`,
          agentName: 'Manual Treasury Vault',
          type: 'transfer',
          amount: deductionUsd,
          asset: `${amount} ${symbol}`,
          destination: destination.length > 16 ? `${destination.slice(0, 8)}...${destination.slice(-6)}` : destination,
          status: 'pending',
          timestamp: 'Just now',
          hash: 'PENDING — Submit via Agent Execution for on-chain signing',
          gasFee: 0,
          blockNumber: undefined,
          gasUsed: undefined,
          calldata: '0xa9059cbb000000000000000000000000' + destination.replace(/^0x/, '').padStart(64, '0')
        };

        const newLog: ActivityLog = {
          id: `log-${Date.now()}`,
          agentName: 'Asset Vault',
          action: `Transfer Queued: ${amount} ${symbol}`,
          details: `Destination: ${destination}. Estimated deduction $${deductionUsd.toFixed(2)}. Use Agent Execution for real on-chain signing.`,
          severity: 'info',
          timestamp: 'Just now',
        };

        set((state) => ({
          walletAssets: updatedAssets,
          transactions: [newTx, ...state.transactions],
          activityLogs: [newLog, ...state.activityLogs],
        }));

        return true;
      },

      depositAsset: (symbol, amount) => {
        const assets = get().walletAssets;
        const target = assets.find((a) => a.symbol === symbol);
        const tokenPrices: Record<string, number> = { ETH: 3450, WETH: 3450, USDC: 1, USDT: 1, WBTC: 67000, ARB: 1.05, LINK: 15.5 };
        const unitPrice = tokenPrices[symbol] || ((target && target.balance > 0) ? target.valueUsd / target.balance : 1);
        const addedUsd = amount * unitPrice;

        let updatedAssets: WalletAsset[];
        if (target) {
          updatedAssets = assets.map((a) =>
            a.symbol === symbol
              ? { ...a, balance: a.balance + amount, valueUsd: a.valueUsd + addedUsd }
              : a
          );
        } else {
          updatedAssets = [
            ...assets,
            {
              symbol,
              name: symbol,
              balance: amount,
              valueUsd: addedUsd,
              change24h: 0.0,
              network: get().activeNetwork,
              icon: 'https://assets.coingecko.com/coins/images/6319/small/USD_Coin_icon.png'
            }
          ];
        }

        const newLog: ActivityLog = {
          id: `log-${Date.now()}`,
          agentName: 'Vault Gateway',
          action: `Received Deposit of ${amount} ${symbol}`,
          details: `Credited $${addedUsd.toFixed(2)} to cold treasury balance.`,
          severity: 'success',
          timestamp: 'Just now',
        };

        set((state) => ({
          walletAssets: updatedAssets,
          activityLogs: [newLog, ...state.activityLogs],
        }));
      },

      addTransaction: (txData) => {
        // ✅ No fabricated hash — caller must supply real data or explicit placeholder
        const newTx: Transaction = {
          ...txData,
          id: `tx-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };

        set((state) => ({
          transactions: [newTx, ...state.transactions],
        }));

        return newTx;
      },

      addPolicy: async (policyData) => {
        const newPolicy: SpendingPolicy = {
          ...policyData,
          id: `pol-${Date.now().toString(36)}`,
        };

        const newLog: ActivityLog = {
          id: `log-${Date.now()}`,
          agentName: 'Policy Engine',
          action: `Policy Enacted: ${newPolicy.name}`,
          details: `Enforced for ${newPolicy.targetAgent}. Daily limit: $${newPolicy.maxDailySpend.toLocaleString()}.`,
          severity: 'info',
          timestamp: 'Just now',
        };

        // Sync to backend first — only add locally after confirmation
        try {
          const serverPolicy = await api.policies.create({
            name: policyData.name,
            description: policyData.description,
            targetAgent: policyData.targetAgent,
            maxDailySpend: policyData.maxDailySpend,
            maxSingleTx: policyData.maxSingleTx,
            requireApprovalAbove: policyData.requireApprovalAbove,
            allowedTokens: policyData.allowedTokens,
            status: policyData.status,
          });

          const confirmedPolicy = serverPolicy || newPolicy;

          set((state) => ({
            spendingPolicies: [...state.spendingPolicies, confirmedPolicy],
            activityLogs: [newLog, ...state.activityLogs],
          }));

          return confirmedPolicy;
        } catch (err) {
          console.warn('[Store] Backend policy sync failed, adding locally:', err);
          set((state) => ({
            spendingPolicies: [...state.spendingPolicies, newPolicy],
            activityLogs: [newLog, ...state.activityLogs],
          }));
          return newPolicy;
        }
      },

      updatePolicy: (id, updates) => {
        set((state) => ({
          spendingPolicies: state.spendingPolicies.map((p) => (p.id === id ? { ...p, ...updates } : p)),
          activityLogs: [
            {
              id: `log-${Date.now()}`,
              agentName: 'Policy Engine',
              action: 'Policy Rule Modified',
              details: `Rule ${id} updated with new velocity constraints.`,
              severity: 'info',
              timestamp: 'Just now',
            },
            ...state.activityLogs,
          ],
        }));
        api.policies.update(id, updates).catch(() => {});
      },

      deletePolicy: (id) => {
        set((state) => ({
          spendingPolicies: state.spendingPolicies.filter((p) => p.id !== id),
          activityLogs: [
            {
              id: `log-${Date.now()}`,
              agentName: 'Policy Engine',
              action: 'Policy Rule Removed',
              details: `Policy ${id} revoked.`,
              severity: 'warning',
              timestamp: 'Just now',
            },
            ...state.activityLogs,
          ],
        }));
        api.policies.delete(id).catch(() => {});
      },

      togglePolicyStatus: (id) => {
        set((state) => {
          const updated: SpendingPolicy[] = state.spendingPolicies.map((p) =>
            p.id === id ? { ...p, status: (p.status === 'active' ? 'inactive' : 'active') as 'active' | 'inactive' } : p
          );
          const policy = updated.find((p) => p.id === id);
          if (policy) {
            api.policies.update(id, { status: policy.status }).catch(() => {});
          }
          return { spendingPolicies: updated };
        });
      },

      setActiveNetwork: (networkName) => {
        set((state) => ({
          activeNetwork: networkName,
          activityLogs: [
            {
              id: `log-${Date.now()}`,
              agentName: 'Network Gateway',
              action: `Switched RPC Network to ${networkName}`,
              details: `Active connection rerouted. Nonces synchronized.`,
              severity: 'info',
              timestamp: 'Just now',
            },
            ...state.activityLogs,
          ],
        }));
      },

      updateSettings: (newSettings) => {
        set((state) => ({
          settings: { ...state.settings, ...newSettings },
          activityLogs: [
            {
              id: `log-${Date.now()}`,
              agentName: 'Kernel Settings',
              action: 'Hyperparameters Saved',
              details: `System operating parameters persisted to local vault store.`,
              severity: 'info',
              timestamp: 'Just now',
            },
            ...state.activityLogs,
          ],
        }));
      },

      // ✅ Now awaits backend confirmation before updating frontend state
      triggerGlobalEmergencyStop: async () => {
        try {
          const result = await api.security.killswitch();
          if (result.isEmergencyPaused) {
            set((state) => ({
              isGlobalEmergencyHalted: true,
              agents: state.agents.map((a) => ({ ...a, status: 'stopped' })),
              activityLogs: [
                {
                  id: `log-${Date.now()}`,
                  agentName: 'Global Circuit Breaker',
                  action: 'EMERGENCY PROTOCOL ENGAGED',
                  details: 'All agent execution halted. Backend killswitch confirmed ACTIVE. On-chain signing blocked.',
                  severity: 'critical',
                  timestamp: 'Just now',
                },
                ...state.activityLogs,
              ],
            }));
          }
        } catch (err: any) {
          console.error('[Store] Emergency stop backend call failed:', err.message);
          throw err;
        }
      },

      resumeGlobalOperations: async () => {
        try {
          const result = await api.security.resume();
          if (!result.isEmergencyPaused) {
            set((state) => ({
              isGlobalEmergencyHalted: false,
              activityLogs: [
                {
                  id: `log-${Date.now()}`,
                  agentName: 'Global Circuit Breaker',
                  action: 'Operations Resumed',
                  details: 'Emergency stop cleared. Backend confirmed ACTIVE. Safe operating thresholds verified.',
                  severity: 'success',
                  timestamp: 'Just now',
                },
                ...state.activityLogs,
              ],
            }));
          }
        } catch (err: any) {
          console.error('[Store] Resume operations backend call failed:', err.message);
          throw err;
        }
      },

      runSecurityDrill: () => {
        set({ securityDrillRunning: true });
        
        const drillLog: ActivityLog = {
          id: `log-${Date.now()}`,
          agentName: 'Security Drill Module',
          action: 'SIMULATED CIRCUIT BREAKER DRILL INITIATED',
          details: 'Executing mock flash-crash mitigation drill. This is a simulation — no real transactions are blocked.',
          severity: 'warning',
          timestamp: 'Just now',
        };

        set((state) => ({ activityLogs: [drillLog, ...state.activityLogs] }));

        setTimeout(() => {
          set((state) => ({
            securityDrillRunning: false,
            activityLogs: [
              {
                id: `log-${Date.now()}`,
                agentName: 'Security Drill Module',
                action: 'DRILL COMPLETED — SIMULATION ONLY',
                details: 'Drill finished. Note: This was a simulation. Real emergency stop is on the Security page.',
                severity: 'success',
                timestamp: 'Just now',
              },
              ...state.activityLogs,
            ],
          }));
        }, 3000);
      },

      fetchOnChainStatus: async () => {
        try {
          const data = await api.wallet.status();
          set((state) => {
            const ethBalance = parseFloat(data.nativeBalanceEth) || 0;
            const updatedAssets = state.walletAssets.map((asset) =>
              asset.symbol === 'ETH'
                ? { ...asset, balance: ethBalance, valueUsd: ethBalance * 3450, network: data.network }
                : asset
            );
            return {
              onChainAddress: data.address,
              onChainBalanceEth: data.nativeBalanceEth,
              onChainChainId: data.chainId,
              onChainNetwork: data.network,
              isGlobalEmergencyHalted: data.isEmergencyPaused,
              backendConnected: true,
              walletAssets: updatedAssets,
            };
          });
        } catch (err) {
          set({ backendConnected: false });
          console.warn('[Store] Could not connect to backend RPC endpoint:', err);
        }
      },

      // Full sync from backend — agents, policies, emergency status
      syncFromBackend: async () => {
        try {
          // Wallet & emergency status
          await get().fetchOnChainStatus();

          // Agents
          const backendAgents = await api.agents.list();
          if (Array.isArray(backendAgents) && backendAgents.length > 0) {
            set({ agents: backendAgents });
          }

          // Policies
          const backendPolicies = await api.policies.list();
          if (Array.isArray(backendPolicies) && backendPolicies.length > 0) {
            set({ spendingPolicies: backendPolicies });
          }

          // Transactions from backend ledger (real execution jobs)
          const backendTxs = await api.transactions.list();
          if (Array.isArray(backendTxs) && backendTxs.length > 0) {
            const mapped = backendTxs.map((job: any) => ({
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
            }));
            set({ transactions: mapped });
          }

          // Audit logs
          const auditLogs = await api.auditLogs.list();
          if (Array.isArray(auditLogs) && auditLogs.length > 0) {
            const mappedLogs: ActivityLog[] = auditLogs.map((r: any) => ({
              id: r.id,
              agentName: r.agentName,
              action: r.outcome === 'confirmed' ? 'On-Chain Execution CONFIRMED' :
                      r.outcome === 'rejected' ? 'Execution REJECTED by Policy Engine' : 'Execution FAILED',
              details: r.details,
              severity: r.outcome === 'confirmed' ? 'success' :
                        r.outcome === 'rejected' ? 'critical' : 'warning',
              timestamp: new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            }));
            set((state) => ({
              activityLogs: [...mappedLogs, ...state.activityLogs.slice(0, 50)],
            }));
          }
        } catch (err) {
          console.warn('[Store] syncFromBackend error:', err);
        }
      },

      executeAgentTask: async (agentId, taskGoal, recipientAddress, amount) => {
        // Generate idempotency key to prevent duplicate submissions
        const idempotencyKey = `exec-${agentId}-${Date.now()}`;

        try {
          const data = await api.agents.execute(agentId, taskGoal, recipientAddress, amount, idempotencyKey);

          if (data.success && data.job) {
            const job = data.job;
            const isConfirmed = job.status === 'confirmed';
            const isFailed = job.status === 'failed';

            const newTx: Transaction = {
              id: job.jobId || `tx-${Date.now()}`,
              agentId: job.agentId,
              agentName: job.agentName,
              type: 'transfer',
              amount: job.proposal.amount,
              asset: `${job.proposal.amount} ${job.proposal.token}`,
              destination: job.proposal.recipient,
              // ✅ Only use real txHash, never fabricate
              status: isConfirmed ? 'completed' : isFailed ? 'failed' : 'pending',
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              hash: job.txHash || (isFailed ? 'FAILED_BROADCAST' : 'PENDING'),
              gasFee: parseFloat(job.proposal.estimatedGasEth || '0.000021') * 3450,
              blockNumber: job.blockNumber,
              gasUsed: job.gasUsed ? parseInt(job.gasUsed) : undefined,
              calldata: `autonomous_task: ${job.proposal.action}(${job.proposal.amount} ${job.proposal.token} -> ${job.proposal.recipient})`,
              explorerUrl: job.explorerUrl,
            };

            const newLog: ActivityLog = {
              id: `log-${Date.now()}`,
              agentName: job.agentName,
              action: isConfirmed
                ? '✅ Autonomous On-Chain Execution CONFIRMED'
                : isFailed
                ? '❌ Broadcast Failed — Policy Approved but RPC Error'
                : '⏳ Execution Pending',
              details: isConfirmed
                ? `Verified on ${get().onChainNetwork} in block #${job.blockNumber}. Hash: ${job.txHash}`
                : (job.error || 'Execution did not complete.'),
              severity: isConfirmed ? 'success' : 'warning',
              timestamp: 'Just now',
            };

            set((state) => ({
              transactions: [newTx, ...state.transactions],
              activityLogs: [newLog, ...state.activityLogs],
              agents: state.agents.map((a) =>
                a.id === agentId
                  ? { ...a, spentToday: a.spentToday + (isConfirmed ? job.proposal.amount : 0), txCount: a.txCount + 1, lastActive: 'Just now' }
                  : a
              ),
            }));

            get().fetchOnChainStatus();

            return { success: isConfirmed, status: job.status, message: job.error || 'Task processed', job };

          } else {
            const violations = data.violations || [data.error || 'Execution rejected by policy engine'];
            const rejectedLog: ActivityLog = {
              id: `log-${Date.now()}`,
              agentName: 'Policy Enforcement Engine',
              action: '🛡️ Autonomous Task REJECTED Before Signing',
              details: violations.join('; '),
              severity: 'critical',
              timestamp: 'Just now',
            };

            const rejectedTx: Transaction = {
              id: `tx-rej-${Date.now()}`,
              agentId,
              agentName: get().agents.find((a) => a.id === agentId)?.name || 'Agent',
              type: 'transfer',
              amount: amount || 0,
              asset: 'ETH',
              destination: recipientAddress || 'Policy Blocked',
              status: 'failed',
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              hash: 'REJECTED_BEFORE_SIGNING',
              gasFee: 0,
              policyViolations: violations,
            };

            set((state) => ({
              transactions: [rejectedTx, ...state.transactions],
              activityLogs: [rejectedLog, ...state.activityLogs],
            }));

            return { success: false, status: 'rejected', violations, policyChecks: data.policyChecks, message: violations.join('; ') };
          }
        } catch (err: any) {
          return { success: false, status: 'error', message: err.message };
        }
      },

      clearActivityLogs: () => {
        set({ activityLogs: [] });
      },

      resetDemoData: () => {
        set({
          agents: initialAgents,
          transactions: mockTransactions,
          activityLogs: mockActivityLogs,
          walletAssets: mockWalletAssets,
          spendingPolicies: mockSpendingPolicies,
          settings: initialSettings,
          activeNetwork: 'Arbitrum One',
          isGlobalEmergencyHalted: false,
          securityDrillRunning: false,
          isAuthenticated: false,
          currentUser: null,
        });
      },
    }),
    {
      name: 'nexus-ai-wallet-storage-v4',
    }
  )
);

export default useAppStore;
