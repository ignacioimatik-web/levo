'use client';

import { useMemo, useState } from 'react';
import type { KeyboardEventHandler, MouseEventHandler } from 'react';

interface ProfilePoint {
  km: number;
  elevationM: number;
}

export default function ContinuousProfile({ series }: { series: ProfilePoint[] }) {
  if (!series.length) return null;
  const width = 760;
  const height = 220;
  const padX = 46;
  const padTop = 20;
  const padBottom = 34;
  const minEle = Math.min(...series.map((p) => p.elevationM));
  const maxEle = Math.max(...series.map((p) => p.elevationM));
  const maxKm = Math.max(...series.map((p) => p.km), 1);
  const rangeEle = Math.max(1, maxEle - minEle);
  const scaleX = (km: number) => padX + (km / maxKm) * (width - padX * 2);
  const scaleY = (ele: number) => {
    if (maxEle === minEle) return height / 2;
    return padTop + ((maxEle - ele) / rangeEle) * (height - padTop - padBottom);
  };

  const highestPoint = series.reduce((best, p) => (p.elevationM > best.elevationM ? p : best), series[0]);
  const lowestPoint = series.reduce((best, p) => (p.elevationM < best.elevationM ? p : best), series[0]);

  const path = series
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(p.km).toFixed(2)} ${scaleY(p.elevationM).toFixed(2)}`)
    .join(' ');

  const areaPath = `${path} L ${scaleX(series[series.length - 1].km).toFixed(2)} ${(height - padBottom).toFixed(2)} L ${scaleX(series[0].km).toFixed(2)} ${(height - padBottom).toFixed(2)} Z`;

  const yTicks = Array.from({ length: 4 }, (_, i) => {
    const pct = i / 3;
    const ele = maxEle - rangeEle * pct;
    const y = scaleY(ele);
    return { ele: Math.round(ele), y };
  });

  const xTicks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => ({
    km: maxKm * ratio,
    x: scaleX(maxKm * ratio),
  }));

  const points = series.map((p) => ({ ...p, x: scaleX(p.km), y: scaleY(p.elevationM) }));
  const [hover, setHover] = useState<{ idx: number; x: number; y: number } | null>(null);
  const [lockedIdx, setLockedIdx] = useState<number | null>(null);

  const onMove: MouseEventHandler<SVGSVGElement> = (ev) => {
    const rect = ev.currentTarget.getBoundingClientRect();
    const relX = ((ev.clientX - rect.left) / rect.width) * width;
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < points.length; i++) {
      const d = Math.abs(points[i].x - relX);
      if (d < bestDist) {
        best = i;
        bestDist = d;
      }
    }
    setHover({ idx: best, x: points[best].x, y: points[best].y });
  };

  const onClick: MouseEventHandler<SVGSVGElement> = () => {
    if (!hover) return;
    setLockedIdx(hover.idx);
  };

  const onKeyDown: KeyboardEventHandler<HTMLDivElement> = (ev) => {
    if (!points.length) return;
    if (ev.key === 'Escape') {
      setLockedIdx(null);
      return;
    }
    if (ev.key !== 'ArrowLeft' && ev.key !== 'ArrowRight') return;
    ev.preventDefault();
    const step = Math.max(1, Math.floor(points.length / 120));
    const base = lockedIdx ?? hover?.idx ?? 0;
    const next = ev.key === 'ArrowRight' ? Math.min(points.length - 1, base + step) : Math.max(0, base - step);
    setLockedIdx(next);
    setHover({ idx: next, x: points[next].x, y: points[next].y });
  };

  const activeIdx = hover?.idx ?? lockedIdx ?? null;
  const hoveredPoint = activeIdx !== null ? points[activeIdx] : null;
  const prev = activeIdx !== null && activeIdx > 0 ? points[activeIdx - 1] : null;

  const localSlopePct = prev && hoveredPoint
    ? (() => {
        const dKm = Math.max(0.0001, hoveredPoint.km - prev.km);
        const dM = hoveredPoint.elevationM - prev.elevationM;
        return (dM / (dKm * 1000)) * 100;
      })()
    : 0;

  const clickedMax = useMemo(() => {
    if (activeIdx === null) return null;
    const anchor = lockedIdx ?? activeIdx;
    const from = Math.max(0, anchor);
    const to = points.length - 1;
    let maxI = from;
    for (let i = from + 1; i <= to; i++) {
      if (points[i].elevationM > points[maxI].elevationM) maxI = i;
    }
    return { idx: maxI, ...points[maxI] };
  }, [activeIdx, lockedIdx, points]);

  return (
    <div className="bg-slate-900/60 border border-white/5 rounded-xl p-4" tabIndex={0} onKeyDown={onKeyDown}>
      <h3 className="text-white font-bold mb-3">Coronel Perdido — Perfil altimétrico continuo</h3>
      <p className="text-xs text-slate-400 mb-3">
        Eje horizontal: kilómetros. Eje vertical: altitud (m).
      </p>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto cursor-crosshair" role="img" aria-label="Perfil altimétrico" onMouseMove={onMove} onMouseLeave={() => setHover(null)} onClick={onClick}>
        <defs>
          <linearGradient id="cpElevLine" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#22c55e" />
            <stop offset="50%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#ef4444" />
          </linearGradient>
          <linearGradient id="cpElevArea" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#f97316" stopOpacity="0.24" />
            <stop offset="100%" stopColor="#f97316" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width={width} height={height} fill="transparent" />

        {yTicks.map((t, i) => (
          <g key={`y-${i}`}>
            <line x1={padX} y1={t.y} x2={width - padX} y2={t.y} stroke="#334155" strokeWidth="1" strokeDasharray="4 4" />
            <text x={8} y={t.y + 4} fill="#94a3b8" fontSize="10">{t.ele} m</text>
          </g>
        ))}

        {xTicks.map((t, i) => (
          <g key={`x-${i}`}>
            <line x1={t.x} y1={height - padBottom} x2={t.x} y2={height - padBottom + 4} stroke="#64748b" strokeWidth="1" />
            <text x={t.x - 10} y={height - 8} fill="#94a3b8" fontSize="10">{t.km.toFixed(1)} km</text>
          </g>
        ))}

        <path d={areaPath} fill="url(#cpElevArea)" stroke="none" />
        <path d={path} fill="none" stroke="url(#cpElevLine)" strokeWidth="3" strokeLinecap="round" />

        <circle cx={scaleX(series[0].km)} cy={scaleY(series[0].elevationM)} r="3" fill="#22c55e" />
        <circle cx={scaleX(series[series.length - 1].km)} cy={scaleY(series[series.length - 1].elevationM)} r="3" fill="#f97316" />
        <circle cx={scaleX(highestPoint.km)} cy={scaleY(highestPoint.elevationM)} r="3.2" fill="#60a5fa" />
        <circle cx={scaleX(lowestPoint.km)} cy={scaleY(lowestPoint.elevationM)} r="3.2" fill="#f43f5e" />

        <text x={scaleX(highestPoint.km) + 6} y={scaleY(highestPoint.elevationM) - 8} fill="#93c5fd" fontSize="10">MAX {highestPoint.elevationM.toFixed(0)} m</text>
        <text x={scaleX(lowestPoint.km) + 6} y={scaleY(lowestPoint.elevationM) + 12} fill="#fda4af" fontSize="10">MIN {lowestPoint.elevationM.toFixed(0)} m</text>

        {hoveredPoint && (
          <g>
            <line x1={hoveredPoint.x} y1={padTop} x2={hoveredPoint.x} y2={height - padBottom} stroke="#e2e8f0" strokeDasharray="4 4" strokeWidth="1" />
            <circle cx={hoveredPoint.x} cy={hoveredPoint.y} r="4" fill="#f8fafc" stroke="#f97316" strokeWidth="2" />
          </g>
        )}

        {clickedMax && (
          <g>
            <circle cx={clickedMax.x} cy={clickedMax.y} r="4" fill="#38bdf8" stroke="#0ea5e9" strokeWidth="2" />
            <text x={clickedMax.x + 6} y={clickedMax.y - 8} fill="#7dd3fc" fontSize="10">MAX restante {clickedMax.elevationM.toFixed(0)} m</text>
          </g>
        )}
      </svg>
      <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px]">
        <div className="bg-slate-950/50 border border-white/5 rounded px-2 py-1.5 text-slate-300">Inicio: {series[0].elevationM.toFixed(0)} m</div>
        <div className="bg-slate-950/50 border border-white/5 rounded px-2 py-1.5 text-slate-300">Final: {series[series.length - 1].elevationM.toFixed(0)} m</div>
        <div className="bg-slate-950/50 border border-white/5 rounded px-2 py-1.5 text-slate-300">Rango: {(maxEle - minEle).toFixed(0)} m</div>
        <div className="bg-slate-950/50 border border-white/5 rounded px-2 py-1.5 text-slate-300">Total: {maxKm.toFixed(1)} km</div>
      </div>
      {hoveredPoint && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
          <span className="px-2 py-1 rounded bg-slate-950/60 border border-white/10 text-slate-200">km {hoveredPoint.km.toFixed(2)}</span>
          <span className="px-2 py-1 rounded bg-slate-950/60 border border-white/10 text-slate-200">altitud {hoveredPoint.elevationM.toFixed(0)} m</span>
          <span className="px-2 py-1 rounded bg-slate-950/60 border border-white/10 text-slate-200">pendiente punto {localSlopePct >= 0 ? '+' : ''}{localSlopePct.toFixed(1)}%</span>
        </div>
      )}
      <p className="mt-2 text-[11px] text-slate-500">Tip: click fija ancla para MAX restante; flechas izquierda/derecha para navegar, Escape para liberar.</p>
    </div>
  );
}
