import type { RideActivity } from '@/lib/activities/types';
import type { Achievement, ProgressSummary, WeekSummary } from './types';

function startOfWeek(date: Date): Date {
  const result = new Date(date);
  const day = result.getDay() || 7;
  result.setDate(result.getDate() - day + 1);
  result.setHours(0, 0, 0, 0);
  return result;
}

function weekKey(date: Date): string {
  return startOfWeek(date).toISOString().slice(0, 10);
}

function bestBy(
  activities: RideActivity[],
  score: (activity: RideActivity) => number | null,
  lowerIsBetter = false,
): RideActivity | null {
  return activities.reduce<RideActivity | null>((best, activity) => {
    const value = score(activity);
    if (value == null || !Number.isFinite(value)) return best;
    if (!best) return activity;
    const bestValue = score(best);
    if (bestValue == null) return activity;
    return lowerIsBetter ? (value < bestValue ? activity : best) : (value > bestValue ? activity : best);
  }, null);
}

function achievement(
  id: string,
  name: string,
  description: string,
  current: number,
  target: number,
): Achievement {
  return {
    id,
    name,
    description,
    unlocked: current >= target,
    progress: Math.min(100, current / target * 100),
  };
}

export function calculateProgress(
  activities: RideActivity[],
  now = new Date(),
): ProgressSummary {
  const weeks: WeekSummary[] = [];
  const currentStart = startOfWeek(now);
  for (let offset = 7; offset >= 0; offset -= 1) {
    const start = new Date(currentStart);
    start.setDate(start.getDate() - offset * 7);
    weeks.push({
      key: weekKey(start),
      label: new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' }).format(start),
      distanceKm: 0,
      elevationM: 0,
      rides: 0,
      durationSeconds: 0,
    });
  }

  const weekMap = new Map(weeks.map((week) => [week.key, week]));
  for (const activity of activities) {
    const week = weekMap.get(weekKey(new Date(activity.startedAt)));
    if (!week) continue;
    week.distanceKm += activity.distanceM / 1000;
    week.elevationM += activity.elevationGainM;
    week.rides += 1;
    week.durationSeconds += activity.durationSeconds;
  }

  const totalDistanceKm = activities.reduce((sum, activity) => sum + activity.distanceM / 1000, 0);
  const totalElevationM = activities.reduce((sum, activity) => sum + activity.elevationGainM, 0);
  const totalDurationSeconds = activities.reduce((sum, activity) => sum + activity.durationSeconds, 0);
  const eBikeActivities = activities.filter((activity) => (
    activity.sportType === 'ebike'
    && activity.energyUsedWh != null
    && activity.distanceM > 500
  ));
  const totalEbikeDistanceKm = eBikeActivities.reduce((sum, activity) => sum + activity.distanceM / 1000, 0);
  const totalEnergyWh = eBikeActivities.reduce((sum, activity) => sum + (activity.energyUsedWh ?? 0), 0);
  const averageWhPerKm = totalEbikeDistanceKm > 0 ? totalEnergyWh / totalEbikeDistanceKm : null;

  let activeWeekStreak = 0;
  for (let index = weeks.length - 1; index >= 0; index -= 1) {
    if (weeks[index].rides === 0) {
      if (index === weeks.length - 1) continue;
      break;
    }
    activeWeekStreak += 1;
  }

  const longest = bestBy(activities, (activity) => activity.distanceM);
  const mostElevation = bestBy(activities, (activity) => activity.elevationGainM);
  const fastest = bestBy(activities, (activity) => activity.averageSpeedKmh);
  const mostEfficient = bestBy(
    eBikeActivities,
    (activity) => (activity.energyUsedWh ?? 0) / (activity.distanceM / 1000),
    true,
  );

  const achievements = [
    achievement('first-ride', 'Primera huella', 'Guarda tu primera salida.', activities.length, 1),
    achievement('century', 'Territorio 100', 'Acumula 100 km sobre la bici.', totalDistanceKm, 100),
    achievement('vertical', 'Cazacumbres', 'Acumula 2.500 m de desnivel positivo.', totalElevationM, 2_500),
    achievement('long-ride', 'Gran fondo MTB', 'Completa una salida de 50 km.', (longest?.distanceM ?? 0) / 1000, 50),
    achievement('streak', 'Ritmo constante', 'Rueda durante 4 semanas consecutivas.', activeWeekStreak, 4),
    achievement(
      'battery-master',
      'Domador de vatios',
      'Completa 100 km e-bike con datos de consumo.',
      totalEbikeDistanceKm,
      100,
    ),
  ];

  return {
    weeks,
    currentWeek: weeks.at(-1)!,
    totalDistanceKm,
    totalElevationM,
    totalRides: activities.length,
    totalDurationSeconds,
    activeWeekStreak,
    averageWhPerKm,
    batteryDistanceKm: totalEbikeDistanceKm,
    records: { longest, mostElevation, fastest, mostEfficient },
    achievements,
  };
}
