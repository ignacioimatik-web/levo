import assert from 'node:assert/strict';

const baseUrl = (process.env.LEVO_BASE_URL || 'https://levo-eta.vercel.app').replace(/\/+$/, '');
const timeoutMs = 30_000;

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
assert.match(analysis.daylight?.sunrise || '', /^\d{2}:\d{2}$/, 'La salida del sol no es válida.');
assert.match(analysis.daylight?.sunset || '', /^\d{2}:\d{2}$/, 'La puesta del sol no es válida.');

console.log(JSON.stringify({
  result: 'ok',
  route: {
    points: routed.route.points.length,
    distanceKm: Math.round(routed.route.distanceM / 100) / 10,
    elevationGainM: Math.round(routed.route.elevationGainM || 0),
  },
  weather: {
    source: analysis.ridePlan.sourceLabel,
    samples: analysis.ridePlan.stationCount,
    phases: analysis.ridePlan.phases.length,
  },
  daylight: {
    sunrise: analysis.daylight.sunrise,
    sunset: analysis.daylight.sunset,
  },
}, null, 2));
