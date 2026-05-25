'use client';

import { MTBTrail } from '@/data/trails';
import { getTrailTypeLabel } from '@/lib/trail-utils';
import TrailDifficultyBadge from './TrailDifficultyBadge';
import Link from 'next/link';
import {
  X, Bike, AlertTriangle, Tag, ChevronRight, Download, ExternalLink, Signal, TrendingUp, Clock, Map,
} from 'lucide-react';

interface TrailDrawerProps {
  trail: MTBTrail | null;
  onClose: () => void;
}

function RatingDots({ rating }: { rating?: number }) {
  if (rating === undefined || rating === null) return <span className="text-slate-600 text-xs">—</span>;
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(i => (
        <div
          key={i}
          className={`w-2 h-2 rounded-full ${i <= rating ? 'bg-orange-500' : 'bg-slate-700'}`}
        />
      ))}
    </div>
  );
}

export default function TrailDrawer({ trail, onClose }: TrailDrawerProps) {
  if (!trail) {
    return (
      <div className="w-full lg:w-80 bg-slate-900/50 border border-white/5 rounded-2xl p-8 flex flex-col items-center justify-center text-center min-h-[200px]">
        <Map className="w-10 h-10 text-slate-700 mb-4" />
        <p className="text-slate-500 text-sm font-medium">Selecciona un sendero en el mapa</p>
        <p className="text-slate-600 text-xs mt-2">Haz clic en cualquier línea del plano para ver su ficha</p>
      </div>
    );
  }

  const isPlaceholder = trail.dataStatus === "placeholder";
  const hasGpx = !!trail.gpxFile;

  return (
    <div className="w-full lg:w-80 bg-slate-900/60 border border-white/5 rounded-2xl overflow-hidden flex flex-col max-h-[600px] lg:max-h-[700px]">
      {/* Header */}
      <div className="flex items-start justify-between p-5 pb-3 border-b border-white/5">
        <div className="flex-1 min-w-0">
          {isPlaceholder && (
            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[9px] font-bold uppercase tracking-wider mb-2">
              <AlertTriangle className="w-2.5 h-2.5" />
              Datos demo — pendiente de track real
            </div>
          )}
          <h3 className="text-white font-bold text-base leading-tight truncate">{trail.name}</h3>
        </div>
        <button
          onClick={onClose}
          className="ml-2 p-1 rounded-lg hover:bg-white/5 text-slate-500 hover:text-white transition-colors flex-shrink-0"
          aria-label="Cerrar"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Badges */}
      <div className="flex flex-wrap items-center gap-2 px-5 py-3 border-b border-white/5">
        <TrailDifficultyBadge difficulty={trail.difficulty} size="md" />
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-500/10 text-slate-400 border border-slate-500/30">
          {getTrailTypeLabel(trail.type)}
        </span>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* Sector */}
        <div>
          <span className="text-[10px] text-slate-600 font-bold uppercase tracking-widest">Sector</span>
          <p className="text-white text-sm font-medium mt-0.5">{trail.sector}</p>
        </div>

        {/* Summary */}
        {trail.summary && (
          <div>
            <span className="text-[10px] text-slate-600 font-bold uppercase tracking-widest">Resumen</span>
            <p className="text-slate-400 text-sm leading-relaxed mt-1">{trail.summary}</p>
          </div>
        )}

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-2">
          {trail.distanceKm && (
            <div className="bg-slate-900/80 border border-white/5 rounded-xl p-3">
              <div className="flex items-center gap-1.5 text-slate-500 mb-0.5">
                <Bike className="w-3 h-3" />
                <span className="text-[8px] font-bold uppercase tracking-widest">Distancia</span>
              </div>
              <p className="text-white font-bold">{trail.distanceKm} km</p>
            </div>
          )}
          {trail.elevationGainM && (
            <div className="bg-slate-900/80 border border-white/5 rounded-xl p-3">
              <div className="flex items-center gap-1.5 text-slate-500 mb-0.5">
                <TrendingUp className="w-3 h-3" />
                <span className="text-[8px] font-bold uppercase tracking-widest">Subida</span>
              </div>
              <p className="text-green-400 font-bold">+{trail.elevationGainM} m</p>
            </div>
          )}
          {trail.elevationLossM && (
            <div className="bg-slate-900/80 border border-white/5 rounded-xl p-3">
              <div className="flex items-center gap-1.5 text-slate-500 mb-0.5">
                <TrendingUp className="w-3 h-3 rotate-180" />
                <span className="text-[8px] font-bold uppercase tracking-widest">Bajada</span>
              </div>
              <p className="text-red-400 font-bold">-{trail.elevationLossM} m</p>
            </div>
          )}
          {trail.estimatedTime && (
            <div className="bg-slate-900/80 border border-white/5 rounded-xl p-3">
              <div className="flex items-center gap-1.5 text-slate-500 mb-0.5">
                <Clock className="w-3 h-3" />
                <span className="text-[8px] font-bold uppercase tracking-widest">Duración</span>
              </div>
              <p className="text-white font-bold">{trail.estimatedTime}</p>
            </div>
          )}
        </div>

        {/* Ratings */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Signal className="w-4 h-4 text-orange-500" />
              <span className="text-xs text-slate-500 font-bold uppercase tracking-widest">Nivel técnico</span>
            </div>
            <RatingDots rating={trail.technicalRating} />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Signal className="w-4 h-4 text-orange-500" />
              <span className="text-xs text-slate-500 font-bold uppercase tracking-widest">Nivel físico</span>
            </div>
            <RatingDots rating={trail.physicalRating} />
          </div>
        </div>

        {/* E-bike */}
        <div className="flex items-center justify-between py-2 border-t border-white/5">
          <div className="flex items-center gap-2">
            <Bike className="w-4 h-4 text-orange-500" />
            <span className="text-xs text-slate-500 font-bold uppercase tracking-widest">E-Bike</span>
          </div>
          <span className={`text-xs font-bold ${
            trail.ebikeFriendly === true ? 'text-green-400' :
            trail.ebikeFriendly === false ? 'text-red-400' :
            'text-slate-600'
          }`}>
            {trail.ebikeFriendly === true ? 'Compatible' :
             trail.ebikeFriendly === false ? 'No recomendado' :
             'No especificado'}
          </span>
        </div>

        {/* Warnings */}
        {trail.warnings.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span className="text-xs text-slate-500 font-bold uppercase tracking-widest">Advertencias</span>
            </div>
            <ul className="space-y-1">
              {trail.warnings.map((w, i) => (
                <li key={i} className="text-amber-400/80 text-xs flex items-start gap-2">
                  <span className="mt-1.5 w-1 h-1 rounded-full bg-amber-400/50 flex-shrink-0" />
                  {w}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Tags */}
        {trail.tags.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Tag className="w-4 h-4 text-slate-500" />
              <span className="text-xs text-slate-500 font-bold uppercase tracking-widest">Etiquetas</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {trail.tags.map((tag, i) => (
                <span key={i} className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 text-[10px] font-medium">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="p-5 pt-3 border-t border-white/5 space-y-2">
        {/* GPX: Replace button with <a href={trail.gpxFile} download> when real files exist.
           Files stored in public/gpx/{slug}.gpx. */}
        {hasGpx ? (
          <a
            href={trail.gpxFile}
            download
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-orange-500/10 border border-orange-500/30 text-orange-500 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-orange-500/20 transition-all"
          >
            <Download className="w-4 h-4" />
            Descargar GPX
          </a>
        ) : (
          <div className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800/50 border border-white/5 text-slate-500 rounded-xl text-xs uppercase tracking-widest font-medium">
            <Download className="w-4 h-4" />
            Track GPX pendiente
          </div>
        )}
        <Link
          href={`/forfait/${trail.slug}`}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-white/5 text-slate-300 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-white/10 hover:text-white transition-all"
        >
          <ExternalLink className="w-4 h-4" />
          Ver ficha completa
        </Link>
      </div>
    </div>
  );
}
