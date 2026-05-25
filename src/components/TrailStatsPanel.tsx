import { MTBTrail, TrailDifficulty } from '@/data/trails';
import { calculateTrailTotals, getTrailDifficultyLabel } from '@/lib/trail-utils';
import { Route, Bike, Mountain, CheckCircle2, AlertTriangle, XCircle, Signal, Database, Map } from 'lucide-react';

const difficultyIconColors: Record<TrailDifficulty, { bar: string; text: string }> = {
  green: { bar: "bg-green-500", text: "text-green-400" },
  blue: { bar: "bg-blue-500", text: "text-blue-400" },
  red: { bar: "bg-red-500", text: "text-red-400" },
  black: { bar: "bg-slate-300", text: "text-slate-300" },
  "double-black": { bar: "bg-white", text: "text-white" },
  unclassified: { bar: "bg-slate-500", text: "text-slate-400" },
};

interface TrailStatsPanelProps {
  trails: MTBTrail[];
}

export default function TrailStatsPanel({ trails }: TrailStatsPanelProps) {
  const totals = calculateTrailTotals(trails);

  const sectors = new Set(trails.map(t => t.sector)).size;
  const ebikeCount = trails.filter(t => t.ebikeFriendly === true).length;
  const placeholderCount = trails.filter(t => t.dataStatus === "placeholder").length;
  const cautionCount = totals.byStatus.caution;
  const closedCount = totals.byStatus.closed;
  const difficulties: TrailDifficulty[] = ["green", "blue", "red", "black", "double-black", "unclassified"];

  const isDemo = trails.some(t => t.dataStatus === "placeholder");

  return (
    <div className="space-y-4">
      {/* Demo notice */}
      {isDemo && (
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/5 border border-amber-500/15">
          <Database className="w-3.5 h-3.5 text-amber-400/70" />
          <span className="text-[11px] text-amber-400/70 font-medium">
            Estadísticas basadas en datos demo
          </span>
        </div>
      )}

      {/* Primary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="glass-card rounded-2xl p-4">
          <div className="flex items-center gap-2 text-slate-500 mb-2">
            <Route className="w-4 h-4" />
            <span className="text-[10px] font-bold uppercase tracking-widest">Senderos</span>
          </div>
          <div className="text-3xl font-black heading-gradient-strong">{totals.total}</div>
        </div>

        <div className="glass-card rounded-2xl p-4">
          <div className="flex items-center gap-2 text-slate-500 mb-2">
            <Map className="w-4 h-4" />
            <span className="text-[10px] font-bold uppercase tracking-widest">Distancia total</span>
          </div>
          <div className="text-3xl font-black heading-gradient-strong">
            {totals.totalDistanceKm}
            <span className="text-lg text-slate-500 ml-1">km</span>
          </div>
        </div>

        <div className="glass-card rounded-2xl p-4">
          <div className="flex items-center gap-2 text-slate-500 mb-2">
            <Mountain className="w-4 h-4" />
            <span className="text-[10px] font-bold uppercase tracking-widest">Sectores</span>
          </div>
          <div className="text-3xl font-black heading-gradient-strong">{sectors}</div>
        </div>

        <div className="glass-card rounded-2xl p-4">
          <div className="flex items-center gap-2 text-slate-500 mb-2">
            <Bike className="w-4 h-4" />
            <span className="text-[10px] font-bold uppercase tracking-widest">E-Bike</span>
          </div>
          <div className="text-3xl font-black text-green-400">{ebikeCount}</div>
        </div>
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="glass-card rounded-2xl p-4">
          <div className="flex items-center gap-2 text-slate-500 mb-2">
            <CheckCircle2 className="w-4 h-4 text-green-400" />
            <span className="text-[10px] font-bold uppercase tracking-widest">Abiertos</span>
          </div>
          <div className="text-2xl font-black text-white">{totals.openCount}</div>
        </div>

        <div className="glass-card rounded-2xl p-4">
          <div className="flex items-center gap-2 text-slate-500 mb-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span className="text-[10px] font-bold uppercase tracking-widest">Precaución</span>
          </div>
          <div className="text-2xl font-black text-white">{cautionCount}</div>
        </div>

        <div className="glass-card rounded-2xl p-4">
          <div className="flex items-center gap-2 text-slate-500 mb-2">
            <XCircle className="w-4 h-4 text-red-400" />
            <span className="text-[10px] font-bold uppercase tracking-widest">Cerrados</span>
          </div>
          <div className="text-2xl font-black text-white">{closedCount}</div>
        </div>

        <div className="glass-card rounded-2xl p-4">
          <div className="flex items-center gap-2 text-slate-500 mb-2">
            <Database className="w-4 h-4 text-amber-400" />
            <span className="text-[10px] font-bold uppercase tracking-widest">Pendientes</span>
          </div>
          <div className="text-2xl font-black text-white">{placeholderCount}</div>
        </div>
      </div>

      {/* Difficulty breakdown */}
      <div className="glass-card rounded-2xl p-5">
        <div className="flex items-center gap-2 text-slate-500 mb-4">
          <Signal className="w-4 h-4" />
          <span className="text-[10px] font-bold uppercase tracking-widest">Por dificultad</span>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          {difficulties.map(d => {
            const count = totals.byDifficulty[d];
            const maxCount = Math.max(...difficulties.map(x => totals.byDifficulty[x]), 1);
            const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;
            const colors = difficultyIconColors[d];

            return (
              <div key={d} className="text-center">
                <div className="flex items-end justify-center gap-0.5 h-16 mb-2">
                  <div
                    className={`w-6 rounded-t-lg transition-all ${colors.bar}`}
                    style={{ height: `${Math.max(pct, 8)}%`, opacity: count > 0 ? 0.8 : 0.2 }}
                  />
                </div>
                <div className={`text-sm font-bold ${colors.text}`}>{count}</div>
                <div className="text-[9px] text-slate-600 font-bold uppercase tracking-wider mt-0.5">
                  {getTrailDifficultyLabel(d)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
