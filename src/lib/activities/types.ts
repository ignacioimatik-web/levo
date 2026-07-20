export type AssistMode = 'eco' | 'trail' | 'turbo' | 'smart';
export type SportType = 'ebike' | 'mtb';
export type SyncStatus = 'local' | 'syncing' | 'synced' | 'error';
export type ActivityPrivacy = 'private' | 'followers' | 'public';

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

export interface RideWeatherSample {
  sourceLabel?: string;
  source?: 'aemet-observation' | 'open-meteo-model' | 'unavailable';
  observedAt?: string | null;
  dataAgeMin?: number | null;
  dataIsStale?: boolean;
  capturedAt: string;
  distanceM: number;
  phaseId: string;
  phaseFromKm: number;
  phaseToKm: number;
  temperatureC: number | null;
  humidityPct: number | null;
  windKmh: number | null;
  maxWindKmh: number | null;
  precipitationMm: number | null;
  windEffect: 'headwind' | 'tailwind' | 'crosswind' | 'calm' | 'unknown';
  feelLabel: string;
  confidence: 'high' | 'medium' | 'low';
  nearestStationKm: number | null;
  stationCount: number;
  riskLevel: 'green' | 'yellow' | 'red';
  lightMarginMinutes: number | null;
}

export interface SegmentEffort {
  segmentId: string;
  elapsedSeconds: number;
  startedAt: string;
  endedAt: string;
  distanceM: number;
  averageSpeedKmh: number;
  matchQuality: number;
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
  weatherSamples?: RideWeatherSample[];
  segmentEfforts?: SegmentEffort[];
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
  batteryReservePercent?: number;
}

export interface BatteryCalibration {
  percent: number;
  distanceM: number;
  recordedAt: number;
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
  weatherSamples?: RideWeatherSample[];
  batteryCalibration?: BatteryCalibration | null;
}
