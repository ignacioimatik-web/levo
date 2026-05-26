'use client';

import { useState, useEffect, useLayoutEffect, useCallback } from 'react';
import { MapContainer, TileLayer, Polyline, CircleMarker, useMap } from 'react-leaflet';
import type { LatLngExpression } from 'leaflet';
import { TrailPoint } from '@/data/trails';
import { parseGPX, haversineKm } from '@/lib/gpx-utils';
import { useTrailHover } from '@/lib/trail-hover-context';
import { Map, Maximize2, Minimize2 } from 'lucide-react';
import 'leaflet/dist/leaflet.css';

interface GpxMapProps {
  coordinates?: TrailPoint[];
  gpxUrl?: string;
  preparsedPoints?: Array<{ lat: number; lng: number }>;
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
    const d = haversineKm(a[0], a[1], b[0], b[1]);
    out.push(out[out.length - 1] + d);
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

function MapController({ coords, focusStartKm, focusEndKm, focusPointKm, maximized }: { coords: LatLngExpression[]; focusStartKm?: number; focusEndKm?: number; focusPointKm?: number; maximized?: boolean }) {
  const map = useMap();
  useLayoutEffect(() => {
    map.invalidateSize();
  }, [maximized, map]);
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

function HoverMarker({ coords }: { coords: LatLngExpression[] }) {
  const { hoveredKm } = useTrailHover();
  if (typeof hoveredKm !== 'number') return null;
  const pt = pointAtKm(coords, hoveredKm);
  if (!pt) return null;
  return (
    <CircleMarker
      center={pt}
      radius={6}
      pathOptions={{ color: '#ffffff', fillColor: '#38bdf8', fillOpacity: 0.9, weight: 2.5 }}
    />
  );
}

export default function GpxMap({ coordinates, gpxUrl, preparsedPoints, title, fallbackMessage, focusStartKm, focusEndKm, focusPointKm, segmentOverlays }: GpxMapProps) {
  const [maximized, setMaximized] = useState(false);
  const [trackCoords, setTrackCoords] = useState<LatLngExpression[]>(
    preparsedPoints
      ? preparsedPoints.map(p => [p.lat, p.lng] as LatLngExpression)
      : coordinates
        ? coordinates.map(p => [p.lat, p.lng] as LatLngExpression)
        : []
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (preparsedPoints) {
      setTrackCoords(preparsedPoints.map(p => [p.lat, p.lng] as LatLngExpression));
      return;
    }
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
  }, [gpxUrl, coordinates, preparsedPoints]);

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
    <>
      {maximized && (
        <div className="fixed inset-0 z-[9999] bg-slate-950">
          <button
            onClick={() => setMaximized(false)}
            className="absolute bottom-3 left-3 z-[1000] flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider border transition-colors bg-slate-950/80 backdrop-blur-sm border-white/10 text-slate-300 hover:bg-slate-800 hover:text-white"
            aria-label="Minimizar mapa"
          >
            <Minimize2 className="w-3.5 h-3.5" />
            Minimizar
          </button>
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
            <HoverMarker coords={trackCoords} />
            <MapController coords={trackCoords} focusStartKm={focusStartKm} focusEndKm={focusEndKm} focusPointKm={focusPointKm} maximized={maximized} />
          </MapContainer>
        </div>
      )}
      <div className={`relative w-full h-[400px] rounded-2xl overflow-hidden border border-white/5 shadow-xl bg-slate-950 ${maximized ? 'hidden' : ''}`}>
        {!maximized && (
          <button
            onClick={() => setMaximized(true)}
            className="absolute bottom-3 left-3 z-[1000] flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider border transition-colors bg-slate-950/80 backdrop-blur-sm border-white/10 text-slate-300 hover:bg-slate-800 hover:text-white"
            aria-label="Maximizar mapa"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            Maximizar
          </button>
        )}
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
        <HoverMarker coords={trackCoords} />
        <MapController coords={trackCoords} focusStartKm={focusStartKm} focusEndKm={focusEndKm} focusPointKm={focusPointKm} maximized={maximized} />
      </MapContainer>
    </div>
    </>
  );
}
