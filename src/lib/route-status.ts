import { promises as fs } from 'fs';
import path from 'path';
import { demoTrails } from '@/data/trails';
import { routes } from '@/data/routes';
import { parseGPX } from '@/lib/gpx-utils';
import { analyzeRoute } from '@/lib/route-analysis';
import { getAemetNowForLocation } from '@/lib/aemet';
import { assessSegmentRisk } from '@/lib/segment-risk';
import { calcSunriseSunset, type DaylightInfo } from '@/lib/daylight';

export interface RouteStatusPayload {
  ok: boolean;
  slug: string;
  source?: 'trail-coordinates' | 'route-gpx' | 'trail-gpx';
  title?: string;
  viewerNow?: string;
  viewerTimeZone?: string;
  points?: Array<{ lat: number; lng: number }>;
  profile?: ReturnType<typeof analyzeRoute>;
  weatherNow?: Awaited<ReturnType<typeof getAemetNowForLocation>> | { error: string; detail?: string } | null;
  daylight?: DaylightInfo;
  safeDeadline?: string; // latest safe departure time HH:MM
  notes?: string[];
  recommendedWindows?: Array<{
    slot: 'manana' | 'tarde' | 'noche';
    timeRange: string;
    riskLevel: 'green' | 'yellow' | 'red';
    label: string;
    reason: string;
    data: { temperatureC?: number; windKmh?: number; precipitationMm?: number; humidityPct?: number };
  }>;
  routeNowRecommendation?: {
    generatedAt: string;
    weatherSummary: {
      riskLevel: 'green' | 'yellow' | 'red';
      temperatureC?: number;
      humidityPct?: number;
      windKmh?: number;
      precipitationMm?: number;
    };
    thirds: Array<{
      id: 'T1' | 'T2' | 'T3';
      rangeKm: { from: number; to: number };
      rangePct: { from: number; to: number };
      keyTerrain: string;
      technicalDemand: 'baja' | 'media' | 'alta';
      weatherRisk: 'bajo' | 'medio' | 'alto';
      recommendation: string;
      checklist: string[];
    }>;
  };
  message?: string;
  detail?: string;
}

type RouteThirdRecommendation = {
  id: 'T1' | 'T2' | 'T3';
  rangeKm: { from: number; to: number };
  rangePct: { from: number; to: number };
  keyTerrain: string;
  technicalDemand: 'baja' | 'media' | 'alta';
  weatherRisk: 'bajo' | 'medio' | 'alto';
  recommendation: string;
  checklist: string[];
};

type BikeMode = 'trail' | 'enduro' | 'ebike';

function estimateSegmentTimeMin(distanceKm: number, avgSlopePct: number, mode: BikeMode): number {
  const baseSpeedKmh: Record<BikeMode, number> = {
    trail: 13,
    enduro: 12,
    ebike: 16,
  };
  let speed = baseSpeedKmh[mode];
  if (avgSlopePct > 0) {
    speed -= avgSlopePct * 0.7;
  } else {
    speed += Math.min(6, Math.abs(avgSlopePct) * 0.35);
  }
  speed = Math.max(5, speed);
  return Math.round((distanceKm / speed) * 60);
}

const SLOT_INFO: Record<string, { timeRange: string; label: string }> = {
  manana: { timeRange: '06:00–12:00', label: 'Mañana' },
  tarde: { timeRange: '12:00–18:00', label: 'Tarde' },
  noche: { timeRange: '18:00–00:00', label: 'Noche' },
};

function slotAdjust(baseTemp: number | undefined, baseWind: number | undefined, slot: 'manana' | 'tarde' | 'noche') {
  const t = baseTemp ?? 18;
  const w = baseWind ?? 12;
  if (slot === 'manana') return { temp: t - 2, wind: Math.max(0, w - 2) };
  if (slot === 'tarde') return { temp: t + 3, wind: w + 2 };
  return { temp: t - 5, wind: w + 1 };
}

function evaluateWindow(
  slot: 'manana' | 'tarde' | 'noche',
  params: { precipitationMm?: number; windKmh?: number; temperatureC?: number; humidityPct?: number }
) {
  const adjusted = slotAdjust(params.temperatureC, params.windKmh, slot);
  const rain = params.precipitationMm ?? 0;
  const humidity = params.humidityPct ?? 70;
  const info = SLOT_INFO[slot];

  const red = rain >= 3 || adjusted.wind >= 45 || adjusted.temp <= 0;
  const yellow = rain > 0 || adjusted.wind >= 28 || adjusted.temp >= 33 || humidity >= 92;

  const factors: string[] = [];
  if (rain > 0) factors.push(`lluvia ${rain.toFixed(1)} mm`);
  if (adjusted.wind >= 28) factors.push(`viento ${adjusted.wind} km/h`);
  if (adjusted.temp >= 33) factors.push(`calor ${adjusted.temp} C`);
  if (adjusted.temp <= 5) factors.push(`frio ${adjusted.temp} C`);
  if (humidity >= 85) factors.push(`humedad ${humidity}%`);

  const reason = factors.length
    ? factors.join(', ')
    : `Estable: ${adjusted.temp} C, viento ${adjusted.wind} km/h`;

  if (red) {
    return {
      slot,
      timeRange: info.timeRange,
      riskLevel: 'red' as const,
      label: 'No recomendada',
      reason: `Desaconsejado. ${factors.length ? factors.join(', ') + '.' : 'Condiciones adversas.'}`,
      data: { temperatureC: adjusted.temp, windKmh: adjusted.wind, precipitationMm: rain, humidityPct: humidity },
    };
  }
  if (yellow) {
    return {
      slot,
      timeRange: info.timeRange,
      riskLevel: 'yellow' as const,
      label: 'Con precaución',
      reason,
      data: { temperatureC: adjusted.temp, windKmh: adjusted.wind, precipitationMm: rain, humidityPct: humidity },
    };
  }
  return {
    slot,
    timeRange: info.timeRange,
    riskLevel: 'green' as const,
    label: 'Ventana óptima',
    reason,
    data: { temperatureC: adjusted.temp, windKmh: adjusted.wind, precipitationMm: rain, humidityPct: humidity },
  };
}

function buildThirdRecommendations(payload: {
  totalKm: number;
  segments: Array<{ startKm: number; endKm: number; type: 'climb' | 'descent' | 'flat'; avgSlopePct: number }>;
  weather: {
    riskLevel: 'green' | 'yellow' | 'red';
    temperatureC?: number;
    humidityPct?: number;
    windKmh?: number;
    precipitationMm?: number;
  };
}) {
  const thirdSize = payload.totalKm / 3;
  const thresholds = [0, thirdSize, thirdSize * 2, payload.totalKm];

  const out: RouteThirdRecommendation[] = [];

  for (let t = 0; t < 3; t++) {
    const from = thresholds[t];
    const to = thresholds[t + 1];
    const segs = payload.segments.filter((s) => s.endKm >= from && s.startKm <= to);

    const climbCount = segs.filter((s) => s.type === 'climb').length;
    const descentCount = segs.filter((s) => s.type === 'descent').length;
    const maxAbsSlope = segs.length ? Math.max(...segs.map((s) => Math.abs(s.avgSlopePct))) : 0;

    const technicalDemand: 'baja' | 'media' | 'alta' =
      maxAbsSlope >= 12 || descentCount >= 2 ? 'alta' : maxAbsSlope >= 8 || descentCount >= 1 ? 'media' : 'baja';

    let weatherRiskScore = payload.weather.riskLevel === 'red' ? 3 : payload.weather.riskLevel === 'yellow' ? 2 : 1;
    if ((payload.weather.precipitationMm ?? 0) > 0) weatherRiskScore += 1;
    if ((payload.weather.windKmh ?? 0) >= 30) weatherRiskScore += 1;
    if ((payload.weather.temperatureC ?? 18) >= 32 || (payload.weather.temperatureC ?? 18) <= 2) weatherRiskScore += 1;

    const weatherRisk: 'bajo' | 'medio' | 'alto' = weatherRiskScore >= 4 ? 'alto' : weatherRiskScore >= 3 ? 'medio' : 'bajo';

    const keyTerrain =
      climbCount > descentCount
        ? 'Predominio de subida y gestion de esfuerzo'
        : descentCount > climbCount
        ? 'Predominio de bajada y control de trazada'
        : 'Tramo mixto con ritmo variable';

    const phaseLabel = t === 0 ? 'inicio' : t === 1 ? 'nucleo' : 'retorno';

    const checklist: string[] = [];
    if (phaseLabel === 'inicio') {
      checklist.push('Haz 10-15 min de calentamiento progresivo y comprueba frenos/transmision antes de forzar ritmo.');
    }
    if (phaseLabel === 'nucleo') {
      checklist.push('Prioriza gestion de energia: evita entrar en deuda en rampas para no penalizar el tercio final.');
    }
    if (phaseLabel === 'retorno') {
      checklist.push('Reserva margen de seguridad: fatiga acumulada y errores de trazada suelen aparecer al final.');
    }

    if ((payload.weather.precipitationMm ?? 0) > 0) checklist.push('Baja 0.2-0.3 bar la presion de neumaticos para mejorar agarre.');
    if ((payload.weather.windKmh ?? 0) >= 30) checklist.push('Sujeta bien la linea en crestas y zonas expuestas al viento lateral.');
    if ((payload.weather.temperatureC ?? 18) >= 30) checklist.push('Aumenta hidratacion y sales; evita picos de esfuerzo al sol.');
    if ((payload.weather.temperatureC ?? 18) <= 4) checklist.push('Protege manos y core; revisa agarre en zonas umbrías.');
    if (technicalDemand === 'alta') checklist.push('Prioriza seguridad: anticipa frenada y conserva margen en pasos tecnicos.');
    if (descentCount > climbCount) checklist.push('En bajada, mira 2-3 curvas por delante y evita apurar frenada sobre terreno dudoso.');
    if (climbCount > descentCount) checklist.push('En subida, controla cadencia y traccion para no perder adherencia en cambios de rasante.');
    if (checklist.length === 0) checklist.push('Condiciones estables: ritmo constante y vigilancia normal de terreno.');

    let recommendation = '';
    if (phaseLabel === 'inicio') {
      recommendation = weatherRisk === 'alto'
        ? 'Entrada delicada hoy: empieza conservador, busca tacto de terreno y confirma agarre antes de subir intensidad.'
        : weatherRisk === 'medio'
        ? 'Inicio con variabilidad: rueda fino, evita acelerones y define ritmo que puedas sostener todo el recorrido.'
        : 'Inicio favorable: aprovecha para entrar en ritmo sin pasar umbral, preparando piernas para el tramo central.';
    } else if (phaseLabel === 'nucleo') {
      recommendation = weatherRisk === 'alto'
        ? 'Este es el tramo mas exigente con meteo sensible: prioriza trazada limpia, frenada temprana y margen tecnico.'
        : weatherRisk === 'medio'
        ? 'Tramo central clave: administra esfuerzo y usa lineas estables para no perder tiempo ni energia.'
        : 'Nucleo de ruta en buenas condiciones: mantén ritmo de trabajo y evita picos que comprometan el final.';
    } else {
      recommendation = weatherRisk === 'alto'
        ? 'Retorno comprometido por condiciones y fatiga: baja un punto de agresividad y concentra seguridad en cada decision.'
        : weatherRisk === 'medio'
        ? 'Final con riesgo moderado: protege manos/frenos y prioriza llegar con control sobre velocidad punta.'
        : 'Retorno favorable: gestiona la fatiga, conserva tecnica limpia y cierra la ruta sin asumir riesgos innecesarios.';
    }

    out.push({
      id: (`T${t + 1}` as 'T1' | 'T2' | 'T3'),
      rangeKm: { from: Math.round(from * 100) / 100, to: Math.round(to * 100) / 100 },
      rangePct: { from: Math.round((t / 3) * 100), to: Math.round(((t + 1) / 3) * 100) },
      keyTerrain,
      technicalDemand,
      weatherRisk,
      recommendation,
      checklist,
    });
  }

  return out;
}

async function loadPointsBySlug(slug: string) {
  const trail = demoTrails.find((t) => t.slug === slug);
  if (trail?.coordinates?.length) {
    return { source: 'trail-coordinates' as const, points: trail.coordinates, trail, route: null };
  }

  const route = routes.find((r) => r.slug === slug);
  if (route?.trackUrl && route.trackUrl.endsWith('.gpx')) {
    const localFile = path.join(process.cwd(), 'public', route.trackUrl.replace(/^\//, ''));
    const xml = await fs.readFile(localFile, 'utf8');
    return { source: 'route-gpx' as const, points: parseGPX(xml), trail: null, route };
  }

  if (trail?.gpxFile && trail.gpxFile.endsWith('.gpx')) {
    const localFile = path.join(process.cwd(), 'public', trail.gpxFile.replace(/^\//, ''));
    const xml = await fs.readFile(localFile, 'utf8');
    return { source: 'trail-gpx' as const, points: parseGPX(xml), trail, route: null };
  }

  return null;
}

export async function getRoutePointsBySlug(slug: string) {
  const data = await loadPointsBySlug(slug);
  if (!data || !data.points.length) return null;
  return {
    slug,
    source: data.source,
    title: data.trail?.name ?? data.route?.name ?? slug,
    points: data.points,
  };
}

function centroid(points: Array<{ lat: number; lng: number }>) {
  const total = points.reduce(
    (acc, p) => {
      acc.lat += p.lat;
      acc.lng += p.lng;
      return acc;
    },
    { lat: 0, lng: 0 }
  );
  return { lat: total.lat / points.length, lng: total.lng / points.length };
}

export async function buildRouteStatus(slug: string, tz = 'Europe/Madrid'): Promise<RouteStatusPayload> {
  try {
    const data = await loadPointsBySlug(slug);
    if (!data || !data.points.length) {
      return { ok: false, slug, message: 'No hay coordenadas ni GPX disponible para esta ruta/senda.' };
    }

    const profile = analyzeRoute(data.points);
    const segmentsWithTime = profile.segments.map((s) => ({
      ...s,
      etaMinutes: {
        trail: estimateSegmentTimeMin(s.distanceKm, s.avgSlopePct, 'trail'),
        enduro: estimateSegmentTimeMin(s.distanceKm, s.avgSlopePct, 'enduro'),
        ebike: estimateSegmentTimeMin(s.distanceKm, s.avgSlopePct, 'ebike'),
      },
    }));
    const center = centroid(data.points);

    let weatherNow = null;
    try {
      weatherNow = await getAemetNowForLocation(center.lat, center.lng);
    } catch (err) {
      weatherNow = {
        error: 'No se pudo consultar AEMET en este momento.',
        detail: err instanceof Error ? err.message : 'Unknown weather error',
      };
    }

    const viewerNow = new Intl.DateTimeFormat('es-ES', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(new Date());

    const segmentsWithRisk = segmentsWithTime.map((s) => ({
      ...s,
      risk: assessSegmentRisk(s, weatherNow && 'riskLevel' in weatherNow ? weatherNow : null),
    }));

function spainTzOffset(date: Date): number {
  const y = date.getFullYear();
  const marLast = new Date(y, 2, 31);
  marLast.setDate(marLast.getDate() - marLast.getDay());
  const octLast = new Date(y, 9, 31);
  octLast.setDate(octLast.getDate() - octLast.getDay());
  return date >= marLast && date < octLast ? 2 : 1;
}

function localDateInTz(date: Date, tzOffsetHours: number): Date {
  const utcMs = date.getTime();
  const localMs = utcMs + tzOffsetHours * 3600000;
  return new Date(localMs);
}

const _now = new Date();
const _tzOffset = spainTzOffset(_now);
const _localNow = localDateInTz(_now, _tzOffset);
const daylight = calcSunriseSunset(center.lat, center.lng, _localNow, _tzOffset);
    let safeDeadline: string | undefined;
    if (!daylight.isPolarDay && !daylight.isPolarNight) {
      const sunsetParts = daylight.sunset.split(':').map(Number);
      const sunsetMin = sunsetParts[0] * 60 + sunsetParts[1];
      const trailTimeMin = segmentsWithTime.reduce((acc, s) => acc + s.etaMinutes.trail, 0);
      const bufferMin = 30;
      const deadlineMin = sunsetMin - trailTimeMin - bufferMin;
      if (deadlineMin >= 0) {
        const h = Math.floor(deadlineMin / 60);
        const m = Math.round(deadlineMin % 60);
        safeDeadline = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
      } else {
        safeDeadline = 'No hay tiempo suficiente';
      }
    }

    return {
      ok: true,
      slug,
      source: data.source,
      title: data.trail?.name ?? data.route?.name ?? slug,
      viewerNow,
      viewerTimeZone: tz,
      daylight,
      safeDeadline,
      points: data.points,
      profile: {
        ...profile,
        segments: segmentsWithRisk,
      },
      weatherNow,
      notes: [
        'Perfil y segmentos derivados del GPX/coordenadas disponibles.',
        'Estado "ahora" combina observacion de estacion AEMET mas cercana y reglas de riesgo MTB.',
      ],
      recommendedWindows: [
        evaluateWindow('manana', {
          precipitationMm: weatherNow && 'precipitationMm' in weatherNow ? weatherNow.precipitationMm : undefined,
          windKmh: weatherNow && 'maxWindKmh' in weatherNow ? weatherNow.maxWindKmh ?? weatherNow.windKmh : undefined,
          temperatureC: weatherNow && 'temperatureC' in weatherNow ? weatherNow.temperatureC : undefined,
          humidityPct: weatherNow && 'humidityPct' in weatherNow ? weatherNow.humidityPct : undefined,
        }),
        evaluateWindow('tarde', {
          precipitationMm: weatherNow && 'precipitationMm' in weatherNow ? weatherNow.precipitationMm : undefined,
          windKmh: weatherNow && 'maxWindKmh' in weatherNow ? weatherNow.maxWindKmh ?? weatherNow.windKmh : undefined,
          temperatureC: weatherNow && 'temperatureC' in weatherNow ? weatherNow.temperatureC : undefined,
          humidityPct: weatherNow && 'humidityPct' in weatherNow ? weatherNow.humidityPct : undefined,
        }),
        evaluateWindow('noche', {
          precipitationMm: weatherNow && 'precipitationMm' in weatherNow ? weatherNow.precipitationMm : undefined,
          windKmh: weatherNow && 'maxWindKmh' in weatherNow ? weatherNow.maxWindKmh ?? weatherNow.windKmh : undefined,
          temperatureC: weatherNow && 'temperatureC' in weatherNow ? weatherNow.temperatureC : undefined,
          humidityPct: weatherNow && 'humidityPct' in weatherNow ? weatherNow.humidityPct : undefined,
        }),
      ],
      routeNowRecommendation: {
        generatedAt: new Date().toISOString(),
        weatherSummary: {
          riskLevel: weatherNow && 'riskLevel' in weatherNow ? weatherNow.riskLevel : 'green',
          temperatureC: weatherNow && 'temperatureC' in weatherNow ? weatherNow.temperatureC : undefined,
          humidityPct: weatherNow && 'humidityPct' in weatherNow ? weatherNow.humidityPct : undefined,
          windKmh: weatherNow && 'maxWindKmh' in weatherNow ? weatherNow.maxWindKmh ?? weatherNow.windKmh : undefined,
          precipitationMm: weatherNow && 'precipitationMm' in weatherNow ? weatherNow.precipitationMm : undefined,
        },
        thirds: buildThirdRecommendations({
          totalKm: profile.distanceKm,
          segments: segmentsWithRisk.map((s) => ({
            startKm: s.startKm,
            endKm: s.endKm,
            type: s.type,
            avgSlopePct: s.avgSlopePct,
          })),
          weather: {
            riskLevel: weatherNow && 'riskLevel' in weatherNow ? weatherNow.riskLevel : 'green',
            temperatureC: weatherNow && 'temperatureC' in weatherNow ? weatherNow.temperatureC : undefined,
            humidityPct: weatherNow && 'humidityPct' in weatherNow ? weatherNow.humidityPct : undefined,
            windKmh: weatherNow && 'maxWindKmh' in weatherNow ? weatherNow.maxWindKmh ?? weatherNow.windKmh : undefined,
            precipitationMm: weatherNow && 'precipitationMm' in weatherNow ? weatherNow.precipitationMm : undefined,
          },
        }),
      },
    };
  } catch (err) {
    return {
      ok: false,
      slug,
      message: 'Error generando estado de ruta.',
      detail: err instanceof Error ? err.message : 'Unknown server error',
    };
  }
}
