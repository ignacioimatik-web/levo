import type { AemetNow } from './aemet';
import { haversineKm } from './gpx-utils.ts';
import {
  buildRouteDistanceIndex,
  pointAtRouteDistance,
} from './route-sampling.ts';
import type { RouteSamplePoint } from './route-sampling.ts';

export type WeatherConfidence = 'high' | 'medium' | 'low';
export type WindEffect = 'headwind' | 'tailwind' | 'crosswind' | 'calm' | 'unknown';

export interface RouteWeatherPhase {
  id: string;
  fromKm: number;
  toKm: number;
  centerKm: number;
  routeBearingDeg: number | null;
  temperatureC: number | null;
  humidityPct: number | null;
  windKmh: number | null;
  maxWindKmh: number | null;
  precipitationMm: number | null;
  windEffect: WindEffect;
  confidence: WeatherConfidence;
  nearestStationKm: number | null;
  stationCount: number;
  feelLabel: string;
  riskLevel: 'green' | 'yellow' | 'red';
}

export interface RouteRidePlan {
  phases: RouteWeatherPhase[];
  stationCount: number;
  overallConfidence: WeatherConfidence;
  sourceLabel: string;
}

type RoutePoint = RouteSamplePoint;

function bearingDegrees(a: RoutePoint, b: RoutePoint): number {
  const lat1 = a.lat * Math.PI / 180;
  const lat2 = b.lat * Math.PI / 180;
  const deltaLng = (b.lng - a.lng) * Math.PI / 180;
  const y = Math.sin(deltaLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2)
    - Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLng);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

function weightedValue(
  stations: NonNullable<AemetNow['nearbyStations']>,
  point: RoutePoint,
  value: (station: NonNullable<AemetNow['nearbyStations']>[number]) => number | undefined,
): number | null {
  let weighted = 0;
  let weights = 0;
  for (const station of stations) {
    const sample = value(station);
    if (sample == null || !Number.isFinite(sample)) continue;
    const distanceKm = haversineKm(point.lat, point.lng, station.latitude, station.longitude);
    const spatialWeight = 1 / Math.max(1, distanceKm) ** 1.5;
    const freshnessWeight = 1 / (1 + Math.max(0, station.dataAgeMin ?? 180) / 120);
    const weight = spatialWeight * freshnessWeight;
    weighted += sample * weight;
    weights += weight;
  }
  return weights > 0 ? weighted / weights : null;
}

function weightedDirection(
  stations: NonNullable<AemetNow['nearbyStations']>,
  point: RoutePoint,
): number | null {
  let weightedSin = 0;
  let weightedCos = 0;
  let weights = 0;
  for (const station of stations) {
    if (station.windDirectionDeg == null || !Number.isFinite(station.windDirectionDeg)) continue;
    const distanceKm = haversineKm(point.lat, point.lng, station.latitude, station.longitude);
    const spatialWeight = 1 / Math.max(1, distanceKm) ** 1.5;
    const freshnessWeight = 1 / (1 + Math.max(0, station.dataAgeMin ?? 180) / 120);
    const weight = spatialWeight * freshnessWeight;
    const radians = station.windDirectionDeg * Math.PI / 180;
    weightedSin += Math.sin(radians) * weight;
    weightedCos += Math.cos(radians) * weight;
    weights += weight;
  }
  if (weights === 0) return null;
  return (Math.atan2(weightedSin / weights, weightedCos / weights) * 180 / Math.PI + 360) % 360;
}

function angleDifference(a: number, b: number): number {
  return Math.abs(((a - b + 540) % 360) - 180);
}

function windEffect(
  routeBearingDeg: number | null,
  windDirectionDeg: number | null,
  windKmh: number | null,
): WindEffect {
  if (windKmh != null && windKmh < 6) return 'calm';
  if (routeBearingDeg == null || windDirectionDeg == null || windKmh == null) return 'unknown';
  // AEMET direction is where the wind comes from.
  const difference = angleDifference(routeBearingDeg, windDirectionDeg);
  if (difference <= 45) return 'headwind';
  if (difference >= 135) return 'tailwind';
  return 'crosswind';
}

function confidence(nearestKm: number | null, ages: number[], stations: number): WeatherConfidence {
  const freshestAge = ages.length > 0 ? Math.min(...ages) : Infinity;
  const recentStations = ages.filter((age) => age <= 120).length;
  if (nearestKm != null && nearestKm <= 10 && freshestAge <= 90 && recentStations >= 2 && stations >= 2) return 'high';
  if (nearestKm != null && nearestKm <= 25 && freshestAge <= 180 && recentStations >= 1 && stations >= 1) return 'medium';
  return 'low';
}

function riskLevel({
  rain,
  wind,
  gust,
  temperature,
}: {
  rain: number | null;
  wind: number | null;
  gust: number | null;
  temperature: number | null;
}): 'green' | 'yellow' | 'red' {
  if ((rain ?? 0) >= 3 || (gust ?? wind ?? 0) >= 45 || (temperature != null && temperature <= 0)) return 'red';
  if ((rain ?? 0) > 0 || (gust ?? wind ?? 0) >= 28 || (temperature != null && (temperature >= 33 || temperature <= 3))) return 'yellow';
  return 'green';
}

function feelLabel({
  temperature,
  humidity,
  effect,
  wind,
}: {
  temperature: number | null;
  humidity: number | null;
  effect: WindEffect;
  wind: number | null;
}): string {
  const sensations: string[] = [];
  if (temperature != null && temperature >= 30 && (humidity ?? 0) >= 65) sensations.push('calor húmedo');
  else if (temperature != null && temperature >= 30) sensations.push('calor seco');
  else if (temperature != null && temperature <= 5) sensations.push('frío intenso');
  else if (temperature != null && temperature <= 10) sensations.push('ambiente fresco');
  if (effect === 'headwind' && (wind ?? 0) >= 15) sensations.push('avance penalizado');
  if (effect === 'crosswind' && (wind ?? 0) >= 20) sensations.push('atención en zonas expuestas');
  if (effect === 'tailwind' && (wind ?? 0) >= 15) sensations.push('viento favorable');
  return sensations.length > 0 ? sensations.join(' · ') : 'sensación neutra';
}

export function buildRouteRidePlan({
  points,
  distanceKm,
  weather,
  phaseCount = 6,
}: {
  points: RoutePoint[];
  distanceKm: number;
  weather: AemetNow | null;
  phaseCount?: number;
}): RouteRidePlan {
  const stations = weather?.nearbyStations ?? [];
  if (points.length < 2 || distanceKm <= 0) {
    return {
      phases: [],
      stationCount: stations.length,
      overallConfidence: 'low',
      sourceLabel: 'Sin trazado suficiente',
    };
  }

  const count = Math.max(3, Math.min(12, Math.round(phaseCount)));
  const distanceIndex = buildRouteDistanceIndex(points);
  const phases: RouteWeatherPhase[] = [];
  for (let index = 0; index < count; index += 1) {
    const fromFraction = index / count;
    const toFraction = (index + 1) / count;
    const centerFraction = (fromFraction + toFraction) / 2;
    const point = pointAtRouteDistance(
      points,
      distanceIndex,
      distanceIndex.totalKm * centerFraction,
    );
    const bearingStart = pointAtRouteDistance(
      points,
      distanceIndex,
      distanceIndex.totalKm * fromFraction,
    );
    const bearingEnd = pointAtRouteDistance(
      points,
      distanceIndex,
      distanceIndex.totalKm * toFraction,
    );
    const routeBearingDeg = bearingStart.lat === bearingEnd.lat && bearingStart.lng === bearingEnd.lng
      ? null
      : bearingDegrees(bearingStart, bearingEnd);
    const distances = stations.map((station) => (
      haversineKm(point.lat, point.lng, station.latitude, station.longitude)
    ));
    const nearestStationKm = distances.length > 0 ? Math.min(...distances) : null;
    const ages = stations
      .map((station) => station.dataAgeMin)
      .filter((age): age is number => age != null);
    const temperatureC = weightedValue(stations, point, (station) => {
      if (station.temperatureC == null) return undefined;
      const elevationDifferenceM = (point.elevation ?? station.altitudeM ?? 0) - (station.altitudeM ?? 0);
      return station.temperatureC - elevationDifferenceM * 0.0065;
    });
    const humidityPct = weightedValue(stations, point, (station) => station.humidityPct);
    const windKmh = weightedValue(stations, point, (station) => station.windKmh);
    const maxWindKmh = weightedValue(stations, point, (station) => station.maxWindKmh);
    const precipitationMm = weightedValue(stations, point, (station) => station.precipitationMm);
    const windDirectionDeg = weightedDirection(stations, point);
    const effect = windEffect(routeBearingDeg, windDirectionDeg, windKmh);
    const measuredConfidence = confidence(nearestStationKm, ages, stations.length);
    const phaseConfidence = weather?.source === 'open-meteo-model' && measuredConfidence === 'high'
      ? 'medium'
      : measuredConfidence;

    phases.push({
      id: `W${index + 1}`,
      fromKm: Math.round(distanceKm * fromFraction * 10) / 10,
      toKm: Math.round(distanceKm * toFraction * 10) / 10,
      centerKm: Math.round(distanceKm * centerFraction * 10) / 10,
      routeBearingDeg,
      temperatureC: temperatureC == null ? weather?.temperatureC ?? null : Math.round(temperatureC * 10) / 10,
      humidityPct: humidityPct == null ? weather?.humidityPct ?? null : Math.round(humidityPct),
      windKmh: windKmh == null ? weather?.windKmh ?? null : Math.round(windKmh * 10) / 10,
      maxWindKmh: maxWindKmh == null ? weather?.maxWindKmh ?? null : Math.round(maxWindKmh * 10) / 10,
      precipitationMm: precipitationMm == null ? weather?.precipitationMm ?? null : Math.round(precipitationMm * 10) / 10,
      windEffect: effect,
      confidence: phaseConfidence,
      nearestStationKm: nearestStationKm == null ? weather?.stationDistanceKm ?? null : Math.round(nearestStationKm * 10) / 10,
      stationCount: stations.length,
      feelLabel: feelLabel({ temperature: temperatureC, humidity: humidityPct, effect, wind: windKmh }),
      riskLevel: riskLevel({
        rain: precipitationMm,
        wind: windKmh,
        gust: maxWindKmh,
        temperature: temperatureC,
      }),
    });
  }

  const confidenceScores = phases.map((phase) => (
    phase.confidence === 'high' ? 3 : phase.confidence === 'medium' ? 2 : 1
  ));
  const averageConfidence = confidenceScores.reduce((sum, score) => sum + score, 0) / confidenceScores.length;
  return {
    phases,
    stationCount: stations.length,
    overallConfidence: averageConfidence >= 2.5 ? 'high' : averageConfidence >= 1.5 ? 'medium' : 'low',
    sourceLabel: weather?.sourceLabel
      ?? (stations.length > 0
        ? `Inferencia AEMET con ${stations.length} ${stations.length === 1 ? 'estación' : 'estaciones'}`
        : 'Sin cobertura meteorológica'),
  };
}
