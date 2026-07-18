export const GPS_STALE_RESTART_MS = 30_000;
export const GPS_RESUME_RESTART_MS = 15_000;
export const GPS_RESTART_COOLDOWN_MS = 20_000;

export function shouldRestartGpsWatch({
  recording,
  demo,
  lastFixAt,
  lastRestartAt,
  now,
  staleAfterMs = GPS_STALE_RESTART_MS,
}: {
  recording: boolean;
  demo: boolean;
  lastFixAt: number;
  lastRestartAt: number;
  now: number;
  staleAfterMs?: number;
}): boolean {
  if (!recording || demo || lastFixAt <= 0) return false;
  if (now - lastFixAt < staleAfterMs) return false;
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
