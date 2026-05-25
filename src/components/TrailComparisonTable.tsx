'use client';

import { MTBTrail } from '@/data/trails';
import { getTrailDifficultyLabel, getTrailStatusLabel, getTrailTypeLabel } from '@/lib/trail-utils';
import TrailDifficultyBadge from './TrailDifficultyBadge';
import { Bike, AlertTriangle } from 'lucide-react';

interface TrailComparisonTableProps {
  trails: MTBTrail[];
  selectedTrailId: string | null;
  onSelect: (id: string | null) => void;
}

function RatingCell({ rating }: { rating?: number | null }) {
  if (rating === undefined || rating === null) return <span className="text-slate-600 text-xs">—</span>;
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <div
          key={i}
          className={`w-1.5 h-1.5 rounded-full ${i <= rating ? 'bg-orange-500' : 'bg-slate-700'}`}
        />
      ))}
    </div>
  );
}

const statusStyles: Record<string, { text: string; bg: string }> = {
  open: { text: "text-green-400", bg: "bg-green-500/10" },
  caution: { text: "text-amber-400", bg: "bg-amber-500/10" },
  closed: { text: "text-red-400", bg: "bg-red-500/10" },
  seasonal: { text: "text-sky-400", bg: "bg-sky-500/10" },
  unknown: { text: "text-slate-400", bg: "bg-slate-500/10" },
};

export default function TrailComparisonTable({ trails, selectedTrailId, onSelect }: TrailComparisonTableProps) {
  if (trails.length === 0) return null;

  return (
    <div className="overflow-x-auto rounded-2xl border border-white/5">
      <table className="w-full text-left">
        <thead>
          <tr className="bg-slate-900/80 border-b border-white/5">
            <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-500 whitespace-nowrap">Sendero</th>
            <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-500 whitespace-nowrap">Nivel</th>
            <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-500 whitespace-nowrap">Sector</th>
            <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-500 whitespace-nowrap">Tipo</th>
            <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-500 whitespace-nowrap text-right">Distancia</th>
            <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-500 whitespace-nowrap text-right">Desnivel +</th>
            <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-500 whitespace-nowrap text-right">Desnivel -</th>
            <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-500 whitespace-nowrap">Técnica</th>
            <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-500 whitespace-nowrap">Físico</th>
            <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-500 whitespace-nowrap text-center">E-bike</th>
            <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-500 whitespace-nowrap">Estado</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {trails.map(trail => {
            const isSelected = selectedTrailId === trail.id;
            const statusCfg = statusStyles[trail.status] ?? statusStyles.unknown;
            const statusLabel = getTrailStatusLabel(trail.status).label;

            return (
              <tr
                key={trail.id}
                className={`transition-all cursor-pointer ${
                  isSelected
                    ? "bg-orange-500/5"
                    : "bg-slate-900/40 hover:bg-slate-900/80"
                }`}
                onClick={() => onSelect(isSelected ? null : trail.id)}
              >
                {/* Sendero */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-medium text-white whitespace-nowrap ${isSelected ? "text-orange-400" : ""}`}>
                      {trail.name}
                    </span>
                    {trail.dataStatus === "placeholder" && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400/80 text-[8px] font-bold uppercase tracking-wider flex-shrink-0">
                        <AlertTriangle className="w-2 h-2" />
                        Demo
                      </span>
                    )}
                  </div>
                </td>

                {/* Nivel */}
                <td className="px-4 py-3">
                  <TrailDifficultyBadge difficulty={trail.difficulty} />
                </td>

                {/* Sector */}
                <td className="px-4 py-3">
                  <span className="text-sm text-slate-400 whitespace-nowrap">{trail.sector}</span>
                </td>

                {/* Tipo */}
                <td className="px-4 py-3">
                  <span className="text-xs text-slate-500 font-medium">{getTrailTypeLabel(trail.type)}</span>
                </td>

                {/* Distancia */}
                <td className="px-4 py-3 text-right">
                  {trail.distanceKm ? (
                    <span className="text-sm text-white font-medium">{trail.distanceKm} km</span>
                  ) : (
                    <span className="text-xs text-slate-600">Pendiente</span>
                  )}
                </td>

                {/* Desnivel + */}
                <td className="px-4 py-3 text-right">
                  {trail.elevationGainM ? (
                    <span className="text-sm text-green-400 font-medium">+{trail.elevationGainM} m</span>
                  ) : (
                    <span className="text-xs text-slate-600">Pendiente</span>
                  )}
                </td>

                {/* Desnivel - */}
                <td className="px-4 py-3 text-right">
                  {trail.elevationLossM ? (
                    <span className="text-sm text-red-400 font-medium">-{trail.elevationLossM} m</span>
                  ) : (
                    <span className="text-xs text-slate-600">Pendiente</span>
                  )}
                </td>

                {/* Técnica */}
                <td className="px-4 py-3">
                  <RatingCell rating={trail.technicalRating} />
                </td>

                {/* Físico */}
                <td className="px-4 py-3">
                  <RatingCell rating={trail.physicalRating} />
                </td>

                {/* E-bike */}
                <td className="px-4 py-3 text-center">
                  {trail.ebikeFriendly === true ? (
                    <Bike className="w-4 h-4 text-green-400 mx-auto" />
                  ) : trail.ebikeFriendly === false ? (
                    <span className="text-xs text-slate-600">No</span>
                  ) : (
                    <span className="text-xs text-slate-600">—</span>
                  )}
                </td>

                {/* Estado */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className={`inline-block w-1.5 h-1.5 rounded-full ${statusCfg.bg.replace("\/10", "\/50")}`} />
                    <span className={`text-xs font-medium ${statusCfg.text}`}>{statusLabel}</span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
