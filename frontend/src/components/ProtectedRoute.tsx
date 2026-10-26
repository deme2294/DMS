import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ROLE_DASHBOARD } from '../config/routes';

export default function ProtectedRoute({
  children,
  roles,
}: {
  children: React.ReactNode;
  roles?: string[];
}) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        background: 'linear-gradient(135deg, #030f2b 0%, #041234 35%, #072060 65%, #0a2d8a 100%)',
      }}>
        <div style={{ textAlign: 'center', color: '#93c5fd' }}>
          <div style={{
            width: 40, height: 40,
            border: '3px solid rgba(96,165,250,0.2)',
            borderTopColor: '#60a5fa',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
            margin: '0 auto 12px',
          }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <p style={{ margin: 0, fontSize: '0.9rem', opacity: 0.7 }}>Loading…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    const target = location.pathname + location.search;
    return <Navigate to={`/login?redirect=${encodeURIComponent(target)}`} state={{ from: location }} replace />;
  }

  if (roles && !roles.includes(user.role)) {
    const ticketMatch = location.pathname.match(/^\/(?:tenant|admin|manager|staff|ceo|tickets)\/tickets\/(.+)$/);
    if (ticketMatch) {
      const ticketParam = ticketMatch[1];
      const rolePrefix = user.role === 'admin' ? '/admin' : user.role === 'manager' ? '/manager' : user.role === 'staff' ? '/staff' : user.role === 'ceo' ? '/ceo' : '/tenant';
      return <Navigate to={`${rolePrefix}/tickets/${ticketParam}${location.search}`} replace />;
    }
    return <Navigate to={ROLE_DASHBOARD[user.role] ?? '/login'} replace />;
  }

  return <>{children}</>;
}
