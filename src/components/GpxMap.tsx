'use client';

import { useState, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, Polyline, Tooltip, useMap } from 'react-leaflet';
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
}

function MapController({ coords }: { coords: LatLngExpression[] }) {
  const map = useMap();
  useEffect(() => {
    if (coords.length > 1) {
      const lats = coords.map(c => (c as number[])[0]);
      const lngs = coords.map(c => (c as number[])[1]);
      map.fitBounds([
        [Math.min(...lats), Math.min(...lngs)],
        [Math.max(...lats), Math.max(...lngs)]
      ], { padding: [40, 40], maxZoom: 15 });
    }
  }, [coords, map]);
  return null;
}

export default function GpxMap({ coordinates, gpxUrl, title, fallbackMessage }: GpxMapProps) {
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
            pathOptions={{ color: '#f97316', weight: 4, opacity: 0.8, lineCap: 'round' }} 
          />
        )}
        <MapController coords={trackCoords} />
      </MapContainer>
    </div>
  );
}
