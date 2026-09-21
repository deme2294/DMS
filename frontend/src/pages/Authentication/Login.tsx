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
      className="min-h-screen min-h-[100dvh] w-full relative overflow-x-hidden overflow-y-auto flex flex-col justify-between items-center px-4 py-6 sm:px-6 sm:py-8 md:py-10 lg:px-8 lg:py-12"
      style={{ background: 'linear-gradient(160deg, #030e2b 0%, #041640 40%, #072060 70%, #0b2e9a 100%)' }}
    >
      {/* ── Background layer ── */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <ParticleBackground className="absolute inset-0" id="login-particles" />
        <div className="absolute top-[-15%] left-[-10%] w-[50%] h-[50%] bg-blue-700/10 rounded-full blur-[140px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[45%] h-[45%] bg-indigo-600/10 rounded-full blur-[120px] animate-pulse delay-1000" />
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '36px 36px' }}
        />
      </div>

      {/* ── Content ── */}
      <div className="relative z-10 w-full max-w-7xl mx-auto flex flex-col lg:flex-row items-center lg:items-center justify-center gap-8 lg:gap-12 xl:gap-16 my-auto">

        {/* ── Left panel / Hero Info Section (Visible on all devices) ───────── */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
          className="w-full lg:w-[54%] xl:w-[56%] flex flex-col justify-center text-center lg:text-left"
        >
          {/* Top badges */}
          <div className="flex items-center justify-center lg:justify-start gap-2.5 mb-3 sm:mb-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/30 flex-shrink-0">
              <ShieldCheckIcon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <div className="flex items-center gap-2 flex-wrap justify-center lg:justify-start">
              <span className="text-[11px] sm:text-xs font-bold text-blue-400 uppercase tracking-[0.2em] bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/20">
                Secure Gateway
              </span>
              <span className="inline-flex items-center gap-1.5 text-[11px] sm:text-xs text-green-400 font-medium bg-green-500/10 px-2.5 py-1 rounded-full border border-green-500/20">
                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                Operational
              </span>
            </div>
          </div>

          {/* Heading */}
          <div className="mb-4 sm:mb-6">
            <h1 className="text-3xl sm:text-4xl md:text-5xl xl:text-6xl font-black tracking-tight text-white leading-[1.05] sm:leading-[0.98] mb-2 sm:mb-3">
              ITPC
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-cyan-300 to-indigo-400">
                HELP DESK
              </span>
              <span className="block text-xl sm:text-2xl xl:text-3xl font-semibold text-slate-300 mt-1 tracking-normal">
                Management System
              </span>
            </h1>
            <div className="h-1 w-20 sm:w-24 bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full mx-auto lg:mx-0" />
          </div>

          <p className="text-slate-300 text-xs sm:text-sm md:text-base leading-relaxed max-w-lg mb-6 sm:mb-8 mx-auto lg:mx-0">
            Streamline government service delivery with a unified platform for ticket management,
            department coordination, and citizen support.
          </p>

          {/* Responsive Feature Highlights */}
          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 gap-2.5 sm:gap-3.5 mb-6 sm:mb-8">
            {[
              { icon: ShieldCheckIcon, color: 'from-blue-500 to-blue-600', title: 'Enterprise Security', sub: 'JWT auth, role-based access & audit logging' },
              { icon: CloudIcon, color: 'from-indigo-500 to-indigo-600', title: 'Multi-Role Access', sub: 'Admin, Manager, Staff & Tenant portals' },
              { icon: CpuChipIcon, color: 'from-cyan-500 to-cyan-600', title: 'Real-Time Analytics', sub: 'Live dashboards & automated reports' },
            ].map(({ icon: Icon, color, title, sub }) => (
              <div
                key={title}
                className="flex items-center gap-3.5 p-3 rounded-2xl bg-slate-800/30 border border-slate-700/30 hover:border-blue-500/30 hover:bg-slate-800/50 transition-all duration-200 text-left group"
              >
                <div className={`w-10 h-10 bg-gradient-to-br ${color} rounded-xl flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform duration-200 flex-shrink-0`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-white font-semibold text-xs sm:text-sm truncate">{title}</p>
                  <p className="text-slate-400 text-[11px] sm:text-xs truncate">{sub}</p>
                </div>
              </div>
            ))}
          </div>

          {/* System Status widget */}
          <div className="p-4 bg-slate-800/35 backdrop-blur-sm rounded-2xl border border-slate-700/40 w-full max-w-md lg:max-w-sm mx-auto lg:mx-0">
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
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 gap-y-2 gap-x-4 text-xs">
              {[['API', 'Online'], ['Auth', 'Active'], ['DB', 'Connected'], ['Uptime', '99.9%']].map(([k, v]) => (
                <div key={k} className="flex justify-between items-center pr-2 py-0.5 border-b border-slate-700/20 sm:border-b-0 lg:border-b">
                  <span className="text-slate-400">{k}:</span>
                  <span className="text-white font-mono text-[11px] sm:text-xs">{v}</span>
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
          className="w-full max-w-[460px] lg:max-w-[420px] xl:max-w-[440px] flex-shrink-0"
        >
          <div
            className={`rounded-2xl sm:rounded-3xl p-5 sm:p-7 md:p-8 transition-all duration-300 ${
              isFocused ? 'bg-white/[0.07]' : 'bg-white/[0.04]'
            }`}
            style={{
              backdropFilter: 'blur(32px)',
              WebkitBackdropFilter: 'blur(32px)',
              border: '1px solid rgba(255,255,255,0.1)',
              boxShadow: '0 0 0 1px rgba(37,99,235,0.15), 0 32px 80px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.08)',
            }}
          >
            {/* Card header */}
            <div className="text-center mb-5 sm:mb-7">
              <div className="inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-blue-500/80 to-indigo-600/80 border border-blue-400/30 shadow-[0_0_30px_rgba(37,99,235,0.4)] mb-3 sm:mb-4">
                <ShieldCheckIcon className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Welcome Back</h2>
              <p className="text-slate-400 text-xs sm:text-sm mt-1">Sign in to your account to continue</p>
            </div>

            {/* Error / lock banner */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`mb-4 sm:mb-5 p-3 sm:p-3.5 rounded-xl border flex items-start gap-3 text-xs sm:text-sm ${
                  isLocked
                    ? 'bg-red-900/30 border-red-500/40 text-red-200'
                    : 'bg-red-900/20 border-red-500/30 text-red-300'
                }`}
              >
                <LockClosedIcon className="w-4 h-4 mt-0.5 flex-shrink-0 text-red-400" />
                <span className="leading-snug">{error}</span>
              </motion.div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-3.5 sm:space-y-4" noValidate>
              {/* Username field */}
              <div>
                <label htmlFor="identifier" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Username or Email
                </label>
                <div className="relative">
                  <UserIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
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
                    className="w-full pl-10 pr-4 py-2.5 sm:py-3 bg-slate-800/60 border border-slate-600/50 rounded-xl text-white placeholder-slate-500 text-base sm:text-sm focus:outline-none focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50 transition-all duration-200"
                  />
                </div>
              </div>

              {/* Password field */}
              <div>
                <label htmlFor="password" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <LockClosedIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
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
                    className="w-full pl-10 pr-11 py-2.5 sm:py-3 bg-slate-800/60 border border-slate-600/50 rounded-xl text-white placeholder-slate-500 text-base sm:text-sm focus:outline-none focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50 transition-all duration-200"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((p) => !p)}
                    disabled={isLoading}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors cursor-pointer p-1"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword
                      ? <EyeSlashIcon className="w-4 h-4" />
                      : <EyeIcon className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Remember me */}
              <label className="flex items-center gap-2.5 cursor-pointer select-none pt-0.5">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  disabled={isLoading}
                  className="w-4 h-4 rounded accent-blue-500 cursor-pointer"
                />
                <span className="text-xs sm:text-sm text-slate-300">Remember me for 7 days</span>
              </label>

              {/* Submit */}
              <button
                type="submit"
                disabled={isLoading || isLocked}
                className="w-full py-3 sm:py-3.5 rounded-xl font-semibold text-white text-sm sm:text-base flex items-center justify-center gap-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all duration-200 active:scale-[0.98] cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed disabled:shadow-none"
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
            <div className="my-4 sm:my-5 flex items-center gap-3">
              <div className="flex-1 h-px bg-slate-700/60" />
              <span className="text-[11px] sm:text-xs text-slate-400 font-medium">Quick demo access</span>
              <div className="flex-1 h-px bg-slate-700/60" />
            </div>

            {/* Demo account grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {DEMO_ACCOUNTS.map(({ role, username, bg, icon }, idx) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => quickFill(username)}
                  className={`flex flex-col items-center justify-center gap-1 py-2 sm:py-2.5 px-2 rounded-xl bg-slate-800/60 border border-slate-700/50 hover:border-blue-500/50 hover:bg-slate-700/60 transition-all duration-150 active:scale-95 group cursor-pointer ${
                    idx === 4 ? 'col-span-2 sm:col-span-1' : ''
                  }`}
                >
                  <span className={`text-xs font-bold text-transparent bg-clip-text bg-gradient-to-br ${bg} flex items-center gap-1`}>
                    <span>{icon}</span> {role}
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono group-hover:text-slate-300">{username}</span>
                </button>
              ))}
            </div>
            <p className="text-center text-[10px] sm:text-[11px] text-slate-500 mt-2">
              Password for all accounts: <code className="text-slate-300 font-mono">password</code>
            </p>

            {/* Security notice */}
            <div className="mt-4 sm:mt-5 p-2.5 sm:p-3 bg-slate-800/30 rounded-xl border border-slate-700/30 flex items-start gap-2">
              <ShieldCheckIcon className="w-3.5 h-3.5 text-green-400 mt-0.5 flex-shrink-0" />
              <p className="text-[10px] sm:text-[11px] text-slate-400 leading-relaxed">
                This is a secure help desk management system. All access attempts are logged and monitored.
              </p>
            </div>
          </div>

          <p className="text-center text-slate-500 text-[11px] sm:text-xs mt-3 sm:mt-4">
            © 2026 ITPC Help Desk Management System
          </p>
        </motion.div>
      </div>
    </div>
  );
}
