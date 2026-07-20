import { lookup } from 'node:dns/promises';
import { NextRequest, NextResponse } from 'next/server';
import {
  externalGpxFileName,
  isPublicNetworkAddress,
  looksLikeGpx,
  MAX_EXTERNAL_GPX_BYTES,
  MAX_EXTERNAL_GPX_REDIRECTS,
  validateExternalGpxUrl,
} from '@/lib/navigation/external-gpx';

export const runtime = 'nodejs';
export const maxDuration = 20;

const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 10;
const requestWindows = new Map<string, { startedAt: number; count: number }>();

function rateLimited(key: string, now = Date.now()): boolean {
  const current = requestWindows.get(key);
  if (!current || now - current.startedAt >= WINDOW_MS) {
    requestWindows.set(key, { startedAt: now, count: 1 });
    return false;
  }
  current.count += 1;
  return current.count > MAX_REQUESTS_PER_WINDOW;
}

async function assertPublicHost(url: URL): Promise<void> {
  const addresses = await lookup(url.hostname, { all: true, verbatim: true });
  if (addresses.length === 0 || addresses.some(({ address }) => !isPublicNetworkAddress(address))) {
    throw new Error('El enlace debe apuntar a un servidor público.');
  }
}

async function readLimitedText(response: Response): Promise<string> {
  const declaredLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_EXTERNAL_GPX_BYTES) {
    throw new Error('El GPX supera el límite de 5 MB.');
  }
  if (!response.body) throw new Error('El servidor no devolvió ningún archivo.');

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_EXTERNAL_GPX_BYTES) {
        await reader.cancel();
        throw new Error('El GPX supera el límite de 5 MB.');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

async function fetchPublicGpx(initialUrl: URL): Promise<{
  xml: string;
  url: URL;
  contentDisposition: string | null;
}> {
  let currentUrl = initialUrl;
  for (let redirect = 0; redirect <= MAX_EXTERNAL_GPX_REDIRECTS; redirect += 1) {
    await assertPublicHost(currentUrl);
    const response = await fetch(currentUrl, {
      redirect: 'manual',
      cache: 'no-store',
      headers: {
        Accept: 'application/gpx+xml, application/xml, text/xml, application/octet-stream;q=0.8',
        'User-Agent': 'LEVO-GPX-import/1.0 (+https://gpxtour.vercel.app)',
      },
      signal: AbortSignal.timeout(12_000),
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location || redirect === MAX_EXTERNAL_GPX_REDIRECTS) {
        throw new Error('El enlace GPX redirige demasiadas veces.');
      }
      currentUrl = validateExternalGpxUrl(new URL(location, currentUrl).toString());
      continue;
    }
    if (!response.ok) {
      throw new Error(`El servidor del GPX respondió con ${response.status}.`);
    }
    return {
      xml: await readLimitedText(response),
      url: currentUrl,
      contentDisposition: response.headers.get('content-disposition'),
    };
  }
  throw new Error('No se pudo seguir el enlace GPX.');
}

export async function POST(request: NextRequest) {
  const requester = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'anonymous';
  if (rateLimited(requester)) {
    return NextResponse.json(
      { error: 'Has importado demasiados enlaces seguidos. Espera un minuto.' },
      { status: 429, headers: { 'Cache-Control': 'private, no-store' } },
    );
  }

  try {
    const body = await request.json() as { url?: unknown };
    if (typeof body.url !== 'string') {
      return NextResponse.json({ error: 'Falta el enlace GPX.' }, { status: 400 });
    }
    const sourceUrl = validateExternalGpxUrl(body.url);
    const result = await fetchPublicGpx(sourceUrl);
    if (!looksLikeGpx(result.xml)) {
      return NextResponse.json(
        { error: 'El enlace no contiene una ruta GPX reconocible.' },
        { status: 422 },
      );
    }
    return NextResponse.json({
      xml: result.xml,
      fileName: externalGpxFileName(result.url, result.contentDisposition),
      sourceHost: result.url.hostname,
    }, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    const timedOut = error instanceof DOMException && error.name === 'TimeoutError';
    const message = error instanceof Error ? error.message : 'No se pudo importar el enlace GPX.';
    return NextResponse.json(
      { error: timedOut ? 'El servidor del GPX tardó demasiado en responder.' : message },
      { status: timedOut ? 504 : 400, headers: { 'Cache-Control': 'private, no-store' } },
    );
  }
}
