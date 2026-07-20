import type { MTBTrail, TrailDifficulty, TrailType } from '@/data/trails';
import type { SavedRouteData } from './save-route';

function normalizeDifficulty(value: string): TrailDifficulty {
  const normalized = value.trim().toLowerCase();
  if (normalized.includes('double') || normalized.includes('doble')) return 'double-black';
  if (normalized.includes('black') || normalized.includes('negro')) return 'black';
  if (normalized.includes('red') || normalized.includes('rojo')) return 'red';
  if (normalized.includes('blue') || normalized.includes('azul')) return 'blue';
  if (normalized.includes('green') || normalized.includes('verde')) return 'green';
  return 'unclassified';
}

function routeType(route: SavedRouteData): TrailType {
  if (route.routing_mode === 'ebike') return 'service-road';
  if (route.routing_mode === 'manual') return 'link';
  return 'loop';
}

function formatDuration(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return 'Duración variable';
  const rounded = Math.round(minutes);
  if (rounded < 60) return `${rounded} min`;
  const hours = Math.floor(rounded / 60);
  const rest = rounded % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

export function savedRouteToTrail(route: SavedRouteData): MTBTrail | null {
  const coordinates = route.route_points
    .filter((point) => Number.isFinite(point.latitude) && Number.isFinite(point.longitude))
    .map((point) => ({
      lat: point.latitude,
      lng: point.longitude,
      ...(point.elevation == null ? {} : { elevation: point.elevation }),
    }));
  if (coordinates.length < 2) return null;

  const difficulty = normalizeDifficulty(route.difficulty);
  return {
    id: `saved-${route.id}`,
    slug: `saved-${route.id}`,
    name: route.name,
    sector: 'Mis rutas guardadas',
    difficulty,
    status: 'open',
    type: routeType(route),
    summary: 'Ruta privada guardada en tu biblioteca. Lista para cargar en el grabador y navegar con GPS.',
    description: route.reference?.title || 'Trazado creado desde el planificador de E-nduro Ebiketracks.',
    distanceKm: Number.isFinite(route.distance_km) ? route.distance_km : undefined,
    elevationGainM: Number.isFinite(route.elevation_gain_m) ? route.elevation_gain_m : undefined,
    elevationLossM: Number.isFinite(route.elevation_loss_m) ? route.elevation_loss_m : undefined,
    estimatedTime: formatDuration(route.estimated_time_min),
    technicalRating: difficulty === 'unclassified' ? undefined : difficulty === 'green' ? 1 : difficulty === 'blue' ? 2 : difficulty === 'red' ? 3 : 4,
    physicalRating: difficulty === 'unclassified' ? undefined : difficulty === 'green' ? 1 : difficulty === 'blue' ? 2 : difficulty === 'red' ? 3 : 4,
    ebikeFriendly: route.routing_mode === 'ebike' ? true : undefined,
    recommendedBike: route.routing_mode === 'ebike' ? ['ebike', 'trail'] : ['trail', 'enduro'],
    tags: ['ruta privada', route.routing_mode === 'ebike' ? 'e-bike' : 'MTB'],
    warnings: route.warnings,
    coordinates,
    relatedRouteSlugs: [],
    dataStatus: 'real',
    detailHref: `/grabar?ruta=${encodeURIComponent(route.id)}`,
    detailLabel: 'Cargar en grabador',
  };
}

export function savedRoutesToTrails(routes: SavedRouteData[]): MTBTrail[] {
  return routes.map(savedRouteToTrail).filter((trail): trail is MTBTrail => trail !== null);
}
