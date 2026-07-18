import assert from 'node:assert/strict';
import test from 'node:test';
import {
  appendRidePoint,
  assessRidePoint,
  calculateRideMetrics,
  estimateBattery,
} from '../src/lib/activities/geo.ts';
import {
  downsampleRoute,
  filterHeatmapActivities,
  summarizeHeatmap,
} from '../src/lib/activities/heatmap.ts';
import {
  activityOdometerKm,
  maintenanceHealth,
} from '../src/lib/maintenance/analytics.ts';
import {
  calculateGhostComparison,
  calculateSecuredNavigation,
  plannedRouteFromActivity,
} from '../src/lib/navigation/repeat.ts';
import { calculateNavigationProgress } from '../src/lib/navigation/progress.ts';
import {
  activityEditNotice,
  normalizeActivityTitle,
} from '../src/lib/activities/edit.ts';
import {
  notificationDestination,
  notificationMessage,
  notificationRelativeTime,
} from '../src/lib/social/notifications.ts';
import { normalizeGeocodingResults } from '../src/lib/geocoding.ts';
import {
  buildBatteryModel,
  predictBatteryForRoute,
} from '../src/lib/activities/battery.ts';
import { parseActivityGpx } from '../src/lib/activities/import-gpx.ts';
import {
  analyzeActivityTrack,
  calculateRideSplits,
  calculateTerrainSummary,
} from '../src/lib/activities/track-analysis.ts';
import {
  buildRouteRidePlan,
} from '../src/lib/route-ride-plan.ts';
import {
  sampleRoutePointAtFraction,
  sampleRoutePointsByDistance,
} from '../src/lib/route-sampling.ts';
import { calculateUpcomingTurn, formatTurnDistance } from '../src/lib/navigation/turns.ts';
import {
  buildOverpassTrailQuery,
  overpassWaysToGeoJson,
  sampleOfflineRoute,
} from '../src/lib/navigation/offline-map-data.ts';
import {
  deriveLiveRideConditions,
  minutesUntilClockTime,
  selectCurrentWeatherPhase,
} from '../src/lib/navigation/live-ride-conditions.ts';
import {
  normalizeBRouterResponse,
  routerProfileForMode,
} from '../src/lib/navigation/routing.ts';
import {
  matchCompetitiveSegments,
  personalSegmentBests,
} from '../src/lib/segments/matcher.ts';
import { normalizeAuthNextPath } from '../src/lib/auth/redirect.ts';
import {
  normalizeProviderAvailability,
} from '../src/lib/supabase/provider-status.ts';
import {
  oppositeTheme,
  resolveThemePreference,
} from '../src/lib/theme.ts';
import { aemetWindMpsToKmh } from '../src/lib/weather-units.ts';

function point({
  latitude = 40,
  longitude = -0.1,
  elevation = 100,
  accuracy = 5,
  speed = null,
  timestamp = 0,
} = {}) {
  return { latitude, longitude, elevation, accuracy, speed, timestamp };
}

test('rechaza deriva estacionaria e incorpora movimiento acumulado real', () => {
  const origin = point({ timestamp: 1_000, accuracy: 20 });
  const drift = point({ longitude: -0.09999, timestamp: 2_000, accuracy: 20 });
  const moved = point({ longitude: -0.0999, timestamp: 5_000, accuracy: 20 });

  assert.equal(assessRidePoint(origin, drift).reason, 'drift');
  const afterDrift = appendRidePoint([origin], drift);
  assert.equal(afterDrift.length, 1);
  assert.equal(appendRidePoint(afterDrift, moved).length, 2);
});

test('rechaza saltos GPS imposibles y puntos con precisión inutilizable', () => {
  const origin = point({ timestamp: 1_000 });
  const jump = point({ latitude: 41, timestamp: 2_000 });
  const weak = point({ longitude: -0.099, timestamp: 3_000, accuracy: 150 });

  assert.equal(assessRidePoint(origin, jump).reason, 'jump');
  assert.equal(assessRidePoint(origin, weak).reason, 'accuracy');
});

test('cuenta tiempo en movimiento aunque el sensor del teléfono informe velocidad cero', () => {
  const points = [
    point({ timestamp: 1_000, speed: 0 }),
    point({ longitude: -0.0999, timestamp: 3_000, speed: 0 }),
    point({ longitude: -0.0998, timestamp: 5_000, speed: 0 }),
  ];
  const metrics = calculateRideMetrics(points);

  assert.equal(metrics.movingSeconds, 4);
  assert.ok(metrics.distanceM > 15);
  assert.ok(metrics.averageSpeedKmh > 10);
});

test('no une con distancia ficticia una pausa GPS superior a dos minutos', () => {
  const points = [
    point({ timestamp: 1_000 }),
    point({ longitude: -0.0999, timestamp: 3_000 }),
    point({ longitude: -0.09, timestamp: 200_000 }),
  ];
  const metrics = calculateRideMetrics(points);

  assert.ok(metrics.distanceM > 5 && metrics.distanceM < 20);
  assert.equal(metrics.movingSeconds, 2);
});

test('la histéresis elimina serrucho de altitud y conserva una subida real', () => {
  const jitter = [100, 102, 99, 101, 100].map((elevation, index) => point({
    longitude: -0.1 + index * 0.0001,
    elevation,
    timestamp: 1_000 + index * 2_000,
  }));
  const climb = [100, 101, 103, 106, 105, 102].map((elevation, index) => point({
    longitude: -0.1 + index * 0.0001,
    elevation,
    timestamp: 1_000 + index * 2_000,
  }));

  assert.equal(calculateRideMetrics(jitter).elevationGainM, 0);
  assert.equal(calculateRideMetrics(climb).elevationGainM, 6);
});

test('la estimación e-bike respeta batería inicial, capacidad y asistencia', () => {
  const estimate = estimateBattery(10_000, 80, 700, 'trail');

  assert.equal(estimate.energyUsedWh, 110);
  assert.equal(estimate.batteryPercent, 64);
  assert.ok(estimate.remainingRangeKm > 40 && estimate.remainingRangeKm < 42);
});

function activity(id, startedAt, sportType, points) {
  return {
    id,
    title: id,
    sportType,
    startedAt,
    endedAt: startedAt,
    durationSeconds: 600,
    movingSeconds: 500,
    distanceM: 10_000,
    elevationGainM: 300,
    averageSpeedKmh: 20,
    maxSpeedKmh: 40,
    batteryStart: null,
    batteryEnd: null,
    batteryCapacityWh: null,
    assistMode: null,
    energyUsedWh: null,
    points,
    privacy: 'private',
    syncStatus: 'local',
  };
}

test('el mapa personal filtra por deporte y periodo sin perder recorridos válidos', () => {
  const now = Date.parse('2026-07-18T12:00:00Z');
  const route = [point(), point({ longitude: -0.09, timestamp: 1_000 })];
  const activities = [
    activity('recent-ebike', '2026-07-10T10:00:00Z', 'ebike', route),
    activity('old-ebike', '2025-01-01T10:00:00Z', 'ebike', route),
    activity('recent-mtb', '2026-07-11T10:00:00Z', 'mtb', route),
  ];

  assert.deepEqual(
    filterHeatmapActivities(activities, 'ebike', '30d', now).map((item) => item.id),
    ['recent-ebike'],
  );
  assert.equal(filterHeatmapActivities(activities, 'all', 'all', now).length, 3);
});

test('el mapa personal cuenta una zona una sola vez por actividad', () => {
  const sharedZone = [
    point({ latitude: 40.001, longitude: -0.101 }),
    point({ latitude: 40.002, longitude: -0.102, timestamp: 1_000 }),
  ];
  const activities = [
    activity('one', '2026-07-10T10:00:00Z', 'ebike', sharedZone),
    activity('two', '2026-07-11T10:00:00Z', 'mtb', sharedZone),
  ];
  const summary = summarizeHeatmap(activities);

  assert.equal(summary.rides, 2);
  assert.equal(summary.mostRepeatedRides, 2);
  assert.equal(summary.distanceM, 20_000);
});

test('el muestreo conserva inicio, final y límite de puntos', () => {
  const route = Array.from({ length: 1_001 }, (_, index) => point({
    longitude: -0.1 + index * 0.00001,
    timestamp: index * 1_000,
  }));
  const sampled = downsampleRoute(route, 100);

  assert.equal(sampled.length, 100);
  assert.equal(sampled[0], route[0]);
  assert.equal(sampled.at(-1), route.at(-1));
});

test('el odómetro ignora distancias negativas y suma las actividades reales', () => {
  assert.equal(activityOdometerKm([
    { distanceM: 12_500 },
    { distanceM: 7_500 },
    { distanceM: -1_000 },
  ]), 20);
});

test('el mantenimiento avisa al 80% y vence al superar el intervalo', () => {
  const item = {
    id: 'chain',
    name: 'Cadena',
    category: 'drivetrain',
    intervalKm: 500,
    lastServiceOdometerKm: 100,
    lastServiceAt: null,
    serviceCount: 0,
    updatedAt: '2026-07-18T10:00:00Z',
    syncStatus: 'local',
  };

  assert.equal(maintenanceHealth(item, 499).state, 'ok');
  assert.equal(maintenanceHealth(item, 500).state, 'soon');
  assert.equal(maintenanceHealth(item, 600).state, 'due');
  assert.equal(maintenanceHealth(item, 650).remainingKm, -50);
});

test('una actividad repetible conserva el tiempo activo y excluye una pausa larga', () => {
  const points = [
    point({ timestamp: 0 }),
    point({ longitude: -0.099, timestamp: 10_000 }),
    point({ longitude: -0.098, timestamp: 200_000 }),
    point({ longitude: -0.097, timestamp: 210_000 }),
  ];
  const source = activity('repeat-me', '2026-07-18T10:00:00Z', 'ebike', points);
  source.durationSeconds = 20;
  const route = plannedRouteFromActivity(source);

  assert.equal(route.reference.activityId, 'repeat-me');
  assert.deepEqual(
    route.points.map((item) => item.referenceElapsedSeconds),
    [0, 10, 10, 20],
  );
});

test('el ghost compara contra el tiempo del mismo punto y se pausa fuera de ruta', () => {
  const route = {
    id: 'repeat',
    name: 'Reto',
    trackIds: [],
    distanceKm: 1,
    elevationGainM: 0,
    estimatedTimeMin: 4,
    difficulty: 'reto personal',
    warnings: [],
    createdAt: '2026-07-18T10:00:00Z',
    reference: {
      activityId: 'source',
      title: 'Fuente',
      durationSeconds: 200,
      startedAt: '2026-07-17T10:00:00Z',
    },
    points: [
      { latitude: 40, longitude: -0.1, elevation: 100, referenceElapsedSeconds: 0 },
      { latitude: 40, longitude: -0.09, elevation: 100, referenceElapsedSeconds: 100 },
      { latitude: 40, longitude: -0.08, elevation: 100, referenceElapsedSeconds: 200 },
    ],
  };
  const progress = {
    nearestIndex: 1,
    offRouteM: 10,
    completedM: 500,
    remainingM: 500,
    remainingGainM: 0,
    progressPercent: 50,
  };

  const comparison = calculateGhostComparison(route, progress, 80);
  assert.equal(comparison.deltaSeconds, -20);
  assert.equal(comparison.projectedFinishSeconds, 160);
  assert.equal(calculateGhostComparison(route, { ...progress, offRouteM: 101 }, 80), null);
});

test('la navegación no retrocede a un tramo inicial después de completar un bucle', () => {
  const route = [
    { latitude: 40, longitude: -0.1, elevation: 100 },
    { latitude: 40, longitude: -0.09, elevation: 100 },
    { latitude: 40.0001, longitude: -0.1, elevation: 100 },
  ];
  const positionNearStart = point({ latitude: 40.00005, longitude: -0.1 });
  const unrestricted = calculateNavigationProgress(route, positionNearStart);
  const monotonic = calculateNavigationProgress(route, positionNearStart, Infinity, 800);

  assert.equal(unrestricted.nearestIndex, 0);
  assert.ok(monotonic.completedM >= 800);
});

test('el resumen conserva el 100% ya alcanzado aunque la posición instantánea retroceda', () => {
  const navigation = {
    nearestIndex: 8,
    offRouteM: 250,
    completedM: 930,
    remainingM: 70,
    remainingGainM: 0,
    progressPercent: 93,
  };
  const secured = calculateSecuredNavigation(navigation, 1_000, 1_000);

  assert.equal(secured.progressPercent, 100);
  assert.equal(secured.remainingM, 0);
});

test('la edición conserva un nombre válido si el nuevo está vacío', () => {
  assert.equal(normalizeActivityTitle('  Cresta del Maigmó  ', 'Salida'), 'Cresta del Maigmó');
  assert.equal(normalizeActivityTitle('   ', 'Salida'), 'Salida');
});

test('avisa con urgencia si retirar una actividad pública aún no se ha sincronizado', () => {
  const pending = activityEditNotice({
    previousPrivacy: 'public',
    nextPrivacy: 'private',
    result: 'local',
    hadRemoteId: true,
  });
  const synced = activityEditNotice({
    previousPrivacy: 'public',
    nextPrivacy: 'private',
    result: 'synced',
    hadRemoteId: true,
  });

  assert.equal(pending.urgent, true);
  assert.match(pending.message, /visibilidad anterior seguirá activa/);
  assert.equal(synced.urgent, false);
  assert.match(synced.message, /solo puedes verla tú/);
});

test('reducir una actividad pública a seguidores queda protegido hasta sincronizar', () => {
  const pending = activityEditNotice({
    previousPrivacy: 'public',
    nextPrivacy: 'followers',
    result: 'error',
    hadRemoteId: true,
  });
  const synced = activityEditNotice({
    previousPrivacy: 'public',
    nextPrivacy: 'followers',
    result: 'synced',
    hadRemoteId: true,
  });

  assert.equal(pending.urgent, true);
  assert.match(pending.message, /visibilidad anterior/);
  assert.equal(synced.urgent, false);
  assert.match(synced.message, /solo para tus seguidores/);
});

test('las notificaciones sociales enlazan al rider o a la actividad correcta', () => {
  assert.equal(
    notificationDestination('follow', 'rider-1', null),
    '/riders/rider-1',
  );
  assert.equal(
    notificationDestination('comment', 'rider-1', 'activity-1'),
    '/actividad/activity-1',
  );
  assert.match(notificationMessage('kudo', 'Bosque y barro'), /Bosque y barro/);
  assert.equal(
    notificationRelativeTime('2026-07-18T10:00:00.000Z', Date.parse('2026-07-18T11:00:00.000Z')),
    'Hace 1 h',
  );
});

test('el modelo de batería aprende el consumo del modo de asistencia elegido', () => {
  const trailOne = activity('trail-one', '2026-07-10T10:00:00Z', 'ebike', []);
  Object.assign(trailOne, {
    distanceM: 20_000,
    elevationGainM: 500,
    energyUsedWh: 200,
    batteryCapacityWh: 700,
    assistMode: 'trail',
  });
  const trailTwo = activity('trail-two', '2026-07-11T10:00:00Z', 'ebike', []);
  Object.assign(trailTwo, {
    distanceM: 30_000,
    elevationGainM: 900,
    energyUsedWh: 360,
    batteryCapacityWh: 700,
    assistMode: 'trail',
  });
  const turbo = activity('turbo', '2026-07-12T10:00:00Z', 'ebike', []);
  Object.assign(turbo, {
    distanceM: 10_000,
    elevationGainM: 200,
    energyUsedWh: 200,
    assistMode: 'turbo',
  });

  const model = buildBatteryModel([trailOne, trailTwo, turbo], 'trail');
  assert.equal(model.sampleCount, 2);
  assert.equal(model.source, 'personal-mode');
  assert.equal(model.averageWhPerKm, 11.2);
  assert.equal(model.conservativeWhPerKm, 12);
});

test('la predicción reserva batería y penaliza una ruta con más subida de la habitual', () => {
  const model = {
    assistMode: 'trail',
    averageWhPerKm: 10,
    conservativeWhPerKm: 10,
    historicalClimbMPerKm: 20,
    sampleCount: 4,
    distanceKm: 100,
    typicalCapacityWh: 700,
    confidence: 'medium',
    source: 'personal-mode',
  };
  const flat = predictBatteryForRoute({
    model,
    distanceKm: 40,
    elevationGainM: 800,
    batteryStart: 100,
    capacityWh: 700,
  });
  const steep = predictBatteryForRoute({
    model,
    distanceKm: 40,
    elevationGainM: 2_800,
    batteryStart: 100,
    capacityWh: 700,
  });

  assert.equal(flat.reservePercent, 15);
  assert.ok(flat.safeRangeKm > 50);
  assert.ok(steep.adjustedWhPerKm > flat.adjustedWhPerKm);
  assert.ok(steep.arrivalPercent < flat.arrivalPercent);
});

test('marca como insuficiente una ruta que consumiría la reserva de seguridad', () => {
  const model = buildBatteryModel([], 'turbo');
  const prediction = predictBatteryForRoute({
    model,
    distanceKm: 40,
    elevationGainM: 1_600,
    batteryStart: 60,
    capacityWh: 500,
  });

  assert.equal(prediction.state, 'insufficient');
  assert.ok(prediction.marginWh < 0);
});

test('importa una actividad GPX con tiempos, métricas y nombre', () => {
  const xml = `<?xml version="1.0"?>
    <gpx version="1.1">
      <metadata><name>Nombre secundario</name></metadata>
      <trk><name>Cresta &amp; Barranco</name><type>e-bike</type><trkseg>
        <trkpt lon="-0.1000" lat="40.0000"><ele>100</ele><time>2026-07-18T08:00:00Z</time></trkpt>
        <trkpt lat="40.0000" lon="-0.0990"><ele>110</ele><time>2026-07-18T08:00:30Z</time></trkpt>
        <trkpt lat="40.0000" lon="-0.0980"><ele>120</ele><time>2026-07-18T08:01:00Z</time></trkpt>
      </trkseg></trk>
    </gpx>`;
  const imported = parseActivityGpx(xml, 'fallback.gpx');

  assert.equal(imported.name, 'Cresta & Barranco');
  assert.equal(imported.sportHint, 'ebike');
  assert.equal(imported.durationSeconds, 60);
  assert.equal(imported.points.length, 3);
  assert.ok(imported.distanceM > 150);
  assert.equal(imported.elevationGainM, 20);
});

test('rechaza como actividad un GPX de ruta sin marcas de tiempo', () => {
  const xml = `<gpx><trk><trkseg>
    <trkpt lat="40" lon="-0.1"><ele>100</ele></trkpt>
    <trkpt lat="40" lon="-0.09"><ele>110</ele></trkpt>
  </trkseg></trk></gpx>`;

  assert.throws(
    () => parseActivityGpx(xml, 'ruta.gpx'),
    /fecha y hora/,
  );
});

const testSegment = {
  id: 'test-segment',
  name: 'Tramo verificado',
  routeName: 'Ruta de prueba',
  routeSlug: 'ruta-prueba',
  region: 'Morella',
  type: 'climb',
  distanceM: 170,
  elevationDeltaM: 20,
  averageGradePct: 11.8,
  checkpoints: [
    { latitude: 40, longitude: -0.1 },
    { latitude: 40, longitude: -0.099 },
    { latitude: 40, longitude: -0.098 },
  ],
};

test('reconoce un segmento solo al cruzar sus controles en orden y con velocidad plausible', () => {
  const forward = [
    point({ longitude: -0.1, timestamp: 1_000 }),
    point({ longitude: -0.099, timestamp: 31_000 }),
    point({ longitude: -0.098, timestamp: 61_000 }),
  ];
  const reverse = [...forward].reverse().map((item, index) => ({
    ...item,
    timestamp: 1_000 + index * 30_000,
  }));

  const efforts = matchCompetitiveSegments(forward, [testSegment]);
  assert.equal(efforts.length, 1);
  assert.equal(efforts[0].segmentId, 'test-segment');
  assert.equal(efforts[0].elapsedSeconds, 60);
  assert.ok(efforts[0].matchQuality > 0.9);
  assert.equal(matchCompetitiveSegments(reverse, [testSegment]).length, 0);
});

test('descarta un falso esfuerzo con tiempo y velocidad imposibles', () => {
  const points = [
    point({ longitude: -0.1, timestamp: 1_000 }),
    point({ longitude: -0.099, timestamp: 2_000 }),
    point({ longitude: -0.098, timestamp: 3_000 }),
  ];

  assert.equal(matchCompetitiveSegments(points, [testSegment]).length, 0);
});

test('conserva el mejor tiempo personal y cuenta todos los intentos', () => {
  const first = activity('first', '2026-07-10T10:00:00Z', 'ebike', []);
  first.segmentEfforts = [{
    segmentId: 'test-segment',
    elapsedSeconds: 80,
    startedAt: '2026-07-10T10:00:00Z',
    endedAt: '2026-07-10T10:01:20Z',
    distanceM: 170,
    averageSpeedKmh: 7.7,
    matchQuality: 1,
  }];
  const second = activity('second', '2026-07-11T10:00:00Z', 'ebike', []);
  second.segmentEfforts = [{
    ...first.segmentEfforts[0],
    elapsedSeconds: 60,
    startedAt: '2026-07-11T10:00:00Z',
    endedAt: '2026-07-11T10:01:00Z',
    averageSpeedKmh: 10.2,
  }];
  const muscular = activity('muscular', '2026-07-12T10:00:00Z', 'mtb', []);
  muscular.segmentEfforts = [{
    ...first.segmentEfforts[0],
    elapsedSeconds: 70,
    startedAt: '2026-07-12T10:00:00Z',
    endedAt: '2026-07-12T10:01:10Z',
  }];

  const bests = personalSegmentBests([first, second, muscular]);
  const ebikeBest = bests.find((best) => best.sportType === 'ebike');
  const mtbBest = bests.find((best) => best.sportType === 'mtb');
  assert.equal(ebikeBest.activity.id, 'second');
  assert.equal(ebikeBest.effort.elapsedSeconds, 60);
  assert.equal(ebikeBest.attempts, 2);
  assert.equal(mtbBest.activity.id, 'muscular');
});

test('no une como distancia una pausa larga de un GPX importado', () => {
  const xml = `<gpx><trk><trkseg>
    <trkpt lat="40" lon="-0.1"><time>2026-07-18T08:00:00Z</time></trkpt>
    <trkpt lat="40" lon="-0.099"><time>2026-07-18T08:00:30Z</time></trkpt>
    <trkpt lat="40" lon="-0.08"><time>2026-07-18T09:00:00Z</time></trkpt>
  </trkseg></trk></gpx>`;
  const imported = parseActivityGpx(xml, 'pausa.gpx');

  assert.ok(imported.distanceM > 50 && imported.distanceM < 100);
  assert.equal(imported.movingSeconds, 30);
});

test('los parciales kilométricos conservan la distancia y marcan el último incompleto', () => {
  const points = Array.from({ length: 19 }, (_, index) => point({
    latitude: 40,
    longitude: -0.1 + index * 0.001,
    elevation: 100 + index * 2,
    timestamp: index * 30_000,
  }));
  const splits = calculateRideSplits(points);

  assert.equal(splits.length, 2);
  assert.equal(splits[0].complete, true);
  assert.equal(splits[1].complete, false);
  assert.ok(splits[0].distanceM > 999 && splits[0].distanceM <= 1_001);
  assert.ok(splits[1].distanceM > 300);
});

test('los parciales no crean kilómetros al otro lado de una pausa GPS larga', () => {
  const points = [
    point({ longitude: -0.1, timestamp: 0 }),
    point({ longitude: -0.099, timestamp: 30_000 }),
    point({ longitude: -0.08, timestamp: 3_600_000 }),
  ];
  const splits = calculateRideSplits(points);

  assert.equal(splits.length, 0);
});

test('el resumen distingue subida y bajada y calcula pendiente sostenida', () => {
  const points = Array.from({ length: 13 }, (_, index) => point({
    latitude: 40,
    longitude: -0.1 + index * 0.001,
    elevation: index <= 6 ? 100 + index * 5 : 130 - (index - 6) * 5,
    timestamp: index * 30_000,
  }));
  const terrain = calculateTerrainSummary(points);
  const analysis = analyzeActivityTrack(points);

  assert.ok(terrain.climbingDistanceM > 400);
  assert.ok(terrain.descendingDistanceM > 400);
  assert.ok((terrain.steepestClimbPercent ?? 0) > 4);
  assert.ok((terrain.steepestDescentPercent ?? 0) < -4);
  assert.equal(analysis.fastestFullSplitIndex, 1);
});

test('la meteo de ruta interpola estaciones y corrige temperatura por altitud', () => {
  const weather = {
    stationCode: 'A',
    stationName: 'Valle',
    stationDistanceKm: 5,
    riskLevel: 'green',
    routeNowLabel: 'Favorable',
    routeNowMessage: 'Estable',
    temperatureC: 20,
    humidityPct: 60,
    windKmh: 12,
    nearbyStations: [
      {
        stationCode: 'A',
        stationName: 'Valle',
        distanceKm: 5,
        altitudeM: 200,
        latitude: 40,
        longitude: -0.1,
        temperatureC: 20,
        humidityPct: 60,
        windKmh: 12,
        maxWindKmh: 18,
        windDirectionDeg: 270,
        precipitationMm: 0,
        dataAgeMin: 20,
      },
      {
        stationCode: 'B',
        stationName: 'Sierra',
        distanceKm: 8,
        altitudeM: 800,
        latitude: 40,
        longitude: -0.05,
        temperatureC: 15,
        humidityPct: 70,
        windKmh: 18,
        maxWindKmh: 25,
        windDirectionDeg: 270,
        precipitationMm: 0,
        dataAgeMin: 35,
      },
    ],
  };
  const plan = buildRouteRidePlan({
    points: [
      { lat: 40, lng: -0.1, elevation: 200 },
      { lat: 40, lng: -0.075, elevation: 600 },
      { lat: 40, lng: -0.05, elevation: 1_000 },
    ],
    distanceKm: 12,
    weather,
    phaseCount: 3,
  });

  assert.equal(plan.phases.length, 3);
  assert.equal(plan.stationCount, 2);
  assert.equal(plan.overallConfidence, 'high');
  assert.ok((plan.phases.at(-1)?.temperatureC ?? 99) < plan.phases[0].temperatureC);
});

test('la meteo de tramo expresa viento de cara y baja confianza si la estación está lejos', () => {
  const weather = {
    stationCode: 'A',
    stationName: 'Lejana',
    stationDistanceKm: 40,
    riskLevel: 'yellow',
    routeNowLabel: 'Precaución',
    routeNowMessage: 'Viento',
    nearbyStations: [{
      stationCode: 'A',
      stationName: 'Lejana',
      distanceKm: 40,
      altitudeM: 200,
      latitude: 40.3,
      longitude: -0.1,
      temperatureC: 20,
      humidityPct: 65,
      windKmh: 25,
      maxWindKmh: 35,
      windDirectionDeg: 0,
      precipitationMm: 0,
      dataAgeMin: 200,
    }],
  };
  const plan = buildRouteRidePlan({
    points: [
      { lat: 40, lng: -0.1, elevation: 200 },
      { lat: 40.1, lng: -0.1, elevation: 300 },
    ],
    distanceKm: 10,
    weather,
    phaseCount: 3,
  });

  assert.equal(plan.overallConfidence, 'low');
  assert.equal(plan.phases[0].windEffect, 'headwind');
  assert.match(plan.phases[0].feelLabel, /avance penalizado/);
});

test('la dirección de viento se interpola como un ángulo circular', () => {
  const baseStation = {
    distanceKm: 4,
    altitudeM: 200,
    latitude: 40,
    temperatureC: 20,
    humidityPct: 60,
    windKmh: 20,
    maxWindKmh: 25,
    precipitationMm: 0,
    dataAgeMin: 20,
  };
  const plan = buildRouteRidePlan({
    points: [
      { lat: 40, lng: -0.1, elevation: 200 },
      { lat: 40.1, lng: -0.1, elevation: 250 },
    ],
    distanceKm: 10,
    phaseCount: 3,
    weather: {
      stationCode: 'A',
      stationName: 'Norte',
      stationDistanceKm: 4,
      riskLevel: 'green',
      routeNowLabel: 'Favorable',
      routeNowMessage: 'Estable',
      nearbyStations: [
        { ...baseStation, stationCode: 'A', stationName: 'Noroeste', longitude: -0.101, windDirectionDeg: 350 },
        { ...baseStation, stationCode: 'B', stationName: 'Noreste', longitude: -0.099, windDirectionDeg: 10 },
      ],
    },
  });

  assert.equal(plan.phases[0].windEffect, 'headwind');
});

test('una observación antigua pesa menos en la triangulación meteorológica', () => {
  const common = {
    distanceKm: 5,
    altitudeM: 200,
    latitude: 40,
    humidityPct: 60,
    windKmh: 10,
    maxWindKmh: 15,
    windDirectionDeg: 0,
    precipitationMm: 0,
  };
  const plan = buildRouteRidePlan({
    points: [{ lat: 40, lng: -0.1, elevation: 200 }, { lat: 40.01, lng: -0.1, elevation: 200 }],
    distanceKm: 2,
    phaseCount: 3,
    weather: {
      stationCode: 'fresh',
      stationName: 'Reciente',
      stationDistanceKm: 5,
      riskLevel: 'green',
      routeNowLabel: 'Favorable',
      routeNowMessage: 'Estable',
      nearbyStations: [
        { ...common, stationCode: 'fresh', stationName: 'Reciente', longitude: -0.101, temperatureC: 20, dataAgeMin: 10 },
        { ...common, stationCode: 'stale', stationName: 'Antigua', longitude: -0.099, temperatureC: 40, dataAgeMin: 600 },
      ],
    },
  });

  assert.ok((plan.phases[0].temperatureC ?? 99) < 27);
});

test('convierte el viento observado por AEMET de m/s a km/h antes de mostrarlo', () => {
  assert.equal(aemetWindMpsToKmh(0), 0);
  assert.equal(aemetWindMpsToKmh(10), 36);
  assert.equal(aemetWindMpsToKmh(12.34), 44.4);
  assert.equal(aemetWindMpsToKmh(undefined), undefined);
});

test('la meteo por tramos sigue la distancia real aunque el GPX tenga densidad irregular', () => {
  const points = [
    { lat: 40, lng: -0.1, elevation: 100 },
    { lat: 40, lng: -0.0999, elevation: 101 },
    { lat: 40, lng: -0.0998, elevation: 102 },
    { lat: 40, lng: 0, elevation: 200 },
  ];
  const halfway = sampleRoutePointAtFraction(points, 0.5);

  assert.ok(halfway);
  assert.ok(Math.abs(halfway.lng - -0.05) < 0.001);
  assert.ok(Math.abs((halfway.elevation ?? 0) - 150) < 2);
  const samples = sampleRoutePointsByDistance(points, 3);
  assert.ok(Math.abs(samples[1].lng - -0.05) < 0.001);
});

test('un modelo meteorológico de respaldo no se presenta con confianza alta', () => {
  const plan = buildRouteRidePlan({
    points: [{ lat: 40, lng: -0.1 }, { lat: 40.05, lng: -0.1 }],
    distanceKm: 5.6,
    phaseCount: 3,
    weather: {
      source: 'open-meteo-model',
      sourceLabel: 'Modelo Open-Meteo',
      stationCode: 'model-1',
      stationName: 'Modelo',
      stationDistanceKm: 0,
      riskLevel: 'green',
      routeNowLabel: 'Favorable',
      routeNowMessage: 'Estable',
      nearbyStations: [
        {
          stationCode: 'model-1',
          stationName: 'Modelo inicio',
          distanceKm: 0,
          latitude: 40,
          longitude: -0.1,
          temperatureC: 20,
          humidityPct: 60,
          windKmh: 10,
          maxWindKmh: 15,
          windDirectionDeg: 0,
          precipitationMm: 0,
          dataAgeMin: 5,
        },
        {
          stationCode: 'model-2',
          stationName: 'Modelo final',
          distanceKm: 0,
          latitude: 40.05,
          longitude: -0.1,
          temperatureC: 19,
          humidityPct: 62,
          windKmh: 12,
          maxWindKmh: 18,
          windDirectionDeg: 0,
          precipitationMm: 0,
          dataAgeMin: 5,
        },
      ],
    },
  });

  assert.equal(plan.overallConfidence, 'medium');
  assert.ok(plan.phases.every((phase) => phase.confidence === 'medium'));
  assert.equal(plan.sourceLabel, 'Modelo Open-Meteo');
});

test('la navegación guiada detecta un giro a la derecha y su distancia', () => {
  const route = [
    { latitude: 40, longitude: -0.1, elevation: 100 },
    { latitude: 40.0005, longitude: -0.1, elevation: 100 },
    { latitude: 40.001, longitude: -0.1, elevation: 100 },
    { latitude: 40.001, longitude: -0.0995, elevation: 100 },
    { latitude: 40.001, longitude: -0.099, elevation: 100 },
  ];
  const instruction = calculateUpcomingTurn(route, {
    nearestIndex: 0,
    offRouteM: 3,
    completedM: 0,
    remainingM: 200,
    remainingGainM: 0,
    progressPercent: 0,
  });

  assert.equal(instruction?.direction, 'right');
  assert.match(instruction?.label ?? '', /derecha/);
  assert.ok((instruction?.distanceM ?? 0) > 90);
  assert.equal(formatTurnDistance(1_250), '1.3 km');
});

test('la navegación guiada marca llegada al final del track', () => {
  const route = [
    { latitude: 40, longitude: -0.1, elevation: null },
    { latitude: 40.001, longitude: -0.1, elevation: null },
  ];
  const instruction = calculateUpcomingTurn(route, {
    nearestIndex: 1,
    offRouteM: 2,
    completedM: 100,
    remainingM: 25,
    remainingGainM: 0,
    progressPercent: 95,
  });

  assert.equal(instruction?.direction, 'arrive');
});

test('el paquete offline muestrea una ruta larga sin perder inicio ni final', () => {
  const route = Array.from({ length: 100 }, (_, index) => ({
    latitude: 40 + index * 0.001,
    longitude: -0.1 + index * 0.001,
    elevation: null,
  }));
  const samples = sampleOfflineRoute(route, 12);

  assert.equal(samples.length, 12);
  assert.deepEqual(samples[0], route[0]);
  assert.deepEqual(samples.at(-1), route.at(-1));
});

test('la consulta offline limita muestras y crea corredores acotados alrededor de la ruta', () => {
  const route = Array.from({ length: 30 }, (_, index) => ({
    latitude: 40 + index * 0.001,
    longitude: -0.1,
    elevation: null,
  }));
  const query = buildOverpassTrailQuery(route, 9_000);

  assert.match(query, /way\["highway"\]/);
  assert.equal(query.match(/way\["highway"\]/g)?.length, 12);
  assert.match(query, /39\.982034/);
  assert.match(query, /out tags geom/);
});

test('la respuesta Overpass se convierte en caminos GeoJSON útiles offline', () => {
  const collection = overpassWaysToGeoJson([
    {
      type: 'way',
      id: 42,
      tags: {
        highway: 'path',
        name: 'Senda del bosque',
        surface: 'ground',
        'mtb:scale': '2',
        access: 'yes',
      },
      geometry: [{ lat: 40, lon: -0.1 }, { lat: 40.001, lon: -0.099 }],
    },
    { type: 'node', id: 7, lat: 40, lon: -0.1 },
  ]);

  assert.equal(collection.features.length, 1);
  assert.equal(collection.features[0].properties.mtbScale, '2');
  assert.equal(collection.features[0].properties.name, 'Senda del bosque');
  assert.deepEqual(collection.features[0].geometry.coordinates[0], [-0.1, 40]);
});

test('la meteo en marcha selecciona el tramo que el ciclista está recorriendo', () => {
  const phases = [
    { id: 'W1', fromKm: 0, toKm: 5, centerKm: 2.5 },
    { id: 'W2', fromKm: 5, toKm: 10, centerKm: 7.5 },
  ];
  assert.equal(selectCurrentWeatherPhase(phases, 6.2)?.id, 'W2');
  assert.equal(selectCurrentWeatherPhase(phases, 20)?.id, 'W2');
});

test('el margen de luz usa el ritmo real y avisa si no alcanza para terminar', () => {
  const result = deriveLiveRideConditions({
    phases: [{
      id: 'W1',
      fromKm: 0,
      toKm: 20,
      centerKm: 10,
      routeBearingDeg: 0,
      temperatureC: 22,
      humidityPct: 50,
      windKmh: 8,
      maxWindKmh: 12,
      precipitationMm: 0,
      windEffect: 'calm',
      confidence: 'high',
      nearestStationKm: 5,
      stationCount: 3,
      feelLabel: 'sensación neutra',
      riskLevel: 'green',
    }],
    daylight: { sunset: '19:00' },
    completedM: 5_000,
    remainingM: 10_000,
    averageSpeedKmh: 10,
    movingSeconds: 1_800,
    sportType: 'mtb',
    now: new Date(2026, 0, 1, 18, 20),
  });
  assert.equal(Math.round(result.estimatedRemainingMinutes), 60);
  assert.equal(result.minutesUntilSunset, 40);
  assert.equal(Math.round(result.lightMarginMinutes), -20);
  assert.equal(result.lightRisk, 'red');
  assert.match(result.recommendation, /luz crítico/i);
});

test('la hora de ocaso se calcula con la hora local del dispositivo', () => {
  assert.equal(minutesUntilClockTime(new Date(2026, 0, 1, 18, 10), '19:25'), 75);
  assert.equal(minutesUntilClockTime(new Date(2026, 0, 1, 20, 10), '19:25'), -45);
});

test('normaliza resultados geográficos y descarta coordenadas inválidas o duplicadas', () => {
  const results = normalizeGeocodingResults([
    {
      place_id: 1,
      display_name: 'Morella, Castelló, España',
      lat: '40.6199',
      lon: '-0.0989',
      addresstype: 'town',
      boundingbox: ['40.60', '40.64', '-0.12', '-0.08'],
    },
    {
      place_id: 2,
      display_name: 'Duplicado',
      lat: '40.6199001',
      lon: '-0.0989001',
    },
    { place_id: 3, display_name: 'Coordenada imposible', lat: '140', lon: '0' },
    { place_id: 4, display_name: '', lat: '40', lon: '-1' },
  ]);

  assert.deepEqual(results, [{
    id: '1',
    name: 'Morella, Castelló, España',
    latitude: 40.6199,
    longitude: -0.0989,
    type: 'town',
    boundingBox: [-0.12, 40.6, -0.08, 40.64],
  }]);
});

test('normaliza una ruta BRouter conservando geometría, altitud y métricas', () => {
  const route = normalizeBRouterResponse({
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      properties: {
        'track-length': '2706',
        'filtered ascend': '42',
        'total-time': '584',
      },
      geometry: {
        type: 'LineString',
        coordinates: [
          [-0.0998, 40.6188, 965],
          [-0.098, 40.62, 970],
          [-0.088, 40.625, 915],
        ],
      },
    }],
  }, 'mtb');

  assert.equal(route?.points.length, 3);
  assert.equal(route?.points[0].elevation, 965);
  assert.equal(route?.distanceM, 2706);
  assert.equal(route?.elevationGainM, 42);
  assert.equal(route?.estimatedSeconds, 584);
  assert.equal(route?.profile, 'mtb');
});

test('asigna perfiles de caminos distintos a MTB, e-bike y trazado manual', () => {
  assert.equal(routerProfileForMode('mtb'), 'mtb');
  assert.equal(routerProfileForMode('ebike'), 'trekking');
  assert.equal(routerProfileForMode('manual'), null);
});

test('acota una geometría de enrutado enorme sin perder inicio ni final', () => {
  const coordinates = Array.from({ length: 5_501 }, (_, index) => [
    -0.1 + index * 0.000001,
    40 + index * 0.000001,
    900 + index * 0.01,
  ]);
  const route = normalizeBRouterResponse({
    features: [{
      geometry: { type: 'LineString', coordinates },
      properties: {},
    }],
  }, 'trekking');

  assert.equal(route?.points.length, 5_000);
  assert.deepEqual(route?.points[0], {
    longitude: coordinates[0][0],
    latitude: coordinates[0][1],
    elevation: coordinates[0][2],
  });
  assert.deepEqual(route?.points.at(-1), {
    longitude: coordinates.at(-1)[0],
    latitude: coordinates.at(-1)[1],
    elevation: coordinates.at(-1)[2],
  });
});

test('el tema sigue el sistema hasta que el ciclista elige día o noche', () => {
  assert.equal(resolveThemePreference(null, true), 'dark');
  assert.equal(resolveThemePreference('system', false), 'light');
  assert.equal(resolveThemePreference('light', true), 'light');
  assert.equal(resolveThemePreference('dark', false), 'dark');
  assert.equal(oppositeTheme('dark'), 'light');
  assert.equal(oppositeTheme('light'), 'dark');
});

test('el callback de acceso solo acepta destinos internos seguros', () => {
  assert.equal(normalizeAuthNextPath('/planifica?ruta=abc'), '/planifica?ruta=abc');
  assert.equal(normalizeAuthNextPath('https://evil.example'), '/account');
  assert.equal(normalizeAuthNextPath('//evil.example/path'), '/account');
  assert.equal(normalizeAuthNextPath(null), '/account');
});

test('la pantalla de acceso refleja los proveedores realmente activados', () => {
  assert.deepEqual(normalizeProviderAvailability({
    external: { email: true, google: false, apple: true },
  }), {
    email: true,
    google: false,
    apple: true,
  });
  assert.deepEqual(normalizeProviderAvailability(null), {
    email: false,
    google: false,
    apple: false,
  });
});
