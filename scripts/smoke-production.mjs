import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { loadEnvFile } from 'node:process';

const baseUrl = (process.env.LEVO_BASE_URL || 'https://levo-eta.vercel.app').replace(/\/+$/, '');
const timeoutMs = 30_000;

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  try {
    loadEnvFile('.env.local');
  } catch {
    // CI and hosted checks provide these variables directly.
  }
}

async function post(path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const payload = await response.json();
  assert.equal(
    response.ok,
    true,
    `${path} respondió ${response.status}: ${payload.error || payload.detail || 'error desconocido'}`,
  );
  return payload;
}

console.log(`Comprobando ${baseUrl}`);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
assert.ok(supabaseUrl, 'Falta NEXT_PUBLIC_SUPABASE_URL para comprobar el acceso.');
assert.ok(supabaseKey, 'Falta NEXT_PUBLIC_SUPABASE_ANON_KEY para comprobar el acceso.');

const authSettingsResponse = await fetch(`${supabaseUrl}/auth/v1/settings`, {
  headers: { apikey: supabaseKey },
  cache: 'no-store',
  signal: AbortSignal.timeout(timeoutMs),
});
assert.equal(
  authSettingsResponse.ok,
  true,
  `Supabase Auth respondió ${authSettingsResponse.status} al consultar proveedores.`,
);
const authSettings = await authSettingsResponse.json();
assert.equal(authSettings.external?.email, true, 'El acceso por email no está activo.');
assert.equal(authSettings.external?.google, true, 'El acceso con Google no está activo.');
assert.notEqual(authSettings.external?.apple, true, 'Apple no debe aparecer en esta beta.');

const verifier = randomBytes(48).toString('base64url');
const challenge = createHash('sha256').update(verifier).digest('base64url');
const authorizeUrl = new URL('/auth/v1/authorize', supabaseUrl);
authorizeUrl.searchParams.set('provider', 'google');
authorizeUrl.searchParams.set(
  'redirect_to',
  `${baseUrl}/auth/callback?next=${encodeURIComponent('/account')}`,
);
authorizeUrl.searchParams.set('code_challenge', challenge);
authorizeUrl.searchParams.set('code_challenge_method', 's256');

const authorizeResponse = await fetch(authorizeUrl, {
  redirect: 'manual',
  signal: AbortSignal.timeout(timeoutMs),
});
assert.equal(authorizeResponse.status, 302, 'Google OAuth no generó una redirección.');
const googleLocation = authorizeResponse.headers.get('location');
assert.ok(googleLocation, 'Google OAuth no devolvió un destino.');
const googleUrl = new URL(googleLocation);
assert.equal(googleUrl.hostname, 'accounts.google.com', 'OAuth no redirige a Google.');
assert.ok(googleUrl.searchParams.get('client_id'), 'Falta el cliente OAuth de Google.');
assert.ok(googleUrl.searchParams.get('state'), 'Falta el estado seguro del flujo OAuth.');
assert.equal(
  googleUrl.searchParams.get('redirect_uri'),
  `${new URL(supabaseUrl).origin}/auth/v1/callback`,
  'Google no devuelve el control al callback de Supabase.',
);

const routed = await post('/api/route-path', {
  points: [
    { latitude: 40.6198, longitude: -0.0989 },
    { latitude: 40.6265, longitude: -0.0865 },
  ],
  profile: 'mtb',
});

assert.ok(Array.isArray(routed.route?.points), 'El enrutador no devolvió puntos.');
assert.ok(routed.route.points.length >= 2, 'El trazado calculado está vacío.');
assert.ok(routed.route.distanceM > 500, 'La distancia calculada no es plausible.');

const analysis = await post('/api/route-analysis', {
  id: 'production-smoke-morella',
  title: 'Comprobación automática Morella',
  timeZone: 'Europe/Madrid',
  points: routed.route.points,
});

assert.ok(Array.isArray(analysis.ridePlan?.phases), 'Falta el plan meteorológico por fases.');
assert.ok(analysis.ridePlan.phases.length >= 3, 'El análisis meteorológico tiene muy poca resolución.');
assert.ok(analysis.ridePlan.stationCount >= 1, 'No se obtuvieron estaciones o muestras meteorológicas.');
assert.ok(analysis.ridePlan.sourceLabel, 'Falta identificar la fuente meteorológica.');
assert.equal(
  analysis.weatherNow?.source,
  'aemet-observation',
  `Producción no está usando observaciones AEMET: ${analysis.weatherNow?.sourceLabel || 'fuente desconocida'}.`,
);
assert.match(analysis.daylight?.sunrise || '', /^\d{2}:\d{2}$/, 'La salida del sol no es válida.');
assert.match(analysis.daylight?.sunset || '', /^\d{2}:\d{2}$/, 'La puesta del sol no es válida.');

console.log(JSON.stringify({
  result: 'ok',
  auth: {
    email: true,
    google: true,
    apple: false,
    oauth: 'pkce',
  },
  route: {
    points: routed.route.points.length,
    distanceKm: Math.round(routed.route.distanceM / 100) / 10,
    elevationGainM: Math.round(routed.route.elevationGainM || 0),
  },
  weather: {
    source: analysis.ridePlan.sourceLabel,
    kind: analysis.weatherNow.source,
    samples: analysis.ridePlan.stationCount,
    phases: analysis.ridePlan.phases.length,
  },
  daylight: {
    sunrise: analysis.daylight.sunrise,
    sunset: analysis.daylight.sunset,
  },
}, null, 2));
