'use client';

import { useState } from 'react';
import { Bike, Thermometer } from 'lucide-react';

type BikeMode = 'trail' | 'enduro' | 'ebike';
type TempSourceMode = 'nearest' | 'estimated';

export default function TrailSidebarControls() {
  const [bikeMode, setBikeMode] = useState<BikeMode>('trail');
  const [tempSource, setTempSource] = useState<TempSourceMode>('estimated');

  return (
    <div className="bg-slate-900 border border-white/5 rounded-2xl p-6 space-y-6">
      {/* Modo bici */}
      <div>
        <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
          <Bike className="w-4 h-4 text-orange-500" />
          Modo bici
        </h3>
        <div className="flex flex-col gap-2">
          {(['trail', 'enduro', 'ebike'] as BikeMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setBikeMode(mode)}
              className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider border transition-colors ${
                bikeMode === mode
                  ? 'bg-orange-500/20 border-orange-500/40 text-orange-300'
                  : 'bg-slate-800 border-white/10 text-slate-400 hover:text-slate-200'
              }`}
            >
              {mode === 'trail' ? 'Trail' : mode === 'enduro' ? 'Enduro' : 'E-Bike'}
            </button>
          ))}
        </div>
      </div>

      {/* Temperatura */}
      <div>
        <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
          <Thermometer className="w-4 h-4 text-orange-500" />
          Temp
        </h3>
        <div className="flex flex-col gap-2">
          <button
            onClick={() => setTempSource('nearest')}
            className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider border transition-colors ${
              tempSource === 'nearest'
                ? 'bg-sky-500/20 border-sky-500/40 text-sky-300'
                : 'bg-slate-800 border-white/10 text-slate-400 hover:text-slate-200'
            }`}
          >
            Estación cercana
          </button>
          <button
            onClick={() => setTempSource('estimated')}
            className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider border transition-colors ${
              tempSource === 'estimated'
                ? 'bg-sky-500/20 border-sky-500/40 text-sky-300'
                : 'bg-slate-800 border-white/10 text-slate-400 hover:text-slate-200'
            }`}
          >
            Temp ruta est.
          </button>
        </div>
      </div>
    </div>
  );
}
