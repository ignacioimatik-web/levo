import type { RideActivity } from '@/lib/activities/types';

export interface ProgressGoals {
  weeklyDistanceKm: number;
  weeklyElevationM: number;
  weeklyRides: number;
}

export interface WeekSummary {
  key: string;
  label: string;
  distanceKm: number;
  elevationM: number;
  rides: number;
  durationSeconds: number;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  unlocked: boolean;
  progress: number;
}

export interface ProgressSummary {
  weeks: WeekSummary[];
  currentWeek: WeekSummary;
  totalDistanceKm: number;
  totalElevationM: number;
  totalRides: number;
  totalDurationSeconds: number;
  activeWeekStreak: number;
  averageWhPerKm: number | null;
  batteryDistanceKm: number;
  records: {
    longest: RideActivity | null;
    mostElevation: RideActivity | null;
    fastest: RideActivity | null;
    mostEfficient: RideActivity | null;
  };
  achievements: Achievement[];
}
