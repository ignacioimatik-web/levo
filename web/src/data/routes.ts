export type RouteDifficulty = "verde" | "azul" | "roja" | "negra" | "doble-negra" | "pendiente";

export type RouteType = "circular" | "lineal" | "travesia" | "top-track" | "sector-link";

export interface Sector {
  id: string;
  slug: string;
  name: string;
  description: string;
  terrain: string;
  dominantDifficulty: RouteDifficulty;
  image?: string;
}

export interface MTBRoute {
  id: string;
  slug: string;
  name: string;
  sector: string;
  type: RouteType;
  summary: string;
  description: string;
  distanceKm?: number;
  elevationGainM?: number;
  elevationLossM?: number;
  maxAltitudeM?: number;
  minAltitudeM?: number;
  estimatedTime?: string;
  physicalDifficulty: RouteDifficulty;
  technicalDifficulty: RouteDifficulty;
  recommendedLevel: "iniciacion" | "medio" | "avanzado" | "experto" | "pendiente";
  recommendedBike: string[];
  ebikeFriendly?: boolean;
  trailPercent?: number;
  trackUrl?: string;
  mapEmbedUrl?: string;
  gpxFile?: string;
  kmlFile?: string;
  images: string[];
  warnings: string[];
  waterPoints: string[];
  bestSeason: string[];
  tags: string[];
  relatedRoutes: string[];
  status: "publicada" | "pendiente-datos" | "cerrada-temporalmente";
}

export const sectors: Sector[] = [
  {
    id: "bergantes",
    slug: "bergantes",
    name: "Bergantes",
    description: "El río Bergantes y sus espectaculares muelas.",
    terrain: "Mixte",
    dominantDifficulty: "roja",
  },
  {
    id: "celumbres",
    slug: "celumbres",
    name: "Celumbres",
    description: "Un abismo entre Cinctorres y Castellfort.",
    terrain: "Rocoso",
    dominantDifficulty: "negra",
  },
  {
    id: "el-riu-de-les-corces",
    slug: "el-riu-de-les-corces",
    name: "El Riu de les Corces",
    description: "El valle de 'Mundo Perdido'.",
    terrain: "Singletrack",
    dominantDifficulty: "roja",
  },
  {
    id: "peter-rules",
    slug: "peter-rules",
    name: "Peter Rules",
    description: "Bosques de gran calidad y orografía quebrada.",
    terrain: "Boscoso",
    dominantDifficulty: "azul",
  },
  {
    id: "torre-miro-xiva",
    slug: "torre-miro-xiva",
    name: "Torre Miró - Xiva",
    description: "Un valle de orfebrería de roca y bosque.",
    terrain: "Mixto",
    dominantDifficulty: "azul",
  },
];

export const routes: MTBRoute[] = [
  {
    id: "1",
    slug: "garumba-gigante",
    name: "Garumba Gigante",
    sector: "Bergantes",
    type: "circular",
    summary: "Una ruta espectacular por el sector de Bergantes.",
    description: "Descripción detallada de la ruta Garumba Gigante. (Pendiente de completar)",
    distanceKm: 34.1,
    elevationGainM: 1137,
    physicalDifficulty: "roja",
    technicalDifficulty: "roja",
    recommendedLevel: "avanzado",
    recommendedBike: ["Enduro", "All-mountain"],
    ebikeFriendly: true,
    trailPercent: 39,
    images: [],
    warnings: [],
    waterPoints: [],
    bestSeason: [],
    tags: ["Bergantes", "Enduro"],
    relatedRoutes: [],
    status: "pendiente-datos",
  },
  {
    id: "2",
    slug: "vuelta-garumba",
    name: "Vuelta Garumba",
    sector: "Bergantes",
    type: "circular",
    summary: "Recorrido circular por las zonas de Garumba.",
    description: "Descripción detallada de la ruta Vuelta Garumba. (Pendiente de completar)",
    distanceKm: 23,
    elevationGainM: 842,
    physicalDifficulty: "azul",
    technicalDifficulty: "azul",
    recommendedLevel: "medio",
    recommendedBike: ["Trail", "All-mountain"],
    ebikeFriendly: true,
    trailPercent: 60,
    images: [],
    warnings: [],
    waterPoints: [],
    bestSeason: [],
    tags: ["Bergantes", "Circular"],
    relatedRoutes: ["garumba-gigante"],
    status: "pendiente-datos",
  },
  {
    id: "3",
    slug: "santets-gegants",
    name: "Santets Gegants",
    sector: "Bergantes",
    type: "circular",
    summary: "Ruta por el sector Bergantes con vistas espectaculares.",
    description: "Descripción detallada de la ruta Santets Gegants. (Pendiente de completar)",
    distanceKm: 29,
    elevationGainM: 750,
    physicalDifficulty: "azul",
    technicalDifficulty: "azul",
    recommendedLevel: "medio",
    recommendedBike: ["Trail", "All-mountain"],
    ebikeFriendly: true,
    trailPercent: 27,
    images: [],
    warnings: [],
    waterPoints: [],
    bestSeason: [],
    tags: ["Bergantes", "Vistas"],
    relatedRoutes: [],
    status: "pendiente-datos",
  }
];
