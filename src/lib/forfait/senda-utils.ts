import type { TrackMTB, TrackPoint } from './types';

export interface CameraView {
  lat: number;
  lng: number;
  zoom: number;
  pitch: number;
  bearing: number;
}

export interface SendaSegment {
  id: string;
  trackId: string;
  trackName: string;
  name: string;
  points: TrackPoint[];
  bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number };
  suggestedView: CameraView;
  customView?: CameraView;
  distanceKm: number;
  elevationGain: number;
  elevationLoss: number;
}

function computeBounds(points: TrackPoint[]) {
  let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
  for (const p of points) {
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lng < minLng) minLng = p.lng;
    if (p.lng > maxLng) maxLng = p.lng;
  }
  const padLat = (maxLat - minLat) * 0.2 || 0.005;
  const padLng = (maxLng - minLng) * 0.2 || 0.005;
  return { minLat: minLat - padLat, maxLat: maxLat + padLat, minLng: minLng - padLng, maxLng: maxLng + padLng };
}

function computeView(bounds: SendaSegment['bounds']): CameraView {
  const lat = (bounds.minLat + bounds.maxLat) / 2;
  const lng = (bounds.minLng + bounds.maxLng) / 2;
  return { lat: +lat.toFixed(6), lng: +lng.toFixed(6), zoom: 14, pitch: 67, bearing: 171 };
}

export function splitIntoSendas(track: TrackMTB, maxSegments = 5): SendaSegment[] {
  const points = track.points;
  if (points.length < 50 || maxSegments <= 1) {
    const bounds = computeBounds(points);
    return [{
      id: `${track.id}-s0`, trackId: track.id, trackName: track.nombre,
      name: track.nombre, points,
      bounds, suggestedView: computeView(bounds),
      distanceKm: track.distanciaKm,
      elevationGain: track.desnivelPositivo,
      elevationLoss: track.desnivelNegativo,
    }];
  }

  const SMOOTH = 10;
  const MIN_PTS = 20;

  const smoothed: number[] = [];
  for (let i = 0; i < points.length; i++) {
    let sum = 0, c = 0;
    for (let j = Math.max(0, i - SMOOTH); j <= Math.min(points.length - 1, i + SMOOTH); j++) {
      sum += points[j].elevation || 0; c++;
    }
    smoothed.push(sum / c);
  }

  const splits: number[] = [0];
  let lastDir = smoothed[1] >= smoothed[0] ? 1 : -1;
  let lastSplit = 0;

  for (let i = 2; i < points.length; i++) {
    const dir = smoothed[i] >= smoothed[i - 1] ? 1 : -1;
    if (dir !== lastDir && (i - lastSplit) >= MIN_PTS) {
      splits.push(i);
      lastSplit = i;
      lastDir = dir;
    }
  }
  if (splits[splits.length - 1] < points.length - 1) splits.push(points.length - 1);

  // Cap at maxSegments
  let finalSplits = splits;
  if (splits.length > maxSegments + 1) {
    finalSplits = [0];
    for (let i = 1; i < maxSegments; i++) {
      finalSplits.push(Math.round((i / maxSegments) * (points.length - 1)));
    }
    finalSplits.push(points.length - 1);
  }

  const segments: SendaSegment[] = [];
  let segIdx = 0;
  for (let i = 0; i < finalSplits.length - 1; i++) {
    const start = finalSplits[i];
    const end = Math.min(finalSplits[i + 1], points.length - 1);
    if (end - start < 2) continue;

    const segPoints = points.slice(start, end + 1);
    const bounds = computeBounds(segPoints);

    const firstEl = segPoints[0].elevation || 0;
    const lastEl = segPoints[segPoints.length - 1].elevation || 0;
    const dir = lastEl >= firstEl ? 'Subida' : 'Descenso';

    let dist = 0;
    let gain = 0, loss = 0;
    for (let j = 1; j < segPoints.length; j++) {
      const d = Math.sqrt(
        ((segPoints[j].lat - segPoints[j - 1].lat) * 111320) ** 2 +
        ((segPoints[j].lng - segPoints[j - 1].lng) * 111320 * Math.cos(segPoints[j].lat * Math.PI / 180)) ** 2
      );
      dist += d;
      const diff = (segPoints[j].elevation || 0) - (segPoints[j - 1].elevation || 0);
      if (diff > 0) gain += diff;
      else loss -= diff;
    }

    segments.push({
      id: `${track.id}-s${segIdx}`,
      trackId: track.id,
      trackName: track.nombre,
      name: `${dir} ${segIdx + 1}`,
      points: segPoints,
      bounds,
      suggestedView: computeView(bounds),
      distanceKm: +(dist / 1000).toFixed(2),
      elevationGain: Math.round(gain),
      elevationLoss: Math.round(loss),
    });
    segIdx++;
  }

  return segments.length > 0 ? segments : [{
    id: `${track.id}-s0`, trackId: track.id, trackName: track.nombre,
    name: track.nombre, points,
    bounds: computeBounds(points),
    suggestedView: computeView(computeBounds(points)),
    distanceKm: track.distanciaKm,
    elevationGain: track.desnivelPositivo,
    elevationLoss: track.desnivelNegativo,
  }];
}
