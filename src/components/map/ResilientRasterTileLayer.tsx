'use client';

import { useState } from 'react';
import { TileLayer } from 'react-leaflet';
import {
  FALLBACK_RASTER_ATTRIBUTION,
  FALLBACK_RASTER_TILE_URL,
  MAPBOX_ACCESS_TOKEN,
  MAPBOX_RASTER_ATTRIBUTION,
  MAPBOX_RASTER_TILE_URL,
} from '@/lib/open-map-styles';

export default function ResilientRasterTileLayer() {
  const [usingFallback, setUsingFallback] = useState(!MAPBOX_ACCESS_TOKEN);

  return (
    <TileLayer
      key={usingFallback ? 'fallback-topo' : 'mapbox-topo'}
      attribution={usingFallback ? FALLBACK_RASTER_ATTRIBUTION : MAPBOX_RASTER_ATTRIBUTION}
      url={usingFallback ? FALLBACK_RASTER_TILE_URL : MAPBOX_RASTER_TILE_URL}
      maxNativeZoom={usingFallback ? 17 : 22}
      maxZoom={22}
      eventHandlers={{
        tileerror: () => setUsingFallback(true),
      }}
    />
  );
}
