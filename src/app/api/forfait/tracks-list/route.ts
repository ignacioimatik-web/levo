import { NextResponse } from 'next/server';
import { routes } from '@/data/routes';
import { promises as fs } from 'fs';
import path from 'path';

/** GET /api/forfait/tracks-list
 *  Returns a lightweight list of tracks that have GPX files.
 */
export async function GET() {
  const tracks: Array<{ id: string; name: string; sector: string; gpxUrl: string }> = [];
  let idCounter = 1;

  for (const route of routes) {
    const gpxRelPath = route.trackUrl || route.gpxFile || '';
    if (!gpxRelPath.endsWith('.gpx')) continue;

    // Verify the GPX file exists
    const fullPath = path.join(process.cwd(), 'public', gpxRelPath.replace(/^\//, ''));
    try {
      await fs.access(fullPath);
    } catch {
      continue;
    }

    tracks.push({
      id: `real-${String(idCounter++).padStart(2, '0')}`,
      name: route.name,
      sector: route.sector,
      gpxUrl: gpxRelPath,
    });
  }

  return NextResponse.json({ tracks });
}
