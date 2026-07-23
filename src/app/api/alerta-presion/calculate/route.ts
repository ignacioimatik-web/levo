import { NextRequest, NextResponse } from 'next/server';
import { getAemetNowForLocation } from '@/lib/aemet';
import { calculatePressure } from '@/lib/alerta-presion/calculate';
import type { BikeProfile, DescentInfo } from '@/lib/alerta-presion/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { profile, lat, lng, descent } = body;

    if (!profile || !descent) {
      return NextResponse.json({ error: 'Faltan datos: profile, descent' }, { status: 400 });
    }

    // Fetch real-time weather from AEMET
    const weather = await getAemetNowForLocation(lat, lng);

    const temperatureC = weather?.weightedRouteTempC ?? weather?.temperatureC ?? 20;
    const humidityPct = weather?.humidityPct ?? 50;

    const result = calculatePressure({
      profile: profile as BikeProfile,
      temperatureC,
      humidityPct,
      descent: descent as DescentInfo,
    });

    return NextResponse.json({
      recommendation: result,
      weather: {
        stationName: weather?.stationName ?? null,
        stationDistanceKm: weather?.stationDistanceKm ?? null,
        stationAltitude: weather?.stationAltitude ?? null,
        temperatureC,
        humidityPct,
        windKmh: weather?.windKmh ?? null,
        maxWindKmh: weather?.maxWindKmh ?? null,
        uvMax: weather?.uvMax ?? null,
        windDirectionDeg: weather?.windDirectionDeg ?? null,
      },
    });
  } catch (e) {
    console.error('Pressure calculation error:', e);
    return NextResponse.json({ error: 'Error al calcular presión' }, { status: 500 });
  }
}
