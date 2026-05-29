import { NextResponse } from 'next/server';
import { createEESatelliteLayer } from '@/lib/ee/ee-client';

export async function GET() {
  try {
    const layer = await createEESatelliteLayer();

    if (!layer) {
      return NextResponse.json(
        { error: 'Failed to create EE layer. Verify EE_PROJECT_ID and GOOGLE_EARTH_ENGINE_API_KEY.' },
        { status: 502 },
      );
    }

    return NextResponse.json(layer);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
