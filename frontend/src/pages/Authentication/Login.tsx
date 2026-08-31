import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ShieldCheckIcon,
  LockClosedIcon,
  EyeIcon,
  EyeSlashIcon,
  UserIcon,
  ArrowRightIcon,
  WifiIcon,
  CpuChipIcon,
  CloudIcon,
} from '@heroicons/react/24/solid';
import { useAuth } from '../../context/AuthContext';
import { ROLE_DASHBOARD } from '../../config/routes';
import ParticleBackground from '../../components/ParticleBackground/ParticleBackground';

// ── Types ─────────────────────────────────────────────────────────────────────
type LoginApiError = {
  response?: { data?: { message?: string }; status?: number };
  message?: string;
};

// ── Demo accounts ─────────────────────────────────────────────────────────────
const DEMO_ACCOUNTS = [
  { role: 'CEO', username: 'ceo', bg: 'from-yellow-500 to-amber-600', icon: '👑' },
  { role: 'Admin', username: 'admin', bg: 'from-red-500 to-rose-600', icon: '⚙️' },
  { role: 'Manager', username: 'manager', bg: 'from-amber-500 to-orange-600', icon: '📋' },
  { role: 'Staff', username: 'staff', bg: 'from-emerald-500 to-teal-600', icon: '🎧' },
  { role: 'Tenant', username: 'tenant', bg: 'from-violet-500 to-purple-600', icon: '🏢' },
];

// ─────────────────────────────────────────────────────────────────────────────
export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  // form state
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isLocked, setIsLocked] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const identifierRef = useRef<HTMLInputElement>(null);

  useEffect(() => { identifierRef.current?.focus(); }, []);

  // ── Submit ──────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!identifier.trim()) { setError('Username or email is required'); return; }
    if (!password) { setError('Password is required'); return; }

    setIsLoading(true);
    setError('');
    setIsLocked(false);

    try {
      // useAuth().login handles token storage + user state update
      await login(identifier.trim(), password, rememberMe);
      const role = localStorage.getItem('role') || 'tenant';
      const target = ROLE_DASHBOARD[role] ?? '/login';
      navigate(target, { replace: true });
    } catch (err: unknown) {
      const e = err as LoginApiError;
      const msg = e?.response?.data?.message ?? e?.message ?? 'Login failed. Please try again.';
      const status = e?.response?.status;

      if (status === 423 || msg.toLowerCase().includes('lock')) {
        setIsLocked(true);
        setError(msg);
      } else {
        setError(msg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // ── Quick-fill demo ─────────────────────────────────────────────────────────
  const quickFill = (username: string) => {
    setIdentifier(username);
    setPassword('password');
    setError('');
    setIsLocked(false);
  };

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div
      className="h-screen relative overflow-hidden flex items-center justify-center p-4"
      style={{ background: 'linear-gradient(160deg, #030e2b 0%, #041640 40%, #072060 70%, #0b2e9a 100%)' }}
    >
      {/* ── Background layer ── */}
      <div className="absolute inset-0 z-0">
        <ParticleBackground className="absolute inset-0" id="login-particles" />
        <div className="absolute top-[-15%] left-[-10%] w-[50%] h-[50%] bg-blue-700/10 rounded-full blur-[140px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[45%] h-[45%] bg-indigo-600/10 rounded-full blur-[120px] animate-pulse delay-1000" />
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '36px 36px' }}
        />
      </div>

      {/* ── Content ── */}
      <div className="relative z-10 w-full max-w-[1400px] flex flex-col lg:flex-row items-center justify-center gap-8 lg:gap-16 py-8">

        {/* ── Left panel (desktop) ───────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, x: -40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
          className="hidden lg:flex flex-col justify-center w-[52%] pr-4"
        >
          {/* Title */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
                <ShieldCheckIcon className="w-6 h-6 text-white" />
              </div>
              <span className="text-xs font-bold text-blue-400 uppercase tracking-[0.25em] bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/20">
                Secure Gateway
              </span>
            </div>

            <h1 className="text-5xl xl:text-6xl font-black tracking-tighter text-white leading-[0.95] mb-3">
                  ITPC
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-cyan-300 to-indigo-400">
                HELP DESK
              </span>
              <span className="block text-2xl xl:text-3xl font-semibold text-slate-300 mt-1 tracking-normal">
                Management System
              </span>
            </h1>
            <div className="h-1 w-24 bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full" />
          </div>

          <p className="text-slate-300 text-base leading-relaxed max-w-md mb-8">
            Streamline government service delivery with a unified platform for ticket management,
            department coordination, and citizen support.
          </p>

          {/* Feature list */}
          <div className="space-y-4 mb-8">
            {[
              { icon: ShieldCheckIcon, color: 'from-blue-500 to-blue-600', title: 'Enterprise Security', sub: 'JWT auth, role-based access & audit logging' },
              { icon: CloudIcon, color: 'from-indigo-500 to-indigo-600', title: 'Multi-Role Access', sub: 'Admin, Manager, Staff and Tenant portals' },
              { icon: CpuChipIcon, color: 'from-cyan-500 to-cyan-600', title: 'Real-Time Analytics', sub: 'Live dashboards and automated reports' },
            ].map(({ icon: Icon, color, title, sub }) => (
              <div key={title} className="flex items-center gap-4 group">
                <div className={`w-10 h-10 bg-gradient-to-br ${color} rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-200`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-white font-semibold text-sm">{title}</p>
                  <p className="text-slate-400 text-xs">{sub}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Status widget */}
          <div className="p-4 bg-slate-800/30 backdrop-blur-sm rounded-2xl border border-slate-700/30 max-w-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-white font-semibold text-xs flex items-center gap-2">
                <WifiIcon className="w-4 h-4 text-green-400" />
                System Status
              </span>
              <span className="flex items-center gap-1.5 text-xs text-green-400 font-medium">
                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                Operational
              </span>
            </div>
            <div className="grid grid-cols-2 gap-y-1.5 text-xs">
              {[['API', 'Online'], ['Auth', 'Active'], ['DB', 'Connected'], ['Uptime', '99.9%']].map(([k, v]) => (
                <div key={k} className="flex justify-between pr-4">
                  <span className="text-slate-400">{k}:</span>
                  <span className="text-white font-mono">{v}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* ── Right panel — login card ───────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15, ease: 'easeOut' }}
          className="w-full lg:w-[400px] flex-shrink-0"
        >
          <div
            className={`rounded-3xl p-8 transition-all duration-300 ${isFocused ? 'bg-white/[0.07]' : 'bg-white/[0.04]'
              }`}
            style={{
              backdropFilter: 'blur(32px)',
              WebkitBackdropFilter: 'blur(32px)',
              border: '1px solid rgba(255,255,255,0.1)',
              boxShadow: '0 0 0 1px rgba(37,99,235,0.15), 0 32px 80px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.08)',
            }}
          >
            {/* Card header */}
            <div className="text-center mb-7">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/80 to-indigo-600/80 border border-blue-400/30 shadow-[0_0_30px_rgba(37,99,235,0.4)] mb-4">
                <ShieldCheckIcon className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-white tracking-tight">Welcome Back</h2>
              <p className="text-slate-400 text-sm mt-1">Sign in to your account to continue</p>
            </div>

            {/* Error / lock banner */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`mb-5 p-3.5 rounded-xl border flex items-start gap-3 text-sm ${isLocked
                  ? 'bg-red-900/30 border-red-500/40 text-red-200'
                  : 'bg-red-900/20 border-red-500/30 text-red-300'
                  }`}
              >
                <LockClosedIcon className="w-4 h-4 mt-0.5 flex-shrink-0 text-red-400" />
                <span className="leading-snug">{error}</span>
              </motion.div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              {/* Username field */}
              <div>
                <label htmlFor="identifier" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Username or Email
                </label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <input
                    ref={identifierRef}
                    id="identifier"
                    type="text"
                    autoComplete="username"
                    value={identifier}
                    onChange={(e) => { setIdentifier(e.target.value); setError(''); }}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    disabled={isLoading || isLocked}
                    placeholder="Enter your username or email"
                    className="w-full pl-10 pr-4 py-3 bg-slate-800/60 border border-slate-600/50 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50 transition-all duration-200"
                  />
                </div>
              </div>

              {/* Password field */}
              <div>
                <label htmlFor="password" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <LockClosedIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setError(''); }}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    disabled={isLoading || isLocked}
                    placeholder="Enter your password"
                    className="w-full pl-10 pr-11 py-3 bg-slate-800/60 border border-slate-600/50 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50 transition-all duration-200"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((p) => !p)}
                    disabled={isLoading}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword
                      ? <EyeSlashIcon className="w-4 h-4" />
                      : <EyeIcon className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Remember me */}
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  disabled={isLoading}
                  className="w-4 h-4 rounded accent-blue-500"
                />
                <span className="text-sm text-slate-300">Remember me for 7 days</span>
              </label>

              {/* Submit */}
              <button
                type="submit"
                disabled={isLoading || isLocked}
                className="w-full py-3.5 rounded-xl font-semibold text-white text-sm flex items-center justify-center gap-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all duration-200 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed disabled:shadow-none"
              >
                {isLoading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Authenticating…
                  </>
                ) : isLocked ? (
                  <>
                    <LockClosedIcon className="w-4 h-4" />
                    Account Locked
                  </>
                ) : (
                  <>
                    Sign In
                    <ArrowRightIcon className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            {/* Divider */}
            <div className="my-5 flex items-center gap-3">
              <div className="flex-1 h-px bg-slate-700/60" />
              <span className="text-xs text-slate-500">Quick demo access</span>
              <div className="flex-1 h-px bg-slate-700/60" />
            </div>

              {/* Demo account grid */}
              <div className="grid grid-cols-3 gap-2.5">
                {DEMO_ACCOUNTS.map(({ role, username, bg, icon }) => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => quickFill(username)}
                    className="flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl bg-slate-800/50 border border-slate-700/50 hover:border-slate-500/60 hover:bg-slate-700/50 transition-all duration-150 active:scale-95 group"
                  >
                    <span className={`text-xs font-bold text-transparent bg-clip-text bg-gradient-to-br ${bg}`}>
                      {icon} {role}
                    </span>
                    <span className="text-[11px] text-slate-500 font-mono">{username}</span>
                  </button>
                ))}
              </div>
            <p className="text-center text-[11px] text-slate-600 mt-2.5">
              Password for all accounts: <code className="text-slate-400 font-mono">password</code>
            </p>

            {/* Security notice */}
            <div className="mt-5 p-3 bg-slate-800/30 rounded-xl border border-slate-700/30 flex items-start gap-2">
              <ShieldCheckIcon className="w-3.5 h-3.5 text-green-400 mt-0.5 flex-shrink-0" />
              <p className="text-[10px] text-slate-400 leading-relaxed">
                This is a secure help desk management system. All access attempts are logged and monitored.
              </p>
            </div>
          </div>

          <p className="text-center text-slate-600 text-xs mt-4">
            © 2026 ITPC Help Desk Management System
          </p>
        </motion.div>
      </div>
    </div>
  );
}
