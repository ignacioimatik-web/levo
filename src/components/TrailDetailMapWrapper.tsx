'use client';

import dynamic from 'next/dynamic';
import { MTBTrail } from '@/data/trails';

const TrailDetailMap = dynamic(() => import('./TrailDetailMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[300px] bg-slate-900/80 border border-white/5 rounded-2xl flex items-center justify-center">
      <p className="text-slate-500 text-sm font-bold">Cargando mapa…</p>
    </div>
  ),
});

export default function TrailDetailMapWrapper({
  trail,
  focusStartKm,
  focusEndKm,
  focusPointKm,
  segmentOverlays,
}: {
  trail: MTBTrail;
  focusStartKm?: number;
  focusEndKm?: number;
  focusPointKm?: number;
  segmentOverlays?: Array<{ startKm: number; endKm: number; type: 'climb' | 'descent' | 'flat' }>;
}) {
  return <TrailDetailMap trail={trail} focusStartKm={focusStartKm} focusEndKm={focusEndKm} focusPointKm={focusPointKm} segmentOverlays={segmentOverlays} />;
}
