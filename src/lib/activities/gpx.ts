import type { RideActivity } from './types';

function escapeXml(value: string): string {
  return value.replace(/[<>&'"]/g, (character) => ({
    '<': '&lt;',
    '>': '&gt;',
    '&': '&amp;',
    "'": '&apos;',
    '"': '&quot;',
  })[character] ?? character);
}

export function activityToGpx(activity: RideActivity): string {
  const points = activity.points.map((point) => {
    const elevation = point.elevation == null ? '' : `<ele>${point.elevation.toFixed(1)}</ele>`;
    return `<trkpt lat="${point.latitude}" lon="${point.longitude}">${elevation}<time>${new Date(point.timestamp).toISOString()}</time></trkpt>`;
  }).join('');

  return `<?xml version="1.0" encoding="UTF-8"?><gpx version="1.1" creator="E-nduro Ebiketracks" xmlns="http://www.topografix.com/GPX/1/1"><metadata><name>${escapeXml(activity.title)}</name></metadata><trk><name>${escapeXml(activity.title)}</name><type>${activity.sportType}</type><trkseg>${points}</trkseg></trk></gpx>`;
}

export function downloadActivityGpx(activity: RideActivity): void {
  const blob = new Blob([activityToGpx(activity)], { type: 'application/gpx+xml' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${activity.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'actividad'}.gpx`;
  link.click();
  URL.revokeObjectURL(url);
}
