import type { MaintenanceHealth, MaintenanceItem } from './types';

export function activityOdometerKm(activities: Array<{ distanceM: number }>): number {
  return activities.reduce((sum, activity) => sum + Math.max(0, activity.distanceM), 0) / 1000;
}

export function maintenanceHealth(item: MaintenanceItem, odometerKm: number): MaintenanceHealth {
  const riddenKm = Math.max(0, odometerKm - item.lastServiceOdometerKm);
  const remainingKm = item.intervalKm - riddenKm;
  const progressPercent = item.intervalKm > 0 ? riddenKm / item.intervalKm * 100 : 100;
  return {
    state: remainingKm <= 0 ? 'due' : progressPercent >= 80 ? 'soon' : 'ok',
    riddenKm,
    remainingKm,
    progressPercent: Math.min(100, Math.max(0, progressPercent)),
  };
}
