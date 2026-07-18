'use client';

import { useMemo } from 'react';
import { distanceBetween } from '@/lib/activities/geo';
import type { RidePoint } from '@/lib/activities/types';

export default function ActivityElevationProfile({ points }: { points: RidePoint[] }) {
  const profile = useMemo(() => {
    const valid = points.filter((point) => point.elevation != null);
    if (valid.length < 2) return null;
    const distances = [0];
    for (let index = 1; index < valid.length; index += 1) {
      distances.push(distances[index - 1] + distanceBetween(valid[index - 1], valid[index]));
    }
    const elevations = valid.map((point) => point.elevation as number);
    const min = Math.min(...elevations);
    const max = Math.max(...elevations);
    const distanceRange = Math.max(distances.at(-1) ?? 0, 1);
    const elevationRange = Math.max(max - min, 1);
    const path = valid.map((point, index) => {
      const x = distances[index] / distanceRange * 100;
      const y = 92 - ((point.elevation as number) - min) / elevationRange * 76;
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
    }).join(' ');
    return { path, min, max };
  }, [points]);

  if (!profile) {
    return <div className="grid h-44 place-items-center text-sm text-slate-500">Esta grabación no contiene altitud.</div>;
  }

  return (
    <div className="relative h-44">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full" role="img" aria-label="Perfil de elevación">
        <defs>
          <linearGradient id="activity-elevation-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fb923c" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#fb923c" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path d={`${profile.path} L 100 100 L 0 100 Z`} fill="url(#activity-elevation-fill)" />
        <path d={profile.path} fill="none" stroke="#fb923c" strokeWidth="1.8" vectorEffect="non-scaling-stroke" />
      </svg>
      <span className="absolute left-2 top-2 rounded bg-slate-950/70 px-2 py-1 text-[10px] font-bold">{Math.round(profile.max)} m</span>
      <span className="absolute bottom-2 left-2 rounded bg-slate-950/70 px-2 py-1 text-[10px] font-bold">{Math.round(profile.min)} m</span>
    </div>
  );
}
