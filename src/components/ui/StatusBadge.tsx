import type { VerificationStatus, ApplicationStage, VerificationVerdict } from '@/types/schema';

interface StatusBadgeProps {
  status: VerificationStatus | ApplicationStage | VerificationVerdict;
  size?: 'sm' | 'md';
}

const STATUS_CONFIG: Record<string, { label: string; classes: string }> = {
  // VerificationStatus
  pending: { label: 'Pending', classes: 'bg-slate-100 text-slate-600' },
  verified: { label: 'Verified', classes: 'bg-success-100 text-success-700' },
  suspicious: { label: 'Suspicious', classes: 'bg-warning-100 text-warning-700' },
  invalid: { label: 'Invalid', classes: 'bg-danger-100 text-danger-700' },
  // ApplicationStage
  applied: { label: 'Applied', classes: 'bg-blue-50 text-blue-600' },
  institute_notified: { label: 'Institute Notified', classes: 'bg-amber-50 text-amber-600' },
  certificate_uploaded: { label: 'Certificate Uploaded', classes: 'bg-purple-50 text-purple-600' },
  verification_requested: { label: 'Verification Requested', classes: 'bg-indigo-50 text-indigo-600' },
  verification_completed: { label: 'Verification Completed', classes: 'bg-slate-100 text-slate-700' },
  // VerificationVerdict (same as status)
};

export function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  const sizeClasses = size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm';

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-medium ${config.classes} ${sizeClasses}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.classes.split(' ')[0].replace('bg-', 'bg-').replace('100', '400').replace('50', '400').replace('600', '500').replace('700', '500')}`} />
      {config.label}
    </span>
  );
}
