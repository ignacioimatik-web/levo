import { NextResponse } from 'next/server';
import { analyzeRoute } from '@/lib/route-analysis';
import { getRoutePointsBySlug } from '@/lib/route-status';

function esc(str: string): string {
  return str
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

export async function GET(_: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const data = await getRoutePointsBySlug(slug);
  if (!data) {
    return NextResponse.json({ ok: false, message: 'Ruta no encontrada o sin puntos.' }, { status: 404 });
  }

  const profile = analyzeRoute(data.points);
  const waypoints = profile.segments
    .map(
      (s, i) => `\n  <wpt lat="${s.start.lat}" lon="${s.start.lng}"><name>${esc(`S${i + 1} ${s.label}`)}</name><desc>${esc(`km ${s.startKm}-${s.endKm} | ${s.distanceKm} km | ${s.elevationDeltaM > 0 ? '+' : ''}${s.elevationDeltaM} m | ${s.avgSlopePct}%`)}</desc></wpt>`
    )
    .join('');

  const trkSegs = profile.segments
    .map((s, i) => {
      const pts = data.points.slice(s.startIndex, s.endIndex + 1);
      const trkpts = pts
        .map((p) => `\n      <trkpt lat="${p.lat}" lon="${p.lng}"><ele>${p.elevation ?? 0}</ele></trkpt>`)
        .join('');
      return `\n    <trkseg>${trkpts}\n    </trkseg>`;
    })
    .join('');

  const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Moreres Forfait" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${esc(`${data.title} - Segmentado`)}</name>
    <desc>${esc('Track segmentado automaticamente para analisis MTB.')}</desc>
    <time>${new Date().toISOString()}</time>
  </metadata>${waypoints}
  <trk>
    <name>${esc(data.title)}</name>
${trkSegs}
  </trk>
</gpx>`;

  return new NextResponse(gpx, {
    headers: {
      'Content-Type': 'application/gpx+xml; charset=utf-8',
      'Content-Disposition': `attachment; filename="${slug}-segmentado.gpx"`,
    },
  });
}
