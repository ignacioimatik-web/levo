'use client';

import dynamic from 'next/dynamic';

const GpxMap = dynamic(() => import('./GpxMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[300px] bg-slate-900/80 border border-white/5 rounded-2xl flex items-center justify-center">
      <p className="text-slate-500 text-sm font-bold">Cargando mapa…</p>
    </div>
  ),
});

interface RouteMapWrapperProps {
  gpxUrl?: string;
  title?: string;
}

export default function RouteMapWrapper({ gpxUrl, title }: RouteMapWrapperProps) {
  return <GpxMap gpxUrl={gpxUrl} title={title} />;
}
