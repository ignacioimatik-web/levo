import type { DaylightInfo } from '@/lib/daylight';
import type { RouteWeatherPhase } from '@/lib/route-ride-plan';

export type LiveConditionRisk = 'green' | 'yellow' | 'red';

export interface LiveRideConditionSummary {
  phase: RouteWeatherPhase | null;
  estimatedRemainingMinutes: number | null;
  minutesUntilSunset: number | null;
  lightMarginMinutes: number | null;
  lightRisk: LiveConditionRisk;
  overallRisk: LiveConditionRisk;
  paceKmh: number;
  recommendation: string;
}

function riskScore(risk: LiveConditionRisk): number {
  return risk === 'red' ? 3 : risk === 'yellow' ? 2 : 1;
}

function maxRisk(a: LiveConditionRisk, b: LiveConditionRisk): LiveConditionRisk {
  return riskScore(a) >= riskScore(b) ? a : b;
}

export function selectCurrentWeatherPhase(
  phases: RouteWeatherPhase[],
  completedKm: number,
): RouteWeatherPhase | null {
  if (phases.length === 0) return null;
  const safeKm = Math.max(0, completedKm);
  return phases.find((phase) => safeKm >= phase.fromKm && safeKm < phase.toKm)
    ?? phases.reduce((nearest, phase) => (
      Math.abs(phase.centerKm - safeKm) < Math.abs(nearest.centerKm - safeKm)
        ? phase
        : nearest
    ));
}

export function minutesUntilClockTime(now: Date, clockTime?: string): number | null {
  if (!clockTime || !/^\d{2}:\d{2}$/.test(clockTime)) return null;
  const [hours, minutes] = clockTime.split(':').map(Number);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes - (now.getHours() * 60 + now.getMinutes());
}

export function deriveLiveRideConditions({
  phases,
  daylight,
  completedM,
  remainingM,
  averageSpeedKmh,
  movingSeconds,
  sportType,
  now = new Date(),
}: {
  phases: RouteWeatherPhase[];
  daylight?: DaylightInfo;
  completedM: number;
  remainingM: number | null;
  averageSpeedKmh: number;
  movingSeconds: number;
  sportType: 'ebike' | 'mtb';
  now?: Date;
}): LiveRideConditionSummary {
  const fallbackPace = sportType === 'ebike' ? 16 : 12;
  const paceKmh = movingSeconds >= 300 && completedM >= 500 && averageSpeedKmh > 0
    ? Math.max(5, Math.min(35, averageSpeedKmh))
    : fallbackPace;
  const estimatedRemainingMinutes = remainingM == null
    ? null
    : Math.max(0, remainingM) / 1000 / paceKmh * 60;
  const minutesUntilSunset = minutesUntilClockTime(now, daylight?.sunset);
  const lightMarginMinutes = minutesUntilSunset == null || estimatedRemainingMinutes == null
    ? null
    : minutesUntilSunset - estimatedRemainingMinutes;

  let lightRisk: LiveConditionRisk = 'green';
  if (lightMarginMinutes != null) {
    lightRisk = lightMarginMinutes < 15 ? 'red' : lightMarginMinutes < 45 ? 'yellow' : 'green';
  } else if (minutesUntilSunset != null) {
    lightRisk = minutesUntilSunset < 30 ? 'red' : minutesUntilSunset < 90 ? 'yellow' : 'green';
  }

  const phase = selectCurrentWeatherPhase(phases, completedM / 1000);
  const overallRisk = maxRisk(phase?.riskLevel ?? 'green', lightRisk);
  const recommendation = overallRisk === 'red'
    ? lightRisk === 'red'
      ? 'Margen de luz crítico: recorta o busca una salida segura.'
      : 'Condiciones comprometidas en este tramo: baja el ritmo y valora alternativa.'
    : overallRisk === 'yellow'
      ? 'Rueda con margen y revisa de nuevo en el próximo tramo.'
      : 'Condiciones favorables con la prudencia habitual de montaña.';

  return {
    phase,
    estimatedRemainingMinutes,
    minutesUntilSunset,
    lightMarginMinutes,
    lightRisk,
    overallRisk,
    paceKmh,
    recommendation,
  };
}
