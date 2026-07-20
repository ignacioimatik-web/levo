export interface GeocodingResult {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  type: string;
  boundingBox: [number, number, number, number] | null;
}

interface NominatimResult {
  place_id?: number | string;
  osm_type?: string;
  osm_id?: number | string;
  display_name?: string;
  lat?: string;
  lon?: string;
  type?: string;
  addresstype?: string;
  boundingbox?: string[];
}

function finiteCoordinate(value: string | undefined, min: number, max: number): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : null;
}

function parseBoundingBox(value: string[] | undefined): [number, number, number, number] | null {
  if (!value || value.length !== 4) return null;
  const south = finiteCoordinate(value[0], -90, 90);
  const north = finiteCoordinate(value[1], -90, 90);
  const west = finiteCoordinate(value[2], -180, 180);
  const east = finiteCoordinate(value[3], -180, 180);
  if (south == null || north == null || west == null || east == null) return null;
  return [west, south, east, north];
}

export function normalizeGeocodingResults(
  input: unknown,
  limit = 5,
): GeocodingResult[] {
  if (!Array.isArray(input)) return [];
  const results: GeocodingResult[] = [];
  const seen = new Set<string>();

  for (const raw of input as NominatimResult[]) {
    const latitude = finiteCoordinate(raw.lat, -90, 90);
    const longitude = finiteCoordinate(raw.lon, -180, 180);
    const name = raw.display_name?.trim();
    if (latitude == null || longitude == null || !name) continue;
    const identity = `${latitude.toFixed(6)}:${longitude.toFixed(6)}`;
    if (seen.has(identity)) continue;
    seen.add(identity);
    results.push({
      id: String(raw.place_id ?? `${raw.osm_type ?? 'place'}-${raw.osm_id ?? identity}`),
      name,
      latitude,
      longitude,
      type: raw.addresstype?.trim() || raw.type?.trim() || 'lugar',
      boundingBox: parseBoundingBox(raw.boundingbox),
    });
    if (results.length >= Math.max(1, Math.min(5, limit))) break;
  }

  return results;
}
