import type { TrailPoint } from '@/data/trails';
import { getAemetNowForRoute } from '@/lib/aemet';
import { calcSunriseSunset } from '@/lib/daylight';
import { analyzeRoute } from '@/lib/route-analysis';
import { buildRouteRidePlan } from '@/lib/route-ride-plan';
import type { RouteStatusPayload } from '@/lib/route-status';
import { assessSegmentRisk } from '@/lib/segment-risk';

type BikeMode = 'trail' | 'enduro' | 'ebike';

function estimateSegmentTimeMin(distanceKm: number, avgSlopePct: number, mode: BikeMode): number {
  const baseSpeedKmh: Record<BikeMode, number> = { trail: 13, enduro: 12, ebike: 16 };
  let speed = baseSpeedKmh[mode];
  if (avgSlopePct > 0) speed -= avgSlopePct * 0.7;
  else speed += Math.min(6, Math.abs(avgSlopePct) * 0.35);
  return Math.round(distanceKm / Math.max(5, speed) * 60);
}

function centroid(points: TrailPoint[]) {
  const total = points.reduce(
    (acc, point) => ({ lat: acc.lat + point.lat, lng: acc.lng + point.lng }),
    { lat: 0, lng: 0 },
  );
  return { lat: total.lat / points.length, lng: total.lng / points.length };
}

function localTimeParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => (
    Number(parts.find((part) => part.type === type)?.value ?? 0)
  );
  return {
    year: value('year'),
    month: value('month'),
    day: value('day'),
    hour: value('hour'),
    minute: value('minute'),
    second: value('second'),
  };
}

function timeZoneOffsetHours(date: Date, timeZone: string): number {
  const local = localTimeParts(date, timeZone);
  const representedAsUtc = Date.UTC(
    local.year,
    local.month - 1,
    local.day,
    local.hour,
    local.minute,
    local.second,
  );
  return (representedAsUtc - date.getTime()) / 3_600_000;
}

export async function buildCustomRouteStatus({
  id,
  title,
  points,
  timeZone,
}: {
  id: string;
  title: string;
  points: TrailPoint[];
  timeZone: string;
}): Promise<RouteStatusPayload> {
  if (points.length < 2) {
    return { ok: false, slug: id, source: 'custom-route', message: 'La ruta necesita al menos dos puntos.' };
  }

  const profile = analyzeRoute(points);
  const center = centroid(points);
  let weatherNow: RouteStatusPayload['weatherNow'] = null;
  try {
    weatherNow = await getAemetNowForRoute(points);
  } catch (error) {
    weatherNow = {
      error: 'No se pudo consultar AEMET en este momento.',
      detail: error instanceof Error ? error.message : 'Unknown weather error',
    };
  }

  const segments = profile.segments.map((segment) => ({
    ...segment,
    etaMinutes: {
      trail: estimateSegmentTimeMin(segment.distanceKm, segment.avgSlopePct, 'trail'),
      enduro: estimateSegmentTimeMin(segment.distanceKm, segment.avgSlopePct, 'enduro'),
      ebike: estimateSegmentTimeMin(segment.distanceKm, segment.avgSlopePct, 'ebike'),
    },
    risk: assessSegmentRisk(segment, weatherNow && 'riskLevel' in weatherNow ? weatherNow : null),
  }));
  const now = new Date();
  const local = localTimeParts(now, timeZone);
  const localDate = new Date(Date.UTC(local.year, local.month - 1, local.day, 12));
  const offset = timeZoneOffsetHours(now, timeZone);
  const daylight = calcSunriseSunset(center.lat, center.lng, localDate, offset);

  return {
    ok: true,
    slug: id,
    source: 'custom-route',
    title,
    viewerNow: new Intl.DateTimeFormat('es-ES', {
      timeZone,
      dateStyle: 'short',
      timeStyle: 'medium',
    }).format(now),
    viewerTimeZone: timeZone,
    points,
    daylight,
    ridePlan: buildRouteRidePlan({
      points,
      distanceKm: profile.distanceKm,
      weather: weatherNow && 'riskLevel' in weatherNow ? weatherNow : null,
    }),
    profile: { ...profile, segments },
    weatherNow,
    notes: [
      'Ruta creada o importada por el usuario.',
      weatherNow && 'sourceLabel' in weatherNow
        ? weatherNow.sourceLabel
        : 'La meteo por tramo usa la mejor fuente disponible a lo largo del trazado.',
    ],
  };
}
