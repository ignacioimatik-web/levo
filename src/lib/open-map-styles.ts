import type { StyleSpecification } from 'mapbox-gl';

export const MAPBOX_ACCESS_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? '';

export const OPEN_MAP_STYLES = [
  {
    label: 'Topo',
    style: 'mapbox://styles/mapbox/outdoors-v12',
  },
  {
    label: 'Satélite',
    style: 'mapbox://styles/mapbox/satellite-streets-v12',
  },
  {
    label: 'Oscuro',
    style: 'mapbox://styles/mapbox/navigation-night-v1',
  },
] as const;

export const DEFAULT_OPEN_MAP_STYLE = OPEN_MAP_STYLES[0].style;

export const MAPBOX_RASTER_TILE_URL = MAPBOX_ACCESS_TOKEN
  ? `https://api.mapbox.com/styles/v1/mapbox/outdoors-v12/tiles/256/{z}/{x}/{y}@2x?access_token=${MAPBOX_ACCESS_TOKEN}`
  : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

export const MAPBOX_RASTER_ATTRIBUTION = MAPBOX_ACCESS_TOKEN
  ? '© Mapbox © OpenStreetMap'
  : '© OpenStreetMap contributors';

export const OFFLINE_MAP_STYLE: StyleSpecification = {
  version: 8,
  name: 'LEVO Offline',
  sources: {},
  layers: [{
    id: 'offline-background',
    type: 'background',
    paint: { 'background-color': '#172033' },
  }],
};
