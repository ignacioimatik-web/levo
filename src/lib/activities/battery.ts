import type { AssistMode, RideActivity } from './types';

const DEFAULT_WH_PER_KM: Record<AssistMode, number> = {
  eco: 7,
  trail: 11,
  turbo: 17,
  smart: 10,
};

export type BatteryModelConfidence = 'low' | 'medium' | 'high';
export type BatteryModelSource = 'personal-mode' | 'personal-all' | 'default';
export type BatteryRouteState = 'safe' | 'tight' | 'insufficient';

export interface BatteryModel {
  assistMode: AssistMode | null;
  averageWhPerKm: number;
  conservativeWhPerKm: number;
  historicalClimbMPerKm: number;
  sampleCount: number;
  distanceKm: number;
  typicalCapacityWh: number | null;
  confidence: BatteryModelConfidence;
  source: BatteryModelSource;
}

export interface BatteryRoutePrediction {
  state: BatteryRouteState;
  requiredWh: number;
  availableWh: number;
  usableWh: number;
  marginWh: number;
  arrivalPercent: number;
  safeRangeKm: number;
  adjustedWhPerKm: number;
  reservePercent: number;
}

function percentile(values: number[], ratio: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1));
  return sorted[index];
}

function validBatteryActivities(activities: RideActivity[]): RideActivity[] {
  return activities.filter((activity) => {
    const distanceKm = activity.distanceM / 1000;
    const consumption = activity.energyUsedWh == null ? 0 : activity.energyUsedWh / distanceKm;
    return activity.sportType === 'ebike'
      && distanceKm >= 2
      && distanceKm <= 200
      && activity.energyUsedWh != null
      && activity.energyUsedWh > 0
      && consumption >= 3
      && consumption <= 40
      && activity.elevationGainM >= 0
      && activity.elevationGainM <= 15_000;
  });
}

export function buildBatteryModel(
  activities: RideActivity[],
  assistMode: AssistMode | null,
): BatteryModel {
  const valid = validBatteryActivities(activities);
  const matchingMode = assistMode == null
    ? valid
    : valid.filter((activity) => activity.assistMode === assistMode);
  const selected = matchingMode.length > 0 ? matchingMode : valid;
  const fallbackMode = assistMode ?? 'smart';

  if (selected.length === 0) {
    return {
      assistMode,
      averageWhPerKm: DEFAULT_WH_PER_KM[fallbackMode],
      conservativeWhPerKm: DEFAULT_WH_PER_KM[fallbackMode],
      historicalClimbMPerKm: 25,
      sampleCount: 0,
      distanceKm: 0,
      typicalCapacityWh: null,
      confidence: 'low',
      source: 'default',
    };
  }

  const totalDistanceKm = selected.reduce((sum, activity) => sum + activity.distanceM / 1000, 0);
  const totalEnergyWh = selected.reduce((sum, activity) => sum + (activity.energyUsedWh ?? 0), 0);
  const consumptions = selected.map((activity) => (
    (activity.energyUsedWh ?? 0) / (activity.distanceM / 1000)
  ));
  const averageWhPerKm = totalEnergyWh / totalDistanceKm;
  const conservativeWhPerKm = Math.max(averageWhPerKm, percentile(consumptions, 0.75));
  const totalClimbM = selected.reduce((sum, activity) => sum + activity.elevationGainM, 0);
  const capacityActivity = [...selected]
    .sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt))
    .find((activity) => activity.batteryCapacityWh != null && activity.batteryCapacityWh > 0);
  const confidence: BatteryModelConfidence = selected.length >= 8 && totalDistanceKm >= 150
    ? 'high'
    : selected.length >= 3 && totalDistanceKm >= 50
      ? 'medium'
      : 'low';

  return {
    assistMode,
    averageWhPerKm,
    conservativeWhPerKm,
    historicalClimbMPerKm: totalClimbM / totalDistanceKm,
    sampleCount: selected.length,
    distanceKm: totalDistanceKm,
    typicalCapacityWh: capacityActivity?.batteryCapacityWh ?? null,
    confidence,
    source: matchingMode.length > 0 && assistMode != null ? 'personal-mode' : 'personal-all',
  };
}

export function predictBatteryForRoute({
  model,
  distanceKm,
  elevationGainM,
  batteryStart,
  capacityWh,
  reservePercent = 15,
}: {
  model: BatteryModel;
  distanceKm: number;
  elevationGainM: number;
  batteryStart: number;
  capacityWh: number;
  reservePercent?: number;
}): BatteryRoutePrediction {
  const normalizedDistanceKm = Math.max(0, distanceKm);
  const normalizedCapacityWh = Math.max(1, capacityWh);
  const normalizedStart = Math.min(100, Math.max(0, batteryStart));
  const normalizedReserve = Math.min(normalizedStart, Math.max(0, reservePercent));
  const routeClimbMPerKm = normalizedDistanceKm > 0
    ? Math.max(0, elevationGainM) / normalizedDistanceKm
    : model.historicalClimbMPerKm;
  const terrainFactor = Math.min(
    1.45,
    Math.max(0.85, 1 + (routeClimbMPerKm - model.historicalClimbMPerKm) / 250),
  );
  const adjustedWhPerKm = model.conservativeWhPerKm * terrainFactor;
  const requiredWh = normalizedDistanceKm * adjustedWhPerKm;
  const availableWh = normalizedCapacityWh * normalizedStart / 100;
  const usableWh = normalizedCapacityWh * Math.max(0, normalizedStart - normalizedReserve) / 100;
  const marginWh = usableWh - requiredWh;
  const arrivalPercent = Math.max(0, (availableWh - requiredWh) / normalizedCapacityWh * 100);
  const safeRangeKm = adjustedWhPerKm > 0 ? usableWh / adjustedWhPerKm : 0;
  const state: BatteryRouteState = marginWh < 0
    ? 'insufficient'
    : marginWh < normalizedCapacityWh * 0.1
      ? 'tight'
      : 'safe';

  return {
    state,
    requiredWh,
    availableWh,
    usableWh,
    marginWh,
    arrivalPercent,
    safeRangeKm,
    adjustedWhPerKm,
    reservePercent: normalizedReserve,
  };
}
