export type TrailDifficulty =
  | "green"
  | "blue"
  | "red"
  | "black"
  | "double-black"
  | "unclassified";

export type TrailStatus =
  | "open"
  | "caution"
  | "closed"
  | "seasonal"
  | "unknown";

export type TrailType =
  | "singletrack"
  | "descent"
  | "climb"
  | "link"
  | "loop"
  | "traverse"
  | "service-road";

/* GPX-ready: coordinates are extracted from <trkpt> lat/lon/ele */
export interface TrailPoint {
  lat: number;
  lng: number;
  elevation?: number;
}

/* GPX-ready: max/min elevation — not yet in model, add when parsing real GPX */
/* elevationProfile?: number[] — decimated series for altimetry chart */

export interface MTBTrail {
  id: string;
  slug: string;
  name: string;
  sector: string;
  difficulty: TrailDifficulty;
  status: TrailStatus;
  type: TrailType;
  summary: string;
  description: string;
  /* GPX: distanceKm = Haversine path length */
  distanceKm?: number;
  /* GPX: elevationGainM = sum of upward ele deltas */
  elevationGainM?: number;
  /* GPX: elevationLossM = sum of downward ele deltas */
  elevationLossM?: number;
  /* GPX: estimatedTime = NP+ formula or manual */
  estimatedTime?: string;
  technicalRating?: 1 | 2 | 3 | 4 | 5;
  physicalRating?: 1 | 2 | 3 | 4 | 5;
  ebikeFriendly?: boolean;
  recommendedBike: string[];
  tags: string[];
  warnings: string[];
  /* GPX: path to file in public/gpx/ */
  gpxFile?: string;
  kmlFile?: string;
  /* GPX: array of TrailPoint parsed from <trkpt> */
  coordinates?: TrailPoint[];
  relatedRouteSlugs: string[];
  image?: string;
  lastReview?: string;
  dataStatus: "real" | "placeholder" | "needs-verification";
}

import { garumbaCoordinates } from './garumba-coordinates';

export const demoTrails: MTBTrail[] = [
  {
    id: "demo-01",
    slug: "sendero-verde-demo",
    name: "Sendero Verde Demo",
    sector: "Sector Demo A",
    difficulty: "green",
    status: "open",
    type: "singletrack",
    summary: "Sendero suave ideal para iniciación y familias.",
    description: "Recorrido sencillo por pista ancha y senda sin obstáculos. Pendiente suave y curvas amplias. Perfecto para tomar contacto con la bicicleta de montaña.",
    distanceKm: 4.5,
    elevationGainM: 80,
    elevationLossM: 80,
    estimatedTime: "45 min",
    technicalRating: 1,
    physicalRating: 1,
    ebikeFriendly: true,
    recommendedBike: ["xc", "hardtail", "ebike"],
    tags: ["iniciacion", "familiar", "senda-ancha"],
    warnings: [],
    relatedRouteSlugs: [],
    dataStatus: "placeholder",
  },
  {
    id: "demo-02",
    slug: "senda-azul-demo",
    name: "Senda Azul Demo",
    sector: "Sector Demo B",
    difficulty: "blue",
    status: "open",
    type: "singletrack",
    summary: "Senda fluida con tramos entretenidos y curvas peraltadas.",
    description: "Singletrack con algo de técnica. Curvas peraltadas, algún escalón pequeño y ritmo constante. Recomendada para ciclistas con experiencia básica.",
    distanceKm: 6.2,
    elevationGainM: 150,
    elevationLossM: 180,
    estimatedTime: "50 min",
    technicalRating: 2,
    physicalRating: 2,
    ebikeFriendly: true,
    recommendedBike: ["trail", "hardtail", "ebike"],
    tags: ["flow", "curvas", "ritmo"],
    warnings: ["Atención en curvas con gravilla suelta"],
    relatedRouteSlugs: ["sendero-verde-demo"],
    dataStatus: "placeholder",
  },
  {
    id: "demo-03",
    slug: "bajada-roja-demo",
    name: "Bajada Roja Demo",
    sector: "Sector Demo C",
    difficulty: "red",
    status: "open",
    type: "descent",
    summary: "Descenso técnico con escalones naturales y pasos estrechos.",
    description: "Bajada de dificultad media-alta con escalones de roca, raíces y curvas cerradas. Exige buen control de la bici y lectura de trazada.",
    distanceKm: 2.8,
    elevationGainM: 20,
    elevationLossM: 320,
    estimatedTime: "20 min",
    technicalRating: 4,
    physicalRating: 2,
    ebikeFriendly: false,
    recommendedBike: ["enduro", "all-mountain"],
    tags: ["descenso", "tecnico", "raices", "roca"],
    warnings: ["Terreno irregular", "Peligro de caídas"],
    relatedRouteSlugs: ["senda-azul-demo"],
    dataStatus: "placeholder",
  },
  {
    id: "demo-04",
    slug: "linea-negra-demo",
    name: "Línea Negra Demo",
    sector: "Sector Demo C",
    difficulty: "black",
    status: "caution",
    type: "descent",
    summary: "Descenso extremo con pasos expuestos y obstáculos técnicos.",
    description: "Línea de dificultad alta con saltos, escalones grandes, pasos de roca expuestos y pendiente muy pronunciada. Solo para pilotos experimentados.",
    distanceKm: 1.9,
    elevationGainM: 10,
    elevationLossM: 260,
    estimatedTime: "12 min",
    technicalRating: 5,
    physicalRating: 3,
    ebikeFriendly: false,
    recommendedBike: ["enduro", "dh"],
    tags: ["extremo", "saltos", "exposicion"],
    warnings: ["Solo expertos", "Terreno expuesto", "No recomendado en mojado"],
    relatedRouteSlugs: ["bajada-roja-demo"],
    dataStatus: "placeholder",
  },
  {
    id: "demo-05",
    slug: "enlace-norte-demo",
    name: "Enlace Norte Demo",
    sector: "Sector Demo A",
    difficulty: "green",
    status: "open",
    type: "link",
    summary: "Conexión entre sectores por pista forestal.",
    description: "Tramo de enlace que conecta la parte norte del sector Demo A con el sector Demo B. Discurre por pista forestal en buen estado con pendiente suave.",
    distanceKm: 3.1,
    elevationGainM: 95,
    elevationLossM: 60,
    estimatedTime: "20 min",
    technicalRating: 1,
    physicalRating: 1,
    ebikeFriendly: true,
    recommendedBike: ["xc", "trail", "hardtail", "ebike"],
    tags: ["enlace", "pista", "conexion"],
    warnings: ["Comparte camino con vehículos autorizados"],
    relatedRouteSlugs: ["sendero-verde-demo", "senda-azul-demo"],
    dataStatus: "placeholder",
  },
  {
    id: "demo-06",
    slug: "subida-tecnica-demo",
    name: "Subida Técnica Demo",
    sector: "Sector Demo B",
    difficulty: "blue",
    status: "open",
    type: "climb",
    summary: "Subida con rampas exigentes y tramos de senda estrecha.",
    description: "Subida técnica con rampas de hasta el 18% en algunos pasos. Requiere buen estado físico y saber gestionar el grip en zonas sueltas.",
    distanceKm: 2.5,
    elevationGainM: 280,
    elevationLossM: 15,
    estimatedTime: "35 min",
    technicalRating: 3,
    physicalRating: 4,
    ebikeFriendly: true,
    recommendedBike: ["trail", "enduro", "ebike"],
    tags: ["subida", "rampas", "tecnico", "fisico"],
    warnings: ["Rampas exigentes", "Zonas de piedra suelta"],
    relatedRouteSlugs: ["senda-azul-demo"],
    dataStatus: "placeholder",
  },
  {
    id: "demo-07",
    slug: "travesia-demo",
    name: "Travesía Demo",
    sector: "Sector Demo C",
    difficulty: "red",
    status: "seasonal",
    type: "traverse",
    summary: "Travesía de media distancia que recorre los tres sectores demo.",
    description: "Recorrido transversal que conecta los sectores Demo A, B y C. Combina pistas, sendas y tramos técnicos. Mejor época: primavera y otoño.",
    distanceKm: 15.0,
    elevationGainM: 520,
    elevationLossM: 520,
    estimatedTime: "3 h 30 min",
    technicalRating: 3,
    physicalRating: 4,
    ebikeFriendly: true,
    recommendedBike: ["trail", "enduro", "all-mountain", "ebike"],
    tags: ["travesia", "conexion", "larga-duracion"],
    warnings: ["Llevar agua suficiente", "Sin cobertura en algunos tramos", "Consultar estado estacional"],
    relatedRouteSlugs: ["sendero-verde-demo", "senda-azul-demo", "enlace-norte-demo"],
    dataStatus: "placeholder",
  },
  {
    id: "demo-08",
    slug: "sector-historico-demo",
    name: "Sector Histórico Demo",
    sector: "Sector Demo A",
    difficulty: "unclassified",
    status: "unknown",
    type: "loop",
    summary: "Recorrido circular por sendas históricas sin clasificar. Pendiente de evaluación.",
    description: "Circuito que sigue trazados históricos actualmente sin mantenimiento. El estado del sendero no está verificado. Requiere reconocimiento previo.",
    distanceKm: 7.8,
    elevationGainM: 310,
    elevationLossM: 310,
    estimatedTime: "2 h",
    technicalRating: undefined,
    physicalRating: undefined,
    ebikeFriendly: undefined,
    recommendedBike: [],
    tags: ["historico", "sin-clasificar", "pendiente"],
    warnings: ["Sendero no evaluado", "Posible vegetación", "Llevar GPS y mapa"],
    relatedRouteSlugs: [],
    dataStatus: "placeholder",
  },
  /* GPX real — parsed from public/tracks/garumba-gigante.gpx (498 trackpoints) */
  {
    id: "garumba-real",
    slug: "garumba-travesia-real",
    name: "Garumba Travesía Real",
    sector: "Sector Demo B",
    difficulty: "red",
    status: "open",
    type: "traverse",
    summary: "Travesía real por los montes de Morella. 32.5 km con 1.264 m de desnivel positivo.",
    description: "Recorrido real extraído de track GPS que atraviesa la zona de Garumba. Combina pistas, senderos y tramos técnicos. Datos obtenidos de grabación GPS con 498 puntos de track.",
    distanceKm: 32.5,
    elevationGainM: 1264,
    elevationLossM: 1272,
    estimatedTime: "4 h",
    technicalRating: 3,
    physicalRating: 4,
    ebikeFriendly: true,
    recommendedBike: ["trail", "enduro", "all-mountain", "ebike"],
    tags: ["real", "gpx", "travesia", "larga-duracion"],
    warnings: ["Track real — verificar estado actual sobre el terreno", "Llevar agua suficiente"],
    gpxFile: "/tracks/garumba-gigante.gpx",
    coordinates: garumbaCoordinates,
    relatedRouteSlugs: [],
    dataStatus: "real",
  },
];
