'use client';

import { useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef } from 'react';
import { Map, Source, Layer, Marker, NavigationControl, useMap } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import { TrailPoint } from '@/data/trails';
import { parseGPX, haversineKm } from '@/lib/gpx-utils';
import { useTrailHover } from '@/lib/trail-hover-context';
import { MapIcon, Maximize2, Minimize2 } from 'lucide-react';

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

function buildCumulativeKm(coords: [number, number][]): number[] {
  const out = [0];
  for (let i = 1; i < coords.length; i++) {
    const a = coords[i - 1];
    const b = coords[i];
    const d = haversineKm(a[0], a[1], b[0], b[1]);
    out.push(out[out.length - 1] + d);
  }
  return out;
}

function segmentSlice(coords: [number, number][], startKm: number, endKm: number) {
  if (coords.length < 2) return null;
  const cum = buildCumulativeKm(coords);
  let startIdx = 0, endIdx = coords.length - 1;
  for (let i = 0; i < cum.length; i++) {
    if (cum[i] >= startKm) { startIdx = i; break; }
  }
  for (let i = startIdx; i < cum.length; i++) {
    if (cum[i] >= endKm) { endIdx = i; break; }
  }
  const slice = coords.slice(startIdx, Math.max(endIdx + 1, startIdx + 2));
  return slice.length >= 2 ? slice : null;
}

function pointAtKm(coords: [number, number][], km: number): [number, number] | null {
  if (coords.length < 2) return null;
  const cum = buildCumulativeKm(coords);
  for (let i = 0; i < cum.length; i++) {
    if (cum[i] >= km) return coords[i];
  }
  return coords[coords.length - 1];
}

function FitController({ coords, focusStartKm, focusEndKm, focusPointKm, maximized }:
  { coords: [number, number][]; focusStartKm?: number; focusEndKm?: number; focusPointKm?: number; maximized?: boolean }) {
  const { current: mapRef } = useMap();
  const fitted = useRef(false);

  useLayoutEffect(() => {
    if (mapRef) mapRef.resize();
  }, [maximized, mapRef]);

  useEffect(() => {
    if (!mapRef || coords.length < 2) return;
    if (typeof focusPointKm === 'number') {
      const pt = pointAtKm(coords, focusPointKm);
      if (pt) {
        mapRef.flyTo({ center: pt, zoom: 15, duration: 500 });
        return;
      }
    }
    if (typeof focusStartKm === 'number' && typeof focusEndKm === 'number' && focusEndKm > focusStartKm) {
      const slice = segmentSlice(coords, focusStartKm, focusEndKm);
      if (slice) {
        const lats = slice.map(c => c[0]);
        const lngs = slice.map(c => c[1]);
        mapRef.fitBounds(
          [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
          { padding: 50, maxZoom: 16 },
        );
        return;
      }
    }
    const lats = coords.map(c => c[0]);
    const lngs = coords.map(c => c[1]);
    mapRef.fitBounds(
      [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
      { padding: 40, maxZoom: 15 },
    );
  }, [coords, mapRef, focusStartKm, focusEndKm, focusPointKm]);

  return null;
}

function HoverMarker({ coords }: { coords: [number, number][] }) {
  const { hoveredKm } = useTrailHover();
  if (typeof hoveredKm !== 'number') return null;
  const pt = pointAtKm(coords, hoveredKm);
  if (!pt) return null;
  return (
    <Marker longitude={pt[1]} latitude={pt[0]} anchor="center">
      <div style={{
        width: 12, height: 12, borderRadius: '50%',
        background: '#38bdf8', border: '2.5px solid #fff',
        boxShadow: '0 0 8px rgba(56,189,248,0.6)',
      }} />
    </Marker>
  );
}

function toLngLatCoords(points: Array<{ lat: number; lng: number }>): [number, number][] {
  return points.map(p => [p.lat, p.lng] as [number, number]);
}

function toGeoJSONLine(coords: [number, number][]): GeoJSON.Feature<GeoJSON.LineString> {
  return {
    type: 'Feature',
    geometry: { type: 'LineString', coordinates: coords.map(c => [c[1], c[0]] as [number, number]) },
    properties: null,
  };
}

export default function GpxMap({ coordinates, gpxUrl, preparsedPoints, title, fallbackMessage, focusStartKm, focusEndKm, focusPointKm, segmentOverlays }: GpxMapProps) {
  const [maximized, setMaximized] = useState(false);
  const [trackCoords, setTrackCoords] = useState<[number, number][]>(
    preparsedPoints
      ? toLngLatCoords(preparsedPoints)
      : coordinates
        ? toLngLatCoords(coordinates)
        : []
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (preparsedPoints) {
      setTrackCoords(toLngLatCoords(preparsedPoints));
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
          setTrackCoords(parsed.map(p => [p.lat, p.lng] as [number, number]));
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

  const trackGeoJSON = useMemo(() => {
    if (trackCoords.length < 2) return null;
    return toGeoJSONLine(trackCoords);
  }, [trackCoords]);

  if ((!trackCoords.length || error) && !loading) {
    return (
      <div className="w-full h-[300px] bg-slate-900/50 border-2 border-dashed border-slate-700 rounded-2xl flex flex-col items-center justify-center text-center p-6">
        <MapIcon className="w-12 h-12 text-slate-700 mb-3" />
        <p className="text-slate-400 text-sm font-bold">{title || 'Mapa no disponible'}</p>
        <p className="text-slate-600 text-xs mt-1">{fallbackMessage || 'Próximamente disponible'}</p>
      </div>
    );
  }

  const mapContent = (inline: boolean) => (
    <>
      <Map
        mapStyle="mapbox://styles/mapbox/outdoors-v12"
        mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
        initialViewState={{ latitude: 40.62, longitude: -0.12, zoom: 13, pitch: 50 }}
        terrain={{ source: 'mapbox-dem', exaggeration: 1.2 }}
        style={{ width: '100%', height: '100%' }}
      >
        <Source id="mapbox-dem" type="raster-dem" url="mapbox://mapbox.mapbox-terrain-dem-v1" />

        {trackGeoJSON && (
          <Source id="track-line-source" type="geojson" data={trackGeoJSON}>
            <Layer
              id="track-line"
              type="line"
              source="track-line-source"
              layout={{
                'line-cap': 'round',
                'line-join': 'round',
              }}
              paint={{
                'line-color': '#64748b',
                'line-width': 4,
                'line-opacity': 0.6,
              }}
            />
          </Source>
        )}

        {segmentOverlays?.map((seg, idx) => {
          const slice = segmentSlice(trackCoords, seg.startKm, seg.endKm);
          if (!slice) return null;
          const color = seg.type === 'climb' ? '#000000' : seg.type === 'descent' ? '#ef4444' : '#f59e0b';
          return (
            <Source key={`seg-${idx}`} id={`seg-source-${idx}`} type="geojson" data={toGeoJSONLine(slice)}>
              <Layer
                id={`seg-line-${idx}`}
                type="line"
                source={`seg-source-${idx}`}
                layout={{
                  'line-cap': 'round',
                }}
                paint={{
                  'line-color': color,
                  'line-width': 5,
                  'line-opacity': 0.9,
                }}
              />
            </Source>
          );
        })}

        {typeof focusPointKm === 'number' && pointAtKm(trackCoords, focusPointKm) && (
          <Marker longitude={pointAtKm(trackCoords, focusPointKm)![1]} latitude={pointAtKm(trackCoords, focusPointKm)![0]} anchor="center">
            <div style={{
              width: 14, height: 14, borderRadius: '50%',
              background: '#fb923c', border: '2px solid #f97316',
              boxShadow: '0 0 8px rgba(249,115,22,0.6)',
            }} />
          </Marker>
        )}

        <HoverMarker coords={trackCoords} />
        <FitController coords={trackCoords} focusStartKm={focusStartKm} focusEndKm={focusEndKm} focusPointKm={focusPointKm} maximized={maximized} />

        {!inline && (
          <>
            <NavigationControl visualizePitch={true} position="top-right" />
          </>
        )}
      </Map>

      {/* Minimize button only in fullscreen mode */}
      {!inline && (
        <button
          onClick={() => setMaximized(false)}
          className="absolute bottom-3 left-3 z-[1000] flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider border transition-colors bg-slate-950/80 backdrop-blur-sm border-white/10 text-slate-300 hover:bg-slate-800 hover:text-white"
          aria-label="Minimizar mapa"
        >
          <Minimize2 className="w-3.5 h-3.5" />
          Minimizar
        </button>
      )}
    </>
  );

  return (
    <>
      {/* Fullscreen overlay */}
      {maximized && (
        <div className="fixed inset-0 z-[9999] bg-slate-950">
          {mapContent(false)}
        </div>
      )}

      {/* Inline map */}
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
        {mapContent(true)}
      </div>
    </>
  );
}
