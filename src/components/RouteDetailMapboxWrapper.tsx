'use client';

import dynamic from 'next/dynamic';

const RouteDetailMapbox = dynamic(() => import('./RouteDetailMapbox'), {
  ssr: false,
  loading: () => (
    <div className="flex h-[min(55svh,28rem)] min-h-72 items-center justify-center rounded-2xl border border-white/5 bg-slate-900/80 text-sm font-bold text-slate-500">
      Cargando mapa 3D…
    </div>
  ),
});

export default function RouteDetailMapboxWrapper({
  points,
  title,
  segmentOverlays,
}: {
  points: Array<{ lat: number; lng: number }>;
  title: string;
  segmentOverlays?: Array<{ startKm: number; endKm: number; type: 'climb' | 'descent' | 'flat' }>;
}) {
  return <RouteDetailMapbox points={points} title={title} segmentOverlays={segmentOverlays} />;
}
