import { NextRequest, NextResponse } from 'next/server';
import { getAemetNowForLocation, getAemetForecast } from '@/lib/aemet';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { lat, lng } = body;

    if (lat == null || lng == null) {
      return NextResponse.json({ error: 'Faltan datos: lat, lng' }, { status: 400 });
    }

    // First get current weather (to obtain province for forecast)
    const now = await getAemetNowForLocation(lat, lng);

    // Then fetch forecast using the province from the nearest station
    const forecast = await getAemetForecast(lat, lng, now?.stationProvince);

    const temperatureC = now?.weightedRouteTempC ?? now?.temperatureC ?? null;
    const humidityPct = now?.humidityPct ?? null;

    return NextResponse.json({
      now: now ? {
        stationName: now.stationName,
        stationDistanceKm: now.stationDistanceKm,
        stationAltitude: now.stationAltitude,
        stationProvince: now.stationProvince,
        temperatureC,
        humidityPct,
        windKmh: now.windKmh,
        maxWindKmh: now.maxWindKmh,
        uvMax: now.uvMax,
        windDirectionDeg: now.windDirectionDeg,
        precipitationMm: now.precipitationMm,
        dataAgeMin: now.dataAgeMin,
        dataIsStale: now.dataIsStale,
      } : null,
      forecast,
      location: { lat, lng },
    });
  } catch (e) {
    console.error('Meteo forecast error:', e);
    return NextResponse.json({ error: 'Error al obtener datos meteorológicos' }, { status: 500 });
  }
}
