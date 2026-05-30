import { promises as fs } from 'fs';
import path from 'path';
import type { TrackMTB, DificultadMTB } from './types';
import { parseGPX } from '@/lib/gpx-utils';
import type { MTBRoute } from '@/data/routes';

const ROUTE_DIFFICULTY_MAP: Record<string, DificultadMTB> = {
  verde: 'verde',
  azul: 'azul',
  roja: 'rojo',
  rojo: 'rojo',
  negra: 'negro',
  negro: 'negro',
  'doble-negra': 'doble-negro',
  'doble-negro': 'doble-negro',
};

function mapDifficulty(d: string): DificultadMTB {
  return ROUTE_DIFFICULTY_MAP[d] || 'rojo';
}

function parseEstimatedTime(est: string | undefined): number {
  if (!est) return 60;
  const parts = est.split('-').map(s => {
    const [hStr, mStr] = s.trim().split(':');
    const h = Number(hStr);
    if (mStr === undefined) return isNaN(h) ? 60 : h * 60;
    const m = Number(mStr.replace(/[^0-9]/g, ''));
    return isNaN(h) || isNaN(m) ? 60 : h * 60 + m;
  });
  return Math.round(parts.reduce((a, b) => a + b, 0) / parts.length);
}

function ratingToNumber(r: string | undefined): 1 | 2 | 3 | 4 | 5 {
  if (!r) return 3;
  const map: Record<string, 1 | 2 | 3 | 4 | 5> = {
    verde: 1, azul: 2, roja: 3, rojo: 3, negra: 4, negro: 4,
    'doble-negra': 5, 'doble-negro': 5,
  };
  return map[r] || 3;
}

export async function loadRealTracks(routes: MTBRoute[]): Promise<TrackMTB[]> {
  const tracks: TrackMTB[] = [];
  let idCounter = 1;

  for (const route of routes) {
    const gpxRelPath = route.trackUrl || route.gpxFile || '';
    if (!gpxRelPath.endsWith('.gpx')) continue;

    const fullPath = path.join(process.cwd(), 'public', gpxRelPath.replace(/^\//, ''));
    let xml: string;
    try {
      xml = await fs.readFile(fullPath, 'utf8');
    } catch {
      continue;
    }

    const points = parseGPX(xml);
    if (points.length < 2) continue;

    // Downsample to keep RSC payload under Vercel's 4.5 MB limit
    const MAX_TRACK_POINTS = 300;
    const sampledPoints = points.length <= MAX_TRACK_POINTS
      ? points
      : Array.from({ length: MAX_TRACK_POINTS }, (_, i) =>
          points[Math.round((i / (MAX_TRACK_POINTS - 1)) * (points.length - 1))]
        );

    tracks.push({
      id: `real-${String(idCounter++).padStart(2, '0')}`,
      nombre: route.name,
      sector: route.sector,
      dificultad: mapDifficulty(route.technicalDifficulty || route.physicalDifficulty),
      estado: 'abierto',
      tipo: route.type === 'circular' ? ['circular', 'enduro'] : ['trail', 'enduro'],
      distanciaKm: route.distanceKm ?? +(points.length / 100).toFixed(1),
      desnivelPositivo: route.elevationGainM ?? 0,
      desnivelNegativo: route.elevationLossM ?? 0,
      nivelTecnico: ratingToNumber(route.technicalDifficulty),
      exigenciaFisica: ratingToNumber(route.physicalDifficulty),
      sentidoRecomendado: 'bidireccional',
      aptoEbike: route.ebikeFriendly ?? false,
      aptoLluvia: false,
      tiempoEstimadoMin: parseEstimatedTime(route.estimatedTime),
      descripcion: route.summary,
      advertencias: route.warnings || [],
      gpxUrl: gpxRelPath,
      points: sampledPoints,
      startPoint: { lat: points[0].lat, lng: points[0].lng },
      endPoint: { lat: points[points.length - 1].lat, lng: points[points.length - 1].lng },
      dataStatus: 'real',
    });
  }

  return tracks;
}
