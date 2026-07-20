export type RideDisplayMode = 'basic' | 'pro';

export const RIDE_DISPLAY_MODE_STORAGE_KEY = 'levo.ride-display-mode.v1';
export const RIDE_DISPLAY_MODE_EVENT = 'levo:ride-display-mode';

export function normalizeRideDisplayMode(value: string | null | undefined): RideDisplayMode {
  return value === 'pro' ? 'pro' : 'basic';
}
