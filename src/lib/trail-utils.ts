import { MTBTrail, TrailDifficulty, TrailStatus, TrailType } from '@/data/trails';

export function getTrailDifficultyLabel(difficulty: TrailDifficulty): string {
  const labels: Record<TrailDifficulty, string> = {
    green: "Verde",
    blue: "Azul",
    red: "Roja",
    black: "Negra",
    "double-black": "Doble Negra",
    unclassified: "Sin clasificar",
  };
  return labels[difficulty];
}

export function getTrailStatusLabel(status: TrailStatus): { label: string; colorClass: string; bgClass: string } {
  const config: Record<TrailStatus, { label: string; colorClass: string; bgClass: string }> = {
    open: { label: "Abierto", colorClass: "text-green-400", bgClass: "bg-green-500/10" },
    caution: { label: "Precaución", colorClass: "text-amber-400", bgClass: "bg-amber-500/10" },
    closed: { label: "Cerrado", colorClass: "text-red-400", bgClass: "bg-red-500/10" },
    seasonal: { label: "Estacional", colorClass: "text-sky-400", bgClass: "bg-sky-500/10" },
    unknown: { label: "Desconocido", colorClass: "text-slate-400", bgClass: "bg-slate-500/10" },
  };
  return config[status];
}

export function getTrailTypeLabel(type: TrailType): string {
  const labels: Record<TrailType, string> = {
    singletrack: "Sendero",
    descent: "Descenso",
    climb: "Subida",
    link: "Enlace",
    loop: "Circular",
    traverse: "Travesía",
    "service-road": "Pista forestal",
  };
  return labels[type];
}

export interface TrailTotals {
  total: number;
  byDifficulty: Record<TrailDifficulty, number>;
  byStatus: Record<TrailStatus, number>;
  byType: Record<TrailType, number>;
  totalDistanceKm: number;
  openCount: number;
  averageTechnicalRating: number | null;
}

export function calculateTrailTotals(trails: MTBTrail[]): TrailTotals {
  const difficulties: TrailDifficulty[] = ["green", "blue", "red", "black", "double-black", "unclassified"];
  const statuses: TrailStatus[] = ["open", "caution", "closed", "seasonal", "unknown"];
  const types: TrailType[] = ["singletrack", "descent", "climb", "link", "loop", "traverse", "service-road"];

  const byDifficulty = Object.fromEntries(difficulties.map(d => [d, 0])) as Record<TrailDifficulty, number>;
  const byStatus = Object.fromEntries(statuses.map(s => [s, 0])) as Record<TrailStatus, number>;
  const byType = Object.fromEntries(types.map(t => [t, 0])) as Record<TrailType, number>;

  let totalDistanceKm = 0;
  let openCount = 0;
  let techSum = 0;
  let techCount = 0;

  for (const trail of trails) {
    byDifficulty[trail.difficulty]++;
    byStatus[trail.status]++;
    byType[trail.type]++;

    if (trail.distanceKm) totalDistanceKm += trail.distanceKm;
    if (trail.status === "open") openCount++;
    if (trail.technicalRating) {
      techSum += trail.technicalRating;
      techCount++;
    }
  }

  return {
    total: trails.length,
    byDifficulty,
    byStatus,
    byType,
    totalDistanceKm: Math.round(totalDistanceKm * 10) / 10,
    openCount,
    averageTechnicalRating: techCount > 0 ? Math.round((techSum / techCount) * 10) / 10 : null,
  };
}

export interface TrailFilters {
  difficulties?: TrailDifficulty[];
  statuses?: TrailStatus[];
  types?: TrailType[];
  sectors?: string[];
  query?: string;
  technicalRatingMin?: number;
  technicalRatingMax?: number;
  ebikeFriendly?: boolean;
}

export function filterTrails(trails: MTBTrail[], filters: TrailFilters): MTBTrail[] {
  return trails.filter(trail => {
    if (filters.difficulties?.length && !filters.difficulties.includes(trail.difficulty)) return false;
    if (filters.statuses?.length && !filters.statuses.includes(trail.status)) return false;
    if (filters.types?.length && !filters.types.includes(trail.type)) return false;
    if (filters.sectors?.length && !filters.sectors.includes(trail.sector)) return false;
    if (filters.technicalRatingMin !== undefined && (trail.technicalRating ?? 0) < filters.technicalRatingMin) return false;
    if (filters.technicalRatingMax !== undefined && (trail.technicalRating ?? 5) > filters.technicalRatingMax) return false;
    if (filters.ebikeFriendly !== undefined && trail.ebikeFriendly !== filters.ebikeFriendly) return false;

    if (filters.query) {
      const q = filters.query.toLowerCase();
      const matchesName = trail.name.toLowerCase().includes(q);
      const matchesSummary = trail.summary.toLowerCase().includes(q);
      const matchesSector = trail.sector.toLowerCase().includes(q);
      const matchesTags = trail.tags.some(t => t.toLowerCase().includes(q));
      if (!matchesName && !matchesSummary && !matchesSector && !matchesTags) return false;
    }

    return true;
  });
}
