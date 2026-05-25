'use client';

/* GPX: This is the provisional SVG map component.
   When migrating to real GPX data, replace this file with a Leaflet or MapLibre
   component that reads trail.coordinates and renders Polylines.
   See /docs/forfait-gpx.md §5 for migration options. */

import { useState, useCallback, useMemo } from 'react';
import { MTBTrail, TrailDifficulty } from '@/data/trails';
import { demoMapPaths, type DemoPathData } from '@/data/map-demo-paths';
import { getTrailDifficultyLabel } from '@/lib/trail-utils';

const DIFFICULTY_COLORS: Record<TrailDifficulty, { stroke: string; glow: string }> = {
  green: { stroke: '#22c55e', glow: 'rgba(34,197,94,0.5)' },
  blue: { stroke: '#60a5fa', glow: 'rgba(96,165,250,0.5)' },
  red: { stroke: '#f87171', glow: 'rgba(248,113,113,0.5)' },
  black: { stroke: '#cbd5e1', glow: 'rgba(203,213,225,0.4)' },
  'double-black': { stroke: '#f1f5f9', glow: 'rgba(241,245,249,0.4)' },
  unclassified: { stroke: '#64748b', glow: 'rgba(100,116,139,0.25)' },
};

const DIFFICULTY_NODE_COLORS: Record<TrailDifficulty, string> = {
  green: '#22c55e',
  blue: '#3b82f6',
  red: '#ef4444',
  black: '#94a3b8',
  'double-black': '#f1f5f9',
  unclassified: '#64748b',
};

interface ForfaitMapProps {
  trails: MTBTrail[];
  selectedTrailId?: string | null;
  onTrailSelect?: (trailId: string | null) => void;
}

const contourLines = [
  { d: "M 0 50 Q 200 20, 400 70 T 1000 80", weight: 0.3 },
  { d: "M 0 110 Q 250 80, 500 130 T 1000 140", weight: 0.5 },
  { d: "M 0 170 Q 300 140, 550 190 T 1000 200", weight: 0.3 },
  { d: "M 0 230 Q 200 200, 450 250 T 1000 260", weight: 0.7 },
  { d: "M 0 290 Q 250 260, 500 310 T 1000 320", weight: 0.3 },
  { d: "M 0 350 Q 300 320, 550 370 T 1000 380", weight: 0.5 },
  { d: "M 0 410 Q 200 380, 450 430 T 1000 440", weight: 0.3 },
  { d: "M 0 470 Q 250 440, 500 490 T 1000 500", weight: 0.7 },
  { d: "M 0 530 Q 300 500, 550 550 T 1000 560", weight: 0.3 },
  { d: "M 0 590 Q 200 560, 450 610 T 1000 620", weight: 0.5 },
  { d: "M 0 650 Q 250 620, 500 670 T 1000 680", weight: 0.3 },
];

const peakAreas = [
  { d: "M 380 180 Q 420 100, 480 140 Q 520 90, 560 150 Q 520 200, 380 180 Z", label: "Alto del Demo", labelX: 470, labelY: 95, elevation: "1.524 m" },
  { d: "M 720 120 Q 760 60, 810 100 Q 860 50, 890 110 Q 840 170, 720 120 Z", label: "Pic Demo", labelX: 805, labelY: 60, elevation: "1.847 m" },
  { d: "M 150 500 Q 200 430, 270 470 Q 320 420, 360 480 Q 300 540, 150 500 Z", label: "Mola Demo", labelX: 255, labelY: 425, elevation: "1.312 m" },
];

const sectorLabels = [
  { x: 225, y: 140, label: "Sector Demo A" },
  { x: 500, y: 250, label: "Sector Demo B" },
  { x: 800, y: 280, label: "Sector Demo C" },
];

function getTrailColor(difficulty: TrailDifficulty) {
  return DIFFICULTY_COLORS[difficulty];
}

function getNodeColor(difficulty: TrailDifficulty) {
  return DIFFICULTY_NODE_COLORS[difficulty];
}

export default function ForfaitMap({ trails, selectedTrailId: externalSelectedId, onTrailSelect: externalOnSelect }: ForfaitMapProps) {
  const [hoveredTrailId, setHoveredTrailId] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; trail: MTBTrail } | null>(null);
  const [internalSelectedId, setInternalSelectedId] = useState<string | null>(null);

  const selectedTrailId = externalSelectedId ?? internalSelectedId;

  const onTrailSelect = externalOnSelect ?? setInternalSelectedId;

  const trailMap = useMemo(() => {
    const map = new Map<string, MTBTrail>();
    for (const t of trails) map.set(t.id, t);
    return map;
  }, [trails]);

  /* GPX: Replace demoMapPaths with a projection of trail.coordinates.
     Each trail with coordinates → projected SVG path using a mercator-like
     transform function. See /docs/forfait-gpx.md §5. */
  const pathMap = useMemo(() => {
    const map = new Map<string, DemoPathData>();
    for (const p of demoMapPaths) map.set(p.trailId, p);
    return map;
  }, []);

  const handleMouseEnter = useCallback((e: React.MouseEvent<SVGPathElement>, trailId: string) => {
    setHoveredTrailId(trailId);
    const trail = trailMap.get(trailId);
    if (!trail) return;
    const rect = (e.currentTarget.closest('svg') as SVGSVGElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setTooltip({ x, y, trail });
  }, [trailMap]);

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGPathElement>, trailId: string) => {
    if (!tooltip || tooltip.trail.id !== trailId) return;
    const rect = (e.currentTarget.closest('svg') as SVGSVGElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setTooltip(prev => prev ? { ...prev, x, y } : null);
  }, [tooltip]);

  const handleMouseLeave = useCallback((_e: React.MouseEvent<SVGPathElement>) => {
    setHoveredTrailId(null);
    setTooltip(null);
  }, []);

  const handleClick = useCallback((trailId: string) => {
    if (selectedTrailId === trailId) {
      onTrailSelect?.(null);
    } else {
      onTrailSelect?.(trailId);
    }
  }, [selectedTrailId, onTrailSelect]);

  const hasPlaceholderTrails = trails.some(t => t.dataStatus === "placeholder");

  return (
    <div className="relative w-full aspect-[1000/700] bg-[#060a14] rounded-3xl overflow-hidden border border-white/5 shadow-2xl ring-1 ring-white/[0.02]">
      <svg
        viewBox="0 0 1000 700"
        className="w-full h-full"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <filter id="trail-glow">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="trail-glow-hover">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="trail-glow-selected">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="blur" />
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <linearGradient id="peak-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(255,255,255,0.04)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
          <linearGradient id="peak-shade" x1="0" y1="0.3" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(0,0,0,0)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.3)" />
          </linearGradient>
          <radialGradient id="peak-glow" cx="0.5" cy="0.3" r="0.6">
            <stop offset="0%" stopColor="rgba(249,115,22,0.06)" />
            <stop offset="100%" stopColor="rgba(249,115,22,0)" />
          </radialGradient>
          <pattern id="map-grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.008)" strokeWidth="0.5" />
          </pattern>
        </defs>

        {/* Grid overlay */}
        <rect width="1000" height="700" fill="url(#map-grid)" pointerEvents="none" />

        {/* Topo contour lines */}
        {contourLines.map((c, i) => (
          <path
            key={`contour-${i}`}
            d={c.d}
            fill="none"
            stroke="rgba(255,255,255,0.02)"
            strokeWidth={c.weight}
          />
        ))}

        {/* Mountain peaks */}
        {peakAreas.map((peak, i) => (
          <g key={`peak-${i}`}>
            <path d={peak.d} fill="url(#peak-grad)" />
            <path d={peak.d} fill="url(#peak-shade)" />
            <path d={peak.d} fill="url(#peak-glow)" />
            {/* Peak elevation mark */}
            <line
              x1={peak.labelX - 15}
              y1={peak.labelY + 18}
              x2={peak.labelX}
              y2={peak.labelY + 12}
              stroke="rgba(255,255,255,0.06)"
              strokeWidth={0.5}
            />
            <text
              x={peak.labelX}
              y={peak.labelY}
              textAnchor="middle"
              fill="rgba(255,255,255,0.08)"
              fontSize="10"
              fontFamily="system-ui"
              fontWeight="bold"
              letterSpacing="2"
            >
              {peak.label}
            </text>
            <text
              x={peak.labelX}
              y={peak.labelY + 14}
              textAnchor="middle"
              fill="rgba(255,255,255,0.05)"
              fontSize="7"
              fontFamily="system-ui"
            >
              {peak.elevation}
            </text>
          </g>
        ))}

        {/* Sector labels */}
        {sectorLabels.map((s, i) => (
          <text
            key={`sector-${i}`}
            x={s.x}
            y={s.y}
            textAnchor="middle"
            fill="rgba(255,255,255,0.06)"
            fontSize="16"
            fontFamily="system-ui"
            fontWeight="bold"
            letterSpacing="3"
          >
            {s.label}
          </text>
        ))}

        {/* GPX: Replace demoMapPaths.map with trail iteration.
           For each trail with coordinates[], project lat/lng to SVG coordinates
           using a simple mercator fit, then render <path> + nodes. */}
        {/* Trail lines */}
        {demoMapPaths.map((mp) => {
          const trail = trailMap.get(mp.trailId);
          if (!trail) return null;

          const colors = getTrailColor(trail.difficulty);
          const isHovered = hoveredTrailId === mp.trailId;
          const isSelected = selectedTrailId === mp.trailId;
          const isActive = isHovered || isSelected;
          const isDoubleBlack = trail.difficulty === "double-black";

          return (
            <g key={mp.trailId}>
              {isDoubleBlack && (
                <path
                  d={mp.path}
                  fill="none"
                  stroke={colors.stroke}
                  strokeWidth={isActive ? 7 : 5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={0.25}
                  transform="translate(2, -2)"
                  pointerEvents="none"
                />
              )}
              <path
                d={mp.path}
                fill="none"
                stroke={colors.stroke}
                strokeWidth={isActive ? 5 : 3.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={isActive ? 1 : 0.7}
                filter={isActive ? (isSelected ? "url(#trail-glow-selected)" : "url(#trail-glow-hover)") : undefined}
                style={{ transition: "stroke-width 0.2s, opacity 0.2s" }}
                className="cursor-pointer"
                onMouseEnter={(e) => handleMouseEnter(e, mp.trailId)}
                onMouseMove={(e) => handleMouseMove(e, mp.trailId)}
                onMouseLeave={handleMouseLeave}
                onClick={() => handleClick(mp.trailId)}
              />

              {/* Start node */}
              <circle
                cx={mp.startX}
                cy={mp.startY}
                r={isActive ? 5 : 3.5}
                fill={getNodeColor(trail.difficulty)}
                stroke={isActive ? colors.stroke : 'transparent'}
                strokeWidth={isActive ? 2 : 0}
                opacity={isActive ? 1 : 0.5}
                className="cursor-pointer"
                onMouseEnter={(e) => handleMouseEnter(e, mp.trailId)}
                onMouseMove={(e) => handleMouseMove(e, mp.trailId)}
                onMouseLeave={handleMouseLeave}
                onClick={() => handleClick(mp.trailId)}
              />
              <circle
                cx={mp.startX}
                cy={mp.startY}
                r={isActive ? 5 : 3.5}
                fill="none"
                stroke="rgba(255,255,255,0.3)"
                strokeWidth={1}
                opacity={isActive ? 1 : 0.5}
                className="cursor-pointer"
                pointerEvents="none"
              />

              {/* End node (skip if loop) */}
              {(mp.startX !== mp.endX || mp.startY !== mp.endY) && (
                <circle
                  cx={mp.endX}
                  cy={mp.endY}
                  r={isActive ? 4 : 2.5}
                  fill={getNodeColor(trail.difficulty)}
                  stroke={isSelected ? colors.stroke : 'none'}
                  strokeWidth={isSelected ? 2 : 0}
                  opacity={isActive ? 1 : 0.5}
                  className="cursor-pointer"
                  onMouseEnter={(e) => handleMouseEnter(e, mp.trailId)}
                  onMouseMove={(e) => handleMouseMove(e, mp.trailId)}
                  onMouseLeave={handleMouseLeave}
                  onClick={() => handleClick(mp.trailId)}
                />
              )}
            </g>
          );
        })}

        {/* Trail name labels on hover */}
        {hoveredTrailId && tooltip && (
          <g>
            <rect
              x={tooltip.x + 12}
              y={tooltip.y - 28}
              width={120}
              height={22}
              rx={6}
              fill="#0f172a"
              stroke="rgba(255,255,255,0.15)"
              strokeWidth={1}
              opacity={0.95}
            />
            <text
              x={tooltip.x + 18}
              y={tooltip.y - 13}
              fill="white"
              fontSize="10"
              fontFamily="system-ui"
              fontWeight="bold"
            >
              {tooltip.trail.name}
            </text>
          </g>
        )}

        {/* Map legend overlay */}
        <g>
          <rect x={16} y={624} width={140} height={64} rx={8} fill="#0a0e1a" opacity={0.9} stroke="rgba(255,255,255,0.08)" strokeWidth={1} />
          <text x={26} y={638} fill="#64748b" fontSize="7" fontFamily="system-ui" fontWeight="bold" letterSpacing="1.5">
            LEYENDA
          </text>
          {(["green", "blue", "red", "black"] as TrailDifficulty[]).map((d, i) => {
            const c = DIFFICULTY_COLORS[d];
            return (
              <g key={`legend-${d}`}>
                <line x1={26} y1={650 + i * 12} x2={42} y2={650 + i * 12} stroke={c.stroke} strokeWidth={3} strokeLinecap="round" />
                <text x={48} y={654 + i * 12} fill="#94a3b8" fontSize="8" fontFamily="system-ui" fontWeight="bold">
                  {getTrailDifficultyLabel(d)}
                </text>
              </g>
            );
          })}
        </g>

        {/* Selection indicator */}
        {selectedTrailId && (
          <g>
            <rect x={16} y={600} width={180} height={20} rx={6} fill="#0a0e1a" opacity={0.9} stroke="rgba(249,115,22,0.2)" strokeWidth={0.5} />
            <text x={26} y={613} fill="#f97316" fontSize="8" fontFamily="system-ui" fontWeight="bold">
              {trailMap.get(selectedTrailId)?.name}
            </text>
          </g>
        )}
      </svg>

      {/* Placeholder notice */}
      {hasPlaceholderTrails && (
        <div className="absolute top-4 right-4 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg pointer-events-none">
          Plano provisional — datos demo
        </div>
      )}
    </div>
  );
}
