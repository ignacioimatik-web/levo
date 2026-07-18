import { NextRequest, NextResponse } from 'next/server';
import { haversineKm } from '@/lib/gpx-utils';
import {
  normalizeBRouterResponse,
  type RouterProfile,
} from '@/lib/navigation/routing';
import type { PlannedRoutePoint } from '@/lib/navigation/types';

const DEFAULT_PROVIDER = 'https://brouter.de/brouter';
const MAX_WAYPOINTS = 25;
const MAX_DIRECT_DISTANCE_KM = 200;
const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT = 20;
let routerQueue: Promise<void> = Promise.resolve();
const clientRequests = new Map<string, number[]>();

async function runInRouterSlot<T>(operation: () => Promise<T>): Promise<T> {
  const previous = routerQueue;
  let release = () => {};
  routerQueue = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;
  try {
    return await operation();
  } finally {
    release();
  }
}

function withinRateLimit(request: NextRequest): boolean {
  const client = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const now = Date.now();
  const recent = (clientRequests.get(client) ?? []).filter((timestamp) => (
    now - timestamp < RATE_WINDOW_MS
  ));
  if (recent.length >= RATE_LIMIT) {
    clientRequests.set(client, recent);
    return false;
  }
  recent.push(now);
  clientRequests.set(client, recent);
  if (clientRequests.size > 1_000) {
    for (const [key, timestamps] of clientRequests) {
      if (timestamps.every((timestamp) => now - timestamp >= RATE_WINDOW_MS)) {
        clientRequests.delete(key);
      }
    }
  }
  return true;
}

function validPoint(value: unknown): value is PlannedRoutePoint {
  if (!value || typeof value !== 'object') return false;
  const point = value as Partial<PlannedRoutePoint>;
  return (
    typeof point.latitude === 'number'
    && Number.isFinite(point.latitude)
    && point.latitude >= -90
    && point.latitude <= 90
    && typeof point.longitude === 'number'
    && Number.isFinite(point.longitude)
    && point.longitude >= -180
    && point.longitude <= 180
  );
}

function totalDirectDistanceKm(points: PlannedRoutePoint[]): number {
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    total += haversineKm(
      points[index - 1].latitude,
      points[index - 1].longitude,
      points[index].latitude,
      points[index].longitude,
    );
  }
  return total;
}

function providerUrl(points: PlannedRoutePoint[], profile: RouterProfile): URL {
  const url = new URL(process.env.ROUTER_BASE_URL || DEFAULT_PROVIDER);
  url.searchParams.set(
    'lonlats',
    points.map((point) => `${point.longitude.toFixed(6)},${point.latitude.toFixed(6)}`).join('|'),
  );
  url.searchParams.set('profile', profile);
  url.searchParams.set('alternativeidx', '0');
  url.searchParams.set('format', 'geojson');
  url.searchParams.set('timode', '2');
  return url;
}

export async function POST(request: NextRequest) {
  if (!withinRateLimit(request)) {
    return NextResponse.json(
      { error: 'Demasiados cálculos seguidos. Espera un minuto antes de continuar.' },
      { status: 429, headers: { 'Retry-After': '60' } },
    );
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Solicitud de ruta no válida.' }, { status: 400 });
  }

  const candidate = body as { points?: unknown; profile?: unknown };
  const points = Array.isArray(candidate.points) ? candidate.points : [];
  const profile = candidate.profile;
  if (
    points.length < 2
    || points.length > MAX_WAYPOINTS
    || !points.every(validPoint)
    || (profile !== 'mtb' && profile !== 'trekking')
  ) {
    return NextResponse.json(
      { error: `Usa entre 2 y ${MAX_WAYPOINTS} puntos y un perfil de ruta válido.` },
      { status: 400 },
    );
  }
  if (totalDirectDistanceKm(points) > MAX_DIRECT_DISTANCE_KM) {
    return NextResponse.json(
      { error: `El trazado automático admite hasta ${MAX_DIRECT_DISTANCE_KM} km entre puntos de control.` },
      { status: 400 },
    );
  }

  try {
    const route = await runInRouterSlot(async () => {
      const response = await fetch(providerUrl(points, profile), {
        headers: {
          Accept: 'application/geo+json, application/json',
          'User-Agent': 'E-nduro-Ebiketracks/1.0 (+https://levo-eta.vercel.app)',
        },
        next: { revalidate: 604_800 },
        signal: AbortSignal.timeout(18_000),
      });
      const payload = await response.json();
      if (!response.ok) {
        const message = typeof payload?.error === 'string' ? payload.error : 'El motor no encontró una ruta.';
        throw new Error(message);
      }
      const normalized = normalizeBRouterResponse(payload, profile);
      if (!normalized) throw new Error('El motor devolvió un trazado vacío.');
      return normalized;
    });
    return NextResponse.json(
      { route, attribution: 'Enrutado BRouter · datos © OpenStreetMap contributors' },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=604800, stale-while-revalidate=2592000',
        },
      },
    );
  } catch {
    return NextResponse.json(
      {
        error: 'No se pudo calcular el camino. Acerca los puntos o cambia temporalmente a modo manual.',
      },
      { status: 503 },
    );
  }
}
