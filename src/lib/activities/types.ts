export type AssistMode = 'eco' | 'trail' | 'turbo' | 'smart';
export type SportType = 'ebike' | 'mtb';
export type SyncStatus = 'local' | 'syncing' | 'synced' | 'error';
export type ActivityPrivacy = 'private' | 'public';

export interface RidePoint {
  latitude: number;
  longitude: number;
  elevation: number | null;
  accuracy: number;
  speed: number | null;
  timestamp: number;
}

export interface RideMetrics {
  distanceM: number;
  elevationGainM: number;
  movingSeconds: number;
  averageSpeedKmh: number;
  maxSpeedKmh: number;
}

export interface RideActivity extends RideMetrics {
  id: string;
  title: string;
  sportType: SportType;
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
  batteryStart: number | null;
  batteryEnd: number | null;
  batteryCapacityWh: number | null;
  assistMode: AssistMode | null;
  energyUsedWh: number | null;
  points: RidePoint[];
  privacy: ActivityPrivacy;
  syncStatus: SyncStatus;
  remoteId?: string;
  remoteUserId?: string;
}

export interface RideSettings {
  sportType: SportType;
  batteryStart: number;
  batteryCapacityWh: number;
  assistMode: AssistMode;
}

export interface RideDraft {
  id: string;
  startedAt: number;
  updatedAt: number;
  durationSeconds: number;
  points: RidePoint[];
  settings: RideSettings;
  isDemo: boolean;
  liveSession?: {
    id: string;
    shareToken: string;
  } | null;
  plannedRouteId?: string;
  navigationCompletedM?: number;
}
