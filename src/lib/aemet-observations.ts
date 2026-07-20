export interface AemetObservation {
  idema: string;
  fint?: string;
  ta?: number;
  hr?: number;
  vv?: number;
  dv?: number;
  prec?: number | string;
  vis?: number;
  nubes?: string;
  vmax?: number;
  uvMax?: number;
}

function observationTimestamp(value?: string): number {
  if (!value) return 0;
  const normalized = value.replace(/([\+\-]\d{2})(\d{2})$/, '$1:$2');
  const timestamp = Date.parse(normalized);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export function selectLatestAemetObservations(
  observations: AemetObservation[],
): Map<string, AemetObservation> {
  const latest = new Map<string, AemetObservation>();
  for (const observation of observations) {
    const stationCode = observation.idema?.trim().toUpperCase();
    if (!stationCode) continue;
    const current = latest.get(stationCode);
    if (!current || observationTimestamp(observation.fint) > observationTimestamp(current.fint)) {
      latest.set(stationCode, observation);
    }
  }
  return latest;
}
