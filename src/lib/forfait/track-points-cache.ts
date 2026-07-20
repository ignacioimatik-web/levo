'use client';

import type { TrackPoint } from './types';
import { parseGPX } from '@/lib/gpx-utils';

/**
 * Client-side cache for lazy-loading GPX track points.
 * Tracks start with no points on the server; points are fetched
 * on-demand when a track becomes visible on the map.
 */
const pointsCache = new Map<string, TrackPoint[]>();
let loadingPromise: Promise<void> | null = null;
let allTracksGpxUrls: string[] = [];

const MAX_POINTS = 300;

function downsample(points: TrackPoint[]): TrackPoint[] {
  if (points.length <= MAX_POINTS) return points;
  const sampled: TrackPoint[] = [];
  for (let i = 0; i < MAX_POINTS; i++) {
    const idx = Math.round((i / (MAX_POINTS - 1)) * (points.length - 1));
    sampled.push(points[idx]);
  }
  return sampled;
}

/**
 * Fetch & parse a single GPX file, cache the result.
 */
export async function loadTrackPoints(gpxUrl: string): Promise<TrackPoint[]> {
  if (pointsCache.has(gpxUrl)) return pointsCache.get(gpxUrl)!;
  try {
    const res = await fetch(gpxUrl);
    if (!res.ok) throw new Error(`Failed to fetch ${gpxUrl}`);
    const xml = await res.text();
    const all = parseGPX(xml);
    const sampled = downsample(all);
    pointsCache.set(gpxUrl, sampled);
    return sampled;
  } catch (e) {
    console.error('Error loading GPX:', gpxUrl, e);
    pointsCache.set(gpxUrl, []);
    return [];
  }
}

/**
 * Register the list of GPX URLs to be preloaded in background.
 */
export function registerAllGpxUrls(urls: string[]) {
  allTracksGpxUrls = urls;
}

/**
 * Start background preload of all GPX files (doesn't block rendering).
 * Call this after the component mounts.
 */
export function preloadAllGpx(): Promise<void> {
  if (loadingPromise) return loadingPromise;
  loadingPromise = Promise.all(
    allTracksGpxUrls.map(url =>
      loadTrackPoints(url).catch(() => {/* swallow */})
    )
  ).then(() => undefined);
  return loadingPromise;
}

/**
 * Get cached points for a GPX URL (synchronous, may return undefined).
 */
export function getCachedTrackPoints(gpxUrl: string): TrackPoint[] | undefined {
  return pointsCache.get(gpxUrl);
}

/**
 * Clear the cache (e.g. on route change).
 */
export function clearTrackPointsCache() {
  pointsCache.clear();
  loadingPromise = null;
}

export { downsample as downsampleTrackPoints };
