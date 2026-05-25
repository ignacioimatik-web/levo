'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Polyline, CircleMarker, useMap, Tooltip } from 'react-leaflet';
import type { LatLngExpression } from 'leaflet';
import { MTBTrail, TrailDifficulty } from '@/data/trails';
import { getTrailDifficultyLabel } from '@/lib/trail-utils';
import 'leaflet/dist/leaflet.css';

const DIFFICULTY_STYLES: Record<TrailDifficulty, { color: string; weight: number; opacity: number }> = {
  green: { color: '#22c55e', weight: 4, opacity: 0.85 },
  blue: { color: '#60a5fa', weight: 4, opacity: 0.85 },
  red: { color: '#f87171', weight: 4, opacity: 0.85 },
  black: { color: '#cbd5e1', weight: 4, opacity: 0.85 },
  'double-black': { color: '#f1f5f9', weight: 4, opacity: 0.85 },
  unclassified: { color: '#64748b', weight: 3, opacity: 0.5 },
};

const DIFFICULTY_HOVER: Record<TrailDifficulty, { weight: number; opacity: number }> = {
  green: { weight: 7, opacity: 1 },
  blue: { weight: 7, opacity: 1 },
  red: { weight: 7, opacity: 1 },
  black: { weight: 7, opacity: 1 },
  'double-black': { weight: 7, opacity: 1 },
  unclassified: { weight: 5, opacity: 0.8 },
};

const DIFFICULTY_SELECTED: Record<TrailDifficulty, { weight: number; opacity: number }> = {
  green: { weight: 8, opacity: 1 },
  blue: { weight: 8, opacity: 1 },
  red: { weight: 8, opacity: 1 },
  black: { weight: 8, opacity: 1 },
  'double-black': { weight: 8, opacity: 1 },
  unclassified: { weight: 6, opacity: 0.9 },
};

const SECTOR_POSITIONS: Record<string, [number, number]> = {
  'Sector Demo A': [40.632, -0.088],
  'Sector Demo B': [40.620, -0.120],
  'Sector Demo C': [40.608, -0.155],
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

function hasRealCoordinates(trail: MTBTrail): boolean {
  return !!(trail.coordinates && trail.coordinates.length > 0);
}

function DifficultyLegend() {
  const difficulties: TrailDifficulty[] = ['green', 'blue', 'red', 'black'];
  return (
    <div className="absolute bottom-4 left-4 z-[1000] bg-[#0a0e1a]/90 border border-white/10 rounded-lg px-3 py-2 shadow-2xl">
      <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mb-1.5">Leyenda</p>
      <div className="space-y-1">
        {difficulties.map(d => (
          <div key={d} className="flex items-center gap-2">
            <span className="inline-block w-4 h-0.5 rounded-full" style={{ backgroundColor: DIFFICULTY_STYLES[d].color }} />
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
      if (trail && hasRealCoordinates(trail)) {
        const coords = toLatLng(trail);
        if (coords.length > 0) {
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
    const coordsTrails = trails.filter(hasRealCoordinates);
    if (coordsTrails.length === 0) return;
    const bounds = getBounds(coordsTrails);
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
  if (coords.length === 0) return null;

  const base = DIFFICULTY_STYLES[trail.difficulty];
  const hover = DIFFICULTY_HOVER[trail.difficulty];
  const selected = DIFFICULTY_SELECTED[trail.difficulty];
  const active = isSelected ? selected : isHovered ? hover : base;

  const isDouble = trail.difficulty === 'double-black';

  return (
    <>
      {isDouble && (
        <Polyline
          positions={coords}
          pathOptions={{
            color: base.color,
            weight: active.weight + 3,
            opacity: 0.2,
            lineCap: 'round',
            lineJoin: 'round',
          }}
        />
      )}
      <Polyline
        positions={coords}
        pathOptions={{
          color: base.color,
          weight: active.weight,
          opacity: active.opacity,
          lineCap: 'round',
          lineJoin: 'round',
        }}
        eventHandlers={{
          mouseover: onMouseEnter,
          mouseout: onMouseLeave,
          click: onClick,
        }}
      />
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
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapController
          selectedTrailId={selectedTrailId ?? null}
          trails={trails}
        />

        {trails.map(trail => {
          if (hasRealCoordinates(trail)) {
            return (
              <TrailPolyline
                key={trail.id}
                trail={trail}
                isHovered={hoveredId === trail.id}
                isSelected={selectedTrailId === trail.id}
                onMouseEnter={() => setHoveredId(trail.id)}
                onMouseLeave={() => setHoveredId(null)}
                onClick={() => handleSelect(trail.id)}
              />
            );
          }

          const pos = SECTOR_POSITIONS[trail.sector] ?? DEFAULT_CENTER;
          const isSelected = selectedTrailId === trail.id;
          const isHovered = hoveredId === trail.id;
          const isActive = isSelected || isHovered;

          return (
            <CircleMarker
              key={trail.id}
              center={pos}
              radius={isActive ? 10 : 7}
              pathOptions={{
                color: DIFFICULTY_STYLES[trail.difficulty].color,
                fillColor: DIFFICULTY_STYLES[trail.difficulty].color,
                fillOpacity: isActive ? 0.9 : 0.5,
                weight: isActive ? 3 : 2,
                opacity: isActive ? 1 : 0.7,
              }}
              eventHandlers={{
                mouseover: () => setHoveredId(trail.id),
                mouseout: () => setHoveredId(null),
                click: () => handleSelect(trail.id),
              }}
            >
              <Tooltip direction="top" offset={[0, -8]} className="text-xs font-bold">
                {trail.name}
                <span className="block text-[10px] text-slate-400 font-normal">
                  {trail.dataStatus === 'placeholder' ? 'Datos demo — GPX pendiente' : ''}
                </span>
              </Tooltip>
            </CircleMarker>
          );
        })}
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
