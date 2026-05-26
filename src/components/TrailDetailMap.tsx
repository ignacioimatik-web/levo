'use client';

import dynamic from 'next/dynamic';
import { MTBTrail } from '@/data/trails';
import GpxMap from './GpxMap';

const MapWithTiles = dynamic(() => import('./RealMap'), {
  ssr: false,
});

export default function TrailDetailMap({
  trail,
  focusStartKm,
  focusEndKm,
  focusPointKm,
  segmentOverlays,
  routePoints,
}: {
  trail: MTBTrail;
  focusStartKm?: number;
  focusEndKm?: number;
  focusPointKm?: number;
  segmentOverlays?: Array<{ startKm: number; endKm: number; type: 'climb' | 'descent' | 'flat' }>;
  routePoints?: Array<{ lat: number; lng: number }>;
}) {
  return (
    <GpxMap 
      coordinates={trail.coordinates}
      preparsedPoints={routePoints}
      gpxUrl={trail.gpxFile || undefined}
      title={trail.name}
      fallbackMessage="Datos demo — GPX pendiente"
      focusStartKm={focusStartKm}
      focusEndKm={focusEndKm}
      focusPointKm={focusPointKm}
      segmentOverlays={segmentOverlays}
    />
  );
}
