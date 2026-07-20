'use client';

import Map, { Marker, NavigationControl } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import { MAPBOX_ACCESS_TOKEN } from '@/lib/open-map-styles';
import useResilientMapStyle from '@/components/map/useResilientMapStyle';

export default function LivePositionMap({
  latitude,
  longitude,
}: {
  latitude: number;
  longitude: number;
}) {
  const resilientStyle = useResilientMapStyle();

  return (
    <Map
      mapboxAccessToken={MAPBOX_ACCESS_TOKEN}
      initialViewState={{ latitude, longitude, zoom: 14.5 }}
      mapStyle={resilientStyle.mapStyle}
      onError={resilientStyle.handleMapError}
    >
      <NavigationControl position="top-right" showCompass />
      <Marker latitude={latitude} longitude={longitude} anchor="center">
        <div className="relative" aria-label="Última posición conocida">
          <span className="absolute inset-0 animate-ping rounded-full bg-orange-400/50" />
          <span className="relative block h-6 w-6 rounded-full border-4 border-white bg-orange-500 shadow-xl shadow-orange-950/60" />
        </div>
      </Marker>
    </Map>
  );
}
