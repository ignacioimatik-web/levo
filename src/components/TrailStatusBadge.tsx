import { TrailStatus } from '@/data/trails';
import { getTrailStatusLabel } from '@/lib/trail-utils';
import { CheckCircle2, AlertTriangle, XCircle, CalendarSync, HelpCircle } from 'lucide-react';

const statusIcons: Record<TrailStatus, typeof CheckCircle2> = {
  open: CheckCircle2,
  caution: AlertTriangle,
  closed: XCircle,
  seasonal: CalendarSync,
  unknown: HelpCircle,
};

interface TrailStatusBadgeProps {
  status: TrailStatus;
  size?: "sm" | "md";
}

export default function TrailStatusBadge({ status, size = "sm" }: TrailStatusBadgeProps) {
  const cfg = getTrailStatusLabel(status);
  const Icon = statusIcons[status];

  if (size === "md") {
    return (
      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg ${cfg.bgClass}`}>
        <Icon className={`w-4 h-4 ${cfg.colorClass}`} />
        <span className={`font-bold text-xs uppercase tracking-wider ${cfg.colorClass}`}>{cfg.label}</span>
      </div>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${cfg.bgClass} ${cfg.colorClass}`}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}
