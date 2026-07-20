import { calculateRideMetrics } from './geo.ts';
import type { RideMetrics, RidePoint, SportType } from './types';

export interface ActivityGpxPreview extends RideMetrics {
  name: string;
  sportHint: SportType | null;
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
  points: RidePoint[];
}

function decodeXml(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function childText(content: string, tag: string): string | null {
  const match = content.match(new RegExp(
    `<(?:[\\w.-]+:)?${tag}\\b[^>]*>([\\s\\S]*?)<\\/(?:[\\w.-]+:)?${tag}>`,
    'i',
  ));
  return match ? decodeXml(match[1].replace(/<[^>]*>/g, '').trim()) : null;
}

function attribute(attributes: string, name: string): string | null {
  const match = attributes.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`, 'i'));
  return match?.[1] ?? null;
}

function inferSport(xml: string): SportType | null {
  const type = childText(xml, 'type')?.toLowerCase() ?? '';
  if (/(e[- ]?bike|ebike|electric)/.test(type)) return 'ebike';
  if (/(mtb|mountain|cycling|biking|bike)/.test(type)) return 'mtb';
  return null;
}

export function parseActivityGpx(xml: string, fallbackName: string): ActivityGpxPreview {
  if (!/<(?:[\w.-]+:)?gpx\b/i.test(xml)) {
    throw new Error('El archivo no contiene un documento GPX válido.');
  }

  const pointPattern = /<(?:[\w.-]+:)?(?:trkpt|rtept)\b([^>]*)>([\s\S]*?)<\/(?:[\w.-]+:)?(?:trkpt|rtept)>/gi;
  const points: RidePoint[] = [];
  let match: RegExpExecArray | null;
  while ((match = pointPattern.exec(xml)) != null) {
    const latitude = Number(attribute(match[1], 'lat'));
    const longitude = Number(attribute(match[1], 'lon'));
    const elevationText = childText(match[2], 'ele');
    const timeText = childText(match[2], 'time');
    const timestamp = timeText ? Date.parse(timeText) : Number.NaN;
    if (
      !Number.isFinite(latitude)
      || latitude < -90
      || latitude > 90
      || !Number.isFinite(longitude)
      || longitude < -180
      || longitude > 180
      || !Number.isFinite(timestamp)
    ) continue;
    const elevation = elevationText == null ? null : Number(elevationText);
    points.push({
      latitude,
      longitude,
      elevation: Number.isFinite(elevation) ? elevation : null,
      accuracy: 5,
      speed: null,
      timestamp,
    });
  }

  if (points.length < 2) {
    throw new Error('Este GPX no incluye suficientes puntos con fecha y hora. Puedes usarlo como ruta, pero no como actividad.');
  }

  const startedAtMs = points[0].timestamp;
  const endedAtMs = points.at(-1)!.timestamp;
  const durationSeconds = Math.round((endedAtMs - startedAtMs) / 1000);
  if (durationSeconds <= 0) {
    throw new Error('Los puntos del GPX no tienen un orden temporal válido.');
  }
  if (durationSeconds > 60 * 60 * 24 * 7) {
    throw new Error('La duración del GPX supera siete días. Comprueba sus marcas de tiempo.');
  }

  const metrics = calculateRideMetrics(points);
  if (metrics.distanceM < 50) {
    throw new Error('El GPX no contiene distancia suficiente para crear una actividad.');
  }

  const trackNameMatch = xml.match(/<(?:[\w.-]+:)?trk\b[^>]*>[\s\S]*?<(?:[\w.-]+:)?name\b[^>]*>([\s\S]*?)<\/(?:[\w.-]+:)?name>/i);
  const metadataNameMatch = xml.match(/<(?:[\w.-]+:)?metadata\b[^>]*>[\s\S]*?<(?:[\w.-]+:)?name\b[^>]*>([\s\S]*?)<\/(?:[\w.-]+:)?name>/i);
  const rawName = trackNameMatch?.[1] ?? metadataNameMatch?.[1];
  const name = rawName
    ? decodeXml(rawName.replace(/<[^>]*>/g, '').trim())
    : fallbackName.replace(/\.gpx$/i, '').trim() || 'Actividad importada';

  return {
    name,
    sportHint: inferSport(xml),
    startedAt: new Date(startedAtMs).toISOString(),
    endedAt: new Date(endedAtMs).toISOString(),
    durationSeconds,
    points,
    ...metrics,
  };
}
