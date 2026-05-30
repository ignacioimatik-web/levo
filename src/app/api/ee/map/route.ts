import { NextResponse } from 'next/server';
import { createEESatelliteLayer } from '@/lib/ee/ee-client';

export async function GET() {
  try {
    const layer = await createEESatelliteLayer();

    if (!layer) {
      return NextResponse.json(
        { error: 'EE not available. Set EE_PROJECT_ID and EE_SERVICE_ACCOUNT_KEY in Vercel env.' },
        { status: 502 },
      );
    }

    return NextResponse.json(layer);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
