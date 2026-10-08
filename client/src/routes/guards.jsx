import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';
import { useAuth } from '../hooks/useAuth';

export function ProtectedRoute() {
  const { isAuthenticated, bootstrapped } = useAuth();
  const location = useLocation();

  if (!bootstrapped) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
}

export function RoleBasedRoute({ allowedRoles }) {
  const { role } = useAuth();

  if (!allowedRoles.includes(role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <Outlet />;
}

export function GuestOnlyRoute() {
  const { isAuthenticated, bootstrapped, role } = useAuth();

  if (bootstrapped && isAuthenticated) {
    return <Navigate to={roleHomePath(role)} replace />;
  }

  return <Outlet />;
}

export function roleHomePath(role) {
  switch (role) {
    case 'CONSUMER': return '/consumer/dashboard';
    case 'CLERK': return '/clerk/dashboard';
    case 'JUDGE': return '/judge/dashboard';
    case 'REGISTRAR': return '/registrar/dashboard';
    case 'OPPOSITE_PARTY': return '/party/dashboard';
    case 'ADMIN': return '/admin/dashboard';
    default: return '/login';
  }
}
