import type { SyncStatus } from '@/lib/activities/types';

export type MaintenanceCategory = 'drivetrain' | 'brakes' | 'suspension' | 'tires' | 'motor' | 'other';

export interface MaintenanceItem {
  id: string;
  remoteId?: string;
  name: string;
  category: MaintenanceCategory;
  intervalKm: number;
  lastServiceOdometerKm: number;
  lastServiceAt: string | null;
  serviceCount: number;
  updatedAt: string;
  syncStatus: SyncStatus;
}

export type MaintenanceState = 'ok' | 'soon' | 'due';

export interface MaintenanceHealth {
  state: MaintenanceState;
  riddenKm: number;
  remainingKm: number;
  progressPercent: number;
}
