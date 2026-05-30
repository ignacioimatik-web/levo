import { NextResponse } from 'next/server';
import { getAemetNowForLocation } from '@/lib/aemet';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const lat = parseFloat(searchParams.get('lat') || '');
  const lng = parseFloat(searchParams.get('lng') || '');
  if (isNaN(lat) || isNaN(lng)) {
    return NextResponse.json({ error: 'Missing or invalid lat/lng' }, { status: 400 });
  }
  try {
    const data = await getAemetNowForLocation(lat, lng);
    return NextResponse.json(data ?? { error: 'No weather data' });
  } catch {
    return NextResponse.json({ error: 'Weather fetch failed' }, { status: 500 });
  }
}
