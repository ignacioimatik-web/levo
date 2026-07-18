import { NextRequest, NextResponse } from 'next/server';
import {
  buildOverpassTrailQuery,
  overpassWaysToGeoJson,
} from '@/lib/navigation/offline-map-data';
import type { OverpassWay } from '@/lib/navigation/offline-map-data';
import type { PlannedRoutePoint } from '@/lib/navigation/types';

type InputPoint = {
  latitude?: unknown;
  longitude?: unknown;
  elevation?: unknown;
};

export const maxDuration = 35;

async function fetchOverpassWays(query: string): Promise<OverpassWay[] | null> {
  const endpoints = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
  ];
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
          'User-Agent': 'LEVO-offline-route/1.0 contact:https://levo-eta.vercel.app',
        },
        body: new URLSearchParams({ data: query }),
        signal: AbortSignal.timeout(16_000),
        cache: 'no-store',
      });
      if (!response.ok) continue;
      const payload = await response.json() as { elements?: unknown };
      if (Array.isArray(payload.elements)) return payload.elements as OverpassWay[];
    } catch {
      // Try the next public Overpass instance within the function time budget.
    }
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      routeId?: unknown;
      routeName?: unknown;
      points?: unknown;
    };
    if (!Array.isArray(body.points) || body.points.length < 2 || body.points.length > 20_000) {
      return NextResponse.json({ error: 'La ruta debe contener entre 2 y 20.000 puntos.' }, { status: 400 });
    }
    const points: PlannedRoutePoint[] = (body.points as InputPoint[]).map((point) => ({
      latitude: Number(point.latitude),
      longitude: Number(point.longitude),
      elevation: point.elevation == null ? null : Number(point.elevation),
    }));
    const valid = points.every((point) => (
      Number.isFinite(point.latitude)
      && Number.isFinite(point.longitude)
      && point.latitude >= -90
      && point.latitude <= 90
      && point.longitude >= -180
      && point.longitude <= 180
      && (point.elevation == null || Number.isFinite(point.elevation))
    ));
    if (!valid) {
      return NextResponse.json({ error: 'La ruta contiene coordenadas no válidas.' }, { status: 400 });
    }

    const query = buildOverpassTrailQuery(points);
    const elements = await fetchOverpassWays(query);
    if (!elements) {
      return NextResponse.json(
        { error: 'OpenStreetMap no pudo preparar el mapa offline en este momento.' },
        { status: 503 },
      );
    }
    const trails = overpassWaysToGeoJson(elements);
    if (trails.features.length === 0) {
      return NextResponse.json(
        { error: 'No se encontraron caminos cartografiados alrededor de esta ruta.' },
        { status: 404 },
      );
    }

    return NextResponse.json({
      routeId: typeof body.routeId === 'string' ? body.routeId.slice(0, 120) : crypto.randomUUID(),
      routeName: typeof body.routeName === 'string' ? body.routeName.slice(0, 120) : 'Ruta offline',
      trails,
      fetchedAt: new Date().toISOString(),
      attribution: '© colaboradores de OpenStreetMap · datos obtenidos mediante Overpass API',
      sampleRadiusM: 1_200,
    }, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    const timedOut = error instanceof DOMException && error.name === 'TimeoutError';
    return NextResponse.json({
      error: timedOut
        ? 'El mapa offline tardó demasiado. Inténtalo de nuevo con cobertura.'
        : 'No se pudo preparar el mapa offline.',
    }, { status: timedOut ? 504 : 500 });
  }
}
