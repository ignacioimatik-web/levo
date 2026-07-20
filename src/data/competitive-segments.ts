export type CompetitiveSegmentType = 'climb' | 'descent';

export interface SegmentCheckpoint {
  latitude: number;
  longitude: number;
}

export interface CompetitiveSegment {
  id: string;
  name: string;
  routeName: string;
  routeSlug: string;
  region: string;
  type: CompetitiveSegmentType;
  distanceM: number;
  elevationDeltaM: number;
  averageGradePct: number;
  checkpoints: SegmentCheckpoint[];
}

/**
 * The checkpoints below come from the repository's verified GPX tracks.
 * Three ordered gates make a match substantially safer than comparing only
 * the start and finish, especially where trails cross or share an access road.
 */
export const COMPETITIVE_SEGMENTS: readonly CompetitiveSegment[] = [
  {
    id: 'garumba-gigante-west-descent',
    name: 'Gigante Oeste',
    routeName: 'Garumba Gigante',
    routeSlug: 'garumba-gigante',
    region: 'Morella · Garumba',
    type: 'descent',
    distanceM: 1_403,
    elevationDeltaM: -252,
    averageGradePct: -17.9,
    checkpoints: [
      { latitude: 40.648394, longitude: -0.164286 },
      { latitude: 40.646118, longitude: -0.168837 },
      { latitude: 40.644075, longitude: -0.173592 },
    ],
  },
  {
    id: 'garumba-gigante-final-climb',
    name: 'Muro de Garumba',
    routeName: 'Garumba Gigante',
    routeSlug: 'garumba-gigante',
    region: 'Morella · Garumba',
    type: 'climb',
    distanceM: 1_411,
    elevationDeltaM: 225,
    averageGradePct: 15.9,
    checkpoints: [
      { latitude: 40.649303, longitude: -0.191672 },
      { latitude: 40.646467, longitude: -0.190116 },
      { latitude: 40.642334, longitude: -0.187091 },
    ],
  },
  {
    id: 'coronel-perdido-vertical',
    name: 'Coronel Vertical',
    routeName: 'Coronel Perdido',
    routeSlug: 'coronel-perdido',
    region: 'Els Ports · Perdido',
    type: 'descent',
    distanceM: 1_402,
    elevationDeltaM: -241,
    averageGradePct: -17.2,
    checkpoints: [
      { latitude: 40.574189, longitude: 0.07309 },
      { latitude: 40.58039, longitude: 0.068957 },
      { latitude: 40.582723, longitude: 0.069173 },
    ],
  },
  {
    id: 'coronel-perdido-approach',
    name: 'Aproximación al Coronel',
    routeName: 'Coronel Perdido',
    routeSlug: 'coronel-perdido',
    region: 'Els Ports · Perdido',
    type: 'climb',
    distanceM: 1_416,
    elevationDeltaM: 152,
    averageGradePct: 10.7,
    checkpoints: [
      { latitude: 40.60304, longitude: 0.02794 },
      { latitude: 40.601089, longitude: 0.021656 },
      { latitude: 40.599256, longitude: 0.013841 },
    ],
  },
  {
    id: 'santets-gegants-east-descent',
    name: 'Gegants Este',
    routeName: 'Santets Gegants',
    routeSlug: 'santets-gegants',
    region: 'Morella · Santets',
    type: 'descent',
    distanceM: 1_412,
    elevationDeltaM: -180,
    averageGradePct: -12.8,
    checkpoints: [
      { latitude: 40.639931, longitude: -0.107349 },
      { latitude: 40.637917, longitude: -0.108488 },
      { latitude: 40.633249, longitude: -0.103594 },
    ],
  },
  {
    id: 'hard-pertxos-wall',
    name: 'Muro Pertxòs',
    routeName: 'Hard Pertxòs',
    routeSlug: 'hard-pertxos',
    region: 'Els Ports · Pertxòs',
    type: 'climb',
    distanceM: 1_404,
    elevationDeltaM: 222,
    averageGradePct: 15.8,
    checkpoints: [
      { latitude: 40.556796, longitude: -0.223541 },
      { latitude: 40.558502, longitude: -0.230861 },
      { latitude: 40.560692, longitude: -0.236159 },
    ],
  },
  {
    id: 'hard-pertxos-north-descent',
    name: 'Pertxòs Norte',
    routeName: 'Hard Pertxòs',
    routeSlug: 'hard-pertxos',
    region: 'Els Ports · Pertxòs',
    type: 'descent',
    distanceM: 1_409,
    elevationDeltaM: -215,
    averageGradePct: -15.3,
    checkpoints: [
      { latitude: 40.564373, longitude: -0.237221 },
      { latitude: 40.569806, longitude: -0.233714 },
      { latitude: 40.574176, longitude: -0.229499 },
    ],
  },
  {
    id: 'todo-perdido-south-climb',
    name: 'Sur del Perdido',
    routeName: 'Todo Perdido',
    routeSlug: 'todo-perdido',
    region: 'Els Ports · Perdido',
    type: 'climb',
    distanceM: 1_402,
    elevationDeltaM: 165,
    averageGradePct: 11.8,
    checkpoints: [
      { latitude: 40.612167, longitude: 0.046217 },
      { latitude: 40.615134, longitude: 0.042834 },
      { latitude: 40.617467, longitude: 0.038433 },
    ],
  },
] as const;

export function getCompetitiveSegment(id: string): CompetitiveSegment | null {
  return COMPETITIVE_SEGMENTS.find((segment) => segment.id === id) ?? null;
}
