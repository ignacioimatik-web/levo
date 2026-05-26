import type { RutaConstruida, TrackPoint } from './types';

export function exportarRutaGPX(route: RutaConstruida): string {
  if (!route.tracks.length || !route.pointsCombinados.length) {
    return '';
  }

  // Build the single track with segments for each selected track
  const trackSegments: string[] = [];
  let offset = 0;

  for (const track of route.tracks) {
    const segPoints = route.pointsCombinados.slice(offset, offset + track.points.length);
    offset += track.points.length;

    if (segPoints.length < 2) continue;

    const pts = segPoints
      .map(p => {
        const ele = p.elevation != null ? `      <ele>${p.elevation}</ele>\n` : '';
        return `      <trkpt lat="${p.lat}" lon="${p.lng}">\n${ele}      </trkpt>`;
      })
      .join('\n');

    trackSegments.push(`    <trkseg>\n${pts}\n    </trkseg>`);
  }

  // Waypoints for gaps between tracks (show as GPX waypoints for navigation)
  const waypoints = route.connectionWaypoints
    .map((wp, i) =>
      `  <wpt lat="${wp.lat}" lon="${wp.lng}">\n` +
      `    <name>Punto ${i + 1}: ${escapeXml(wp.descripcion)}</name>\n` +
      (wp.distancia > 50 ? `    <cmt>Separación: ${Math.round(wp.distancia)} m</cmt>\n` : '') +
      `  </wpt>`
    )
    .join('\n');

  const warningsXml = route.advertencias.length
    ? `\n  <extensions>\n${route.advertencias.map(a => `    <warning>${escapeXml(a)}</warning>`).join('\n')}\n  </extensions>`
    : '';

  const desc = `Ruta construida: ${route.tracks.length} tracks, ${route.distanciaTotalKm} km, +${route.desnivelPositivoTotal}m / -${route.desnivelNegativoTotal}m, dificultad ${route.dificultadGlobal}`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="MorellaEbiketracks-ForfaitMTB" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns="http://www.topografix.com/GPX/1/1" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>${escapeXml(route.nombre)}</name>
    <desc>${escapeXml(desc)}</desc>
    <author>
      <name>Morella Ebiketracks Forfait MTB</name>
    </author>
  </metadata>
${waypoints}
  <trk>
    <name>${escapeXml(route.nombre)}</name>
    <desc>${escapeXml(desc)}</desc>
${route.tracks.map(t => `    <type>${escapeXml(t.sector)}</type>`).join('\n')}
${trackSegments.join('\n')}
  </trk>
${warningsXml}
</gpx>`;
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

export function descargarGPX(gpx: string, filename?: string): void {
  if (!gpx) return;
  const blob = new Blob([gpx], { type: 'application/gpx+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || 'morella-ebiketracks-ruta.gpx';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
