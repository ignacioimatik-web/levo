'use client';

import { useMemo } from 'react';

interface ProfilePoint {
  km: number;
  elevationM: number;
}

const W = 760;
const H = 220;
const PAD_X = 46;
const PAD_TOP = 20;
const PAD_BOTTOM = 34;
const WINDOW_KM = 20;

export default function SegmentMiniMap({
  profileSeries,
  totalKm,
  startKm,
  endKm,
  type,
}: {
  profileSeries: ProfilePoint[];
  totalKm: number;
  startKm: number;
  endKm: number;
  type: 'climb' | 'descent' | 'flat';
}) {
  const color = type === 'climb' ? '#000000' : type === 'descent' ? '#ef4444' : '#f59e0b';

  const { windowPoints, segPoints, minEle, maxEle, windowStart, windowEnd } = useMemo(() => {
    if (!profileSeries.length) return { windowPoints: [], segPoints: [], minEle: 0, maxEle: 0, windowStart: 0, windowEnd: 0 };

    const midKm = (startKm + endKm) / 2;
    const halfWindow = Math.min(WINDOW_KM / 2, totalKm / 2);
    const ws = Math.max(0, midKm - halfWindow);
    const we = Math.min(totalKm, midKm + halfWindow);

    const visible = profileSeries.filter(p => p.km >= ws && p.km <= we);
    if (visible.length < 2) return { windowPoints: [], segPoints: [], minEle: 0, maxEle: 0, windowStart: ws, windowEnd: we };

    const seg = profileSeries.filter(p => p.km >= startKm && p.km <= endKm);
    const els = visible.map(p => p.elevationM);

    return {
      windowPoints: visible,
      segPoints: seg,
      minEle: Math.min(...els),
      maxEle: Math.max(...els),
      windowStart: ws,
      windowEnd: we,
    };
  }, [profileSeries, totalKm, startKm, endKm]);

  if (windowPoints.length < 2) return null;

  const rangeEle = Math.max(1, maxEle - minEle);
  const windowWidth = Math.max(0.1, windowEnd - windowStart);

  const scaleX = (km: number) => PAD_X + ((km - windowStart) / windowWidth) * (W - PAD_X * 2);
  const scaleY = (ele: number) => {
    if (maxEle === minEle) return H / 2;
    return PAD_TOP + ((maxEle - ele) / rangeEle) * (H - PAD_TOP - PAD_BOTTOM);
  };

  const fullPath = windowPoints
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(p.km).toFixed(2)} ${scaleY(p.elevationM).toFixed(2)}`)
    .join(' ');

  const segPath = segPoints.length >= 2
    ? segPoints
        .map((p, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(p.km).toFixed(2)} ${scaleY(p.elevationM).toFixed(2)}`)
        .join(' ')
    : '';

  const segAreaPath = segPoints.length >= 2
    ? `${segPath} L ${scaleX(segPoints[segPoints.length - 1].km).toFixed(2)} ${(H - PAD_BOTTOM).toFixed(2)} L ${scaleX(segPoints[0].km).toFixed(2)} ${(H - PAD_BOTTOM).toFixed(2)} Z`
    : '';

  const yTicks = Array.from({ length: 4 }, (_, i) => {
    const pct = i / 3;
    const ele = maxEle - rangeEle * pct;
    return { ele: Math.round(ele), y: scaleY(ele) };
  });

  const xTicks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => {
    const km = windowStart + windowWidth * ratio;
    return { km, x: scaleX(km) };
  });

  const highest = segPoints.length >= 2
    ? segPoints.reduce((best, p) => (p.elevationM > best.elevationM ? p : best), segPoints[0])
    : null;
  const lowest = segPoints.length >= 2
    ? segPoints.reduce((best, p) => (p.elevationM < best.elevationM ? p : best), segPoints[0])
    : null;

  const titleLabel = type === 'climb' ? 'Subida' : type === 'descent' ? 'Bajada' : 'Transición';

  return (
    <div className="mt-3 bg-slate-900/60 border border-white/5 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
          <span className="text-sm font-bold text-white">{titleLabel}</span>
          {segPoints.length >= 2 && (
            <span className="text-xs text-slate-400">
              km {segPoints[0].km.toFixed(1)}–{segPoints[segPoints.length - 1].km.toFixed(1)}
            </span>
          )}
        </div>
        <span className="text-[11px] text-slate-500">Contexto {windowStart.toFixed(1)}–{windowEnd.toFixed(1)} km ({(windowEnd - windowStart).toFixed(1)} km)</span>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto cursor-crosshair" style={{ aspectRatio: `${W} / ${H}` }}>
        <defs>
          <linearGradient id="segLineGlow" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#22c55e" />
            <stop offset="50%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#ef4444" />
          </linearGradient>
          <linearGradient id="segAreaGlow" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.2" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>

        <rect x={0} y={0} width={W} height={H} fill="transparent" />

        {yTicks.map((t, i) => (
          <g key={`y-${i}`}>
            <line x1={PAD_X} y1={t.y} x2={W - PAD_X} y2={t.y} stroke="#334155" strokeWidth="1" strokeDasharray="4 4" />
            <text x={8} y={t.y + 4} fill="#94a3b8" fontSize="10">{t.ele} m</text>
          </g>
        ))}

        {xTicks.map((t, i) => (
          <g key={`x-${i}`}>
            <line x1={t.x} y1={H - PAD_BOTTOM} x2={t.x} y2={H - PAD_BOTTOM + 4} stroke="#64748b" strokeWidth="1" />
            <text x={t.x - 10} y={H - 8} fill="#94a3b8" fontSize="10">{t.km.toFixed(1)} km</text>
          </g>
        ))}

        <path d={fullPath} fill="none" stroke="#1e293b" strokeWidth="2" strokeLinejoin="round" />

        {segAreaPath && <path d={segAreaPath} fill="url(#segAreaGlow)" stroke="none" />}
        {segPath && <path d={segPath} fill="none" stroke="url(#segLineGlow)" strokeWidth="3" strokeLinecap="round" />}

        {segPoints.length >= 2 && (
          <>
            <circle cx={scaleX(segPoints[0].km)} cy={scaleY(segPoints[0].elevationM)} r="3" fill="#22c55e" />
            <circle cx={scaleX(segPoints[segPoints.length - 1].km)} cy={scaleY(segPoints[segPoints.length - 1].elevationM)} r="3" fill={color} />

            {highest && (highest.km !== segPoints[0].km && highest.km !== segPoints[segPoints.length - 1].km) && (
              <>
                <circle cx={scaleX(highest.km)} cy={scaleY(highest.elevationM)} r="3.2" fill="#60a5fa" />
                <text x={scaleX(highest.km) + 6} y={scaleY(highest.elevationM) - 8} fill="#93c5fd" fontSize="10">MAX {highest.elevationM.toFixed(0)} m</text>
              </>
            )}

            {lowest && (lowest.km !== segPoints[0].km && lowest.km !== segPoints[segPoints.length - 1].km) && (
              <>
                <circle cx={scaleX(lowest.km)} cy={scaleY(lowest.elevationM)} r="3.2" fill="#f43f5e" />
                <text x={scaleX(lowest.km) + 6} y={scaleY(lowest.elevationM) + 12} fill="#fda4af" fontSize="10">MIN {lowest.elevationM.toFixed(0)} m</text>
              </>
            )}
          </>
        )}
      </svg>

      {segPoints.length >= 2 && (
        <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px]">
          <div className="bg-slate-950/50 border border-white/5 rounded px-2 py-1.5 text-slate-300">
            Inicio: {segPoints[0].elevationM.toFixed(0)} m
          </div>
          <div className="bg-slate-950/50 border border-white/5 rounded px-2 py-1.5 text-slate-300">
            Final: {segPoints[segPoints.length - 1].elevationM.toFixed(0)} m
          </div>
          <div className="bg-slate-950/50 border border-white/5 rounded px-2 py-1.5 text-slate-300">
            Rango: {(highest && lowest ? highest.elevationM - lowest.elevationM : 0).toFixed(0)} m
          </div>
          <div className="bg-slate-950/50 border border-white/5 rounded px-2 py-1.5 text-slate-300">
            {type === 'climb' ? 'Subida' : type === 'descent' ? 'Bajada' : 'Tramo'}: {(segPoints[segPoints.length - 1].km - segPoints[0].km).toFixed(2)} km
          </div>
        </div>
      )}
    </div>
  );
}
