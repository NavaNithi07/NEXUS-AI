// src/lib/apiClient.ts
// Shared typed API client for all backend communication
// Never exposes private keys or signing credentials

let _inMemoryToken: string | null = null;

export function setAuthToken(token: string | null): void {
  _inMemoryToken = token;
  if (typeof window !== 'undefined' && window.localStorage) {
    if (token) {
      localStorage.setItem('nexus_jwt_token', token);
    } else {
      localStorage.removeItem('nexus_jwt_token');
    }
  }
}

export function getAuthToken(): string | null {
  if (_inMemoryToken) return _inMemoryToken;
  if (typeof window !== 'undefined' && window.localStorage) {
    return localStorage.getItem('nexus_jwt_token');
  }
  return null;
}

interface FetchOptions extends RequestInit {
  idempotencyKey?: string;
}

async function apiFetch<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const { idempotencyKey, ...fetchOptions } = options;
  const token = getAuthToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(idempotencyKey ? { 'X-Idempotency-Key': idempotencyKey } : {}),
    ...(fetchOptions.headers as Record<string, string> || {}),
  };

  const res = await fetch(path, { ...fetchOptions, headers });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new ApiError(res.status, errorBody.error || errorBody.message || `Request failed`, errorBody);
  }

  return res.json();
}

export class ApiError extends Error {
  status: number;
  body: any;
  constructor(status: number, message: string, body?: any) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

// ── Health & Status ────────────────────────────────────────────────────────────
export const api = {
  auth: {
    login: (credentials: { email: string; password: string }) =>
      apiFetch<{
        token: string;
        user: { userId: string; email: string; role: string; name: string };
        expiresIn: string;
      }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(credentials),
      }),
  },

  health: {
    get: () => apiFetch<{
      status: string;
      network: string;
      chainId: number;
      signerAddress: string;
      nativeBalanceEth: string;
      emergencyHaltActive: boolean;
      aiEngine: string;
      persistence: string;
    }>('/api/health'),
  },

  wallet: {
    status: () => apiFetch<{
      address: string;
      chainId: number;
      network: string;
      nativeBalanceEth: string;
      nativeBalanceWei: string;
      nonce: number;
      isEmergencyPaused: boolean;
      blockExplorerUrl: string;
    }>('/api/wallet/status'),
  },

  agents: {
    list: () => apiFetch<any[]>('/api/agents', { method: 'GET' }),
    create: (data: object) => apiFetch<any>('/api/agents', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: object) => apiFetch<any>(`/api/agents/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string) => apiFetch<any>(`/api/agents/${id}`, { method: 'DELETE' }),
    execute: (agentId: string, taskGoal: string, recipientAddress?: string, amount?: number, idempotencyKey?: string) =>
      apiFetch<{
        success: boolean;
        status: string;
        job?: any;
        violations?: string[];
        policyChecks?: any;
        cached?: boolean;
        error?: string;
      }>(`/api/agents/${agentId}/execute`, {
        method: 'POST',
        body: JSON.stringify({ taskGoal, recipientAddress, amount }),
        idempotencyKey,
      }),
  },

  policies: {
    list: () => apiFetch<any[]>('/api/policies', { method: 'GET' }),
    create: (data: object) => apiFetch<any>('/api/policies', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: object) => apiFetch<any>(`/api/policies/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string) => apiFetch<any>(`/api/policies/${id}`, { method: 'DELETE' }),
  },

  transactions: {
    list: () => apiFetch<any[]>('/api/transactions', { method: 'GET' }),
  },

  auditLogs: {
    list: () => apiFetch<any[]>('/api/audit-logs', { method: 'GET' }),
  },

  security: {
    status: () => apiFetch<{ isEmergencyPaused: boolean; timestamp: string }>('/api/security/status', { method: 'GET' }),
    killswitch: () => apiFetch<{ isEmergencyPaused: boolean; message: string }>('/api/security/killswitch', { method: 'POST' }),
    resume: () => apiFetch<{ isEmergencyPaused: boolean; message: string }>('/api/security/resume', { method: 'POST' }),
  },
};

export default api;
