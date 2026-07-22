import { NextRequest, NextResponse } from 'next/server';
import { getAemetNowForLocation } from '@/lib/aemet';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const lat = parseFloat(searchParams.get('lat') || '40.62');
  const lng = parseFloat(searchParams.get('lng') || '-0.10');
  const radiusKm = 25;

  try {
    const weather = await getAemetNowForLocation(lat, lng);

    if (!weather) {
      return NextResponse.json({ stations: [], error: 'No se pudieron obtener datos meteorológicos' });
    }

    // Filter nearbyStations within radius and format them
    const stations = [
      {
        code: weather.stationCode,
        name: weather.stationName,
        distanceKm: weather.stationDistanceKm,
        temperatureC: weather.temperatureC,
        humidityPct: weather.humidityPct,
        windKmh: weather.windKmh,
        precipitationMm: weather.precipitationMm,
        riskLevel: weather.riskLevel,
        routeNowLabel: weather.routeNowLabel,
        isNearest: true,
      },
      ...(weather.nearbyStations || [])
        .filter(s => s.distanceKm <= radiusKm && s.stationCode !== weather.stationCode)
        .map(s => ({
          code: s.stationCode,
          name: s.stationName,
          distanceKm: s.distanceKm,
          temperatureC: s.temperatureC,
          humidityPct: null as number | null,
          windKmh: null as number | null,
          precipitationMm: null as number | null,
          riskLevel: null as string | null,
          routeNowLabel: null as string | null,
          isNearest: false,
        })),
    ];

    return NextResponse.json({ stations, centerLat: lat, centerLng: lng });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Error al obtener estaciones' }, { status: 500 });
  }
}
