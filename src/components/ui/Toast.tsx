import { CheckCircle2, AlertCircle, Info, XCircle, X } from 'lucide-react';
import { useStore } from '@/store/AppStore';

export function ToastContainer() {
  const { toasts, dismissToast } = useStore();

  if (toasts.length === 0) return null;

  const ICONS = {
    success: <CheckCircle2 className="w-5 h-5 text-success-600" />,
    error: <XCircle className="w-5 h-5 text-danger-600" />,
    warning: <AlertCircle className="w-5 h-5 text-warning-600" />,
    info: <Info className="w-5 h-5 text-accent-600" />,
  };

  const BORDERS = {
    success: 'border-l-success-600',
    error: 'border-l-danger-600',
    warning: 'border-l-warning-600',
    info: 'border-l-accent-600',
  };

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-3 max-w-sm">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`flex items-start gap-3 bg-white rounded-xl shadow-modal border border-slate-100 border-l-4 ${BORDERS[toast.type]} p-4 animate-slide-in-right`}
        >
          {ICONS[toast.type]}
          <p className="flex-1 text-sm text-slate-700 font-medium leading-snug">{toast.message}</p>
          <button onClick={() => dismissToast(toast.id)} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
