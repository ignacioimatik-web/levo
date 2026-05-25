'use client';

import { MTBTrail } from '@/data/trails';
import { getTrailTypeLabel } from '@/lib/trail-utils';
import TrailDifficultyBadge from './TrailDifficultyBadge';
import Link from 'next/link';
import { Bike, TrendingUp, Clock, MapPin, Tag, AlertTriangle, Crosshair, ExternalLink } from 'lucide-react';

interface TrailCardProps {
  trail: MTBTrail;
  isSelected: boolean;
  onSelect: (id: string | null) => void;
  mapSectionId?: string;
}

const difficultyAccents: Record<string, { border: string; glow: string }> = {
  green: { border: "border-l-green-500/60", glow: "shadow-green-500/5" },
  blue: { border: "border-l-blue-500/60", glow: "shadow-blue-500/5" },
  red: { border: "border-l-red-500/60", glow: "shadow-red-500/5" },
  black: { border: "border-l-slate-300/60", glow: "shadow-slate-300/5" },
  "double-black": { border: "border-l-white/60", glow: "shadow-white/5" },
  unclassified: { border: "border-l-slate-500/60", glow: "shadow-slate-500/5" },
};

const statusColors: Record<string, string> = {
  open: "text-green-400",
  caution: "text-amber-400",
  closed: "text-red-400",
  seasonal: "text-sky-400",
  unknown: "text-slate-500",
};

const statusLabels: Record<string, string> = {
  open: "Abierto",
  caution: "Precaución",
  closed: "Cerrado",
  seasonal: "Estacional",
  unknown: "Desconocido",
};

export default function TrailCard({ trail, isSelected, onSelect, mapSectionId = "forfait-map-section" }: TrailCardProps) {
  const accent = difficultyAccents[trail.difficulty] ?? difficultyAccents.unclassified;

  const handleSelectInMap = () => {
    onSelect(trail.id);
    const el = document.getElementById(mapSectionId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div
      className={`bg-slate-900 border rounded-2xl overflow-hidden transition-all duration-200 group trail-card-hover ${
        isSelected
          ? "border-orange-500/50 ring-1 ring-orange-500/20 shadow-lg shadow-orange-500/5"
          : `border-white/5 hover:border-white/20 shadow-sm ${accent.glow}`
      }`}
    >
      {/* Top color bar */}
      <div className={`h-1.5 w-full bg-gradient-to-r ${
        trail.difficulty === "green" ? "from-green-500 to-green-400" :
        trail.difficulty === "blue" ? "from-blue-500 to-blue-400" :
        trail.difficulty === "red" ? "from-red-500 to-red-400" :
        trail.difficulty === "black" ? "from-slate-300 to-slate-400" :
        trail.difficulty === "double-black" ? "from-white to-slate-200" :
        "from-slate-500 to-slate-400"
      }`} />

      <div className="p-5">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-white font-bold text-base leading-tight group-hover:text-orange-500 transition-colors truncate">
                {trail.name}
              </h3>
              {trail.dataStatus === "placeholder" && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400/80 text-[8px] font-bold uppercase tracking-wider flex-shrink-0">
                  <AlertTriangle className="w-2 h-2" />
                  Demo
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <MapPin className="w-3 h-3" />
              <span>{trail.sector}</span>
            </div>
          </div>

          {/* Status badge */}
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider flex-shrink-0 ${
            trail.status === "open" ? "bg-green-500/10 text-green-400" :
            trail.status === "caution" ? "bg-amber-500/10 text-amber-400" :
            trail.status === "closed" ? "bg-red-500/10 text-red-400" :
            trail.status === "seasonal" ? "bg-sky-500/10 text-sky-400" :
            "bg-slate-500/10 text-slate-400"
          }`}>
            {statusLabels[trail.status] ?? trail.status}
          </span>
        </div>

        {/* Summary */}
        <p className="text-slate-400 text-sm leading-relaxed mb-4 line-clamp-2">
          {trail.summary || trail.description}
        </p>

        {/* Badges row */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <TrailDifficultyBadge difficulty={trail.difficulty} />
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-slate-800 text-slate-400 border border-white/5">
            {getTrailTypeLabel(trail.type)}
          </span>
          {trail.ebikeFriendly === true && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-green-500/10 text-green-400">
              <Bike className="w-2.5 h-2.5" />
              E-Bike
            </span>
          )}
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
          {trail.distanceKm && (
            <div className="bg-slate-950/50 border border-white/5 rounded-xl p-2.5">
              <span className="text-[8px] text-slate-600 font-bold uppercase tracking-widest block mb-0.5">Distancia</span>
              <span className="text-white font-bold text-sm">{trail.distanceKm} km</span>
            </div>
          )}
          {trail.elevationGainM && (
            <div className="bg-slate-950/50 border border-white/5 rounded-xl p-2.5">
              <span className="text-[8px] text-slate-600 font-bold uppercase tracking-widest block mb-0.5">Subida</span>
              <span className="text-green-400 font-bold text-sm">+{trail.elevationGainM} m</span>
            </div>
          )}
          {trail.elevationLossM && (
            <div className="bg-slate-950/50 border border-white/5 rounded-xl p-2.5">
              <span className="text-[8px] text-slate-600 font-bold uppercase tracking-widest block mb-0.5">Bajada</span>
              <span className="text-red-400 font-bold text-sm">-{trail.elevationLossM} m</span>
            </div>
          )}
          {trail.estimatedTime && (
            <div className="bg-slate-950/50 border border-white/5 rounded-xl p-2.5">
              <span className="text-[8px] text-slate-600 font-bold uppercase tracking-widest block mb-0.5">Duración</span>
              <span className="text-white font-bold text-sm">{trail.estimatedTime}</span>
            </div>
          )}
        </div>

        {/* Tags */}
        {trail.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-4">
            {trail.tags.slice(0, 4).map(tag => (
              <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-800 text-slate-500 text-[9px] font-medium">
                <Tag className="w-2 h-2" />
                {tag}
              </span>
            ))}
            {trail.tags.length > 4 && (
              <span className="text-[9px] text-slate-600">+{trail.tags.length - 4}</span>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={handleSelectInMap}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest transition-all ${
              isSelected
                ? "bg-orange-500/10 border border-orange-500/30 text-orange-400"
                : "bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 hover:text-white"
            }`}
          >
            <Crosshair className="w-3.5 h-3.5" />
            {isSelected ? "Seleccionado" : "En mapa"}
          </button>
          <Link
            href={`/forfait/${trail.slug}`}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 transition-all"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
