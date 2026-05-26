'use client';

import 'leaflet/dist/leaflet.css';
import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Polyline, CircleMarker, Tooltip, useMap } from 'react-leaflet';
import type { Map as LeafletMap } from 'leaflet';
import type { TrackMTB, TrackPoint, RutaConstruida } from '@/lib/forfait/types';

const DIFICULTAD_COLORS: Record<string, string> = {
  verde: '#009988',
  azul: '#0077BB',
  rojo: '#EE7733',
  negro: '#222222',
  'doble-negro': '#000000',
};

const ESTADO_DASH: Record<string, string> = {
  abierto: '',
  cerrado: '6 6',
  precaucion: '4 4',
  revision: '8 4 2 4',
};

function FitBounds({ tracks, routePoints }: { tracks: TrackMTB[]; routePoints: TrackPoint[] }) {
  const map = useMap();
  const fitted = useRef(false);

  useEffect(() => {
    if (fitted.current) return;
    const allPoints = routePoints.length > 0
      ? routePoints
      : tracks.flatMap(t => t.points);
    if (!allPoints.length) return;
    const lats = allPoints.map(p => p.lat);
    const lngs = allPoints.map(p => p.lng);
    map.fitBounds(
      [[Math.min(...lats), Math.min(...lngs)], [Math.max(...lats), Math.max(...lngs)]],
      { padding: [40, 40] },
    );
    fitted.current = true;
  }, [tracks, routePoints, map]);

  return null;
}

export default function MTBMap({
  tracks,
  selectedTrackIds,
  previewTrackIds = [],
  recommendedIds,
  cautionIds,
  notRecommendedIds,
  builtRoute,
  onTrackClick,
}: {
  tracks: TrackMTB[];
  selectedTrackIds: string[];
  previewTrackIds: string[];
  recommendedIds: string[];
  cautionIds: string[];
  notRecommendedIds: string[];
  builtRoute: RutaConstruida | null;
  onTrackClick: (track: TrackMTB) => void;
}) {
  const mapRef = useRef<LeafletMap | null>(null);

  return (
    <MapContainer
      center={[40.6, -0.02]}
      zoom={13}
      className="w-full h-full rounded-xl"
      scrollWheelZoom={true}
      ref={mapRef}
      preferCanvas={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds tracks={tracks} routePoints={builtRoute?.pointsCombinados ?? []} />

      {tracks.map(track => {
        const isInRoute = selectedTrackIds.includes(track.id);
        const isPreview = previewTrackIds.includes(track.id) && !isInRoute;
        const isRecommended = recommendedIds.includes(track.id);
        const isCaution = cautionIds.includes(track.id);
        const isNotRec = notRecommendedIds.includes(track.id);
        const isClosed = track.estado === 'cerrado';

        let color = DIFICULTAD_COLORS[track.dificultad] || '#64748b';
        let weight = isInRoute ? 5 : isPreview ? 4 : 3;
        let opacity = 1;

        if (isClosed) { color = '#64748b'; opacity = 0.4; }
        else if (isNotRec) { color = '#CC3311'; opacity = 0.5; }
        else if (isCaution) { color = '#EE7733'; weight = 4; }
        else if (isRecommended) { color = '#009988'; weight = 4; }
        else if (isInRoute) { color = '#0077BB'; weight = 5; }
        else if (isPreview) { color = DIFICULTAD_COLORS[track.dificultad] || '#64748b'; weight = 4; opacity = 0.7; }

        return (
          <g key={track.id}>
            {isPreview && (
              <Polyline
                positions={track.points.map(p => [p.lat, p.lng] as [number, number])}
                pathOptions={{
                  color: '#ffffff',
                  weight: 6,
                  opacity: 0.15,
                }}
                eventHandlers={{ click: () => onTrackClick(track) }}
              />
            )}
            <Polyline
              positions={track.points.map(p => [p.lat, p.lng] as [number, number])}
              pathOptions={{
                color,
                weight,
                opacity,
                dashArray: isPreview ? '8 4' : ESTADO_DASH[track.estado] || undefined,
              }}
              eventHandlers={{ click: () => onTrackClick(track) }}
            />
            <CircleMarker
              center={[track.startPoint.lat, track.startPoint.lng]}
              radius={isInRoute ? 5 : isPreview ? 4 : 3}
              pathOptions={{ color: '#009988', fillColor: '#009988', fillOpacity: 0.8 }}
            >
              <Tooltip permanent={false} direction="top">
                {track.nombre} — inicio
              </Tooltip>
            </CircleMarker>
            <CircleMarker
              center={[track.endPoint.lat, track.endPoint.lng]}
              radius={isInRoute ? 5 : isPreview ? 4 : 3}
              pathOptions={{ color: '#CC3311', fillColor: '#CC3311', fillOpacity: 0.8 }}
            >
              <Tooltip permanent={false} direction="bottom">
                {track.nombre} — fin
              </Tooltip>
            </CircleMarker>
          </g>
        );
      })}

      {builtRoute && builtRoute.pointsCombinados.length > 0 && (
        <Polyline
          positions={builtRoute.pointsCombinados.map(p => [p.lat, p.lng] as [number, number])}
          pathOptions={{ color: '#0077BB', weight: 5, opacity: 0.8 }}
        />
      )}
    </MapContainer>
  );
}
