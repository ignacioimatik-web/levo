'use client';

import { useMemo } from 'react';
import type { TrackPoint } from '@/lib/forfait/types';
import { buildProfileSeries } from '@/lib/forfait/geo-utils';

export default function ElevationProfile({ points }: { points: TrackPoint[] }) {
  const series = useMemo(() => buildProfileSeries(points), [points]);

  if (!series.length) {
    return (
      <div className="bg-slate-900/60 border border-white/5 rounded-xl p-6 text-center">
        <p className="text-xs text-slate-500">Perfil de elevación disponible cuando los tracks incluyan datos de altitud.</p>
      </div>
    );
  }

  const width = 600;
  const height = 160;
  const padX = 40;
  const padTop = 16;
  const padBottom = 26;
  const minEle = Math.min(...series.map(p => p.elevationM));
  const maxEle = Math.max(...series.map(p => p.elevationM));
  const maxKm = Math.max(...series.map(p => p.km), 1);
  const rangeEle = Math.max(1, maxEle - minEle);

  const scaleX = (km: number) => padX + (km / maxKm) * (width - padX * 2);
  const scaleY = (ele: number) => {
    if (maxEle === minEle) return height / 2;
    return padTop + ((maxEle - ele) / rangeEle) * (height - padTop - padBottom);
  };

  const path = series
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(p.km).toFixed(2)} ${scaleY(p.elevationM).toFixed(2)}`)
    .join(' ');
  const areaPath = `${path} L ${scaleX(series[series.length - 1].km).toFixed(2)} ${(height - padBottom).toFixed(2)} L ${scaleX(series[0].km).toFixed(2)} ${(height - padBottom).toFixed(2)} Z`;

  const yTicks = Array.from({ length: 3 }, (_, i) => {
    const pct = i / 2;
    const ele = maxEle - rangeEle * pct;
    const y = scaleY(ele);
    return { ele: Math.round(ele), y };
  });

  const xTicks = [0, 0.5, 1].map(ratio => ({
    km: maxKm * ratio,
    x: scaleX(maxKm * ratio),
  }));

  const highest = series.reduce((best, p) => (p.elevationM > best.elevationM ? p : best), series[0]);
  const lowest = series.reduce((best, p) => (p.elevationM < best.elevationM ? p : best), series[0]);

  return (
    <div className="bg-slate-900/60 border border-white/5 rounded-xl p-4">
      <h4 className="text-xs font-bold text-white mb-3">Perfil de elevación</h4>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" role="img" aria-label="Perfil de elevación">
        <defs>
          <linearGradient id="profGrad" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#22c55e" />
            <stop offset="50%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#ef4444" />
          </linearGradient>
          <linearGradient id="profArea" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#f97316" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#f97316" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        <rect x="0" y="0" width={width} height={height} fill="transparent" />

        {yTicks.map((t, i) => (
          <g key={`y-${i}`}>
            <line x1={padX} y1={t.y} x2={width - padX} y2={t.y} stroke="#1e293b" strokeWidth="1" strokeDasharray="3 3" />
            <text x={6} y={t.y + 3} fill="#64748b" fontSize="9">{t.ele}</text>
          </g>
        ))}

        {xTicks.map((t, i) => (
          <g key={`x-${i}`}>
            <text x={t.x - 8} y={height - 5} fill="#64748b" fontSize="9">{t.km.toFixed(1)}</text>
          </g>
        ))}

        <path d={areaPath} fill="url(#profArea)" stroke="none" />
        <path d={path} fill="none" stroke="url(#profGrad)" strokeWidth="2.5" strokeLinecap="round" />

        <circle cx={scaleX(highest.km)} cy={scaleY(highest.elevationM)} r="2.5" fill="#60a5fa" />
        <line x1={scaleX(highest.km) + 4} y1={scaleY(highest.elevationM) - 4} x2={scaleX(highest.km) + 40} y2={scaleY(highest.elevationM) - 8} stroke="#60a5fa" strokeWidth="0.8" />
        <text x={scaleX(highest.km) + 42} y={scaleY(highest.elevationM) - 8} fill="#93c5fd" fontSize="9">{highest.elevationM.toFixed(0)} m</text>

        <circle cx={scaleX(lowest.km)} cy={scaleY(lowest.elevationM)} r="2.5" fill="#f43f5e" />
        <line x1={scaleX(lowest.km) + 4} y1={scaleY(lowest.elevationM) + 4} x2={scaleX(lowest.km) + 40} y2={scaleY(lowest.elevationM) + 8} stroke="#f43f5e" strokeWidth="0.8" />
        <text x={scaleX(lowest.km) + 42} y={scaleY(lowest.elevationM) + 8} fill="#fda4af" fontSize="9">{lowest.elevationM.toFixed(0)} m</text>
      </svg>
      <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500">
        <span>{series[0].elevationM.toFixed(0)} m inicio</span>
        <span>{(maxEle - minEle).toFixed(0)} m desnivel</span>
        <span>{series[series.length - 1].elevationM.toFixed(0)} m final</span>
      </div>
    </div>
  );
}
