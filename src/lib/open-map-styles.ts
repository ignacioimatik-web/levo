import type { StyleSpecification } from 'mapbox-gl';

export const MAPBOX_ACCESS_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? '';

function rasterStyle({
  id,
  name,
  tiles,
  attribution,
  maxzoom = 19,
}: {
  id: string;
  name: string;
  tiles: string[];
  attribution: string;
  maxzoom?: number;
}): StyleSpecification {
  return {
    version: 8,
    name,
    sources: {
      [id]: {
        type: 'raster',
        tiles,
        tileSize: 256,
        attribution,
        maxzoom,
      },
    },
    layers: [{ id: `${id}-layer`, type: 'raster', source: id }],
  };
}

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

export const FALLBACK_MAP_STYLES = [
  {
    label: 'Topo',
    style: rasterStyle({
      id: 'fallback-open-topo',
      name: 'OpenTopoMap fallback',
      tiles: ['https://tile.opentopomap.org/{z}/{x}/{y}.png'],
      attribution: '© OpenStreetMap contributors · SRTM · OpenTopoMap',
      maxzoom: 17,
    }),
  },
  {
    label: 'Satélite',
    style: rasterStyle({
      id: 'fallback-esri-satellite',
      name: 'Esri World Imagery fallback',
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
      attribution: 'Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics',
    }),
  },
  {
    label: 'Oscuro',
    style: rasterStyle({
      id: 'fallback-carto-dark',
      name: 'CARTO Dark fallback',
      tiles: ['https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png'],
      attribution: '© OpenStreetMap contributors · © CARTO',
      maxzoom: 20,
    }),
  },
] as const;

export const DEFAULT_OPEN_MAP_STYLE = OPEN_MAP_STYLES[0].style;
export const DEFAULT_FALLBACK_MAP_STYLE = FALLBACK_MAP_STYLES[0].style;

export const MAPBOX_RASTER_TILE_URL = MAPBOX_ACCESS_TOKEN
  ? `https://api.mapbox.com/styles/v1/mapbox/outdoors-v12/tiles/256/{z}/{x}/{y}@2x?access_token=${MAPBOX_ACCESS_TOKEN}`
  : 'https://tile.opentopomap.org/{z}/{x}/{y}.png';

export const MAPBOX_RASTER_ATTRIBUTION = MAPBOX_ACCESS_TOKEN
  ? '© Mapbox © OpenStreetMap'
  : '© OpenStreetMap contributors · SRTM · OpenTopoMap';

export const FALLBACK_RASTER_TILE_URL = 'https://tile.opentopomap.org/{z}/{x}/{y}.png';
export const FALLBACK_RASTER_ATTRIBUTION = '© OpenStreetMap contributors · SRTM · OpenTopoMap';

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
