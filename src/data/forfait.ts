export type ForfaitDifficultyId = "verde" | "azul" | "roja" | "negra" | "doble-negra";
export type ForfaitTrailStatus = "abierto" | "cerrado" | "parcial" | "obras";
export type ForfaitTrailType = "descenso" | "enduro" | "travesia" | "enlace" | "subida";

export interface ForfaitDifficulty {
  id: ForfaitDifficultyId;
  label: string;
  description: string;
  colorClass: string;
  bgClass: string;
  borderClass: string;
}

export interface ForfaitTrail {
  id: string;
  name: string;
  sector: string;
  difficulty: ForfaitDifficultyId;
  status: ForfaitTrailStatus;
  type: ForfaitTrailType;
  distanceKm: number;
  elevationGainM: number;
  elevationLossM: number;
  estimatedTime: string;
  description: string;
}

export const forfaitDifficulties: ForfaitDifficulty[] = [
  {
    id: "verde",
    label: "Verde",
    description: "Senderos suaves, ideales para iniciación y familias. Sin obstáculos técnicos.",
    colorClass: "text-green-500",
    bgClass: "bg-green-500/10",
    borderClass: "border-green-500/30",
  },
  {
    id: "azul",
    label: "Azul",
    description: "Dificultad baja. Requiere algo de experiencia en MTB. Curvas amplias y pendientes moderadas.",
    colorClass: "text-blue-500",
    bgClass: "bg-blue-500/10",
    borderClass: "border-blue-500/30",
  },
  {
    id: "roja",
    label: "Roja",
    description: "Dificultad media-alta. Requiere buen manejo técnico. Pendientes pronunciadas y curvas cerradas.",
    colorClass: "text-red-500",
    bgClass: "bg-red-500/10",
    borderClass: "border-red-500/30",
  },
  {
    id: "negra",
    label: "Negra",
    description: "Dificultad alta. Solo para ciclistas experimentados. Obstáculos técnicos y pendientes muy exigentes.",
    colorClass: "text-slate-300",
    bgClass: "bg-slate-300/10",
    borderClass: "border-slate-300/30",
  },
  {
    id: "doble-negra",
    label: "Doble Negra",
    description: "Dificultad extrema. Riesgo alto. Pasos expuestos, saltos, escalones y pendientes límite.",
    colorClass: "text-slate-100",
    bgClass: "bg-slate-100/10",
    borderClass: "border-slate-100/30",
  },
];

export const trailStatusConfig: Record<ForfaitTrailStatus, { label: string; colorClass: string; bgClass: string }> = {
  abierto: { label: "Abierto", colorClass: "text-green-400", bgClass: "bg-green-500/10" },
  cerrado: { label: "Cerrado", colorClass: "text-red-400", bgClass: "bg-red-500/10" },
  parcial: { label: "Parcial", colorClass: "text-amber-400", bgClass: "bg-amber-500/10" },
  obras: { label: "En obras", colorClass: "text-orange-400", bgClass: "bg-orange-500/10" },
};

export const trailTypeLabels: Record<ForfaitTrailType, string> = {
  descenso: "Descenso",
  enduro: "Enduro",
  travesia: "Travesía",
  enlace: "Enlace",
  subida: "Subida",
};

/* --- DEMO DATA — marcado como placeholder --- */
export const forfaitTrails: ForfaitTrail[] = [
  {
    id: "demo-001",
    name: "Descenso de la Mola (demo)",
    sector: "Mola",
    difficulty: "negra",
    status: "abierto",
    type: "descenso",
    distanceKm: 4.2,
    elevationGainM: 45,
    elevationLossM: 520,
    estimatedTime: "25 min",
    description: "Descenso técnico con pasos expuestos, escalones naturales y curvas cerradas. Exige concentración constante.",
  },
  {
    id: "demo-002",
    name: "Sendero dels Ports (demo)",
    sector: "Els Ports",
    difficulty: "roja",
    status: "abierto",
    type: "enduro",
    distanceKm: 8.7,
    elevationGainM: 310,
    elevationLossM: 420,
    estimatedTime: "1 h 15 min",
    description: "Recorrido enduro con subidas técnicas y descensos rápidos por senda estrecha.",
  },
  {
    id: "demo-003",
    name: "Loma del Castillo (demo)",
    sector: "Castillo",
    difficulty: "azul",
    status: "abierto",
    type: "enlace",
    distanceKm: 3.1,
    elevationGainM: 180,
    elevationLossM: 95,
    estimatedTime: "25 min",
    description: "Tramo de enlace con vistas al castillo. Pista ancha con pendiente suave.",
  },
  {
    id: "demo-004",
    name: "Ruta dels Molins (demo)",
    sector: "Molins",
    difficulty: "verde",
    status: "abierto",
    type: "travesia",
    distanceKm: 12.5,
    elevationGainM: 240,
    elevationLossM: 240,
    estimatedTime: "2 h",
    description: "Ruta circular familiar por pistas forestales y sendas anchas. Ideal para iniciación.",
  },
  {
    id: "demo-005",
    name: "Garumba Extreme (demo)",
    sector: "Garumba",
    difficulty: "doble-negra",
    status: "cerrado",
    type: "descenso",
    distanceKm: 2.8,
    elevationGainM: 20,
    elevationLossM: 380,
    estimatedTime: "18 min",
    description: "Descenso extremo con saltos, drops y pasos de roca. Actualmente cerrado por obras.",
  },
  {
    id: "demo-006",
    name: "Coll de la Bassa (demo)",
    sector: "Mola",
    difficulty: "roja",
    status: "parcial",
    type: "enduro",
    distanceKm: 6.3,
    elevationGainM: 280,
    elevationLossM: 310,
    estimatedTime: "55 min",
    description: "Tramo enduro con sección técnica en la parte alta. El último tramo está parcialmente cortado.",
  },
  {
    id: "demo-007",
    name: "Coronel Perdido (demo)",
    sector: "Castillo",
    difficulty: "negra",
    status: "abierto",
    type: "descenso",
    distanceKm: 3.5,
    elevationGainM: 30,
    elevationLossM: 460,
    estimatedTime: "20 min",
    description: "Descenso emblemático por senda de montaña con raíces, piedras y curvas cerradas.",
  },
  {
    id: "demo-008",
    name: "Subida a Santets (demo)",
    sector: "Santets",
    difficulty: "azul",
    status: "abierto",
    type: "subida",
    distanceKm: 5.9,
    elevationGainM: 410,
    elevationLossM: 60,
    estimatedTime: "50 min",
    description: "Subida constante por pista con rampas exigentes pero ciclables. Recompensa con vistas espectaculares.",
  },
  {
    id: "demo-009",
    name: "Travesía dels Ports (demo)",
    sector: "Els Ports",
    difficulty: "roja",
    status: "obras",
    type: "travesia",
    distanceKm: 22.0,
    elevationGainM: 890,
    elevationLossM: 890,
    estimatedTime: "4 h",
    description: "Travesía completa por el macizo. En obras parciales — consultar estado antes de salir.",
  },
  {
    id: "demo-010",
    name: "Vuelta a la Garumba (demo)",
    sector: "Garumba",
    difficulty: "roja",
    status: "abierto",
    type: "enduro",
    distanceKm: 9.8,
    elevationGainM: 380,
    elevationLossM: 380,
    estimatedTime: "1 h 30 min",
    description: "Circuito enduro de media distancia con tramos técnicos y zonas de flow.",
  },
];
