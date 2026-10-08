import {
  LayoutDashboard, FilePlus2, Search, Bell, User, CalendarDays,
  ClipboardCheck, Gavel, UserCog, Users, FolderCog, BarChart3,
  Settings, ScrollText, CalendarOff, Landmark, Inbox, Mail,
} from 'lucide-react';

export const NAV_CONFIG = {
  CONSUMER: [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/consumer/dashboard' },
    { label: 'File a Complaint', icon: FilePlus2, path: '/consumer/complaints/new' },
    { label: 'Track Complaints', icon: Search, path: '/consumer/complaints' },
    { label: 'Hearing Calendar', icon: CalendarDays, path: '/consumer/hearings' },
    { label: 'Notifications', icon: Bell, path: '/consumer/notifications' },
    { label: 'My Profile', icon: User, path: '/consumer/profile' },
  ],
  // Clerks have two flavours (see navKeyFor): scrutiny clerks work the shared
  // intake queue, court clerks run one bench's cases and hearings.
  SCRUTINY_CLERK: [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/clerk/dashboard' },
    { label: 'Intake & Verification', icon: Inbox, path: '/clerk/complaints' },
    { label: 'Notifications', icon: Bell, path: '/clerk/notifications' },
    { label: 'My Profile', icon: User, path: '/clerk/profile' },
  ],
  COURT_CLERK: [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/clerk/dashboard' },
    { label: 'Bench Cases', icon: ClipboardCheck, path: '/clerk/complaints' },
    { label: 'Cause List & Hearings', icon: CalendarDays, path: '/clerk/hearings' },
    { label: 'Notifications', icon: Bell, path: '/clerk/notifications' },
    { label: 'My Profile', icon: User, path: '/clerk/profile' },
  ],
  OPPOSITE_PARTY: [
    { label: 'My Cases', icon: LayoutDashboard, path: '/party/dashboard' },
    { label: 'Notifications', icon: Bell, path: '/party/notifications' },
    { label: 'My Profile', icon: User, path: '/party/profile' },
  ],
  REGISTRAR: [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/registrar/dashboard' },
    { label: 'All Complaints', icon: ClipboardCheck, path: '/registrar/complaints' },
    { label: 'Hearing Calendar', icon: CalendarDays, path: '/registrar/hearings' },
    { label: 'Analytics & Reports', icon: BarChart3, path: '/registrar/analytics' },
    { label: 'Notifications', icon: Bell, path: '/registrar/notifications' },
    { label: 'My Profile', icon: User, path: '/registrar/profile' },
  ],
  JUDGE: [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/judge/dashboard' },
    { label: 'Assigned Cases', icon: Gavel, path: '/judge/cases' },
    { label: 'Hearing Calendar', icon: CalendarDays, path: '/judge/hearings' },
    { label: 'My Leave', icon: CalendarOff, path: '/judge/leave' },
    { label: 'Notifications', icon: Bell, path: '/judge/notifications' },
    { label: 'My Profile', icon: User, path: '/judge/profile' },
  ],
  ADMIN: [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/admin/dashboard' },
    { label: 'Manage Users', icon: Users, path: '/admin/users' },
    { label: 'Manage Judges', icon: UserCog, path: '/admin/judges' },
    { label: 'Benches', icon: Landmark, path: '/admin/benches' },
    { label: 'Email Log', icon: Mail, path: '/admin/email-log' },
    { label: 'Categories & Rules', icon: FolderCog, path: '/admin/categories' },
    { label: 'Analytics & Reports', icon: BarChart3, path: '/admin/analytics' },
    { label: 'Audit Logs', icon: ScrollText, path: '/admin/audit-logs' },
    { label: 'Holidays & Settings', icon: Settings, path: '/admin/settings' },
    { label: 'Notifications', icon: Bell, path: '/admin/notifications' },
  ],
};

/** Which NAV_CONFIG entry a logged-in user gets. */
export function navKeyFor(user) {
  if (user?.role === 'CLERK') return user.clerkType === 'COURT' ? 'COURT_CLERK' : 'SCRUTINY_CLERK';
  return user?.role;
}

export const ROLE_LABELS = {
  CONSUMER: 'Consumer',
  CLERK: 'Forum Clerk',
  SCRUTINY_CLERK: 'Scrutiny Clerk',
  COURT_CLERK: 'Court Clerk',
  REGISTRAR: 'Registrar',
  OPPOSITE_PARTY: 'Opposite Party',
  JUDGE: 'Judge',
  ADMIN: 'Administrator',
};
