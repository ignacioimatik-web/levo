'use client';

import { useState, useMemo } from 'react';
import { TrailDifficulty, TrailStatus, TrailType, MTBTrail } from '@/data/trails';
import { getTrailDifficultyLabel, getTrailStatusLabel, getTrailTypeLabel } from '@/lib/trail-utils';
import type { TrailFilters as FiltersState } from '@/lib/trail-utils';
import { Search, SlidersHorizontal, X, Bike } from 'lucide-react';

const difficulties: TrailDifficulty[] = ["green", "blue", "red", "black", "double-black", "unclassified"];
const types: TrailType[] = ["singletrack", "descent", "climb", "link", "loop", "traverse", "service-road"];
const statuses: TrailStatus[] = ["open", "caution", "closed", "seasonal", "unknown"];

const difficultyStyles: Record<TrailDifficulty, { active: string; inactive: string }> = {
  green: { active: "bg-green-500/20 border-green-500/50 text-green-400", inactive: "bg-slate-800/50 border-white/5 text-slate-500 hover:text-slate-300" },
  blue: { active: "bg-blue-500/20 border-blue-500/50 text-blue-400", inactive: "bg-slate-800/50 border-white/5 text-slate-500 hover:text-slate-300" },
  red: { active: "bg-red-500/20 border-red-500/50 text-red-400", inactive: "bg-slate-800/50 border-white/5 text-slate-500 hover:text-slate-300" },
  black: { active: "bg-slate-300/20 border-slate-300/50 text-slate-200", inactive: "bg-slate-800/50 border-white/5 text-slate-500 hover:text-slate-300" },
  "double-black": { active: "bg-white/20 border-white/50 text-white", inactive: "bg-slate-800/50 border-white/5 text-slate-500 hover:text-slate-300" },
  unclassified: { active: "bg-slate-500/20 border-slate-500/50 text-slate-400", inactive: "bg-slate-800/50 border-white/5 text-slate-500 hover:text-slate-300" },
};

interface TrailFiltersProps {
  filters: FiltersState;
  trails: MTBTrail[];
  onChange: (filters: FiltersState) => void;
}

export default function TrailFilters({ filters, trails, onChange }: TrailFiltersProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const sectors = useMemo(() => {
    const set = new Set(trails.map(t => t.sector));
    return Array.from(set).sort();
  }, [trails]);

  const toggleDifficulty = (d: TrailDifficulty) => {
    const current = filters.difficulties ?? [];
    const next = current.includes(d) ? current.filter(x => x !== d) : [...current, d];
    onChange({ ...filters, difficulties: next.length ? next : undefined });
  };

  const toggleType = (t: TrailType) => {
    const current = filters.types ?? [];
    const next = current.includes(t) ? current.filter(x => x !== t) : [...current, t];
    onChange({ ...filters, types: next.length ? next : undefined });
  };

  const toggleStatus = (s: TrailStatus) => {
    const current = filters.statuses ?? [];
    const next = current.includes(s) ? current.filter(x => x !== s) : [...current, s];
    onChange({ ...filters, statuses: next.length ? next : undefined });
  };

  const toggleSector = (s: string) => {
    const current = filters.sectors ?? [];
    const next = current.includes(s) ? current.filter(x => x !== s) : [...current, s];
    onChange({ ...filters, sectors: next.length ? next : undefined });
  };

  const clearAll = () => onChange({});

  const hasActiveFilters = !!(
    filters.query ||
    filters.difficulties?.length ||
    filters.types?.length ||
    filters.statuses?.length ||
    filters.sectors?.length ||
    filters.ebikeFriendly !== undefined
  );

  const activeCount = [
    filters.difficulties?.length ?? 0,
    filters.types?.length ?? 0,
    filters.statuses?.length ?? 0,
    filters.sectors?.length ?? 0,
    filters.ebikeFriendly !== undefined ? 1 : 0,
  ].reduce((a, b) => a + b, 0);

  return (
    <div className="bg-slate-900/60 border border-white/5 rounded-2xl">
      {/* Mobile toggle */}
      <div className="flex items-center gap-3 p-4 lg:hidden">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Buscar sendero..."
            value={filters.query ?? ""}
            onChange={e => onChange({ ...filters, query: e.target.value || undefined })}
            className="w-full bg-slate-800 border border-white/5 rounded-xl py-2 pl-10 pr-3 text-sm text-white placeholder:text-slate-600 outline-none focus:border-orange-500/30 transition-colors"
          />
        </div>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className={`relative p-2 rounded-xl border transition-colors ${
            hasActiveFilters
              ? "bg-orange-500/10 border-orange-500/30 text-orange-400"
              : "bg-slate-800 border-white/5 text-slate-500"
          }`}
        >
          <SlidersHorizontal className="w-4 h-4" />
          {activeCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-orange-500 rounded-full text-[8px] font-bold text-white flex items-center justify-center">
              {activeCount}
            </span>
          )}
        </button>
      </div>

      {/* Desktop layout */}
      <div className="hidden lg:block p-5 space-y-4">
        {/* Search + Clear row */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Buscar sendero..."
              value={filters.query ?? ""}
              onChange={e => onChange({ ...filters, query: e.target.value || undefined })}
              className="w-full bg-slate-800 border border-white/5 rounded-xl py-2 pl-10 pr-3 text-sm text-white placeholder:text-slate-600 outline-none focus:border-orange-500/30 transition-colors"
            />
          </div>
          {hasActiveFilters && (
            <button
              onClick={clearAll}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold uppercase tracking-widest text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              Limpiar
            </button>
          )}
        </div>

        {/* Filter chips */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Difficulty */}
          {difficulties.map(d => {
            const active = filters.difficulties?.includes(d);
            const s = difficultyStyles[d];
            return (
              <button
                key={d}
                onClick={() => toggleDifficulty(d)}
                className={`px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider border transition-all ${
                  active ? s.active : s.inactive
                }`}
              >
                {getTrailDifficultyLabel(d)}
              </button>
            );
          })}

          <span className="w-px h-5 bg-white/5 mx-1" />

          {/* Sector */}
          <select
            value=""
            onChange={e => {
              if (e.target.value) toggleSector(e.target.value);
            }}
            className="bg-slate-800 border border-white/5 rounded-xl px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 outline-none cursor-pointer appearance-none"
          >
            <option value="">Sector</option>
            {sectors.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          {/* Active sector pills */}
          {filters.sectors?.map(s => (
            <button
              key={s}
              onClick={() => toggleSector(s)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-orange-500/10 border border-orange-500/30 text-orange-400 transition-all"
            >
              {s}
              <X className="w-3 h-3" />
            </button>
          ))}

          {/* Type */}
          <select
            value=""
            onChange={e => {
              if (e.target.value) toggleType(e.target.value as TrailType);
            }}
            className="bg-slate-800 border border-white/5 rounded-xl px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 outline-none cursor-pointer appearance-none"
          >
            <option value="">Tipo</option>
            {types.map(t => (
              <option key={t} value={t}>{getTrailTypeLabel(t)}</option>
            ))}
          </select>

          {filters.types?.map(t => (
            <button
              key={t}
              onClick={() => toggleType(t)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-orange-500/10 border border-orange-500/30 text-orange-400 transition-all"
            >
              {getTrailTypeLabel(t)}
              <X className="w-3 h-3" />
            </button>
          ))}

          {/* Status */}
          <select
            value=""
            onChange={e => {
              if (e.target.value) toggleStatus(e.target.value as TrailStatus);
            }}
            className="bg-slate-800 border border-white/5 rounded-xl px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 outline-none cursor-pointer appearance-none"
          >
            <option value="">Estado</option>
            {statuses.map(s => (
              <option key={s} value={s}>{getTrailStatusLabel(s).label}</option>
            ))}
          </select>

          {filters.statuses?.map(s => (
            <button
              key={s}
              onClick={() => toggleStatus(s)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-orange-500/10 border border-orange-500/30 text-orange-400 transition-all"
            >
              {getTrailStatusLabel(s).label}
              <X className="w-3 h-3" />
            </button>
          ))}

          <span className="w-px h-5 bg-white/5 mx-1" />

          {/* E-bike toggle */}
          <button
            onClick={() => onChange({
              ...filters,
              ebikeFriendly: filters.ebikeFriendly === true ? undefined : true,
            })}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider border transition-all ${
              filters.ebikeFriendly
                ? "bg-green-500/20 border-green-500/50 text-green-400"
                : "bg-slate-800/50 border-white/5 text-slate-500 hover:text-slate-300"
            }`}
          >
            <Bike className="w-3.5 h-3.5" />
            E-Bike
          </button>
        </div>
      </div>

      {/* Mobile expanded panel */}
      {mobileOpen && (
        <div className="lg:hidden p-4 pt-0 border-t border-white/5 space-y-4">
          {/* Difficulty */}
          <div>
            <span className="text-[10px] text-slate-600 font-bold uppercase tracking-widest block mb-2">Dificultad</span>
            <div className="flex flex-wrap gap-1.5">
              {difficulties.map(d => {
                const active = filters.difficulties?.includes(d);
                const s = difficultyStyles[d];
                return (
                  <button
                    key={d}
                    onClick={() => toggleDifficulty(d)}
                    className={`px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider border transition-all ${
                      active ? s.active : s.inactive
                    }`}
                  >
                    {getTrailDifficultyLabel(d)}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sector */}
          <div>
            <span className="text-[10px] text-slate-600 font-bold uppercase tracking-widest block mb-2">Sector</span>
            <div className="flex flex-wrap gap-1.5">
              {sectors.map(s => {
                const active = filters.sectors?.includes(s);
                return (
                  <button
                    key={s}
                    onClick={() => toggleSector(s)}
                    className={`px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider border transition-all ${
                      active
                        ? "bg-orange-500/10 border-orange-500/30 text-orange-400"
                        : "bg-slate-800 border-white/5 text-slate-400"
                    }`}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Type */}
          <div>
            <span className="text-[10px] text-slate-600 font-bold uppercase tracking-widest block mb-2">Tipo</span>
            <div className="flex flex-wrap gap-1.5">
              {types.map(t => {
                const active = filters.types?.includes(t);
                return (
                  <button
                    key={t}
                    onClick={() => toggleType(t)}
                    className={`px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider border transition-all ${
                      active
                        ? "bg-orange-500/10 border-orange-500/30 text-orange-400"
                        : "bg-slate-800 border-white/5 text-slate-400"
                    }`}
                  >
                    {getTrailTypeLabel(t)}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Status */}
          <div>
            <span className="text-[10px] text-slate-600 font-bold uppercase tracking-widest block mb-2">Estado</span>
            <div className="flex flex-wrap gap-1.5">
              {statuses.map(s => {
                const active = filters.statuses?.includes(s);
                return (
                  <button
                    key={s}
                    onClick={() => toggleStatus(s)}
                    className={`px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider border transition-all ${
                      active
                        ? "bg-orange-500/10 border-orange-500/30 text-orange-400"
                        : "bg-slate-800 border-white/5 text-slate-400"
                    }`}
                  >
                    {getTrailStatusLabel(s).label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* E-bike */}
          <div>
            <span className="text-[10px] text-slate-600 font-bold uppercase tracking-widest block mb-2">E-Bike</span>
            <button
              onClick={() => onChange({
                ...filters,
                ebikeFriendly: filters.ebikeFriendly === true ? undefined : true,
              })}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider border transition-all ${
                filters.ebikeFriendly
                  ? "bg-green-500/20 border-green-500/50 text-green-400"
                  : "bg-slate-800 border-white/5 text-slate-400"
              }`}
            >
              <Bike className="w-3.5 h-3.5" />
              E-Bike
            </button>
          </div>

          {/* Clear */}
          {hasActiveFilters && (
            <button
              onClick={clearAll}
              className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest bg-white/5 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              Limpiar todos los filtros
            </button>
          )}
        </div>
      )}
    </div>
  );
}
