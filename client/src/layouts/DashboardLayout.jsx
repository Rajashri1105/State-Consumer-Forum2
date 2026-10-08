import { Outlet } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { Box } from '@mui/material';
import Sidebar from '../components/layout/Sidebar';
import Topbar from '../components/layout/Topbar';
import { useAuth } from '../hooks/useAuth';
import { navKeyFor } from '../routes/navConfig';

export default function DashboardLayout({ role, homePrefix, pageTitle = 'Dashboard' }) {
  const sidebarCollapsed = useSelector((state) => state.ui.sidebarCollapsed);
  const { user } = useAuth();
  // Clerks get a different menu depending on scrutiny vs court clerk.
  const navKey = role === 'CLERK' ? navKeyFor(user) : role;

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', backgroundColor: 'background.default' }}>
      <Sidebar role={navKey} collapsed={sidebarCollapsed} />
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Topbar sidebarCollapsed={sidebarCollapsed} homePrefix={homePrefix} pageTitle={pageTitle} />
        <Box component="main" sx={{ flex: 1, p: { xs: 2, md: 3 } }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}
