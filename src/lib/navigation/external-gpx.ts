import { isIP } from 'node:net';

export const MAX_EXTERNAL_GPX_BYTES = 5 * 1024 * 1024;
export const MAX_EXTERNAL_GPX_REDIRECTS = 3;

function isPrivateIpv4(address: string): boolean {
  const octets = address.split('.').map(Number);
  if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) {
    return true;
  }
  const [a, b] = octets;
  return a === 0
    || a === 10
    || a === 127
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168)
    || (a === 100 && b >= 64 && b <= 127)
    || (a === 192 && b === 0 && octets[2] === 0)
    || (a === 192 && b === 0 && octets[2] === 2)
    || (a === 198 && (b === 18 || b === 19))
    || (a === 198 && b === 51 && octets[2] === 100)
    || (a === 203 && b === 0 && octets[2] === 113)
    || a >= 224;
}

function isPrivateIpv6(address: string): boolean {
  const normalized = address.toLowerCase().replace(/^\[|\]$/g, '');
  if (normalized === '::' || normalized === '::1') return true;
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;
  if (/^fe[89ab]/.test(normalized)) return true;
  const mappedIpv4 = normalized.match(/(?:^|:)ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
  return mappedIpv4 ? isPrivateIpv4(mappedIpv4) : false;
}

export function isPublicNetworkAddress(address: string): boolean {
  const version = isIP(address.replace(/^\[|\]$/g, ''));
  if (version === 4) return !isPrivateIpv4(address);
  if (version === 6) return !isPrivateIpv6(address);
  return false;
}

export function validateExternalGpxUrl(value: string): URL {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 2_048) {
    throw new Error('El enlace GPX no es válido.');
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error('Escribe un enlace completo que empiece por https://.');
  }

  if (url.protocol !== 'https:') {
    throw new Error('Por seguridad, el enlace GPX debe usar https://.');
  }
  if (url.username || url.password) {
    throw new Error('El enlace GPX no puede incluir credenciales.');
  }
  if (url.port && url.port !== '443') {
    throw new Error('El enlace GPX debe usar el puerto HTTPS estándar.');
  }
  const hostname = url.hostname.toLowerCase().replace(/\.$/, '');
  const addressLiteral = hostname.replace(/^\[|\]$/g, '');
  if (
    !hostname
    || hostname === 'localhost'
    || hostname.endsWith('.localhost')
    || hostname.endsWith('.local')
    || hostname.endsWith('.internal')
  ) {
    throw new Error('El enlace debe apuntar a un servidor público.');
  }
  if (isIP(addressLiteral) && !isPublicNetworkAddress(addressLiteral)) {
    throw new Error('El enlace debe apuntar a un servidor público.');
  }
  return url;
}

export function looksLikeGpx(xml: string): boolean {
  const sample = xml.slice(0, 50_000).toLowerCase();
  return /<(?:[\w-]+:)?gpx(?:\s|>)/.test(sample)
    && /<(?:[\w-]+:)?(?:trkpt|rtept)(?:\s|>)/.test(sample);
}

export function externalGpxFileName(
  responseUrl: URL,
  contentDisposition: string | null,
): string {
  const encoded = contentDisposition?.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  const plain = contentDisposition?.match(/filename="?([^";]+)"?/i)?.[1];
  let candidate = plain;
  if (encoded) {
    try {
      candidate = decodeURIComponent(encoded);
    } catch {
      candidate = encoded;
    }
  }
  if (!candidate) candidate = responseUrl.pathname.split('/').filter(Boolean).at(-1);
  const safe = (candidate || 'ruta-importada.gpx')
    .replace(/[^\p{L}\p{N}._ -]+/gu, '-')
    .slice(0, 120);
  return /\.gpx$/i.test(safe) ? safe : `${safe || 'ruta-importada'}.gpx`;
}
