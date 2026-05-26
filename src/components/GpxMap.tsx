'use client';

import { useState, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, Polyline, CircleMarker, useMap } from 'react-leaflet';
import type { LatLngExpression } from 'leaflet';
import { TrailPoint } from '@/data/trails';
import { parseGPX } from '@/lib/gpx-utils';
import { Map } from 'lucide-react';
import 'leaflet/dist/leaflet.css';

interface GpxMapProps {
  coordinates?: TrailPoint[];
  gpxUrl?: string;
  title?: string;
  fallbackMessage?: string;
  focusStartKm?: number;
  focusEndKm?: number;
  focusPointKm?: number;
  segmentOverlays?: Array<{ startKm: number; endKm: number; type: 'climb' | 'descent' | 'flat' }>;
}

function buildCumulativeKm(coords: LatLngExpression[]): number[] {
  const out = [0];
  for (let i = 1; i < coords.length; i++) {
    const a = coords[i - 1] as number[];
    const b = coords[i] as number[];
    const dx = (b[0] - a[0]) * 111;
    const dy = (b[1] - a[1]) * 111;
    const approxKm = Math.sqrt(dx * dx + dy * dy);
    out.push(out[out.length - 1] + approxKm);
  }
  return out;
}

function segmentSlice(coords: LatLngExpression[], startKm: number, endKm: number) {
  if (coords.length < 2) return null;
  const cum = buildCumulativeKm(coords);
  let startIdx = 0;
  let endIdx = coords.length - 1;
  for (let i = 0; i < cum.length; i++) {
    if (cum[i] >= startKm) {
      startIdx = i;
      break;
    }
  }
  for (let i = startIdx; i < cum.length; i++) {
    if (cum[i] >= endKm) {
      endIdx = i;
      break;
    }
  }
  const slice = coords.slice(startIdx, Math.max(endIdx + 1, startIdx + 2));
  if (slice.length < 2) return null;
  return slice;
}

function segmentBounds(coords: LatLngExpression[], startKm: number, endKm: number) {
  const slice = segmentSlice(coords, startKm, endKm);
  if (!slice) return null;
  const lats = slice.map((c) => (c as number[])[0]);
  const lngs = slice.map((c) => (c as number[])[1]);
  return [
    [Math.min(...lats), Math.min(...lngs)],
    [Math.max(...lats), Math.max(...lngs)],
  ] as [[number, number], [number, number]];
}

function pointAtKm(coords: LatLngExpression[], km: number) {
  if (coords.length < 2) return null;
  const cum = buildCumulativeKm(coords);
  for (let i = 0; i < cum.length; i++) {
    if (cum[i] >= km) return coords[i] as [number, number];
  }
  return coords[coords.length - 1] as [number, number];
}

function MapController({ coords, focusStartKm, focusEndKm, focusPointKm }: { coords: LatLngExpression[]; focusStartKm?: number; focusEndKm?: number; focusPointKm?: number }) {
  const map = useMap();
  useEffect(() => {
    if (coords.length > 1) {
      if (typeof focusPointKm === 'number') {
        const pt = pointAtKm(coords, focusPointKm);
        if (pt) {
          map.setView(pt, 15, { animate: true });
          return;
        }
      }
      if (typeof focusStartKm === 'number' && typeof focusEndKm === 'number' && focusEndKm > focusStartKm) {
        const bounds = segmentBounds(coords, focusStartKm, focusEndKm);
        if (bounds) {
          map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
          return;
        }
      }
      const lats = coords.map(c => (c as number[])[0]);
      const lngs = coords.map(c => (c as number[])[1]);
      map.fitBounds([
        [Math.min(...lats), Math.min(...lngs)],
        [Math.max(...lats), Math.max(...lngs)]
      ], { padding: [40, 40], maxZoom: 15 });
    }
  }, [coords, map, focusStartKm, focusEndKm, focusPointKm]);
  return null;
}

export default function GpxMap({ coordinates, gpxUrl, title, fallbackMessage, focusStartKm, focusEndKm, focusPointKm, segmentOverlays }: GpxMapProps) {
  const [trackCoords, setTrackCoords] = useState<LatLngExpression[]>(
    coordinates ? coordinates.map(p => [p.lat, p.lng] as LatLngExpression) : []
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (gpxUrl && !coordinates) {
      const fetchGpx = async () => {
        setLoading(true);
        setError(false);
        try {
          const res = await fetch(gpxUrl);
          if (!res.ok) throw new Error('Failed to fetch GPX');
          const text = await res.text();
          const parsed = parseGPX(text);
          setTrackCoords(parsed.map(p => [p.lat, p.lng] as LatLngExpression));
        } catch (e) {
          console.error(e);
          setError(true);
        } finally {
          setLoading(false);
        }
      };
      fetchGpx();
    }
  }, [gpxUrl, coordinates]);

  if ((!trackCoords.length || error) && !loading) {
    return (
      <div className="w-full h-[300px] bg-slate-900/50 border-2 border-dashed border-slate-700 rounded-2xl flex flex-col items-center justify-center text-center p-6">
        <Map className="w-12 h-12 text-slate-700 mb-3" />
        <p className="text-slate-400 text-sm font-bold">{title || 'Mapa no disponible'}</p>
        <p className="text-slate-600 text-xs mt-1">{fallbackMessage || 'Próximamente disponible'}</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-[300px] rounded-2xl overflow-hidden border border-white/5 shadow-xl">
      {loading && (
        <div className="absolute inset-0 z-[1000] bg-slate-950/60 flex items-center justify-center backdrop-blur-sm">
          <p className="text-white text-xs font-bold animate-pulse">Cargando trazado...</p>
        </div>
      )}
      <MapContainer
        center={[40.62, -0.12]}
        zoom={13}
        className="w-full h-full"
        zoomControl={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {trackCoords.length > 1 && (
          <Polyline 
            positions={trackCoords} 
            pathOptions={{ color: '#64748b', weight: 4, opacity: 0.6, lineCap: 'round' }} 
          />
        )}
        {segmentOverlays?.map((seg, idx) => {
          const slice = segmentSlice(trackCoords, seg.startKm, seg.endKm);
          if (!slice) return null;
          const color = seg.type === 'climb' ? '#000000' : seg.type === 'descent' ? '#ef4444' : '#f59e0b';
          return (
            <Polyline
              key={`seg-${idx}`}
              positions={slice}
              pathOptions={{ color, weight: 5, opacity: 0.9, lineCap: 'round' }}
            />
          );
        })}
        {typeof focusPointKm === 'number' && pointAtKm(trackCoords, focusPointKm) && (
          <CircleMarker
            center={pointAtKm(trackCoords, focusPointKm)!}
            radius={7}
            pathOptions={{ color: '#f97316', fillColor: '#fb923c', fillOpacity: 0.9, weight: 2 }}
          />
        )}
        <MapController coords={trackCoords} focusStartKm={focusStartKm} focusEndKm={focusEndKm} focusPointKm={focusPointKm} />
      </MapContainer>
    </div>
  );
}
