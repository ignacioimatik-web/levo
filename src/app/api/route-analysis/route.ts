import { NextRequest, NextResponse } from 'next/server';
import { buildCustomRouteStatus } from '@/lib/custom-route-status';

type InputPoint = {
  latitude?: unknown;
  longitude?: unknown;
  elevation?: unknown;
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      id?: unknown;
      title?: unknown;
      timeZone?: unknown;
      points?: unknown;
    };
    if (!Array.isArray(body.points) || body.points.length < 2 || body.points.length > 20_000) {
      return NextResponse.json({ error: 'La ruta debe contener entre 2 y 20.000 puntos.' }, { status: 400 });
    }
    const points = (body.points as InputPoint[]).map((point) => ({
      lat: Number(point.latitude),
      lng: Number(point.longitude),
      elevation: point.elevation == null ? undefined : Number(point.elevation),
    }));
    const valid = points.every((point) => (
      Number.isFinite(point.lat)
      && Number.isFinite(point.lng)
      && point.lat >= -90
      && point.lat <= 90
      && point.lng >= -180
      && point.lng <= 180
      && (point.elevation == null || Number.isFinite(point.elevation))
    ));
    if (!valid) {
      return NextResponse.json({ error: 'La ruta contiene coordenadas no válidas.' }, { status: 400 });
    }

    const id = typeof body.id === 'string' && body.id.trim() ? body.id.slice(0, 120) : crypto.randomUUID();
    const title = typeof body.title === 'string' && body.title.trim()
      ? body.title.trim().slice(0, 120)
      : 'Ruta personalizada';
    const timeZone = typeof body.timeZone === 'string' && body.timeZone.length <= 80
      ? body.timeZone
      : 'Europe/Madrid';
    try {
      new Intl.DateTimeFormat('es-ES', { timeZone }).format();
    } catch {
      return NextResponse.json({ error: 'Zona horaria no válida.' }, { status: 400 });
    }

    return NextResponse.json(await buildCustomRouteStatus({ id, title, points, timeZone }));
  } catch (error) {
    return NextResponse.json({
      error: 'No se pudo analizar la ruta.',
      detail: error instanceof Error ? error.message : 'Unknown route analysis error',
    }, { status: 500 });
  }
}
