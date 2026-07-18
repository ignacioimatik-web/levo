import type { StyleSpecification } from 'mapbox-gl';

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
    style: rasterStyle({
      id: 'open-topo',
      name: 'OpenTopoMap',
      tiles: ['https://tile.opentopomap.org/{z}/{x}/{y}.png'],
      attribution: '© OpenStreetMap contributors · SRTM · OpenTopoMap',
      maxzoom: 17,
    }),
  },
  {
    label: 'Satélite',
    style: rasterStyle({
      id: 'esri-satellite',
      name: 'Esri World Imagery',
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
      attribution: 'Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics',
    }),
  },
  {
    label: 'Oscuro',
    style: rasterStyle({
      id: 'carto-dark',
      name: 'CARTO Dark',
      tiles: ['https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png'],
      attribution: '© OpenStreetMap contributors · © CARTO',
      maxzoom: 20,
    }),
  },
] as const;

export const DEFAULT_OPEN_MAP_STYLE = OPEN_MAP_STYLES[0].style;
