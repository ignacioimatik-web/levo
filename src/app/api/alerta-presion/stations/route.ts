import { NextRequest, NextResponse } from 'next/server';
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
  prec?: number | string;
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

  // DD.ddddN — decimal degrees with hemisphere
  m = v.match(/^(\d{2,3}\.\d+)([NSEW])$/);
  if (m) {
    let decimal = parseFloat(m[1]);
    if (m[2] === 'S' || m[2] === 'W') decimal *= -1;
    return Math.round(decimal * 10000) / 10000;
  }

  // DDMMSS.ssN / DDMMSSN — sexagesimal with seconds, possibly fractional
  m = v.match(/^(\d{2,3})(\d{2})(\d{2}(?:\.\d+)?)([NSEW])$/);
  if (m) {
    const deg = Number(m[1]), min = Number(m[2]), sec = Number(m[3]);
    let decimal = deg + min / 60 + sec / 3600;
    if (m[4] === 'S' || m[4] === 'W') decimal *= -1;
    return decimal;
  }

  // DDMM.mmmN — sexagesimal with fractional minutes
  m = v.match(/^(\d{2,3})(\d{2}\.\d+)([NSEW])$/);
  if (m) {
    const deg = Number(m[1]), min = Number(m[2]);
    let decimal = deg + min / 60;
    if (m[3] === 'S' || m[3] === 'W') decimal *= -1;
    return decimal;
  }

  // DDMMN — sexagesimal, whole minutes only (no seconds)
  m = v.match(/^(\d{2,3})(\d{2})([NSEW])$/);
  if (m) {
    const deg = Number(m[1]), min = Number(m[2]);
    let decimal = deg + min / 60;
    if (m[3] === 'S' || m[3] === 'W') decimal *= -1;
    return decimal;
  }

  return null;
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

async function fetchAemetData<T>(path: string, apiKey: string): Promise<T> {
  const url = `${AEMET_BASE_URL}${path}${path.includes('?') ? '&' : '?'}api_key=${apiKey}`;
  const metaRes = await fetch(url, { cache: 'no-store' });
  if (!metaRes.ok) throw new Error(`AEMET request failed (${metaRes.status})`);
  const meta = (await metaRes.json()) as AemetMetaResponse;
  if (meta.estado !== 200 || !meta.datos) throw new Error(`AEMET error: ${meta.descripcion ?? 'unknown'}`);
  const dataRes = await fetch(meta.datos, { cache: 'no-store' });
  if (!dataRes.ok) throw new Error(`AEMET data failed (${dataRes.status})`);
  return (await dataRes.json()) as T;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const lat = parseFloat(searchParams.get('lat') || '40.62');
  const lng = parseFloat(searchParams.get('lng') || '-0.10');
  const radiusKm = 30;
  const apiKey = process.env.AEMET_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'AEMET API key not configured' }, { status: 500 });

  try {
    // Fetch all stations
    const allStations = await fetchAemetData<AemetStationInventory[]>('/valores/climatologicos/inventarioestaciones/todasestaciones', apiKey);

    // Parse and find stations within radius
    const candidates = allStations
      .map(s => {
        const stationLat = parseAemetCoord(s.latitud);
        const stationLng = parseAemetCoord(s.longitud);
        if (stationLat === null || stationLng === null) return null;
        return { ...s, stationLat, stationLng, distanceKm: haversineKm(lat, lng, stationLat, stationLng) };
      })
      .filter((s): s is NonNullable<typeof s> => s !== null && s.distanceKm <= radiusKm)
      .sort((a, b) => a.distanceKm - b.distanceKm);

    if (candidates.length === 0) {
      return NextResponse.json({ stations: [], message: 'No hay estaciones en el área' });
    }

    // Fetch observations for the nearest stations (up to 6)
    const nearStations = candidates.slice(0, 6);
    const obsResults = await Promise.allSettled(
      nearStations.map(async st => {
        try {
          const arr = await fetchAemetData<AemetObservation[]>(`/observacion/convencional/datos/estacion/${st.indicativo}`, apiKey);
          const latest = [...(arr ?? [])].sort((a, b) => {
            const ta = Date.parse(a.fint?.replace(/([+-]\d{2})(\d{2})$/, '$1:$2') || '') || 0;
            const tb = Date.parse(b.fint?.replace(/([+-]\d{2})(\d{2})$/, '$1:$2') || '') || 0;
            return tb - ta;
          })[0];
          return { station: st, obs: latest };
        } catch { return { station: st, obs: undefined }; }
      })
    );

    const stations = obsResults
      .filter((r): r is PromiseFulfilledResult<{ station: any; obs: any }> => r.status === 'fulfilled')
      .map(r => r.value)
      .map(({ station, obs }) => ({
        code: station.indicativo,
        name: station.nombre,
        province: station.provincia,
        lat: station.stationLat,
        lng: station.stationLng,
        distanceKm: Math.round(station.distanceKm * 10) / 10,
        altitudeM: station.altitud,
        temperatureC: toNumber(obs?.ta),
        humidityPct: toNumber(obs?.hr),
        windKmh: toNumber(obs?.vv),
        precipitationMm: toNumber(obs?.prec),
        updatedAt: obs?.fint,
        hasData: obs != null,
      }));

    return NextResponse.json({
      stations,
      centerLat: lat,
      centerLng: lng,
      totalInRadius: candidates.length,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Error al obtener estaciones' }, { status: 500 });
  }
}
