'use client';

import { TrailType } from '@/data/trails';
import { getTrailTypeLabel } from '@/lib/trail-utils';
import type { TrailFilters as FiltersState } from '@/lib/trail-utils';
import { X } from 'lucide-react';

const types: TrailType[] = ["singletrack", "descent", "climb", "link", "loop", "traverse", "service-road"];

interface QuickTypeFiltersProps {
  filters: FiltersState;
  onChange: (filters: FiltersState) => void;
}

export default function QuickTypeFilters({ filters, onChange }: QuickTypeFiltersProps) {
  const toggleType = (t: TrailType) => {
    const current = filters.types ?? [];
    const next = current.includes(t) ? current.filter(x => x !== t) : [...current, t];
    onChange({ ...filters, types: next.length ? next : undefined });
  };

  const clearTypes = () => {
    onChange({ ...filters, types: undefined });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {types.map(t => {
        const active = filters.types?.includes(t);
        return (
          <button
            key={t}
            onClick={() => toggleType(t)}
            className={`px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider border transition-all ${
              active 
                ? "bg-orange-500/20 border-orange-500/50 text-orange-400" 
                : "bg-slate-800/50 border-white/5 text-slate-500 hover:text-slate-300"
            }`}
          >
            {getTrailTypeLabel(t)}
          </button>
        );
      })}

      {filters.types && filters.types.length > 0 && (
        <button
          onClick={clearTypes}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:text-white transition-colors ml-1"
        >
          <X className="w-3 h-3" />
          Limpiar
        </button>
      )}
    </div>
  );
}
