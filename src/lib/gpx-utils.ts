/* Parser for GPX files — extracts TrailPoint[], computes distance + elevation.
   See /docs/forfait-gpx.md §3 for the full data model reference. */

import type { TrailPoint } from '@/data/trails';

export function parseGPX(xml: string): TrailPoint[] {
  const points: TrailPoint[] = [];
  const regex = /<trkpt lat="([\-\d\.]+)" lon="([\-\d\.]+)">\s*<ele>([\-\d\.]+)/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(xml)) !== null) {
    points.push({
      lat: parseFloat(m[1]),
      lng: parseFloat(m[2]),
      elevation: parseFloat(m[3]),
    });
  }
  return points;
}

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function computeDistanceKm(points: TrailPoint[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += haversineKm(points[i - 1].lat, points[i - 1].lng, points[i].lat, points[i].lng);
  }
  return Math.round(total * 10) / 10;
}

export function computeElevation(points: TrailPoint[]): { gainM: number; lossM: number; maxM: number; minM: number } {
  let gain = 0, loss = 0;
  let maxM = -Infinity, minM = Infinity;
  for (const p of points) {
    const ele = p.elevation ?? 0;
    if (ele > maxM) maxM = ele;
    if (ele < minM) minM = ele;
  }
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1].elevation ?? 0;
    const b = points[i].elevation ?? 0;
    const d = b - a;
    if (d > 1) gain += d;
    else if (d < -1) loss += Math.abs(d);
  }
  return { gainM: Math.round(gain), lossM: Math.round(loss), maxM: Math.round(maxM), minM: Math.round(minM) };
}
