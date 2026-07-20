import { NextRequest, NextResponse } from 'next/server';
import { getAemetNowForLocation } from '@/lib/aemet';
import { calculatePressure } from '@/lib/alerta-presion/calculate';
import type { CalculationInput, BikeProfile, PressureRecommendation } from '@/lib/alerta-presion/types';

/**
 * POST /api/alerta-presion/calculate
 * Body: { profile, lat, lng, difficulty, sector, trackName }
 * Returns PressureRecommendation with weather data + calculated pressures.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { profile, lat, lng, difficulty, sector, trackName } = body;

    if (!profile || lat === undefined || lng === undefined || !difficulty) {
      return NextResponse.json({ error: 'Faltan datos: profile, lat, lng, difficulty' }, { status: 400 });
    }

    // Fetch real-time weather from AEMET at the given coordinates
    const weather = await getAemetNowForLocation(lat, lng);

    const temperatureC = weather?.weightedRouteTempC ?? weather?.temperatureC ?? 20;
    const humidityPct = weather?.humidityPct ?? 50;

    const input: CalculationInput = {
      profile: profile as BikeProfile,
      temperatureC,
      humidityPct,
      difficulty: difficulty as 'rojo' | 'negro' | 'doble-negro',
      sector: sector || '',
      trackName: trackName || '',
    };

    const result = calculatePressure(input);

    return NextResponse.json({
      recommendation: result,
      weather: {
        stationName: weather?.stationName ?? null,
        stationDistanceKm: weather?.stationDistanceKm ?? null,
        temperatureC,
        humidityPct,
        windKmh: weather?.windKmh ?? null,
        updatedAt: weather?.updatedAt ?? null,
      },
    });
  } catch (e) {
    console.error('Pressure calculation error:', e);
    return NextResponse.json({ error: 'Error al calcular presión' }, { status: 500 });
  }
}
