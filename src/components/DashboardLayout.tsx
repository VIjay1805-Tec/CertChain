import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, LogOut } from 'lucide-react';
import { useStore } from '@/store/AppStore';
import { NotificationBell } from '@/components/NotificationBell';
import type { UserRole } from '@/types/schema';

interface DashboardLayoutProps {
  children: ReactNode;
  activeTab: string;
  tabs: { key: string; label: string; icon: typeof ShieldCheck }[];
  onTabChange: (key: string) => void;
  onNotificationClick?: (notificationId: string, applicationId: string | null, studentId: string | null) => void;
}

const ROLE_LABELS: Record<UserRole, string> = {
  institute: 'Institute',
  student: 'Student',
  company: 'Company',
};

const ROLE_COLORS: Record<UserRole, string> = {
  institute: 'bg-blue-50 text-blue-600',
  student: 'bg-emerald-50 text-emerald-600',
  company: 'bg-amber-50 text-amber-600',
};

export function DashboardLayout({ children, activeTab, tabs, onTabChange, onNotificationClick }: DashboardLayoutProps) {
  const { session, logout } = useStore();
  const navigate = useNavigate();

  if (!session) return null;
  const entity = session.entity;
  const displayName = 'full_name' in entity ? entity.full_name : entity.name;
  const initials = displayName.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col flex-shrink-0 sticky top-0 h-screen">
        <div className="p-6">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-accent-600 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-bold text-slate-900 text-sm leading-tight">CertiGuard</p>
              <p className="text-[10px] text-slate-400 leading-tight">Certificate Verification</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 space-y-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => onTabChange(tab.key)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  active
                    ? 'bg-accent-50 text-accent-700'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Icon className={`w-4.5 h-4.5 ${active ? 'text-accent-600' : 'text-slate-400'}`} />
                {tab.label}
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-slate-100">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl">
            <div className="w-9 h-9 rounded-full bg-accent-100 text-accent-700 flex items-center justify-center text-sm font-semibold">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-900 truncate">{displayName}</p>
              <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${ROLE_COLORS[session.user.role]}`}>
                {ROLE_LABELS[session.user.role]}
              </span>
            </div>
          </div>
          <button
            onClick={() => { logout(); navigate('/'); }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors mt-1"
          >
            <LogOut className="w-4.5 h-4.5 text-slate-400" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between sticky top-0 z-30">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">{tabs.find((t) => t.key === activeTab)?.label}</h1>
          </div>
          <NotificationBell onNotificationClick={onNotificationClick} />
        </header>
        <main className="flex-1 p-8 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
