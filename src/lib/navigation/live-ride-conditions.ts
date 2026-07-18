import type { DaylightInfo } from '@/lib/daylight';
import type { RouteWeatherPhase } from '@/lib/route-ride-plan';

export type LiveConditionRisk = 'green' | 'yellow' | 'red';

export interface UpcomingWeatherHazard {
  phase: RouteWeatherPhase;
  distanceM: number;
}

export interface LiveRideConditionAlert {
  key: string;
  risk: Exclude<LiveConditionRisk, 'green'>;
  message: string;
}

export interface LiveRideConditionSummary {
  phase: RouteWeatherPhase | null;
  upcomingHazard: UpcomingWeatherHazard | null;
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

export function findUpcomingWeatherHazard(
  phases: RouteWeatherPhase[],
  completedKm: number,
  lookAheadKm = 5,
): UpcomingWeatherHazard | null {
  const safeKm = Math.max(0, completedKm);
  const maxKm = safeKm + Math.max(0, lookAheadKm);
  const candidates = phases
    .filter((phase) => (
      phase.riskLevel !== 'green'
      && phase.toKm > safeKm
      && phase.fromKm <= maxKm
    ))
    .sort((a, b) => {
      const distanceDifference = Math.max(0, a.fromKm - safeKm) - Math.max(0, b.fromKm - safeKm);
      if (distanceDifference !== 0) return distanceDifference;
      return riskScore(b.riskLevel) - riskScore(a.riskLevel);
    });
  const phase = candidates[0];
  if (!phase) return null;
  return {
    phase,
    distanceM: Math.round(Math.max(0, phase.fromKm - safeKm) * 1_000),
  };
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
  const upcomingHazard = findUpcomingWeatherHazard(phases, completedM / 1000);
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
    upcomingHazard,
    estimatedRemainingMinutes,
    minutesUntilSunset,
    lightMarginMinutes,
    lightRisk,
    overallRisk,
    paceKmh,
    recommendation,
  };
}

function formatAlertDistance(distanceM: number): string {
  if (distanceM < 950) return `${Math.max(50, Math.round(distanceM / 50) * 50)} metros`;
  return `${(distanceM / 1_000).toFixed(distanceM < 10_000 ? 1 : 0)} kilómetros`;
}

export function buildLiveConditionAlert(
  summary: LiveRideConditionSummary,
): LiveRideConditionAlert | null {
  if (summary.lightRisk === 'red') {
    return {
      key: 'light:red',
      risk: 'red',
      message: summary.lightMarginMinutes != null && summary.lightMarginMinutes < 0
        ? `Alerta de luz. La llegada estimada es ${Math.abs(Math.round(summary.lightMarginMinutes))} minutos después del ocaso. Busca una salida segura.`
        : 'Alerta de luz. Queda muy poco margen para terminar antes del ocaso.',
    };
  }

  if (summary.phase?.riskLevel === 'red') {
    return {
      key: `weather:${summary.phase.id}:red`,
      risk: 'red',
      message: `Alerta meteorológica en el tramo actual. ${summary.phase.feelLabel}. Baja el ritmo y valora una alternativa.`,
    };
  }

  const upcoming = summary.upcomingHazard;
  if (upcoming && upcoming.distanceM > 0) {
    const upcomingRisk = upcoming.phase.riskLevel === 'red' ? 'red' : 'yellow';
    const thresholdM = upcomingRisk === 'red' ? 2_000 : 1_000;
    if (upcoming.distanceM <= thresholdM) {
      return {
        key: `weather:${upcoming.phase.id}:${upcomingRisk}`,
        risk: upcomingRisk,
        message: `Atención. En ${formatAlertDistance(upcoming.distanceM)}, ${upcoming.phase.feelLabel}.`,
      };
    }
  }

  if (summary.lightRisk === 'yellow') {
    return {
      key: 'light:yellow',
      risk: 'yellow',
      message: summary.lightMarginMinutes != null
        ? `Aviso de luz. Margen estimado de ${Math.max(0, Math.round(summary.lightMarginMinutes))} minutos al llegar.`
        : 'Aviso de luz. El ocaso está próximo.',
    };
  }

  if (summary.phase?.riskLevel === 'yellow') {
    return {
      key: `weather:${summary.phase.id}:yellow`,
      risk: 'yellow',
      message: `Precaución meteorológica en el tramo actual. ${summary.phase.feelLabel}.`,
    };
  }

  return null;
}
