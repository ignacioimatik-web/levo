import { NextRequest, NextResponse } from 'next/server';
import { normalizeGeocodingResults } from '@/lib/geocoding';

const DEFAULT_PROVIDER = 'https://nominatim.openstreetmap.org';
const MIN_REQUEST_GAP_MS = 1_050;
let providerQueue: Promise<void> = Promise.resolve();
let lastProviderRequestAt = 0;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function respectProviderRateLimit(): Promise<void> {
  const previous = providerQueue;
  let release = () => {};
  providerQueue = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;
  const remaining = MIN_REQUEST_GAP_MS - (Date.now() - lastProviderRequestAt);
  if (remaining > 0) await wait(remaining);
  lastProviderRequestAt = Date.now();
  release();
}

function providerUrl(query: string): URL {
  const base = (process.env.GEOCODER_BASE_URL || DEFAULT_PROVIDER).replace(/\/+$/, '');
  const url = new URL(`${base}/search`);
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', '5');
  url.searchParams.set('addressdetails', '0');
  url.searchParams.set('accept-language', 'es,en');
  return url;
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q')?.trim().replace(/\s+/g, ' ') ?? '';
  if (query.length < 2 || query.length > 120) {
    return NextResponse.json(
      { error: 'Escribe entre 2 y 120 caracteres.' },
      { status: 400 },
    );
  }

  try {
    await respectProviderRateLimit();
    const response = await fetch(providerUrl(query), {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'E-nduro-Ebiketracks/1.0 (+https://gpxtour.vercel.app)',
      },
      next: { revalidate: 86_400 },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) throw new Error(`Geocoder responded ${response.status}`);
    const results = normalizeGeocodingResults(await response.json());
    return NextResponse.json(
      { results, attribution: '© colaboradores de OpenStreetMap' },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
        },
      },
    );
  } catch {
    return NextResponse.json(
      { error: 'La búsqueda de lugares no está disponible ahora. Puedes seguir moviendo el mapa.' },
      { status: 503 },
    );
  }
}
