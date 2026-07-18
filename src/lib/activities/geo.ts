import type { RideMetrics, RidePoint } from './types';

const EARTH_RADIUS_M = 6_371_000;
const MAX_GPS_ACCURACY_M = 100;
const MAX_RIDE_SPEED_KMH = 100;
const MOVING_SPEED_KMH = 2.5;
const ELEVATION_HYSTERESIS_M = 3;

function toRadians(value: number): number {
  return value * Math.PI / 180;
}

export function distanceBetween(a: RidePoint, b: RidePoint): number {
  const dLat = toRadians(b.latitude - a.latitude);
  const dLng = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

export type RidePointRejection = 'invalid' | 'accuracy' | 'timestamp' | 'jump' | 'drift';

export interface RidePointAssessment {
  accepted: boolean;
  reason: RidePointRejection | null;
  distanceM: number;
  speedKmh: number;
}

export function assessRidePoint(previous: RidePoint | null, candidate: RidePoint): RidePointAssessment {
  const validCoordinates = Number.isFinite(candidate.latitude)
    && candidate.latitude >= -90
    && candidate.latitude <= 90
    && Number.isFinite(candidate.longitude)
    && candidate.longitude >= -180
    && candidate.longitude <= 180;
  if (!validCoordinates || !Number.isFinite(candidate.accuracy) || !Number.isFinite(candidate.timestamp)) {
    return { accepted: false, reason: 'invalid', distanceM: 0, speedKmh: 0 };
  }
  if (candidate.accuracy < 0 || candidate.accuracy > MAX_GPS_ACCURACY_M) {
    return { accepted: false, reason: 'accuracy', distanceM: 0, speedKmh: 0 };
  }
  if (!previous) return { accepted: true, reason: null, distanceM: 0, speedKmh: 0 };

  const seconds = (candidate.timestamp - previous.timestamp) / 1000;
  if (seconds <= 0) return { accepted: false, reason: 'timestamp', distanceM: 0, speedKmh: 0 };

  const distanceM = distanceBetween(previous, candidate);
  const speedKmh = distanceM / seconds * 3.6;
  if (seconds <= 120 && speedKmh > MAX_RIDE_SPEED_KMH) {
    return { accepted: false, reason: 'jump', distanceM, speedKmh };
  }

  const driftThresholdM = Math.max(2, Math.max(previous.accuracy, candidate.accuracy) * 0.15);
  if (seconds <= 120 && distanceM < driftThresholdM) {
    return { accepted: false, reason: 'drift', distanceM, speedKmh };
  }
  return { accepted: true, reason: null, distanceM, speedKmh };
}

export function appendRidePoint(points: RidePoint[], candidate: RidePoint): RidePoint[] {
  return assessRidePoint(points.at(-1) ?? null, candidate).accepted ? [...points, candidate] : points;
}

function calculateElevationGain(points: RidePoint[]): number {
  const elevations = points
    .map((point) => point.elevation)
    .filter((elevation): elevation is number => elevation != null && Number.isFinite(elevation));
  if (elevations.length < 2) return 0;

  let baseline = elevations[0];
  let peak = elevations[0];
  let gainM = 0;
  let previous = elevations[0];

  for (const elevation of elevations.slice(1)) {
    if (Math.abs(elevation - previous) > 30) continue;
    previous = elevation;
    if (elevation > peak) {
      peak = elevation;
    } else if (peak - elevation >= ELEVATION_HYSTERESIS_M) {
      if (peak - baseline >= ELEVATION_HYSTERESIS_M) gainM += peak - baseline;
      baseline = elevation;
      peak = elevation;
    } else if (elevation < baseline) {
      baseline = elevation;
      peak = elevation;
    }
  }
  if (peak - baseline >= ELEVATION_HYSTERESIS_M) gainM += peak - baseline;
  return gainM;
}

export function calculateRideMetrics(points: RidePoint[]): RideMetrics {
  let distanceM = 0;
  let movingSeconds = 0;
  let maxSpeedKmh = 0;
  const acceptedPoints: RidePoint[] = [];

  for (const current of points) {
    const previous = acceptedPoints.at(-1) ?? null;
    const assessment = assessRidePoint(previous, current);
    if (!assessment.accepted) continue;
    acceptedPoints.push(current);
    if (!previous) continue;
    const seconds = Math.max(0, (current.timestamp - previous.timestamp) / 1000);
    if (seconds === 0 || seconds > 120) continue;

    const deviceSpeedKmh = current.speed != null && current.speed >= 0 ? current.speed * 3.6 : 0;
    const effectiveSpeedKmh = Math.max(deviceSpeedKmh, assessment.speedKmh);
    distanceM += assessment.distanceM;
    if (effectiveSpeedKmh > MOVING_SPEED_KMH) movingSeconds += seconds;
    maxSpeedKmh = Math.max(maxSpeedKmh, Math.min(effectiveSpeedKmh, MAX_RIDE_SPEED_KMH));
  }

  return {
    distanceM,
    elevationGainM: calculateElevationGain(acceptedPoints),
    movingSeconds: Math.round(movingSeconds),
    averageSpeedKmh: movingSeconds > 0 ? distanceM / movingSeconds * 3.6 : 0,
    maxSpeedKmh,
  };
}

export function estimateBattery(
  distanceM: number,
  batteryStart: number,
  capacityWh: number,
  assistMode: string,
  customWhPerKm?: number,
): { batteryPercent: number; energyUsedWh: number; remainingRangeKm: number } {
  const consumption: Record<string, number> = {
    eco: 7,
    trail: 11,
    turbo: 17,
    smart: 10,
  };
  const whPerKm = customWhPerKm != null && customWhPerKm > 0
    ? customWhPerKm
    : consumption[assistMode] ?? 10;
  const energyUsedWh = distanceM / 1000 * whPerKm;
  const initialWh = capacityWh * batteryStart / 100;
  const remainingWh = Math.max(0, initialWh - energyUsedWh);

  return {
    batteryPercent: Math.round(remainingWh / capacityWh * 100),
    energyUsedWh,
    remainingRangeKm: remainingWh / whPerKm,
  };
}

export function pointFromPosition(position: GeolocationPosition): RidePoint {
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    elevation: position.coords.altitude,
    accuracy: position.coords.accuracy,
    speed: position.coords.speed,
    timestamp: position.timestamp,
  };
}
