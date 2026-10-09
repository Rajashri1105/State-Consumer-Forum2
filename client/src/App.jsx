import { useEffect, Suspense, lazy } from 'react';
import { useDispatch } from 'react-redux';
import { Routes, Route } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import theme from './theme/theme';
import { bootstrapSession, logoutUser } from './redux/slices/authSlice';
import { registerLogoutHandler } from './services/api';

import PublicLayout from './layouts/PublicLayout';
import AuthLayout from './layouts/AuthLayout';
import DashboardLayout from './layouts/DashboardLayout';
import { ProtectedRoute, RoleBasedRoute, GuestOnlyRoute } from './routes/guards';
import Loader from './components/common/Loader';

import Home from './pages/public/Home';
import About from './pages/public/About';
import ConsumerRights from './pages/public/ConsumerRights';
import ComplaintProcedure from './pages/public/ComplaintProcedure';
import FAQs from './pages/public/FAQs';
import Contact from './pages/public/Contact';

import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import VerifyEmail from './pages/auth/VerifyEmail';
import ForgotPassword from './pages/auth/ForgotPassword';
import ResetPassword from './pages/auth/ResetPassword';
import SetPassword from './pages/auth/SetPassword';

import NotFound from './pages/NotFound';
import Unauthorized from './pages/Unauthorized';

// --------------------------------------------------------------------------
// Role-specific pages are code-split so a consumer's browser never
// downloads admin analytics/chart code (and vice versa) — each chunk only
// loads when that role's routes are actually visited.
// --------------------------------------------------------------------------
const ConsumerDashboard = lazy(() => import('./pages/consumer/ConsumerDashboard'));
const RegisterComplaint = lazy(() => import('./pages/consumer/RegisterComplaint'));
const ComplaintList = lazy(() => import('./pages/consumer/ComplaintList'));

const ComplaintDetail = lazy(() => import('./pages/shared/ComplaintDetail'));
const HearingCalendar = lazy(() => import('./pages/shared/HearingCalendar'));
const Profile = lazy(() => import('./pages/shared/Profile'));
const NotificationsPage = lazy(() => import('./pages/shared/NotificationsPage'));

const ClerkDashboard = lazy(() => import('./pages/clerk/ClerkDashboard'));
const ClerkComplaintList = lazy(() => import('./pages/clerk/ClerkComplaintList'));

const JudgeDashboard = lazy(() => import('./pages/judge/JudgeDashboard'));
const JudgeCaseList = lazy(() => import('./pages/judge/JudgeCaseList'));
const MyLeave = lazy(() => import('./pages/judge/MyLeave'));

const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const AdminUsers = lazy(() => import('./pages/admin/AdminUsers'));
const AdminCategories = lazy(() => import('./pages/admin/AdminCategories'));
const AdminAnalytics = lazy(() => import('./pages/admin/AdminAnalytics'));
const AdminAuditLogs = lazy(() => import('./pages/admin/AdminAuditLogs'));
const AdminSettings = lazy(() => import('./pages/admin/AdminSettings'));
const AdminBenches = lazy(() => import('./pages/admin/AdminBenches'));
const AdminEmailLog = lazy(() => import('./pages/admin/AdminEmailLog'));

const PartyDashboard = lazy(() => import('./pages/party/PartyDashboard'));
const PartyCaseDetail = lazy(() => import('./pages/party/PartyCaseDetail'));

const RegistrarDashboard = lazy(() => import('./pages/registrar/RegistrarDashboard'));

export default function App() {
  const dispatch = useDispatch();

  useEffect(() => {
    // Attempt a silent session restore using the httpOnly refresh cookie
    // so a page refresh doesn't force the user back to the login screen.
    dispatch(bootstrapSession());
    // If the API layer ever gives up refreshing (refresh token expired/
    // revoked), fall back to a clean logout so the UI state stays honest.
    registerLogoutHandler(() => dispatch(logoutUser()));
  }, [dispatch]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <ToastContainer position="top-right" autoClose={4000} newestOnTop hideProgressBar={false} />

      <Suspense fallback={<Loader label="Loading…" minHeight="100vh" />}>
        <Routes>
          {/* -------------------- Public site -------------------- */}
          <Route element={<PublicLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/about" element={<About />} />
            <Route path="/consumer-rights" element={<ConsumerRights />} />
            <Route path="/complaint-procedure" element={<ComplaintProcedure />} />
            <Route path="/faqs" element={<FAQs />} />
            <Route path="/contact" element={<Contact />} />
          </Route>

          {/* -------------------- Guest-only auth flows -------------------- */}
          <Route element={<GuestOnlyRoute />}>
            <Route element={<AuthLayout />}>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
            </Route>
          </Route>
          {/* Verification and password-reset links must remain usable with an existing session. */}
          <Route element={<AuthLayout />}>
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/set-password" element={<SetPassword />} />
          </Route>

          {/* -------------------- Authenticated: Consumer -------------------- */}
          <Route element={<ProtectedRoute />}>
            <Route element={<RoleBasedRoute allowedRoles={['CONSUMER']} />}>
              <Route element={<DashboardLayout role="CONSUMER" homePrefix="/consumer" pageTitle="Dashboard" />}>
                <Route path="/consumer/dashboard" element={<ConsumerDashboard />} />
                <Route path="/consumer/complaints/new" element={<RegisterComplaint />} />
                <Route path="/consumer/complaints" element={<ComplaintList />} />
                <Route path="/consumer/complaints/:id" element={<ComplaintDetail />} />
                <Route path="/consumer/hearings" element={<HearingCalendar homePrefix="/consumer" />} />
                <Route path="/consumer/notifications" element={<NotificationsPage />} />
                <Route path="/consumer/profile" element={<Profile />} />
              </Route>
            </Route>

            {/* -------------------- Authenticated: Clerk -------------------- */}
            <Route element={<RoleBasedRoute allowedRoles={['CLERK']} />}>
              <Route element={<DashboardLayout role="CLERK" homePrefix="/clerk" pageTitle="Dashboard" />}>
                <Route path="/clerk/dashboard" element={<ClerkDashboard />} />
                <Route path="/clerk/complaints" element={<ClerkComplaintList homePrefix="/clerk" />} />
                <Route path="/clerk/complaints/:id" element={<ComplaintDetail />} />
                <Route path="/clerk/hearings" element={<HearingCalendar homePrefix="/clerk" />} />
                <Route path="/clerk/notifications" element={<NotificationsPage />} />
                <Route path="/clerk/profile" element={<Profile />} />
              </Route>
            </Route>

            {/* -------------------- Authenticated: Registrar -------------------- */}
            <Route element={<RoleBasedRoute allowedRoles={['REGISTRAR']} />}>
              <Route element={<DashboardLayout role="REGISTRAR" homePrefix="/registrar" pageTitle="Dashboard" />}>
                <Route path="/registrar/dashboard" element={<RegistrarDashboard />} />
                <Route path="/registrar/complaints" element={<ClerkComplaintList homePrefix="/registrar" />} />
                <Route path="/registrar/complaints/:id" element={<ComplaintDetail />} />
                <Route path="/registrar/hearings" element={<HearingCalendar homePrefix="/registrar" />} />
                <Route path="/registrar/analytics" element={<AdminAnalytics />} />
                <Route path="/registrar/notifications" element={<NotificationsPage />} />
                <Route path="/registrar/profile" element={<Profile />} />
              </Route>
            </Route>

            {/* -------------------- Authenticated: Opposite Party -------------------- */}
            <Route element={<RoleBasedRoute allowedRoles={['OPPOSITE_PARTY']} />}>
              <Route element={<DashboardLayout role="OPPOSITE_PARTY" homePrefix="/party" pageTitle="My Cases" />}>
                <Route path="/party/dashboard" element={<PartyDashboard />} />
                <Route path="/party/cases/:id" element={<PartyCaseDetail />} />
                <Route path="/party/complaints/:id" element={<PartyCaseDetail />} /> {/* notification links */}
                <Route path="/party/notifications" element={<NotificationsPage />} />
                <Route path="/party/profile" element={<Profile />} />
              </Route>
            </Route>

            {/* -------------------- Authenticated: Judge -------------------- */}
            <Route element={<RoleBasedRoute allowedRoles={['JUDGE']} />}>
              <Route element={<DashboardLayout role="JUDGE" homePrefix="/judge" pageTitle="Dashboard" />}>
                <Route path="/judge/dashboard" element={<JudgeDashboard />} />
                <Route path="/judge/cases" element={<JudgeCaseList />} />
                <Route path="/judge/cases/:id" element={<ComplaintDetail />} />
                <Route path="/judge/complaints/:id" element={<ComplaintDetail />} />
                <Route path="/judge/hearings" element={<HearingCalendar homePrefix="/judge" />} />
                <Route path="/judge/leave" element={<MyLeave />} />
                <Route path="/judge/notifications" element={<NotificationsPage />} />
                <Route path="/judge/profile" element={<Profile />} />
              </Route>
            </Route>

            {/* -------------------- Authenticated: Admin -------------------- */}
            <Route element={<RoleBasedRoute allowedRoles={['ADMIN']} />}>
              <Route element={<DashboardLayout role="ADMIN" homePrefix="/admin" pageTitle="Dashboard" />}>
                <Route path="/admin/dashboard" element={<AdminDashboard />} />
                <Route path="/admin/users" element={<AdminUsers />} />
                <Route path="/admin/judges" element={<AdminUsers />} />
                <Route path="/admin/categories" element={<AdminCategories />} />
                <Route path="/admin/analytics" element={<AdminAnalytics />} />
                <Route path="/admin/benches" element={<AdminBenches />} />
                <Route path="/admin/email-log" element={<AdminEmailLog />} />
                <Route path="/admin/complaints/:id" element={<ComplaintDetail />} />
                <Route path="/admin/audit-logs" element={<AdminAuditLogs />} />
                <Route path="/admin/settings" element={<AdminSettings />} />
                <Route path="/admin/notifications" element={<NotificationsPage />} />
                <Route path="/admin/profile" element={<Profile />} />
              </Route>
            </Route>
          </Route>

          <Route path="/unauthorized" element={<Unauthorized />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </ThemeProvider>
  );
}
