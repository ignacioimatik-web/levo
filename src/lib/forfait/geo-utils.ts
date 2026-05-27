import type { TrackPoint, TrackMTB, ConexionTrack, RutaConstruida, DificultadMTB, NivelUsuario, EstadoTrack, TipoTrack } from './types';
import turfDistance from '@turf/distance';
import turfLineIntersect from '@turf/line-intersect';
import turfNearestPointOnLine from '@turf/nearest-point-on-line';
import { point, lineString } from '@turf/helpers';

export function haversineM(p1: { lat: number; lng: number }, p2: { lat: number; lng: number }): number {
  const R = 6371000;
  const dLat = (p2.lat - p1.lat) * Math.PI / 180;
  const dLng = (p2.lng - p1.lng) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(p1.lat * Math.PI / 180) * Math.cos(p2.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function distanciaTotalKm(points: TrackPoint[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += haversineM(points[i - 1], points[i]);
  }
  return +(total / 1000).toFixed(2);
}

export function elevationGain(points: TrackPoint[]): number {
  let gain = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1].elevation ?? 0;
    const b = points[i].elevation ?? 0;
    const d = b - a;
    if (d > 1) gain += d;
  }
  return Math.round(gain);
}

export function elevationLoss(points: TrackPoint[]): number {
  let loss = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1].elevation ?? 0;
    const b = points[i].elevation ?? 0;
    const d = b - a;
    if (d < -1) loss += Math.abs(d);
  }
  return Math.round(loss);
}

export function pointAlongTrack(track: TrackMTB, fraction: number): TrackPoint {
  const i = Math.round((track.points.length - 1) * Math.min(1, Math.max(0, fraction)));
  return track.points[i];
}

export function buildProfileSeries(points: TrackPoint[]): Array<{ km: number; elevationM: number }> {
  if (points.length < 2) return [];
  const cumKm: number[] = [0];
  for (let i = 1; i < points.length; i++) {
    cumKm.push(cumKm[i - 1] + haversineM(points[i - 1], points[i]) / 1000);
  }
  const result: Array<{ km: number; elevationM: number }> = [];
  for (let i = 0; i < points.length; i++) {
    result.push({ km: +(cumKm[i]).toFixed(2), elevationM: points[i].elevation ?? 0 });
  }
  return result;
}

/** Detect endpoint proximity connections (fin de A → inicio de B) */
export function detectConnections(
  tracks: TrackMTB[],
  umbralContactoM = 50,
  umbralCercaniaM = 100,
): ConexionTrack[] {
  const connections: ConexionTrack[] = [];
  let idCounter = 1;

  for (let i = 0; i < tracks.length; i++) {
    for (let j = 0; j < tracks.length; j++) {
      if (i === j) continue;

      const a = tracks[i];
      const b = tracks[j];
      const distEndStart = haversineM(a.endPoint, b.startPoint);
      const distStartEnd = haversineM(a.startPoint, b.endPoint);

      let tipo: ConexionTrack['tipoConexion'];
      let distancia: number;
      let punto: { lat: number; lng: number };
      let recomendado = true;

      if (distEndStart <= umbralContactoM || distStartEnd <= umbralContactoM) {
        tipo = "contacto";
        distancia = Math.min(distEndStart, distStartEnd);
        punto = distEndStart <= distStartEnd
          ? { lat: (a.endPoint.lat + b.startPoint.lat) / 2, lng: (a.endPoint.lng + b.startPoint.lng) / 2 }
          : { lat: (a.startPoint.lat + b.endPoint.lat) / 2, lng: (a.startPoint.lng + b.endPoint.lng) / 2 };
      } else if (distEndStart <= umbralCercaniaM || distStartEnd <= umbralCercaniaM) {
        tipo = "cercania";
        distancia = Math.min(distEndStart, distStartEnd);
        punto = distEndStart <= distStartEnd
          ? { lat: a.endPoint.lat + (b.startPoint.lat - a.endPoint.lat) * 0.5, lng: a.endPoint.lng + (b.startPoint.lng - a.endPoint.lng) * 0.5 }
          : { lat: a.startPoint.lat + (b.endPoint.lat - a.startPoint.lat) * 0.5, lng: a.startPoint.lng + (b.endPoint.lng - a.startPoint.lng) * 0.5 };
        recomendado = false;
      } else {
        continue;
      }

      if (tracks[j].estado === "cerrado" || tracks[j].estado === "revision") {
        recomendado = false;
      }

      connections.push({
        id: `conn-${idCounter++}`,
        fromTrackId: a.id,
        toTrackId: b.id,
        tipoConexion: tipo,
        distanciaMetros: Math.round(distancia),
        descripcion: tipo === "contacto"
          ? `Conexión directa entre ${a.nombre} y ${b.nombre}`
          : `Conexión posible entre ${a.nombre} y ${b.nombre} (a ${Math.round(distancia)} m)`,
        puntoConexion: punto,
        recomendado,
      });
    }
  }

  return connections;
}

/** Bounding box filter — quickly skip track pairs too far apart for turf analysis */
function tracksOverlapBB(trackA: TrackMTB, trackB: TrackMTB, marginM: number): boolean {
  const marginDeg = marginM / 111000;
  const latsA = trackA.points.map(p => p.lat);
  const lngsA = trackA.points.map(p => p.lng);
  const latsB = trackB.points.map(p => p.lat);
  const lngsB = trackB.points.map(p => p.lng);

  const aMinLat = Math.min(...latsA) - marginDeg;
  const aMaxLat = Math.max(...latsA) + marginDeg;
  const aMinLng = Math.min(...lngsA) - marginDeg;
  const aMaxLng = Math.max(...lngsA) + marginDeg;

  const bMinLat = Math.min(...latsB);
  const bMaxLat = Math.max(...latsB);
  const bMinLng = Math.min(...lngsB);
  const bMaxLng = Math.max(...lngsB);

  return aMinLat <= bMaxLat && aMaxLat >= bMinLat &&
         aMinLng <= bMaxLng && aMaxLng >= bMinLng;
}

/** Combined detection: endpoint proximity + turf crossings + partial overlaps */
export function detectAllConnections(
  tracks: TrackMTB[],
  umbralContactoM = 50,
  umbralCercaniaM = 100,
  umbralCruceM = 15,
  umbralSuperposicionM = 40,
): ConexionTrack[] {
  const endpointConns = detectConnections(tracks, umbralContactoM, umbralCercaniaM);
  const geoConns: ConexionTrack[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < tracks.length; i++) {
    for (let j = i + 1; j < tracks.length; j++) {
      const a = tracks[i], b = tracks[j];
      if (!a.points.length || !b.points.length) continue;
      if (!tracksOverlapBB(a, b, umbralSuperposicionM + 50)) continue;
      const found = detectCrossingsTurf(a, b, umbralCruceM, umbralSuperposicionM);
      for (const c of found) {
        const key = `${c.tipoConexion}-${Math.round(c.puntoConexion.lat * 100)}-${Math.round(c.puntoConexion.lng * 100)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        geoConns.push(c);
      }
    }
  }

  return [...endpointConns, ...geoConns];
}

/** Use Turf.js to detect crossings and partial overlaps between two tracks */
export function detectCrossingsTurf(
  trackA: TrackMTB,
  trackB: TrackMTB,
  umbralCruceM = 15,
  umbralSuperposicionM = 40,
): ConexionTrack[] {
  const results: ConexionTrack[] = [];

  if (trackA.points.length < 2 || trackB.points.length < 2) return results;

  try {
    const coordsA = trackA.points
      .filter(p => isFinite(p.lat) && isFinite(p.lng))
      .map(p => [p.lng, p.lat] as [number, number]);
    const coordsB = trackB.points
      .filter(p => isFinite(p.lat) && isFinite(p.lng))
      .map(p => [p.lng, p.lat] as [number, number]);
    if (coordsA.length < 2 || coordsB.length < 2) return results;

    const lineA = lineString(coordsA);
    const lineB = lineString(coordsB);

    const lenA = distanciaTotalKm(trackA.points) * 1000;
    const lenB = distanciaTotalKm(trackB.points) * 1000;
    if (lenA < 1 || lenB < 1) return results;

  // 1. Exact line intersections
  const intersections = turfLineIntersect(lineA, lineB);
  const seen = new Set<string>();

  for (const inter of intersections.features) {
    const [lng, lat] = inter.geometry.coordinates;
    const key = `cross-${Math.round(lat * 1000)}-${Math.round(lng * 1000)}`;
    if (seen.has(key)) continue;
    seen.add(key);

    // Determine which track segments overlap at this point — flag as superposicion
    // if the intersection lies along both lines for > 20m
    const pt = point([lng, lat]);
    const distA = turfNearestPointOnLine(lineA, pt).properties.dist ?? 0;
    const distB = turfNearestPointOnLine(lineB, pt).properties.dist ?? 0;

    // Check for overlap: sample points near intersection on both lines
    const overlapM = detectOverlapNearPoint(trackA, trackB, { lat, lng }, 30, 15);
    const tipo = overlapM > 20 ? "superposicion" : "cruce";

    results.push({
      id: `geo-${tipo}-${results.length + 1}`,
      fromTrackId: trackA.id,
      toTrackId: trackB.id,
      tipoConexion: tipo,
      distanciaMetros: tipo === "superposicion" ? Math.round(overlapM) : 0,
      descripcion: tipo === "superposicion"
        ? `Superposición parcial (${Math.round(overlapM)} m) entre ${trackA.nombre} y ${trackB.nombre}`
        : `Cruce exacto entre ${trackA.nombre} y ${trackB.nombre}`,
      puntoConexion: { lat, lng },
      recomendado: tipo !== "superposicion",
    });
  }

  // 2. Sample each track's points for proximity to the other line
  const step = Math.max(1, Math.floor(Math.min(trackA.points.length, trackB.points.length) / 40));
  for (let i = 0; i < trackA.points.length; i += step) {
    const pA = trackA.points[i];
    const pt = point([pA.lng, pA.lat]);
    const nearest = turfNearestPointOnLine(lineB, pt);
    const distM = nearest.properties.dist !== undefined
      ? nearest.properties.dist * 1000
      : haversineM(pA, trackB.points[0]);

    if (distM <= umbralSuperposicionM) {
      const [lng, lat] = nearest.geometry.coordinates;
      const key = `prox-${Math.round(lat * 100)}-${Math.round(lng * 100)}`;
      if (seen.has(key)) continue;
      seen.add(key);

      // Check if this is a crossing or overlap
      const overlapM = detectOverlapNearPoint(trackA, trackB, { lat, lng }, 25, umbralSuperposicionM);
      const tipo = overlapM > 15 ? "superposicion" : (distM <= umbralCruceM ? "cruce" : "superposicion");
      const descM = tipo === "superposicion" ? overlapM : distM;

      results.push({
        id: `geo-${tipo}-${results.length + 1}`,
        fromTrackId: trackA.id,
        toTrackId: trackB.id,
        tipoConexion: tipo,
        distanciaMetros: Math.round(descM),
        descripcion: tipo === "superposicion"
          ? `Superposición (${Math.round(descM)} m) entre ${trackA.nombre} y ${trackB.nombre}`
          : `Cruce cercano (${Math.round(distM)} m) entre ${trackA.nombre} y ${trackB.nombre}`,
        puntoConexion: { lat, lng },
        recomendado: tipo !== "superposicion",
      });
    }
  }

  // 3. Detect partial overlap: check if a significant contiguous section of trackA
  //    is within overlap distance of trackB
  detectPartialOverlap(trackA, trackB, lineB, umbralSuperposicionM, results, seen);
  // Also check the reverse direction (B close to A)
  detectPartialOverlap(trackB, trackA, lineA, umbralSuperposicionM, results, seen);

  return results;
  } catch { return results; }
}

/** Check if a contiguous section of trackA overlaps with trackB (sampled) */
function detectPartialOverlap(
  trackA: TrackMTB,
  trackB: TrackMTB,
  lineB: ReturnType<typeof lineString>,
  thresholdM: number,
  results: ConexionTrack[],
  seen: Set<string>,
): void {
  let overlapStart: TrackPoint | null = null;
  let overlapCount = 0;
  let totalOverlapM = 0;
  let prevPoint: TrackPoint | null = null;

  // Sample every ~50m to keep performance acceptable
  const sampleStep = Math.max(1, Math.floor(trackA.points.length / 80));
  for (let i = 0; i < trackA.points.length; i += sampleStep) {
    const p = trackA.points[i];
    const pt = point([p.lng, p.lat]);
    const nearest = turfNearestPointOnLine(lineB, pt);
    const distM = nearest.properties.dist !== undefined
      ? nearest.properties.dist * 1000
      : haversineM(p, trackB.points[0]);

    if (distM <= thresholdM) {
      if (!overlapStart) overlapStart = p;
      if (prevPoint) totalOverlapM += haversineM(prevPoint, p);
      overlapCount++;
    } else {
      if (overlapStart && totalOverlapM > 15 && overlapCount > 0) {
        const midIdx = Math.max(0, i - Math.floor(overlapCount / 2));
        const mid = trackA.points[midIdx];
        if (mid) {
          const resultKey = `overlap-${Math.round(mid.lat * 100)}-${Math.round(mid.lng * 100)}`;
          if (!seen.has(resultKey)) {
            seen.add(resultKey);
            results.push({
              id: `geo-overlap-${results.length + 1}`,
              fromTrackId: trackA.id,
              toTrackId: trackB.id,
              tipoConexion: "superposicion",
              distanciaMetros: Math.round(totalOverlapM),
              descripcion: `Superposición parcial (${Math.round(totalOverlapM)} m) entre ${trackA.nombre} y ${trackB.nombre}`,
              puntoConexion: { lat: mid.lat, lng: mid.lng },
              recomendado: false,
            });
          }
        }
      }
      overlapStart = null;
      totalOverlapM = 0;
      overlapCount = 0;
    }
    prevPoint = p;
  }

  // Handle overlap at the end
  if (overlapStart && totalOverlapM > 15 && overlapCount > 0) {
    const midIdx = Math.max(0, trackA.points.length - 1 - Math.floor(overlapCount / 2));
    const mid = trackA.points[midIdx];
    if (mid) {
      const resultKey = `overlap-${Math.round(mid.lat * 100)}-${Math.round(mid.lng * 100)}`;
      if (!seen.has(resultKey)) {
        seen.add(resultKey);
        results.push({
          id: `geo-overlap-${results.length + 1}`,
          fromTrackId: trackA.id,
          toTrackId: trackB.id,
          tipoConexion: "superposicion",
          distanciaMetros: Math.round(totalOverlapM),
          descripcion: `Superposición parcial (${Math.round(totalOverlapM)} m) entre ${trackA.nombre} y ${trackB.nombre}`,
          puntoConexion: { lat: mid.lat, lng: mid.lng },
          recomendado: false,
        });
      }
    }
  }
}

/** Measure how many meters two tracks run close together near a point */
function detectOverlapNearPoint(
  trackA: TrackMTB,
  trackB: TrackMTB,
  near: { lat: number; lng: number },
  searchRadiusM: number,
  thresholdM: number,
): number {
  // Find indices near the point in both tracks
  const idxA = findNearestIndex(trackA.points, near);
  const idxB = findNearestIndex(trackB.points, near);

  if (idxA < 0 || idxB < 0) return 0;

  // Walk forward from the intersection point on both tracks
  let overlapM = 0;
  let aIdx = idxA;
  let bIdx = idxB;

  // Walk backward
  while (aIdx > 0 && bIdx > 0) {
    const pA = trackA.points[aIdx];
    const pB = trackB.points[bIdx];
    const d = haversineM(pA, pB);
    if (d > thresholdM) break;
    overlapM += haversineM(trackA.points[aIdx], trackA.points[Math.max(0, aIdx - 1)]);
    aIdx--;
    bIdx--;
  }

  // Walk forward
  aIdx = idxA + 1;
  bIdx = idxB + 1;
  while (aIdx < trackA.points.length && bIdx < trackB.points.length) {
    const pA = trackA.points[aIdx];
    const pB = trackB.points[bIdx];
    const d = haversineM(pA, pB);
    if (d > thresholdM) break;
    overlapM += haversineM(trackA.points[aIdx], trackA.points[aIdx - 1]);
    aIdx++;
    bIdx++;
  }

  return overlapM;
}

function findNearestIndex(points: TrackPoint[], target: { lat: number; lng: number }): number {
  let minDist = Infinity;
  let minIdx = -1;
  for (let i = 0; i < points.length; i++) {
    const d = haversineM(points[i], target);
    if (d < minDist) {
      minDist = d;
      minIdx = i;
    }
  }
  return minIdx;
}

export function sugerirSiguientesTracks(
  trackActual: TrackMTB,
  todosTracks: TrackMTB[],
  conexiones: ConexionTrack[],
  nivelUsuario: NivelUsuario,
  seleccionados: string[],
): Array<{ track: TrackMTB; conexion: ConexionTrack; tipo: 'recomendado' | 'con_precaucion' | 'no_recomendado' }> {
  const disponibles = todosTracks.filter(t => !seleccionados.includes(t.id) && t.id !== trackActual.id);
  const resultado: Array<{ track: TrackMTB; conexion: ConexionTrack; tipo: 'recomendado' | 'con_precaucion' | 'no_recomendado' }> = [];

  for (const track of disponibles) {
    const conns = conexiones.filter(
      c => c.fromTrackId === trackActual.id && c.toTrackId === track.id,
    );
    if (conns.length === 0) continue;

    const mejorConexion = conns.reduce((best, c) => c.distanciaMetros < best.distanciaMetros ? c : best);

    if (track.estado === "cerrado") {
      resultado.push({ track, conexion: mejorConexion, tipo: 'no_recomendado' });
      continue;
    }

    const saltoDificultad = saltoPermitido(nivelUsuario, track.dificultad);
    if (!saltoDificultad) {
      resultado.push({ track, conexion: mejorConexion, tipo: 'no_recomendado' });
      continue;
    }

    if (
      track.estado === "revision" ||
      track.estado === "precaucion" ||
      !mejorConexion.recomendado ||
      (nivelUsuario === "iniciacion" && (track.dificultad === "rojo" || track.dificultad === "negro")) ||
      (nivelUsuario === "medio" && (track.dificultad === "negro" || track.dificultad === "doble-negro")) ||
      (nivelUsuario === "ebike" && !track.aptoEbike)
    ) {
      resultado.push({ track, conexion: mejorConexion, tipo: 'con_precaucion' });
      continue;
    }

    resultado.push({ track, conexion: mejorConexion, tipo: 'recomendado' });
  }

  return resultado.sort((a, b) => {
    const order = { recomendado: 0, con_precaucion: 1, no_recomendado: 2 };
    return order[a.tipo] - order[b.tipo];
  });
}

function saltoPermitido(nivel: NivelUsuario, dificultad: DificultadMTB): boolean {
  const niveles: Record<NivelUsuario, DificultadMTB[]> = {
    iniciacion: ["verde", "azul"],
    medio: ["verde", "azul", "rojo"],
    avanzado: ["verde", "azul", "rojo", "negro", "doble-negro"],
    experto: ["verde", "azul", "rojo", "negro", "doble-negro"],
    ebike: ["verde", "azul", "rojo"],
  };
  return niveles[nivel].includes(dificultad);
}

export function dificultadGlobal(tracks: TrackMTB[]): DificultadMTB {
  if (tracks.some(t => t.dificultad === "doble-negro")) return "doble-negro";
  if (tracks.some(t => t.dificultad === "negro")) return "negro";
  if (tracks.some(t => t.dificultad === "rojo")) return "rojo";
  if (tracks.some(t => t.dificultad === "azul")) return "azul";
  return "verde";
}

export function nivelTecnicoMax(tracks: TrackMTB[]): number {
  return Math.max(...tracks.map(t => t.nivelTecnico), 1);
}

export function exigenciaFisicaMedia(tracks: TrackMTB[]): number {
  if (!tracks.length) return 1;
  return Math.round(tracks.reduce((s, t) => s + t.exigenciaFisica, 0) / tracks.length);
}

export function tiempoTotalMin(tracks: TrackMTB[]): number {
  return tracks.reduce((s, t) => s + t.tiempoEstimadoMin, 0);
}

/** Build a combined route from ordered tracks, detecting gaps and inserting connection waypoints */
export function buildRouteFromTracks(tracks: TrackMTB[], conexiones: ConexionTrack[], name?: string): RutaConstruida {
  const allPoints: TrackPoint[] = [];
  const connectionWaypoints: Array<{ lat: number; lng: number; descripcion: string; distancia: number }> = [];
  const warnings: string[] = [];

  for (let i = 0; i < tracks.length; i++) {
    if (i > 0) {
      const prev = tracks[i - 1];
      const curr = tracks[i];
      const conn = conexiones.find(
        c => c.fromTrackId === prev.id && c.toTrackId === curr.id,
      );

      if (conn) {
        const gapM = haversineM(prev.endPoint, curr.startPoint);

        if (conn.tipoConexion === "contacto" || gapM <= 50) {
          // Direct connection — just insert the connection point as waypoint
          connectionWaypoints.push({
            lat: conn.puntoConexion.lat,
            lng: conn.puntoConexion.lng,
            descripcion: `Enlace: ${prev.nombre} → ${curr.nombre}`,
            distancia: gapM,
          });
        } else if (conn.tipoConexion === "cercania" || gapM <= 100) {
          // Gap between tracks — create a connection waypoint
          connectionWaypoints.push({
            lat: conn.puntoConexion.lat,
            lng: conn.puntoConexion.lng,
            descripcion: `Conexión: ${prev.nombre} → ${curr.nombre}`,
            distancia: gapM,
          });
          if (gapM > 80) {
            warnings.push(`Salto de ${Math.round(gapM)} m entre ${prev.nombre} y ${curr.nombre}. Verificar enlace.`);
          }
        }
      } else {
        // No connection found — calculate gap
        const gapM = haversineM(prev.endPoint, curr.startPoint);
        const midLat = (prev.endPoint.lat + curr.startPoint.lat) / 2;
        const midLng = (prev.endPoint.lng + curr.startPoint.lng) / 2;

        connectionWaypoints.push({
          lat: midLat,
          lng: midLng,
          descripcion: `Salto: ${prev.nombre} → ${curr.nombre} (${Math.round(gapM)} m sin conexión directa)`,
          distancia: gapM,
        });

        if (gapM > 50) {
          warnings.push(`Hueco de ${Math.round(gapM)} m entre ${prev.nombre} y ${curr.nombre}. No hay conexión directa — usar carretera o senda de enlace.`);
        }
      }
    }

    // Add all points of this track
    allPoints.push(...tracks[i].points);
  }

  // Compute metrics
  const distTotal = distanciaTotalKm(allPoints);
  const elevGain = elevationGain(allPoints);
  const elevLoss = elevationLoss(allPoints);

  return {
    id: `route-${Date.now()}`,
    nombre: name || `Ruta ${tracks.map(t => t.nombre).join(' + ')}`,
    tracks,
    conexiones: conexiones.filter(c =>
      tracks.some(t => t.id === c.fromTrackId) && tracks.some(t => t.id === c.toTrackId),
    ),
    distanciaTotalKm: +(distTotal).toFixed(1),
    desnivelPositivoTotal: elevGain,
    desnivelNegativoTotal: elevLoss,
    dificultadGlobal: dificultadGlobal(tracks),
    nivelTecnicoMaximo: nivelTecnicoMax(tracks),
    exigenciaFisicaMedia: exigenciaFisicaMedia(tracks),
    tiempoEstimadoTotalMin: tiempoTotalMin(tracks),
    pointsCombinados: allPoints,
    advertencias: warnings,
    connectionWaypoints,
  };
}

export function defaultFilters() {
  return {
    dificultad: [] as DificultadMTB[],
    estado: [] as EstadoTrack[],
    sector: [] as string[],
    tipo: [] as TipoTrack[],
    soloEbike: false,
    soloLluvia: false,
    nivelTecnicoMax: 5,
    exigenciaFisicaMax: 5,
    distanciaMin: 0,
    distanciaMax: 999,
    soloAbiertos: true,
    soloConectables: false,
    nivelUsuario: "avanzado" as NivelUsuario,
    busqueda: "",
  };
}
