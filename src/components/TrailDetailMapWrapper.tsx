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

export default function TrailDetailMapWrapper({ trail }: { trail: MTBTrail }) {
  return <TrailDetailMap trail={trail} />;
}
