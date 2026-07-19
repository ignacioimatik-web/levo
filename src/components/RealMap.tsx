'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { MapContainer, Polyline, useMap, Tooltip } from 'react-leaflet';
import type { LatLngExpression } from 'leaflet';
import { MTBTrail, TrailDifficulty } from '@/data/trails';
import { getTrailDifficultyLabel } from '@/lib/trail-utils';
import 'leaflet/dist/leaflet.css';
import ResilientRasterTileLayer from '@/components/map/ResilientRasterTileLayer';

const DIFFICULTY_BASE: Record<TrailDifficulty, { weight: number; opacity: number }> = {
  green: { weight: 4, opacity: 0.85 },
  blue: { weight: 4, opacity: 0.85 },
  red: { weight: 4, opacity: 0.85 },
  black: { weight: 4, opacity: 0.85 },
  'double-black': { weight: 4, opacity: 0.85 },
  unclassified: { weight: 3, opacity: 0.55 },
};

const DIFFICULTY_HOVER: Record<TrailDifficulty, number> = {
  green: 7, blue: 7, red: 7, black: 7, 'double-black': 7, unclassified: 5,
};

const DIFFICULTY_SELECTED: Record<TrailDifficulty, number> = {
  green: 8, blue: 8, red: 8, black: 8, 'double-black': 8, unclassified: 6,
};

const DIFFICULTY_COLORS: Record<TrailDifficulty, string> = {
  green: '#22c55e',
  blue: '#60a5fa',
  red: '#f87171',
  black: '#cbd5e1',
  'double-black': '#f1f5f9',
  unclassified: '#64748b',
};

const DEFAULT_CENTER: [number, number] = [40.622, -0.125];
const DEFAULT_ZOOM = 13;

function toLatLng(trail: MTBTrail): LatLngExpression[] {
  return (trail.coordinates ?? []).map(p => [p.lat, p.lng] as LatLngExpression);
}

function getBounds(trails: MTBTrail[]): [[number, number], [number, number]] | null {
  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
  for (const t of trails) {
    for (const c of (t.coordinates ?? [])) {
      if (c.lat < minLat) minLat = c.lat;
      if (c.lat > maxLat) maxLat = c.lat;
      if (c.lng < minLng) minLng = c.lng;
      if (c.lng > maxLng) maxLng = c.lng;
    }
  }
  if (!isFinite(minLat)) return null;
  return [[minLat, minLng], [maxLat, maxLng]];
}

function hasCoords(trail: MTBTrail): boolean {
  return !!(trail.coordinates && trail.coordinates.length > 1);
}

function DifficultyLegend() {
  const difficulties: TrailDifficulty[] = ['green', 'blue', 'red', 'black'];
  return (
    <div className="absolute bottom-4 left-4 z-[1000] bg-[#0a0e1a]/90 border border-white/10 rounded-lg px-3 py-2 shadow-2xl">
      <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mb-1.5">Leyenda</p>
      <div className="space-y-1">
        {difficulties.map(d => (
          <div key={d} className="flex items-center gap-2">
            <span className="inline-block w-4 h-0.5 rounded-full" style={{ backgroundColor: DIFFICULTY_COLORS[d] }} />
            <span className="text-[10px] text-slate-400 font-bold">{getTrailDifficultyLabel(d)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MapController({ selectedTrailId, trails }: {
  selectedTrailId: string | null;
  trails: MTBTrail[];
}) {
  const map = useMap();
  const prevSelected = useRef<string | null>(null);
  const initialFitDone = useRef(false);

  useEffect(() => {
    if (selectedTrailId && selectedTrailId !== prevSelected.current) {
      const trail = trails.find(t => t.id === selectedTrailId);
      if (trail && hasCoords(trail)) {
        const coords = toLatLng(trail);
        if (coords.length > 1) {
          map.flyToBounds(coords as unknown as [[number, number], [number, number]], {
            padding: [60, 60],
            maxZoom: 15,
            duration: 1,
          });
        }
      }
      prevSelected.current = selectedTrailId;
    }
  }, [selectedTrailId, trails, map]);

  useEffect(() => {
    if (initialFitDone.current) return;
    const withCoords = trails.filter(hasCoords);
    if (withCoords.length === 0) return;
    const bounds = getBounds(withCoords);
    if (bounds) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
      initialFitDone.current = true;
    }
  }, [trails, map]);

  return null;
}

function TrailPolyline({ trail, isHovered, isSelected, onMouseEnter, onMouseLeave, onClick }: {
  trail: MTBTrail;
  isHovered: boolean;
  isSelected: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onClick: () => void;
}) {
  const coords = toLatLng(trail);
  if (coords.length < 2) return null;

  const color = DIFFICULTY_COLORS[trail.difficulty];
  const base = DIFFICULTY_BASE[trail.difficulty];
  const weight = isSelected ? DIFFICULTY_SELECTED[trail.difficulty]
    : isHovered ? DIFFICULTY_HOVER[trail.difficulty]
    : base.weight;
  const opacity = isSelected ? 1 : isHovered ? 1 : base.opacity;
  const isPlaceholder = trail.dataStatus === 'placeholder';
  const isDouble = trail.difficulty === 'double-black';

  return (
    <>
      {isDouble && (
        <Polyline
          positions={coords}
          pathOptions={{
            color,
            weight: weight + 3,
            opacity: 0.15,
            lineCap: 'round',
            lineJoin: 'round',
          }}
        />
      )}
      <Polyline
        positions={coords}
        pathOptions={{
          color,
          weight,
          opacity,
          lineCap: 'round',
          lineJoin: 'round',
          dashArray: isPlaceholder ? (isSelected || isHovered ? undefined : '6 4') : undefined,
        }}
        eventHandlers={{
          mouseover: onMouseEnter,
          mouseout: onMouseLeave,
          click: onClick,
        }}
      >
        <Tooltip
          direction="top"
          offset={[0, -8]}
          className="bg-slate-900 border border-white/10 text-white text-xs font-bold px-2 py-1 rounded-lg shadow-xl"
        >
          {trail.name}
          {isPlaceholder && (
            <span className="block text-[9px] text-amber-400/70 font-medium">Datos demo</span>
          )}
        </Tooltip>
      </Polyline>
    </>
  );
}

interface RealMapProps {
  trails: MTBTrail[];
  selectedTrailId?: string | null;
  onTrailSelect?: (trailId: string | null) => void;
}

export default function RealMap({ trails, selectedTrailId, onTrailSelect }: RealMapProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const handleSelect = useCallback((id: string | null) => {
    if (id === null) { onTrailSelect?.(null); return; }
    onTrailSelect?.(selectedTrailId === id ? null : id);
  }, [selectedTrailId, onTrailSelect]);

  const hasPlaceholderTrails = trails.some(t => t.dataStatus === 'placeholder');

  return (
    <div className="relative w-full h-[500px] lg:h-[600px] rounded-3xl overflow-hidden border border-white/5 shadow-2xl ring-1 ring-white/[0.02]">
      <MapContainer
        center={DEFAULT_CENTER}
        zoom={DEFAULT_ZOOM}
        className="w-full h-full"
        zoomControl={true}
        scrollWheelZoom={true}
      >
        <ResilientRasterTileLayer />

        <MapController
          selectedTrailId={selectedTrailId ?? null}
          trails={trails}
        />

        {trails.map(trail => (
          <TrailPolyline
            key={trail.id}
            trail={trail}
            isHovered={hoveredId === trail.id}
            isSelected={selectedTrailId === trail.id}
            onMouseEnter={() => setHoveredId(trail.id)}
            onMouseLeave={() => setHoveredId(null)}
            onClick={() => handleSelect(trail.id)}
          />
        ))}
      </MapContainer>

      <DifficultyLegend />

      {hasPlaceholderTrails && (
        <div className="absolute top-4 right-4 z-[1000] bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg pointer-events-none">
          Algunos senderos son datos demo
        </div>
      )}
    </div>
  );
}
