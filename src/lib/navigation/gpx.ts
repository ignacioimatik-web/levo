import { distanceBetween } from '@/lib/activities/geo';
import type { RidePoint } from '@/lib/activities/types';
import type { PlannedRoute, PlannedRoutePoint } from './types';

function ridePoint(point: PlannedRoutePoint): RidePoint {
  return {
    ...point,
    accuracy: 0,
    speed: null,
    timestamp: 0,
  };
}

export function parseNavigationGpx(xml: string, fallbackName: string): PlannedRoute {
  const documentNode = new DOMParser().parseFromString(xml, 'application/xml');
  if (documentNode.querySelector('parsererror')) throw new Error('El archivo GPX no es válido.');

  const nodes = Array.from(documentNode.querySelectorAll('trkpt, rtept'));
  const points = nodes.map((node) => ({
    latitude: Number(node.getAttribute('lat')),
    longitude: Number(node.getAttribute('lon')),
    elevation: node.querySelector('ele') ? Number(node.querySelector('ele')?.textContent) : null,
  })).filter((point) => Number.isFinite(point.latitude) && Number.isFinite(point.longitude));

  if (points.length < 2) throw new Error('El GPX no contiene un track navegable.');

  let distanceM = 0;
  let elevationGainM = 0;
  for (let index = 1; index < points.length; index += 1) {
    distanceM += distanceBetween(ridePoint(points[index - 1]), ridePoint(points[index]));
    if (points[index - 1].elevation != null && points[index].elevation != null) {
      const gain = points[index].elevation! - points[index - 1].elevation!;
      if (gain > 1 && gain < 50) elevationGainM += gain;
    }
  }

  const gpxName = documentNode.querySelector('metadata > name, trk > name, rte > name')?.textContent?.trim();
  const name = gpxName || fallbackName.replace(/\.gpx$/i, '') || 'Ruta importada';
  const distanceKm = distanceM / 1000;

  return {
    id: crypto.randomUUID(),
    name,
    trackIds: [],
    distanceKm,
    elevationGainM,
    estimatedTimeMin: Math.round(distanceKm / 12 * 60),
    difficulty: 'importada',
    warnings: ['Ruta GPX externa: comprueba el estado del terreno y los permisos de paso antes de salir.'],
    points,
    createdAt: new Date().toISOString(),
  };
}
