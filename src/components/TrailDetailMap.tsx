'use client';

import dynamic from 'next/dynamic';
import { MTBTrail } from '@/data/trails';
import GpxMap from './GpxMap';

const MapWithTiles = dynamic(() => import('./RealMap'), {
  ssr: false,
});

export default function TrailDetailMap({ trail }: { trail: MTBTrail }) {
  return (
    <GpxMap 
      coordinates={trail.coordinates}
      gpxUrl={trail.gpxFile || undefined}
      title={trail.name}
      fallbackMessage="Datos demo — GPX pendiente"
    />
  );
}
