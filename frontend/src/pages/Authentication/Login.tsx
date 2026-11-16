import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
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
import { resolveRoleRedirect } from '../../utils/redirectUtils';
import ParticleBackground from '../../components/ParticleBackground/ParticleBackground';
import './Login.css';

type LoginApiError = {
  response?: { data?: { message?: string }; status?: number };
  message?: string;
};



const FEATURES = [
  { icon: ShieldCheckIcon, color: 'from-blue-500 to-blue-600', title: 'Enterprise Security', sub: 'JWT auth, role-based access & audit logging' },
  { icon: CloudIcon, color: 'from-indigo-500 to-indigo-600', title: 'Multi-Role Access', sub: 'Admin, Manager, Staff & Tenant portals' },
  { icon: CpuChipIcon, color: 'from-cyan-500 to-cyan-600', title: 'Real-Time Analytics', sub: 'Live dashboards & automated reports' },
];

export default function Login() {
  const { user, loading, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // If visiting with an explicit deep-link redirect query param and user is already authenticated, route to the target task
  useEffect(() => {
    if (!loading && user) {
      const searchParams = new URLSearchParams(location.search);
      const redirectUrl = searchParams.get('redirect');
      if (redirectUrl) {
        const role = user.role || localStorage.getItem('role') || 'tenant';
        navigate(resolveRoleRedirect(redirectUrl, role), { replace: true });
      }
    }
  }, [user, loading, location.search, navigate]);

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isLocked, setIsLocked] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const identifierRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const queryUser = searchParams.get('username') || searchParams.get('email') || searchParams.get('identifier');
    if (queryUser) {
      setIdentifier(queryUser);
      setTimeout(() => {
        const pwdInput = document.getElementById('password') as HTMLInputElement | null;
        pwdInput?.focus();
      }, 50);
    } else {
      identifierRef.current?.focus();
    }
  }, [location.search]);

  const togglePasswordVisibility = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setShowPassword((prev) => !prev);
    setTimeout(() => {
      const pwdInput = document.getElementById('password') as HTMLInputElement | null;
      if (pwdInput) {
        pwdInput.focus();
        const len = pwdInput.value.length;
        pwdInput.setSelectionRange(len, len);
      }
    }, 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) { setError('Username or email is required'); return; }
    if (!password) { setError('Password is required'); return; }
    setIsLoading(true); setError(''); setIsLocked(false);
    try {
      await login(identifier.trim(), password, rememberMe);
      const role = localStorage.getItem('role') || 'tenant';
      const searchParams = new URLSearchParams(location.search);
      const fromState = (location.state as { from?: { pathname?: string; search?: string } })?.from;
      const fromUrl = fromState ? `${fromState.pathname || ''}${fromState.search || ''}` : undefined;
      const redirectUrl = searchParams.get('redirect') || fromUrl;

      if (redirectUrl) {
        navigate(resolveRoleRedirect(redirectUrl, role), { replace: true });
      } else {
        navigate(ROLE_DASHBOARD[role] ?? '/login', { replace: true });
      }
    } catch (err: unknown) {
      const e = err as LoginApiError;
      const msg = e?.response?.data?.message ?? e?.message ?? 'Login failed. Please try again.';
      const status = e?.response?.status;
      if (status === 423 || msg.toLowerCase().includes('lock')) { setIsLocked(true); }
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-root">
      {/* ── Background ── */}
      <div className="login-bg">
        <ParticleBackground className="absolute inset-0" id="login-particles" />
        <div className="login-ambient-center" />
      </div>

      {/* ── Main Two-Column Body ── */}
      <div className="login-body">
        {/* ════════════════════════════════════
            LEFT PANEL — Info & Branding
        ════════════════════════════════════ */}
        <motion.div
          className="login-left"
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
        >
          {/* Organization Logo & Badges */}
          <div className="login-brand-row">
            <div className="login-brand-logo">
              <img src="/logo-white.png?v=3" alt="Ethiopian IT Park" className="login-logo-img" />
            </div>

            <div className="login-badges">
              <span className="badge-secure">
                <ShieldCheckIcon style={{ width: 15, height: 15, marginRight: 5, verticalAlign: 'middle', display: 'inline' }} />
                Secure Gateway
              </span>
              <span className="badge-online">
                <span className="dot-pulse" /> Operational
              </span>
            </div>
          </div>

          {/* Heading */}
          <div className="login-heading-wrap">
            <h1 className="login-heading">
              ITPC
              <span className="login-heading-gradient">HELP DESK</span>
              <span className="login-heading-sub">Management System</span>
            </h1>
            <div className="login-heading-bar" />
          </div>

          <p className="login-desc">
            Streamline government service delivery with a unified platform for ticket management,
            department coordination, and citizen support.
          </p>

          {/* Feature cards */}
          <div className="login-features">
            {FEATURES.map(({ icon: Icon, color, title, sub }) => (
              <div key={title} className="login-feature-card">
                <div className={`login-feature-icon bg-gradient-to-br ${color}`}>
                  <Icon style={{ width: 20, height: 20, color: 'white' }} />
                </div>
                <div>
                  <p className="login-feature-title">{title}</p>
                  <p className="login-feature-sub">{sub}</p>
                </div>
              </div>
            ))}
          </div>

          {/* System Status */}
          <div className="login-status-box">
            <div className="login-status-top">
              <span className="login-status-label">
                <WifiIcon style={{ width: 16, height: 16, color: '#4ade80' }} />
                System Status
              </span>
              <span className="login-status-ok">
                <span className="dot-pulse" /> Operational
              </span>
            </div>
            <div className="login-status-grid">
              {[['API', 'Online'], ['Auth', 'Active'], ['DB', 'Connected'], ['Uptime', '99.9%']].map(([k, v]) => (
                <div key={k} className="login-status-row">
                  <span className="login-status-key">{k}:</span>
                  <span className="login-status-val">{v}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

      {/* ════════════════════════════════════
          RIGHT PANEL — Login Form
      ════════════════════════════════════ */}
      <div className="login-right">
        <motion.div
          className="login-card-wrap"
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.1, ease: 'easeOut' }}
        >
          {/* Mobile-only brand header */}
          <div className="login-mobile-brand">
            <div className="login-brand-logo" style={{ margin: '0 auto 14px' }}>
              <img src="/logo-white.png?v=3" alt="Ethiopian IT Park" className="login-logo-img" />
            </div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 900, color: 'white', textAlign: 'center', margin: 0 }}>
              ITPC <span style={{ background: 'linear-gradient(to right, #60a5fa, #67e8f9)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>HELP DESK</span>
            </h1>
            <p style={{ color: '#94a3b8', fontSize: '0.75rem', marginTop: 4 }}>Management System</p>
          </div>

          {/* Glass card */}
          <div className={`login-card ${isFocused ? 'login-card-focused' : ''}`}>
            {/* Card header */}
            <div className="login-card-top">
              <div className="login-card-icon">
                <ShieldCheckIcon style={{ width: 22, height: 22, color: 'white' }} />
              </div>
              <h2 className="login-card-title">Welcome Back</h2>
              <p className="login-card-sub">Sign in to your account to continue</p>
            </div>

            {/* Error banner */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`login-error ${isLocked ? 'login-error-locked' : ''}`}
              >
                <LockClosedIcon style={{ width: 16, height: 16, color: '#f87171', flexShrink: 0, marginTop: 2 }} />
                <span>{error}</span>
              </motion.div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} noValidate className="login-form">
              <div className="login-field">
                <label htmlFor="identifier" className="login-label">Username or Email</label>
                <div className="login-input-wrap">
                  <UserIcon className="login-input-icon" />
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
                    className="login-input"
                  />
                </div>
              </div>

              <div className="login-field">
                <label htmlFor="password" className="login-label">Password</label>
                <div className="login-input-wrap">
                  <LockClosedIcon className="login-input-icon" />
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
                    className="login-input"
                    style={{ paddingRight: '2.75rem' }}
                  />
                  <button
                    type="button"
                    onClick={togglePasswordVisibility}
                    disabled={isLoading || isLocked}
                    className="login-eye-btn"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    title={showPassword ? 'Hide password' : 'Show password'}
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <EyeSlashIcon style={{ width: 19, height: 19, pointerEvents: 'none' }} />
                    ) : (
                      <EyeIcon style={{ width: 19, height: 19, pointerEvents: 'none' }} />
                    )}
                  </button>
                </div>
              </div>

              <label className="login-remember">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  disabled={isLoading}
                  style={{ width: 15, height: 15, accentColor: '#3b82f6', cursor: 'pointer' }}
                />
                <span style={{ fontSize: '0.8125rem', color: '#cbd5e1' }}>Remember me for 7 days</span>
              </label>

              <button type="submit" disabled={isLoading || isLocked} className="login-submit-btn">
                {isLoading ? (
                  <><span className="login-spinner" />Authenticating…</>
                ) : isLocked ? (
                  <><LockClosedIcon style={{ width: 16, height: 16 }} />Account Locked</>
                ) : (
                  <>Sign In <ArrowRightIcon style={{ width: 16, height: 16 }} /></>
                )}
              </button>
            </form>

            {/* Enterprise Security Notice */}
            <div className="login-security-notice" style={{ marginTop: '1.5rem' }}>
              <ShieldCheckIcon className="login-security-icon" />
              <div className="login-security-content">
                <span className="login-security-title">Secure Enterprise Authentication</span>
                <span className="login-security-sub">Role-Based Access Control • End-to-End Audit Logging</span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>

      {/* ════════════════════════════════════
          BOTTOM BAR — Centered & Seamless
      ════════════════════════════════════ */}
      <div className="login-bottom-bar">
        <div className="login-footer-pill">
          <ShieldCheckIcon className="login-footer-icon" />
          <span className="login-footer-copyright">
            © 2026 <strong className="login-footer-brand-name">ITPC</strong> Help Desk Management System
          </span>
        </div>
      </div>
    </div>
  );
}
