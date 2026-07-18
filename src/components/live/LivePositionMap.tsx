'use client';

import Map, { Marker, NavigationControl } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import { MapPin } from 'lucide-react';

export default function LivePositionMap({
  latitude,
  longitude,
}: {
  latitude: number;
  longitude: number;
}) {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) {
    return (
      <div className="grid h-full place-items-center bg-slate-900 text-center">
        <div>
          <MapPin className="mx-auto h-8 w-8 text-orange-400" />
          <p className="mt-2 text-sm font-bold">{latitude.toFixed(5)}, {longitude.toFixed(5)}</p>
        </div>
      </div>
    );
  }

  return (
    <Map
      mapboxAccessToken={token}
      initialViewState={{ latitude, longitude, zoom: 14.5 }}
      mapStyle="mapbox://styles/mapbox/outdoors-v12"
      attributionControl={false}
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
