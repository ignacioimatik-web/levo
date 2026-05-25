import { TrailDifficulty, TrailStatus } from '@/data/trails';
import { getTrailDifficultyLabel, getTrailStatusLabel } from '@/lib/trail-utils';
import { CheckCircle2, AlertTriangle, XCircle, CalendarSync, HelpCircle } from 'lucide-react';

const difficultyColorMap: Record<TrailDifficulty, string> = {
  green: "bg-green-500",
  blue: "bg-blue-500",
  red: "bg-red-500",
  black: "bg-slate-200",
  "double-black": "bg-white",
  unclassified: "bg-slate-600",
};

const difficultyRingMap: Record<TrailDifficulty, string> = {
  green: "ring-green-500/30",
  blue: "ring-blue-500/30",
  red: "ring-red-500/30",
  black: "ring-slate-200/20",
  "double-black": "ring-white/20",
  unclassified: "ring-slate-600/30",
};

const difficultyDescriptions: Record<TrailDifficulty, string> = {
  green: "Iniciación",
  blue: "Intermedia",
  red: "Avanzada",
  black: "Experta",
  "double-black": "Extrema",
  unclassified: "Pendiente de clasificar",
};

const statusIcons: Record<TrailStatus, typeof CheckCircle2> = {
  open: CheckCircle2,
  caution: AlertTriangle,
  closed: XCircle,
  seasonal: CalendarSync,
  unknown: HelpCircle,
};

const difficulties: TrailDifficulty[] = ["green", "blue", "red", "black", "double-black", "unclassified"];
const statuses: TrailStatus[] = ["open", "caution", "closed", "seasonal", "unknown"];

function DifficultyRow({ difficulty }: { difficulty: TrailDifficulty }) {
  const label = getTrailDifficultyLabel(difficulty);
  const desc = difficultyDescriptions[difficulty];
  const color = difficultyColorMap[difficulty];
  const ring = difficultyRingMap[difficulty];
  const isDouble = difficulty === "double-black";
  const isUnclassified = difficulty === "unclassified";

  return (
    <div className="flex items-center gap-4 group">
      <div className="flex flex-col items-center gap-0.5 w-6 flex-shrink-0">
        {isDouble ? (
          <div className="flex gap-0.5">
            <div className={`w-3 h-3 rounded-full ${color} ring-2 ${ring}`} />
            <div className={`w-3 h-3 rounded-full ${color} ring-2 ${ring}`} />
          </div>
        ) : isUnclassified ? (
          <div className="w-3.5 h-3.5 rounded-full border-2 border-slate-500 ring-2 ring-slate-600/20" />
        ) : (
          <div className={`w-3.5 h-3.5 rounded-full ${color} ring-2 ${ring}`} />
        )}
      </div>
      <div className="min-w-[100px]">
        <span className="text-sm font-bold text-white">{label}</span>
      </div>
      <div className="h-px flex-1 bg-white/5 group-hover:bg-white/10 transition-colors" />
      <span className="text-sm text-slate-400 text-right">{desc}</span>
    </div>
  );
}

function StatusRow({ status }: { status: TrailStatus }) {
  const cfg = getTrailStatusLabel(status);
  const Icon = statusIcons[status];

  return (
    <div className="flex items-center gap-4 group">
      <div className="w-6 flex justify-center flex-shrink-0">
        <Icon className={`w-4 h-4 ${cfg.colorClass}`} />
      </div>
      <div className="min-w-[100px]">
        <span className={`text-sm font-bold ${cfg.colorClass}`}>{cfg.label}</span>
      </div>
      <div className="h-px flex-1 bg-white/5 group-hover:bg-white/10 transition-colors" />
      <span className="text-sm text-slate-500 text-right capitalize">
        {status === "open" && "Tránsito permitido"}
        {status === "caution" && "Extremar precaución"}
        {status === "closed" && "Acceso restringido"}
        {status === "seasonal" && "Disponible en temporada"}
        {status === "unknown" && "Estado no verificado"}
      </span>
    </div>
  );
}

interface TrailLegendProps {
  showStatus?: boolean;
}

export default function TrailLegend({ showStatus = true }: TrailLegendProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
      <div className="bg-slate-900/60 border border-white/5 rounded-2xl p-6">
        <h3 className="text-xs font-bold uppercase tracking-widest text-orange-500 mb-6 flex items-center gap-2">
          <span className="w-8 h-0.5 bg-orange-500/50" />
          Dificultad
        </h3>
        <div className="space-y-4">
          {difficulties.map(d => (
            <DifficultyRow key={d} difficulty={d} />
          ))}
        </div>
      </div>

      {showStatus && (
        <div className="bg-slate-900/60 border border-white/5 rounded-2xl p-6">
          <h3 className="text-xs font-bold uppercase tracking-widest text-orange-500 mb-6 flex items-center gap-2">
            <span className="w-8 h-0.5 bg-orange-500/50" />
            Estado
          </h3>
          <div className="space-y-4">
            {statuses.map(s => (
              <StatusRow key={s} status={s} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
