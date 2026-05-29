'use client';

import { useState, useMemo, useCallback, useRef, useEffect, type MouseEventHandler, type KeyboardEventHandler } from 'react';
import type { TrackPoint } from '@/lib/forfait/types';
import { buildProfileSeries } from '@/lib/forfait/geo-utils';

export interface RouteHoverData {
  km: number;
  elevationM: number;
  slopePct: number;
  trend: 'subiendo' | 'bajando' | 'llano';
  cumulativeGainM: number;
  cumulativeLossM: number;
}

export default function ContinuousProfile({ points, onHoverKm }: {
  points: TrackPoint[];
  onHoverKm?: (data: RouteHoverData | null) => void;
}) {
  const series = useMemo(() => buildProfileSeries(points), [points]);

  const [hover, setHover] = useState<{ idx: number; x: number; y: number } | null>(null);
  const [lockedIdx, setLockedIdx] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [cWidth, setCWidth] = useState(760);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      for (const e of entries) setCWidth(Math.round(e.contentRect.width));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (!series.length) {
    return (
      <div className="bg-slate-900/60 border border-white/5 rounded-xl p-4 h-full flex items-center justify-center">
        <p className="text-xs text-slate-500">Perfil de elevación disponible cuando los tracks incluyan datos de altitud.</p>
      </div>
    );
  }

  const height = 180;
  const padX = 50;
  const padTop = 20;
  const padBottom = 34;
  const minEle = Math.min(...series.map(p => p.elevationM));
  const maxEle = Math.max(...series.map(p => p.elevationM));
  const maxKm = Math.max(...series.map(p => p.km), 1);
  const rangeEle = Math.max(1, maxEle - minEle);
  const innerW = cWidth - padX * 2;

  const scaleX = (km: number) => padX + (km / maxKm) * innerW;
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

  const xTicks = [0, 0.25, 0.5, 0.75, 1].map(ratio => ({
    km: maxKm * ratio,
    x: scaleX(maxKm * ratio),
  }));

  const mapped = series.map(p => ({ ...p, x: scaleX(p.km), y: scaleY(p.elevationM) }));

  const emitHover = useCallback((idx: number | null) => {
    if (idx === null) { onHoverKm?.(null); return; }
    const p = mapped[idx];
    const pr = idx > 0 ? mapped[idx - 1] : null;
    const tr = pr && p
      ? p.elevationM > pr.elevationM + 1 ? 'subiendo'
        : p.elevationM < pr.elevationM - 1 ? 'bajando' : 'llano'
      : 'llano';
    const slope = pr && p
      ? (() => {
          const dKm = Math.max(0.0001, p.km - pr.km);
          const dM = p.elevationM - pr.elevationM;
          return (dM / (dKm * 1000)) * 100;
        })()
      : 0;
    let cumGain = 0, cumLoss = 0;
    for (let i = 1; i <= idx; i++) {
      const d = mapped[i].elevationM - mapped[i - 1].elevationM;
      if (d > 1) cumGain += d;
      if (d < -1) cumLoss += Math.abs(d);
    }
    onHoverKm?.({ km: p.km, elevationM: p.elevationM, slopePct: slope, trend: tr, cumulativeGainM: cumGain, cumulativeLossM: cumLoss });
  }, [mapped, onHoverKm]);

  const onMove: MouseEventHandler<SVGSVGElement> = useCallback((ev) => {
    const rect = ev.currentTarget.getBoundingClientRect();
    const relX = ((ev.clientX - rect.left) / rect.width) * cWidth;
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < mapped.length; i++) {
      const d = Math.abs(mapped[i].x - relX);
      if (d < bestDist) { best = i; bestDist = d; }
    }
    setHover({ idx: best, x: mapped[best].x, y: mapped[best].y });
    emitHover(best);
  }, [mapped, cWidth, emitHover]);

  const onClick: MouseEventHandler<SVGSVGElement> = useCallback(() => {
    if (!hover) return;
    setLockedIdx(hover.idx);
  }, [hover]);

  const onLeave = useCallback(() => {
    setHover(null);
    if (!lockedIdx) emitHover(null);
  }, [lockedIdx, emitHover]);

  const onKeyDown: KeyboardEventHandler<HTMLDivElement> = useCallback((ev) => {
    if (!mapped.length) return;
    if (ev.key === 'Escape') {
      setLockedIdx(null);
      emitHover(null);
      return;
    }
    if (ev.key !== 'ArrowLeft' && ev.key !== 'ArrowRight') return;
    ev.preventDefault();
    const step = Math.max(1, Math.floor(mapped.length / 120));
    const base = lockedIdx ?? hover?.idx ?? 0;
    const next = ev.key === 'ArrowRight' ? Math.min(mapped.length - 1, base + step) : Math.max(0, base - step);
    setLockedIdx(next);
    setHover({ idx: next, x: mapped[next].x, y: mapped[next].y });
    emitHover(next);
  }, [mapped, lockedIdx, hover?.idx, emitHover]);

  const activeIdx = hover?.idx ?? lockedIdx ?? null;
  const hoveredPoint = activeIdx !== null ? mapped[activeIdx] : null;
  const prev = activeIdx !== null && activeIdx > 0 ? mapped[activeIdx - 1] : null;
  const trend = prev && hoveredPoint
    ? hoveredPoint.elevationM > prev.elevationM + 1 ? 'subiendo'
      : hoveredPoint.elevationM < prev.elevationM - 1 ? 'bajando' : 'llano'
    : 'llano';

  const localSlopePct = prev && hoveredPoint
    ? (() => {
        const dKm = Math.max(0.0001, hoveredPoint.km - prev.km);
        const dM = hoveredPoint.elevationM - prev.elevationM;
        return (dM / (dKm * 1000)) * 100;
      })()
    : 0;

  const cumulative = useMemo(() => {
    const out: Array<{ gainM: number; lossM: number }> = [];
    let gain = 0, loss = 0;
    for (let i = 0; i < mapped.length; i++) {
      if (i > 0) {
        const d = mapped[i].elevationM - mapped[i - 1].elevationM;
        if (d > 1) gain += d;
        if (d < -1) loss += Math.abs(d);
      }
      out.push({ gainM: gain, lossM: loss });
    }
    return out;
  }, [mapped]);

  const activeCum = activeIdx !== null ? cumulative[activeIdx] : null;
  const activeKm = hoveredPoint?.km ?? 0;
  const gainPctAtPoint = activeCum && activeKm > 0 ? (activeCum.gainM / (activeKm * 1000)) * 100 : 0;
  const lossPctAtPoint = activeCum && activeKm > 0 ? (activeCum.lossM / (activeKm * 1000)) * 100 : 0;

  const clickedMax = useMemo(() => {
    if (activeIdx === null) return null;
    const anchor = lockedIdx ?? activeIdx;
    const from = Math.max(0, anchor);
    const to = mapped.length - 1;
    let maxI = from;
    for (let i = from + 1; i <= to; i++) {
      if (mapped[i].elevationM > mapped[maxI].elevationM) maxI = i;
    }
    return { idx: maxI, ...mapped[maxI] };
  }, [activeIdx, lockedIdx, mapped]);

  return (
    <div ref={containerRef} className="h-full" tabIndex={0} onKeyDown={onKeyDown}>
      <div className="flex items-center justify-between mb-0.5 px-1">
        <h4 className="text-[10px] font-bold text-white uppercase tracking-wider">Perfil altimétrico continuo</h4>
      </div>
      <svg viewBox={`0 0 ${cWidth} ${height}`} className="w-full h-[calc(100%-28px)] cursor-crosshair" role="img" aria-label="Perfil altimétrico" onMouseMove={onMove} onMouseLeave={onLeave} onClick={onClick} preserveAspectRatio="none">
        <defs>
          <linearGradient id="elevLine2" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#22c55e" />
            <stop offset="50%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#ef4444" />
          </linearGradient>
          <linearGradient id="elevArea2" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#f97316" stopOpacity="0.24" />
            <stop offset="100%" stopColor="#f97316" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width={cWidth} height={height} fill="transparent" />

        {yTicks.map((t, i) => (
          <g key={`y-${i}`}>
            <line x1={padX} y1={t.y} x2={cWidth - padX} y2={t.y} stroke="#334155" strokeWidth="1" strokeDasharray="4 4" />
            <text x={6} y={t.y + 3} fill="#94a3b8" fontSize="9">{t.ele} m</text>
          </g>
        ))}

        {xTicks.map((t, i) => (
          <g key={`x-${i}`}>
            <line x1={t.x} y1={height - padBottom} x2={t.x} y2={height - padBottom + 4} stroke="#64748b" strokeWidth="1" />
            <text x={t.x - 10} y={height - 8} fill="#94a3b8" fontSize="9">{t.km.toFixed(1)} km</text>
          </g>
        ))}

        <path d={areaPath} fill="url(#elevArea2)" stroke="none" />
        <path d={path} fill="none" stroke="url(#elevLine2)" strokeWidth="2.5" strokeLinecap="round" />

        <circle cx={scaleX(series[0].km)} cy={scaleY(series[0].elevationM)} r="3" fill="#22c55e" />
        <circle cx={scaleX(series[series.length - 1].km)} cy={scaleY(series[series.length - 1].elevationM)} r="3" fill="#f97316" />
        <circle cx={scaleX(highestPoint.km)} cy={scaleY(highestPoint.elevationM)} r="3" fill="#60a5fa" />
        <circle cx={scaleX(lowestPoint.km)} cy={scaleY(lowestPoint.elevationM)} r="3" fill="#f43f5e" />

        <text x={scaleX(highestPoint.km) + 5} y={scaleY(highestPoint.elevationM) - 6} fill="#93c5fd" fontSize="8">MAX {highestPoint.elevationM.toFixed(0)} m</text>
        <text x={scaleX(lowestPoint.km) + 5} y={scaleY(lowestPoint.elevationM) + 10} fill="#fda4af" fontSize="8">MIN {lowestPoint.elevationM.toFixed(0)} m</text>

        {hoveredPoint && (
          <g>
            <line x1={hoveredPoint.x} y1={padTop} x2={hoveredPoint.x} y2={height - padBottom} stroke="#e2e8f0" strokeDasharray="4 4" strokeWidth="1" />
            <circle cx={hoveredPoint.x} cy={hoveredPoint.y} r="3.5" fill="#f8fafc" stroke="#f97316" strokeWidth="2" />
          </g>
        )}

        {clickedMax && (
          <g>
            <circle cx={clickedMax.x} cy={clickedMax.y} r="3.5" fill="#38bdf8" stroke="#0ea5e9" strokeWidth="2" />
            <text x={clickedMax.x + 5} y={clickedMax.y - 6} fill="#7dd3fc" fontSize="8">MAX restante {clickedMax.elevationM.toFixed(0)} m</text>
          </g>
        )}
      </svg>
      {hoveredPoint && (
        <div className="flex flex-wrap items-center gap-1.5 text-[9px] px-1 pt-0.5">
          <span className="px-1.5 py-0.5 rounded bg-slate-950/60 border border-white/10 text-slate-200">{hoveredPoint.km.toFixed(2)} km</span>
          <span className="px-1.5 py-0.5 rounded bg-slate-950/60 border border-white/10 text-slate-200">{hoveredPoint.elevationM.toFixed(0)} m</span>
          <span className="px-1.5 py-0.5 rounded bg-slate-950/60 border border-white/10 capitalize text-slate-200">{trend}</span>
          <span className="px-1.5 py-0.5 rounded bg-slate-950/60 border border-white/10 text-slate-200">{localSlopePct >= 0 ? '+' : ''}{localSlopePct.toFixed(1)}%</span>
          <span className="px-1.5 py-0.5 rounded bg-slate-950/60 border border-white/10 text-green-300">+{gainPctAtPoint.toFixed(1)}%</span>
          <span className="px-1.5 py-0.5 rounded bg-slate-950/60 border border-white/10 text-red-300">-{lossPctAtPoint.toFixed(1)}%</span>
          {lockedIdx !== null && <span className="px-1.5 py-0.5 rounded bg-blue-500/15 border border-blue-500/30 text-blue-300">fijado</span>}
        </div>
      )}
    </div>
  );
}
