import { useState, useRef, useEffect } from 'react';
import { Bell, Check, FileText, ShieldCheck, Upload, UserPlus, CheckCheck } from 'lucide-react';
import { useStore } from '@/store/AppStore';
import type { NotificationType } from '@/types/schema';

const TYPE_ICONS: Record<NotificationType, { icon: typeof Bell; bg: string; color: string }> = {
  student_applied: { icon: UserPlus, bg: 'bg-blue-50', color: 'text-blue-600' },
  certificate_uploaded: { icon: Upload, bg: 'bg-purple-50', color: 'text-purple-600' },
  verification_requested: { icon: ShieldCheck, bg: 'bg-indigo-50', color: 'text-indigo-600' },
  verification_completed: { icon: Check, bg: 'bg-success-50', color: 'text-success-600' },
  verification_result_student: { icon: FileText, bg: 'bg-success-50', color: 'text-success-600' },
  verification_result_institute: { icon: FileText, bg: 'bg-success-50', color: 'text-success-600' },
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

interface NotificationBellProps {
  onNotificationClick?: (notificationId: string, applicationId: string | null, studentId: string | null) => void;
}

export function NotificationBell({ onNotificationClick }: NotificationBellProps) {
  const { session, getNotificationsFor, markNotificationRead, markAllNotificationsRead } = useStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!session) return null;
  const notifs = getNotificationsFor(session.user.role, session.user.id);
  const unread = notifs.filter((n) => !n.read).length;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2.5 rounded-xl text-slate-600 hover:bg-slate-100 transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unread > 0 && (
          <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-danger-600 text-white text-[10px] font-bold flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-96 bg-white rounded-2xl shadow-modal border border-slate-100 z-50 animate-slide-up max-h-[480px] flex flex-col">
          <div className="flex items-center justify-between p-4 border-b border-slate-100">
            <div>
              <h3 className="font-semibold text-slate-900">Notifications</h3>
              <p className="text-xs text-slate-500">{unread} unread</p>
            </div>
            {unread > 0 && (
              <button
                onClick={() => markAllNotificationsRead(session.user.role, session.user.id)}
                className="flex items-center gap-1.5 text-xs font-medium text-accent-600 hover:text-accent-700 transition-colors"
              >
                <CheckCheck className="w-4 h-4" />
                Mark all read
              </button>
            )}
          </div>

          <div className="overflow-y-auto flex-1">
            {notifs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4">
                <Bell className="w-8 h-8 text-slate-300 mb-2" />
                <p className="text-sm text-slate-500">No notifications yet</p>
              </div>
            ) : (
              notifs.map((n) => {
                const config = TYPE_ICONS[n.type];
                const Icon = config.icon;
                return (
                  <button
                    key={n.id}
                    onClick={() => {
                      markNotificationRead(n.id);
                      if (onNotificationClick) {
                        onNotificationClick(n.id, n.application_id, n.student_id);
                      }
                      setOpen(false);
                    }}
                    className={`w-full flex items-start gap-3 p-4 border-b border-slate-50 text-left transition-colors hover:bg-slate-50 ${!n.read ? 'bg-accent-50/30' : ''}`}
                  >
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${config.bg}`}>
                      <Icon className={`w-4.5 h-4.5 ${config.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900">{n.title}</p>
                      <p className="text-xs text-slate-500 mt-0.5 leading-snug">{n.message}</p>
                      <p className="text-xs text-slate-400 mt-1">{timeAgo(n.created_at)}</p>
                    </div>
                    {!n.read && <span className="w-2 h-2 rounded-full bg-accent-600 flex-shrink-0 mt-2" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

