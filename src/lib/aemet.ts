import { haversineKm } from '@/lib/gpx-utils';

const AEMET_BASE_URL = 'https://opendata.aemet.es/opendata/api';

interface AemetMetaResponse {
  estado: number;
  datos?: string;
  descripcion?: string;
}

interface AemetStationInventory {
  indicativo: string;
  nombre: string;
  latitud: string;
  longitud: string;
  provincia?: string;
  altitud?: number | string;
}

interface AemetObservation {
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

export interface AemetNow {
  stationCode: string;
  stationName: string;
  stationProvince?: string;
  stationDistanceKm: number;
  updatedAt?: string;
  dataAgeMin?: number;
  dataIsStale?: boolean;
  temperatureC?: number;
  humidityPct?: number;
  windKmh?: number;
  maxWindKmh?: number;
  precipitationMm?: number;
  visibilityM?: number;
  uvMax?: number;
  riskLevel: 'green' | 'yellow' | 'red';
  routeNowLabel: string;
  routeNowMessage: string;
  nearbyStations?: Array<{
    stationCode: string;
    stationName: string;
    distanceKm: number;
    altitudeM?: number;
    latitude: number;
    longitude: number;
    temperatureC?: number;
    humidityPct?: number;
    windKmh?: number;
    maxWindKmh?: number;
    windDirectionDeg?: number;
    precipitationMm?: number;
    dataAgeMin?: number;
    updatedAt?: string;
  }>;
  temperatureRangeC?: { min: number; max: number };
  weightedRouteTempC?: number;
}

function parseAemetTimestamp(value?: string): number | null {
  if (!value) return null;
  // AEMET example: 2026-05-25T11:00:00+0000
  const normalized = value.replace(/([\+\-]\d{2})(\d{2})$/, '$1:$2');
  const ts = Date.parse(normalized);
  return Number.isFinite(ts) ? ts : null;
}

function parseAemetCoord(value: string): number | null {
  // Common AEMET format: DDMMSSN / DDDMMSSW
  const m = value.trim().toUpperCase().match(/^(\d{2,3})(\d{2})(\d{2})([NSEW])$/);
  if (!m) return null;
  const deg = Number(m[1]);
  const min = Number(m[2]);
  const sec = Number(m[3]);
  const hemi = m[4];
  let decimal = deg + min / 60 + sec / 3600;
  if (hemi === 'S' || hemi === 'W') decimal *= -1;
  return decimal;
}

async function fetchAemetData<T>(path: string, apiKey: string): Promise<T> {
  const url = `${AEMET_BASE_URL}${path}${path.includes('?') ? '&' : '?'}api_key=${apiKey}`;
  const metaRes = await fetch(url, { cache: 'no-store' });
  if (!metaRes.ok) {
    throw new Error(`AEMET metadata request failed (${metaRes.status})`);
  }
  const meta = (await metaRes.json()) as AemetMetaResponse;
  if (meta.estado !== 200 || !meta.datos) {
    throw new Error(`AEMET metadata error: ${meta.descripcion ?? 'unknown'}`);
  }

  const dataRes = await fetch(meta.datos, { cache: 'no-store' });
  if (!dataRes.ok) {
    throw new Error(`AEMET data request failed (${dataRes.status})`);
  }
  const bytes = await dataRes.arrayBuffer();
  let text = new TextDecoder('utf-8').decode(bytes);
  if (text.includes('\uFFFD')) {
    text = new TextDecoder('windows-1252').decode(bytes);
  }
  return JSON.parse(text) as T;
}

function toNumber(value: unknown): number | undefined {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value === 'string') {
    if (value.trim() === '' || value.toLowerCase() === 'ip') return 0;
    const num = Number(value.replace(',', '.'));
    return Number.isFinite(num) ? num : undefined;
  }
  return undefined;
}

function scoreRouteNow(obs: AemetObservation): Pick<AemetNow, 'riskLevel' | 'routeNowLabel' | 'routeNowMessage'> {
  const prec = toNumber(obs.prec) ?? 0;
  const wind = toNumber(obs.vmax) ?? toNumber(obs.vv) ?? 0;
  const temp = toNumber(obs.ta);
  const humidity = toNumber(obs.hr);

  const red = prec >= 3 || wind >= 45;
  const yellow = prec > 0 || wind >= 28 || (temp !== undefined && (temp >= 33 || temp <= 2)) || (humidity !== undefined && humidity >= 92);

  if (red) {
    return {
      riskLevel: 'red',
      routeNowLabel: 'Comprometida ahora',
      routeNowMessage: 'Condiciones adversas (lluvia/viento). Revisa bien seguridad y alternativas.',
    };
  }
  if (yellow) {
    return {
      riskLevel: 'yellow',
      routeNowLabel: 'Con precaucion',
      routeNowMessage: 'Condiciones variables. Ajusta ritmo, equipo y decision por tramo.',
    };
  }
  return {
    riskLevel: 'green',
    routeNowLabel: 'Favorable ahora',
    routeNowMessage: 'Condiciones generalmente buenas para rodar, manteniendo prudencia.',
  };
}

async function getAemetNowForTargets(
  targets: Array<{ lat: number; lng: number }>,
): Promise<AemetNow | null> {
  const apiKey = process.env.AEMET_API_KEY;
  if (!apiKey || targets.length === 0) return null;

  const stations = await fetchAemetData<AemetStationInventory[]>('/valores/climatologicos/inventarioestaciones/todasestaciones', apiKey);

  const parsed = stations
    .map((s) => {
      const stationLat = parseAemetCoord(s.latitud);
      const stationLng = parseAemetCoord(s.longitud);
      if (stationLat === null || stationLng === null) return null;
      return {
        ...s,
        stationLat,
        stationLng,
        distanceKm: Math.min(...targets.map((target) => (
          haversineKm(target.lat, target.lng, stationLat, stationLng)
        ))),
      };
    })
    .filter((s): s is NonNullable<typeof s> => s !== null)
    .sort((a, b) => a.distanceKm - b.distanceKm);

  if (!parsed.length) return null;
  if (parsed[0].distanceKm > 100) return null;
  const selectedCodes = new Set<string>();
  const candidates: typeof parsed = [];
  for (const target of targets) {
    const nearestTargetStation = parsed
      .filter((station) => !selectedCodes.has(station.indicativo))
      .sort((a, b) => (
        haversineKm(target.lat, target.lng, a.stationLat, a.stationLng)
        - haversineKm(target.lat, target.lng, b.stationLat, b.stationLng)
      ))[0];
    if (!nearestTargetStation) continue;
    selectedCodes.add(nearestTargetStation.indicativo);
    candidates.push(nearestTargetStation);
    if (candidates.length >= 8) break;
  }
  for (const station of parsed) {
    if (candidates.length >= 8) break;
    if (selectedCodes.has(station.indicativo)) continue;
    selectedCodes.add(station.indicativo);
    candidates.push(station);
  }
  const stationObs = await Promise.all(
    candidates.map(async (st) => {
      try {
        const arr = await fetchAemetData<AemetObservation[]>(`/observacion/convencional/datos/estacion/${st.indicativo}`, apiKey);
        const latest = [...(arr ?? [])].sort((a, b) => {
          const ta = parseAemetTimestamp(a.fint) ?? 0;
          const tb = parseAemetTimestamp(b.fint) ?? 0;
          return tb - ta;
        })[0];
        return { station: st, obs: latest };
      } catch {
        return { station: st, obs: undefined };
      }
    })
  );

  const nearestAvailable = stationObs.find((item) => item.obs);
  if (!nearestAvailable?.obs) return null;
  const nearest = nearestAvailable.station;
  const obs = nearestAvailable.obs;

  const obsTs = parseAemetTimestamp(obs.fint);
  const dataAgeMin = obsTs ? Math.max(0, Math.round((Date.now() - obsTs) / 60000)) : undefined;
  const dataIsStale = typeof dataAgeMin === 'number' ? dataAgeMin > 120 : false;

  const score = scoreRouteNow(obs);
  const staleMessage = dataIsStale
    ? 'Dato AEMET con mas de 2 horas. Usa esta referencia con cautela.'
    : '';

  const tempSamples = stationObs
    .map(({ station, obs: o }) => ({ station, temp: toNumber(o?.ta), updatedAt: o?.fint }))
    .filter((x) => typeof x.temp === 'number') as Array<{
      station: (typeof candidates)[number];
      temp: number;
      updatedAt?: string;
    }>;

  let weightedRouteTempC: number | undefined;
  let temperatureRangeC: { min: number; max: number } | undefined;
  if (tempSamples.length > 0) {
    let tempW = 0;
    let wSum = 0;
    for (const s of tempSamples) {
      const distW = 1 / Math.max(0.5, s.station.distanceKm);
      const altDiff = Math.abs((toNumber(s.station.altitud) ?? 0) - (toNumber(nearest.altitud) ?? 0));
      const altW = 1 / (1 + altDiff / 300);
      const w = distW * altW;
      tempW += s.temp * w;
      wSum += w;
    }
    weightedRouteTempC = wSum > 0 ? Math.round((tempW / wSum) * 10) / 10 : undefined;
    temperatureRangeC = {
      min: Math.min(...tempSamples.map((s) => s.temp)),
      max: Math.max(...tempSamples.map((s) => s.temp)),
    };
  }

  return {
    stationCode: nearest.indicativo,
    stationName: nearest.nombre,
    stationProvince: nearest.provincia,
    stationDistanceKm: Math.round(nearest.distanceKm * 10) / 10,
    updatedAt: obs.fint,
    dataAgeMin,
    dataIsStale,
    temperatureC: toNumber(obs.ta),
    humidityPct: toNumber(obs.hr),
    windKmh: toNumber(obs.vv),
    maxWindKmh: toNumber(obs.vmax),
    precipitationMm: toNumber(obs.prec),
    visibilityM: toNumber(obs.vis),
    uvMax: toNumber(obs.uvMax),
    ...score,
    routeNowMessage: staleMessage ? `${score.routeNowMessage} ${staleMessage}` : score.routeNowMessage,
    nearbyStations: stationObs
      .filter(({ obs: stationObservation }) => stationObservation != null)
      .map(({ station, obs: o }) => {
        const stationTimestamp = parseAemetTimestamp(o?.fint);
        return {
          stationCode: station.indicativo,
          stationName: station.nombre,
          distanceKm: Math.round(station.distanceKm * 10) / 10,
          altitudeM: toNumber(station.altitud),
          latitude: station.stationLat,
          longitude: station.stationLng,
          temperatureC: toNumber(o?.ta),
          humidityPct: toNumber(o?.hr),
          windKmh: toNumber(o?.vv),
          maxWindKmh: toNumber(o?.vmax),
          windDirectionDeg: toNumber(o?.dv),
          precipitationMm: toNumber(o?.prec),
          dataAgeMin: stationTimestamp
            ? Math.max(0, Math.round((Date.now() - stationTimestamp) / 60_000))
            : undefined,
          updatedAt: o?.fint,
        };
      }),
    temperatureRangeC,
    weightedRouteTempC,
  };
}

export async function getAemetNowForLocation(lat: number, lng: number): Promise<AemetNow | null> {
  return getAemetNowForTargets([{ lat, lng }]);
}

export async function getAemetNowForRoute(
  points: Array<{ lat: number; lng: number }>,
): Promise<AemetNow | null> {
  if (points.length === 0) return null;
  const sampleCount = Math.min(8, points.length);
  const targets = Array.from({ length: sampleCount }, (_, index) => (
    points[Math.round(index * (points.length - 1) / Math.max(1, sampleCount - 1))]
  ));
  return getAemetNowForTargets(targets);
}
