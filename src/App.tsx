// src/App.tsx
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Agents } from './pages/Agents';
import { Wallet } from './pages/Wallet';
import { Transactions } from './pages/Transactions';
import { Policies } from './pages/Policies';
import { Security } from './pages/Security';
import { Monitoring } from './pages/Monitoring';
import { Settings } from './pages/Settings';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Login Route (Step 0) */}
        <Route path="/login" element={<Login />} />

        {/* Protected Vault Routes Guarded by ProtectedRoute */}
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<AppLayout />}>
            {/* Main Dashboard (Step 1) */}
            <Route index element={<Dashboard />} />
            <Route path="dashboard" element={<Navigate to="/" replace />} />

            {/* AI Agent Fleet Management (Step 2) */}
            <Route path="agents" element={<Agents />} />

            {/* Platform Modules (Steps 3 to 8) */}
            <Route path="wallet" element={<Wallet />} />
            <Route path="transactions" element={<Transactions />} />
            <Route path="policies" element={<Policies />} />
            <Route path="security" element={<Security />} />
            <Route path="monitoring" element={<Monitoring />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Route>

        {/* Catch-all fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
