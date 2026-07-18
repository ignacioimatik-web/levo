import type { RidePointRejection } from './geo';

export const GPS_STALE_RESTART_MS = 30_000;
export const GPS_RESUME_RESTART_MS = 15_000;
export const GPS_RESTART_COOLDOWN_MS = 20_000;

export function gpsAssessmentKeepsSignalAlive(
  reason: RidePointRejection | null,
): boolean {
  // Stationary drift is intentionally omitted from the track, but it still
  // proves that the receiver is delivering a current, usable GPS fix.
  return reason == null || reason === 'drift';
}

export function shouldRestartGpsWatch({
  recording,
  demo,
  lastFixAt,
  watchStartedAt = 0,
  lastRestartAt,
  now,
  staleAfterMs = GPS_STALE_RESTART_MS,
}: {
  recording: boolean;
  demo: boolean;
  lastFixAt: number;
  watchStartedAt?: number;
  lastRestartAt: number;
  now: number;
  staleAfterMs?: number;
}): boolean {
  if (!recording || demo) return false;
  const freshnessAnchor = lastFixAt > 0 ? lastFixAt : watchStartedAt;
  if (freshnessAnchor <= 0 || now - freshnessAnchor < staleAfterMs) return false;
  return lastRestartAt <= 0 || now - lastRestartAt >= GPS_RESTART_COOLDOWN_MS;
}

export function displayedRideSpeedKmh({
  recording,
  demo,
  signalAgeSeconds,
  speedMps,
}: {
  recording: boolean;
  demo: boolean;
  signalAgeSeconds: number;
  speedMps: number | null | undefined;
}): number {
  if (!recording || (!demo && signalAgeSeconds > 10) || speedMps == null) return 0;
  return Math.max(0, speedMps * 3.6);
}
