// src/pages/Login.tsx
import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Zap,
  Shield,
  Lock,
  Mail,
  Eye,
  EyeOff,
  ArrowRight,
  Sparkles,
  Bot,
  Radio,
  CheckCircle2,
  AlertCircle,
  Cpu,
  KeyRound,
  Layers,
  ChevronRight,
  Fingerprint,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '../store/appStore';
import { api } from '../lib/apiClient';
import { CyberFoxLogo } from '../components/ui/CyberFoxLogo';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated } = useAppStore();

  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [forgotModalOpen, setForgotModalOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState(false);

  // If already authenticated, redirect to previous location or dashboard
  React.useEffect(() => {
    if (isAuthenticated) {
      const from = (location.state as any)?.from?.pathname || '/';
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, location]);

  const validateEmail = (val: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    // Validation
    if (!email.trim()) {
      setErrorMsg('Please enter your operator email address.');
      return;
    }
    if (!validateEmail(email.trim())) {
      setErrorMsg('Please enter a valid email address format.');
      return;
    }
    if (!password) {
      setErrorMsg('Please enter your vault password.');
      return;
    }
    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
      return;
    }

    if (isRegisterMode) {
      if (!fullName.trim()) {
        setErrorMsg('Please enter your operator name.');
        return;
      }
    }

    setIsLoading(true);

    try {
      let authRes;
      if (isRegisterMode) {
        authRes = await api.auth.register({
          email: email.trim(),
          password,
          name: fullName.trim(),
        });
      } else {
        authRes = await api.auth.login({ email: email.trim(), password });
      }

      login(authRes.user.email, authRes.user.name, authRes.token);
      setIsLoading(false);
      const from = (location.state as any)?.from?.pathname || '/';
      navigate(from, { replace: true });
    } catch (err: any) {
      setIsLoading(false);
      setErrorMsg(err.message || 'Authentication failed. Please verify credentials.');
    }
  };

  const handleDemoOneClick = () => {
    setEmail('operator@nexus.ai');
    setErrorMsg(null);
    const passInput = document.getElementById('operator-password-input');
    if (passInput) {
      passInput.focus();
    }
  };

  const handleForgotPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail || !validateEmail(forgotEmail)) return;
    setForgotSuccess(true);
    setTimeout(() => {
      setForgotModalOpen(false);
      setForgotSuccess(false);
      setForgotEmail('');
    }, 2500);
  };

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 flex flex-col justify-between font-sans relative overflow-hidden selection:bg-cyan-500/20 selection:text-cyan-300">
      {/* Background Ambient Glow Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[55vw] h-[55vw] bg-cyan-500/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[55vw] h-[55vw] bg-violet-600/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-1/2 left-1/3 -translate-y-1/2 w-96 h-96 bg-cyan-600/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Top Navbar */}
      <header className="relative z-10 px-6 sm:px-12 py-5 flex items-center justify-between border-b border-slate-800/40 backdrop-blur-md">
        <div className="flex items-center gap-3.5">
          <div className="relative flex items-center justify-center w-11 h-11 rounded-2xl bg-slate-900/90 border border-cyan-500/30 shadow-lg shadow-cyan-500/20">
            <CyberFoxLogo size="sm" showGlow={false} />
            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-slate-950" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-base tracking-wider text-white">NEXUS</span>
              <span className="text-xs px-1.5 py-0.2 rounded font-mono font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                AI
              </span>
            </div>
            <p className="text-[10px] font-mono text-slate-400 tracking-tight">AUTONOMOUS ON-CHAIN VAULT</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-mono bg-slate-900/80 border border-slate-800 text-slate-300">
            <Radio className="w-3 h-3 text-emerald-400 animate-pulse" /> Arbitrum Nitro Relay
          </span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-semibold">
            ZERO-KNOWLEDGE ENCLAVE
          </span>
        </div>
      </header>

      {/* Main Container */}
      <main className="relative z-10 flex-1 max-w-7xl w-full mx-auto px-4 sm:px-8 py-8 sm:py-12 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        {/* Left Side: Brand Visuals & Neural Telemetry */}
        <div className="lg:col-span-6 space-y-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="space-y-4"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-mono font-medium">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>EIP-4337 Account Abstraction • 8 Autonomous Agents</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight leading-[1.15]">
              Autonomous Capital Orchestration with{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-sky-300 to-violet-400">
                Zero-Trust Security
              </span>
            </h1>

            <p className="text-sm sm:text-base text-slate-400 max-w-xl leading-relaxed">
              Log in to your private on-chain command center. Monitor algorithmic flash arbitrage, dynamic yield compounding, and instantaneous circuit-breaker protection in real time.
            </p>
          </motion.div>

          {/* Animated Cyber Fox Hologram Mascot Showcase */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="relative flex items-center justify-center py-4 my-2"
          >
            {/* Holographic Glowing Ring */}
            <div className="absolute w-64 h-64 sm:w-72 sm:h-72 rounded-full border border-cyan-500/20 animate-spin [animation-duration:30s] pointer-events-none">
              <span className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_12px_#22d3ee]" />
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-violet-400 shadow-[0_0_12px_#a78bfa]" />
            </div>
            <div className="absolute w-52 h-52 sm:w-56 sm:h-56 rounded-full border border-dashed border-violet-500/25 animate-spin [animation-duration:20s] [animation-direction:reverse] pointer-events-none" />

            {/* Neon Cyber Fox Mascot */}
            <CyberFoxLogo size="hero" animated={true} />

            {/* Floating Orbit Telemetry Badges */}
            <motion.div
              animate={{ y: [-4, 4, -4] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute -top-1 right-1 sm:right-6 px-3 py-1.5 rounded-xl bg-slate-900/90 border border-cyan-500/30 text-[10px] font-mono text-cyan-300 shadow-lg shadow-cyan-950/40 backdrop-blur-md flex items-center gap-1.5"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
              <span>NEURAL ARBITRAGE: ACTIVE</span>
            </motion.div>

            <motion.div
              animate={{ y: [4, -4, 4] }}
              transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute -bottom-1 left-1 sm:left-6 px-3 py-1.5 rounded-xl bg-slate-900/90 border border-violet-500/30 text-[10px] font-mono text-violet-300 shadow-lg shadow-black/40 backdrop-blur-md flex items-center gap-1.5"
            >
              <Shield className="w-3 h-3 text-violet-400" />
              <span>MEV SHIELD: ARMED</span>
            </motion.div>
          </motion.div>

          {/* Feature Highlights Grid */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="grid grid-cols-1 sm:grid-cols-2 gap-4"
          >
            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-xl">
              <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center mb-2.5">
                <Bot className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-bold text-white mb-1">Autonomous Agent Fleet</h3>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Self-executing smart-contract bots with enforced daily spending ceilings.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-xl">
              <div className="w-8 h-8 rounded-xl bg-violet-500/10 border border-violet-500/30 text-violet-400 flex items-center justify-center mb-2.5">
                <Shield className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-bold text-white mb-1">Mempool MEV Shield</h3>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Private Flashbots routing deflecting frontrunners and sandwich attacks.
              </p>
            </div>
          </motion.div>

          {/* Live Node Signal Pill */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 flex items-center justify-between text-xs font-mono text-slate-400"
          >
            <span className="flex items-center gap-2">
              <Cpu className="w-3.5 h-3.5 text-cyan-400" />
              <span>Kernel State: Operational (v2.4)</span>
            </span>
            <span className="text-emerald-400 font-bold">14.8ms Latency</span>
          </motion.div>
        </div>

        {/* Right Side: Centered Glassmorphism Login Card */}
        <div className="lg:col-span-6 flex justify-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
            className="w-full max-w-md rounded-3xl bg-slate-900/85 backdrop-blur-2xl border border-slate-750 p-6 sm:p-8 shadow-2xl shadow-cyan-950/20 relative"
          >
            {/* Ambient card top border */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-400 via-sky-400 to-violet-500 rounded-t-3xl" />

            {/* Tab switch: Sign In vs Register */}
            <div className="flex rounded-2xl bg-slate-950/80 p-1 border border-slate-800 mb-6">
              <button
                type="button"
                onClick={() => {
                  setIsRegisterMode(false);
                  setErrorMsg(null);
                }}
                className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-all ${
                  !isRegisterMode
                    ? 'bg-slate-800 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsRegisterMode(true);
                  setErrorMsg(null);
                }}
                className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-all ${
                  isRegisterMode
                    ? 'bg-slate-800 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Create Account
              </button>
            </div>

            {/* Title */}
            <div className="mb-6">
              <h2 className="text-xl font-bold text-white tracking-tight">
                {isRegisterMode ? 'Deploy Operator Credentials' : 'Authenticate Vault Session'}
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                {isRegisterMode
                  ? 'Provision your decentralized operator identity'
                  : 'Enter your credentials to unlock autonomous execution'}
              </p>
            </div>

            {/* Error Banner */}
            {errorMsg && (
              <div className="mb-5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              {isRegisterMode && (
                <div>
                  <label className="block text-slate-300 font-medium mb-1.5">Operator Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Alex Mercer"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition-colors"
                  />
                </div>
              )}

              <div>
                <label className="block text-slate-300 font-medium mb-1.5">Email Address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="operator@nexus.ai"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition-colors"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-slate-300 font-medium">Vault Password</label>
                  {!isRegisterMode && (
                    <button
                      type="button"
                      onClick={() => setForgotModalOpen(true)}
                      className="text-cyan-400 hover:text-cyan-300 text-[11px] font-mono transition-colors"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    id="operator-password-input"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Remember Me checkbox */}
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="rounded accent-cyan-500 w-3.5 h-3.5"
                  />
                  <span className="text-slate-400 text-xs">Remember session on this device</span>
                </label>
              </div>

              {/* Primary Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 px-4 rounded-xl font-bold bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/25 active:scale-98 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {isLoading ? (
                  <span className="inline-block w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <span>{isRegisterMode ? 'Deploy Account & Enter' : 'Sign In to Vault'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            {/* Quick Access Button */}
            <div className="mt-5 pt-5 border-t border-slate-800">
              <button
                type="button"
                onClick={handleDemoOneClick}
                disabled={isLoading}
                className="w-full py-2.5 px-3 rounded-xl bg-slate-800/80 hover:bg-slate-750 text-slate-200 border border-slate-700 font-mono text-xs flex items-center justify-center gap-2 transition-all group"
              >
                <Fingerprint className="w-4 h-4 text-cyan-400 group-hover:scale-110 transition-transform" />
                <span>Instant Access (Operator Portal)</span>
              </button>
              <p className="text-[10px] text-center text-slate-500 mt-2 font-mono">
                Cryptographically authenticated session token
              </p>
            </div>
          </motion.div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 py-4 px-6 border-t border-slate-800/40 text-slate-500 text-xs flex flex-col sm:flex-row items-center justify-between gap-2">
        <span>NEXUS AI WALLET • Decentralized Autonomous Account Abstraction</span>
        <span className="font-mono text-[11px] text-slate-500">ZERO-TRUST AUTHENTICATION • HARDWARE SIGNER COMPATIBLE</span>
      </footer>

      {/* FORGOT PASSWORD MODAL */}
      {forgotModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="w-full max-w-sm rounded-3xl bg-slate-900 border border-slate-750 p-6 text-center shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 flex items-center justify-center mx-auto mb-3">
              <KeyRound className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-white mb-1">Reset Vault Access</h3>
            <p className="text-xs text-slate-400 mb-4">
              Enter your operator email to receive a cryptographic session recovery magic link.
            </p>

            {forgotSuccess ? (
              <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-medium">
                Recovery link dispatched to {forgotEmail}. Check your inbox.
              </div>
            ) : (
              <form onSubmit={handleForgotPassword} className="space-y-3">
                <input
                  type="email"
                  required
                  placeholder="operator@nexus.ai"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setForgotModalOpen(false)}
                    className="flex-1 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold"
                  >
                    Send Link
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;
