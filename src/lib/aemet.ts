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
  altitud?: number;
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

export interface AemetAlert {
  nivel: number;
  tipo: string;
  descripcion: string;
  provinciaNombre: string;
}

export interface AemetNow {
  stationCode: string;
  stationName: string;
  stationProvince?: string;
  stationAltitude?: number;
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
  windDirectionDeg?: number;
  riskLevel: 'green' | 'yellow' | 'red';
  routeNowLabel: string;
  routeNowMessage: string;
  nearbyStations?: Array<{
    stationCode: string;
    stationName: string;
    distanceKm: number;
    altitudeM?: number;
    temperatureC?: number;
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
  if (!value || typeof value !== 'string') return null;
  const v = value.trim().toUpperCase();

  // Plain decimal (no hemisphere suffix)
  const dec = parseFloat(v);
  if (!isNaN(dec) && v.indexOf('N') === -1 && v.indexOf('S') === -1 && v.indexOf('E') === -1 && v.indexOf('W') === -1) {
    return Math.round(dec * 10000) / 10000;
  }

  let m: RegExpMatchArray | null;

  // DDMMSS.ssN / DDMMSSN — sexagesimal with seconds, possibly fractional
  m = v.match(/^(\d{2,3})(\d{2})(\d{2}(?:\.\d+)?)([NSEW])$/);
  if (m) {
    const deg = Number(m[1]), min = Number(m[2]), sec = Number(m[3]);
    let decimal = deg + min / 60 + sec / 3600;
    if (m[4] === 'S' || m[4] === 'W') decimal *= -1;
    return Math.round(decimal * 10000) / 10000;
  }

  // DDMM.mmmN — sexagesimal with fractional minutes (4+ digits before decimal)
  m = v.match(/^(\d{2,3})(\d{2}\.\d+)([NSEW])$/);
  if (m) {
    const deg = Number(m[1]), min = Number(m[2]);
    let decimal = deg + min / 60;
    if (m[3] === 'S' || m[3] === 'W') decimal *= -1;
    return Math.round(decimal * 10000) / 10000;
  }

  // DDMMN — sexagesimal, whole minutes only (no seconds)
  m = v.match(/^(\d{2,3})(\d{2})([NSEW])$/);
  if (m) {
    const deg = Number(m[1]), min = Number(m[2]);
    let decimal = deg + min / 60;
    if (m[3] === 'S' || m[3] === 'W') decimal *= -1;
    return Math.round(decimal * 10000) / 10000;
  }

  // DD.ddddN — decimal degrees with hemisphere (2-3 digits, last resort)
  m = v.match(/^(\d{2,3}\.\d+)([NSEW])$/);
  if (m) {
    let decimal = parseFloat(m[1]);
    if (decimal > 180) return null; // sanity check — not a valid coord
    if (m[2] === 'S' || m[2] === 'W') decimal *= -1;
    return Math.round(decimal * 10000) / 10000;
  }

  return null;
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
  return (await dataRes.json()) as T;
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

export async function getAemetNowForLocation(lat: number, lng: number): Promise<AemetNow | null> {
  const apiKey = process.env.AEMET_API_KEY;
  if (!apiKey) return null;

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
        distanceKm: haversineKm(lat, lng, stationLat, stationLng),
      };
    })
    .filter((s): s is NonNullable<typeof s> => s !== null)
    .sort((a, b) => a.distanceKm - b.distanceKm);

  if (!parsed.length) return null;
  const nearest = parsed[0];

  // Try up to 15 nearest stations to ensure we find real observation data
  const CANDIDATE_LIMIT = 15;
  const candidates = parsed.slice(0, CANDIDATE_LIMIT);
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

  // Find the nearest station that actually has observation data
  const bestMatch = stationObs.find((x) => x.obs);
  if (!bestMatch) return null;
  const obsStation = bestMatch.station;
  const obs = bestMatch.obs!; // guaranteed by the find above

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
      const altDiff = Math.abs((s.station.altitud ?? 0) - (nearest.altitud ?? 0));
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
    stationAltitude: nearest.altitud,
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
    windDirectionDeg: toNumber(obs.dv),
    ...score,
    routeNowMessage: staleMessage ? `${score.routeNowMessage} ${staleMessage}` : score.routeNowMessage,
    nearbyStations: stationObs.map(({ station, obs: o }) => ({
      stationCode: station.indicativo,
      stationName: station.nombre,
      distanceKm: Math.round(station.distanceKm * 10) / 10,
      altitudeM: station.altitud,
      temperatureC: toNumber(o?.ta),
      updatedAt: o?.fint,
    })),
    temperatureRangeC,
    weightedRouteTempC,
  };
}

export async function getAemetAlertsForProvince(province: string): Promise<AemetAlert[]> {
  const apiKey = process.env.AEMET_API_KEY;
  if (!apiKey) return [];

  try {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');

    const data = await fetchAemetData<any[]>(`/avisos/fichero/${year}/${month}/${day}`, apiKey);

    if (!Array.isArray(data)) return [];

    // Normalize province name for matching
    const provNorm = province.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    return data
      .filter((a: any) => {
        const name = (a.provinciaNombre || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        return name.includes(provNorm) || provNorm.includes(name);
      })
      .map((a: any) => ({
        nivel: Number(a.nivel) || 0,
        tipo: a.tipo || '',
        descripcion: a.descripcion || '',
        provinciaNombre: a.provinciaNombre || '',
      }));
  } catch {
    return [];
  }
}

// Province → INE municipality code mapping for thunderstorm forecast
const PROVINCE_MUNICIPIO: Record<string, string> = {
  'barcelona': '08019',
  'tarragona': '43148',
  'lleida': '25120',
  'girona': '17079',
  'madrid': '28079',
  'valencia': '46250',
  'alicante': '03014',
  'castellon': '12040',
  'sevilla': '41091',
  'malaga': '29067',
  'murcia': '30030',
  'zaragoza': '50297',
  'bilbao': '48020',
  'palmas': '35016',
  'tenerife': '38038',
  'pamplona': '31201',
  'vitoria': '01059',
  'santander': '39075',
  'santiago': '15078',
  'toledo': '45168',
  'granada': '18087',
  'cordoba': '14021',
  'valladolid': '47186',
  'huesca': '22125',
  'teruel': '44216',
};

export async function getThunderstormProbability(lat: number, lng: number, province?: string): Promise<number> {
  const apiKey = process.env.AEMET_API_KEY;
  if (!apiKey) return 0;

  try {
    // Try to match by province first
    let municipioCode = '';
    if (province) {
      const provNorm = province.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
      for (const [key, code] of Object.entries(PROVINCE_MUNICIPIO)) {
        if (provNorm.includes(key) || key.includes(provNorm)) {
          municipioCode = code;
          break;
        }
      }
    }

    if (!municipioCode) return 0;

    const data = await fetchAemetData<any>(`/prediccion/especifica/municipio/diaria/${municipioCode}`, apiKey);

    // The response has a prediccion array with daily data
    const today = data?.prediccion?.dia?.[0];
    if (today) {
      // probTormenta can be an array (hourly periods) or a single value
      const prob = today.probTormenta;
      if (Array.isArray(prob)) {
        return Math.max(...prob.map((p: any) => Number(p) || 0));
      }
      return Number(prob) || 0;
    }
    return 0;
  } catch {
    return 0;
  }
}

export interface AemetForecastDay {
  date: string;
  dayName: string;
  tempMax: number;
  tempMin: number;
  feelsLikeMax?: number;
  feelsLikeMin?: number;
  humidityMax?: number;
  humidityMin?: number;
  precipitationProb: number;
  stormProb: number;
  windSpeedKmh: number;
  windDirectionDeg?: number;
  windDireccion?: string;
  uvMax?: number;
  skyDesc?: string;
}

export async function getAemetForecast(lat: number, lng: number, province?: string): Promise<AemetForecastDay[]> {
  const apiKey = process.env.AEMET_API_KEY;
  if (!apiKey) return [];

  try {
    let municipioCode = '';
    if (province) {
      const provNorm = province.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
      for (const [key, code] of Object.entries(PROVINCE_MUNICIPIO)) {
        if (provNorm.includes(key) || key.includes(provNorm)) {
          municipioCode = code;
          break;
        }
      }
    }
    if (!municipioCode) return [];

    const data = await fetchAemetData<any>(`/prediccion/especifica/municipio/diaria/${municipioCode}`, apiKey);
    const days: any[] = data?.prediccion?.dia ?? [];
    if (!days.length) return [];

    const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const today = new Date();

    return days.slice(0, 3).map((d: any) => {
      const dateObj = new Date(d.fecha + 'T00:00:00');
      const diffDays = Math.round((dateObj.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      let dayName: string;
      if (diffDays === 0) dayName = 'Hoy';
      else if (diffDays === 1) dayName = 'Mañana';
      else dayName = dayNames[dateObj.getDay()] || '';

      const precipProbs: number[] = (d.probPrecipitacion ?? []).map((p: any) => Number(p) || 0);
      const stormProbs: number[] = (d.probTormenta ?? []).map((p: any) => Number(p) || 0);

      // Wind — take the period with highest speed
      let windSpeed = 0;
      let windDirDeg: number | undefined;
      let windDirText: string | undefined;
      if (Array.isArray(d.viento)) {
        for (const v of d.viento) {
          const spd = Number(v.velocidad) || 0;
          if (spd > windSpeed) {
            windSpeed = spd;
            windDirText = v.direccion || undefined;
          }
        }
      }
      // Convert cardinal direction to degrees
      const cardToDeg: Record<string, number> = { 'N': 0, 'NNE': 22.5, 'NE': 45, 'ENE': 67.5, 'E': 90, 'ESE': 112.5, 'SE': 135, 'SSE': 157.5, 'S': 180, 'SSW': 202.5, 'SW': 225, 'WSW': 247.5, 'W': 270, 'WNW': 292.5, 'NW': 315, 'NNW': 337.5 };
      if (windDirText && cardToDeg[windDirText.toUpperCase()] !== undefined) {
        windDirDeg = cardToDeg[windDirText.toUpperCase()];
      }

      // Sky description — pick first period's description
      const skyDesc = Array.isArray(d.estadoCielo) ? (d.estadoCielo.find((s: any) => s.descripcion)?.descripcion || '') : '';

      return {
        date: d.fecha,
        dayName,
        tempMax: d.temperatura?.maxima ?? 0,
        tempMin: d.temperatura?.minima ?? 0,
        feelsLikeMax: d.sensTermica?.maxima,
        feelsLikeMin: d.sensTermica?.minima,
        humidityMax: d.humedad?.maxima,
        humidityMin: d.humedad?.minima,
        precipitationProb: precipProbs.length > 0 ? Math.max(...precipProbs) : 0,
        stormProb: stormProbs.length > 0 ? Math.max(...stormProbs) : 0,
        windSpeedKmh: windSpeed,
        windDirectionDeg: windDirDeg,
        windDireccion: windDirText,
        uvMax: Number(d.uvMax) || 0,
        skyDesc,
      };
    });
  } catch {
    return [];
  }
}
