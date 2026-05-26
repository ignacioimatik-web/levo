import type { TrackMTB } from './types';

function pt(lat: number, lng: number, elevation?: number) {
  return { lat, lng, elevation };
}

function segment(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  steps: number,
  baseElevation: number,
  elevVariation: number,
): Array<{ lat: number; lng: number; elevation?: number }> {
  const pts: Array<{ lat: number; lng: number; elevation?: number }> = [];
  for (let i = 0; i <= steps; i++) {
    const f = i / steps;
    const lat = from.lat + (to.lat - from.lat) * f;
    const lng = from.lng + (to.lng - from.lng) * f;
    const elev = baseElevation + Math.sin(f * Math.PI * 3) * elevVariation + (i % 7) * 3;
    pts.push({ lat, lng, elevation: Math.round(elev) });
  }
  return pts;
}

const BASE_LAT = 40.62;
const BASE_LNG = -0.02;

export const forfaitTestTracks: TrackMTB[] = [
  // === NEARBY (end-to-start proximity) ===
  {
    id: "test-near-1",
    nombre: "TEST: Enlace Norte (cercano)",
    sector: "Test Bergantes",
    dificultad: "verde",
    estado: "abierto",
    tipo: ["enlace", "xc"],
    distanciaKm: 1.5,
    desnivelPositivo: 30,
    desnivelNegativo: 20,
    nivelTecnico: 1,
    exigenciaFisica: 1,
    sentidoRecomendado: "bidireccional",
    aptoEbike: true,
    aptoLluvia: true,
    tiempoEstimadoMin: 15,
    descripcion: "TEST: Track de enlace corto, extremo sur cerca de inicio de test-near-2",
    advertencias: [],
    points: segment(pt(BASE_LAT, BASE_LNG, 700), pt(BASE_LAT - 0.03, BASE_LNG + 0.02, 680), 30, 690, 15),
    startPoint: pt(BASE_LAT, BASE_LNG),
    endPoint: pt(BASE_LAT - 0.03, BASE_LNG + 0.02),
    dataStatus: "placeholder",
  },
  {
    id: "test-near-2",
    nombre: "TEST: Enlace Sur (cercano)",
    sector: "Test Bergantes",
    dificultad: "azul",
    estado: "abierto",
    tipo: ["enlace", "xc"],
    distanciaKm: 1.3,
    desnivelPositivo: 20,
    desnivelNegativo: 30,
    nivelTecnico: 1,
    exigenciaFisica: 1,
    sentidoRecomendado: "bidireccional",
    aptoEbike: true,
    aptoLluvia: true,
    tiempoEstimadoMin: 12,
    descripcion: "TEST: Empieza a 30m del final de test-near-1 (proximidad directa)",
    advertencias: [],
    points: segment(pt(BASE_LAT - 0.0305, BASE_LNG + 0.0205, 685), pt(BASE_LAT - 0.06, BASE_LNG + 0.04, 660), 30, 675, 12),
    startPoint: pt(BASE_LAT - 0.0305, BASE_LNG + 0.0205),
    endPoint: pt(BASE_LAT - 0.06, BASE_LNG + 0.04),
    dataStatus: "placeholder",
  },
  // === CROSSING (tracks that cross each other) ===
  {
    id: "test-cross-1",
    nombre: "TEST: Travesía Horizontal",
    sector: "Test Cruces",
    dificultad: "rojo",
    estado: "abierto",
    tipo: ["trail", "enduro"],
    distanciaKm: 2.0,
    desnivelPositivo: 50,
    desnivelNegativo: 50,
    nivelTecnico: 3,
    exigenciaFisica: 2,
    sentidoRecomendado: "bidireccional",
    aptoEbike: true,
    aptoLluvia: false,
    tiempoEstimadoMin: 20,
    descripcion: "TEST: Cruza con test-cross-2 en el centro",
    advertencias: [],
    points: segment(pt(BASE_LAT - 0.01, BASE_LNG - 0.03, 720), pt(BASE_LAT - 0.01, BASE_LNG + 0.03, 740), 50, 730, 20),
    startPoint: pt(BASE_LAT - 0.01, BASE_LNG - 0.03),
    endPoint: pt(BASE_LAT - 0.01, BASE_LNG + 0.03),
    dataStatus: "placeholder",
  },
  {
    id: "test-cross-2",
    nombre: "TEST: Travesía Vertical",
    sector: "Test Cruces",
    dificultad: "rojo",
    estado: "abierto",
    tipo: ["trail", "enduro"],
    distanciaKm: 2.0,
    desnivelPositivo: 60,
    desnivelNegativo: 50,
    nivelTecnico: 3,
    exigenciaFisica: 2,
    sentidoRecomendado: "bidireccional",
    aptoEbike: true,
    aptoLluvia: false,
    tiempoEstimadoMin: 20,
    descripcion: "TEST: Cruza con test-cross-1 en el centro (lat -0.01, lng 0)",
    advertencias: [],
    points: segment(pt(BASE_LAT + 0.02, BASE_LNG, 760), pt(BASE_LAT - 0.04, BASE_LNG, 700), 50, 730, 30),
    startPoint: pt(BASE_LAT + 0.02, BASE_LNG),
    endPoint: pt(BASE_LAT - 0.04, BASE_LNG),
    dataStatus: "placeholder",
  },
  // === OVERLAPPING (partial shared segment) ===
  {
    id: "test-overlap-1",
    nombre: "TEST: Bajada compartida (tramo A)",
    sector: "Test Superposición",
    dificultad: "negro",
    estado: "abierto",
    tipo: ["bajada", "enduro"],
    distanciaKm: 2.5,
    desnivelPositivo: 20,
    desnivelNegativo: 200,
    nivelTecnico: 4,
    exigenciaFisica: 3,
    sentidoRecomendado: "unidireccional",
    aptoEbike: false,
    aptoLluvia: false,
    tiempoEstimadoMin: 25,
    descripcion: "TEST: Comparte tramo con test-overlap-2 en la zona media",
    advertencias: [],
    points: segment(pt(BASE_LAT + 0.03, BASE_LNG + 0.04, 850), pt(BASE_LAT - 0.02, BASE_LNG + 0.06, 680), 70, 770, 60),
    startPoint: pt(BASE_LAT + 0.03, BASE_LNG + 0.04),
    endPoint: pt(BASE_LAT - 0.02, BASE_LNG + 0.06),
    dataStatus: "placeholder",
  },
  {
    id: "test-overlap-2",
    nombre: "TEST: Bajada compartida (tramo B)",
    sector: "Test Superposición",
    dificultad: "rojo",
    estado: "abierto",
    tipo: ["bajada", "enduro"],
    distanciaKm: 2.2,
    desnivelPositivo: 40,
    desnivelNegativo: 180,
    nivelTecnico: 3,
    exigenciaFisica: 2,
    sentidoRecomendado: "unidireccional",
    aptoEbike: true,
    aptoLluvia: false,
    tiempoEstimadoMin: 22,
    descripcion: "TEST: Comparte ~300m con test-overlap-1 en la zona media (misma traza)",
    advertencias: [],
    // This track shares the middle section of test-overlap-1's path
    points: (() => {
      const basePts = segment(pt(BASE_LAT + 0.02, BASE_LNG + 0.03, 820), pt(BASE_LAT - 0.015, BASE_LNG + 0.055, 700), 60, 760, 40);
      // Override middle portion to match test-overlap-1's trajectory
      const overlapStart = Math.floor(basePts.length * 0.3);
      const overlapEnd = Math.floor(basePts.length * 0.7);
      const sharedPts = segment(pt(BASE_LAT + 0.01, BASE_LNG + 0.045, 780), pt(BASE_LAT - 0.005, BASE_LNG + 0.052, 730), overlapEnd - overlapStart, 755, 25);
      for (let i = overlapStart; i <= overlapEnd && i - overlapStart < sharedPts.length; i++) {
        basePts[i] = sharedPts[i - overlapStart];
      }
      return basePts;
    })(),
    startPoint: pt(BASE_LAT + 0.02, BASE_LNG + 0.03),
    endPoint: pt(BASE_LAT - 0.015, BASE_LNG + 0.055),
    dataStatus: "placeholder",
  },
  // === DISTANT (no connection, isolated) ===
  {
    id: "test-distant-1",
    nombre: "TEST: Aislado Norte",
    sector: "Test Aislados",
    dificultad: "verde",
    estado: "abierto",
    tipo: ["xc"],
    distanciaKm: 0.8,
    desnivelPositivo: 20,
    desnivelNegativo: 15,
    nivelTecnico: 1,
    exigenciaFisica: 1,
    sentidoRecomendado: "bidireccional",
    aptoEbike: true,
    aptoLluvia: true,
    tiempoEstimadoMin: 10,
    descripcion: "TEST: Track aislado lejos de todo (>500m de cualquier otro track)",
    advertencias: [],
    points: segment(pt(BASE_LAT + 0.10, BASE_LNG + 0.08, 800), pt(BASE_LAT + 0.08, BASE_LNG + 0.10, 780), 20, 790, 10),
    startPoint: pt(BASE_LAT + 0.10, BASE_LNG + 0.08),
    endPoint: pt(BASE_LAT + 0.08, BASE_LNG + 0.10),
    dataStatus: "placeholder",
  },
];
