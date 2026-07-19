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
import {
  calculateNavigationProgress,
  cardinalForBearing,
} from '../src/lib/navigation/progress.ts';
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
  calculateLiveRideSplitState,
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
import {
  calculateUpcomingTurn,
  formatTurnDistance,
  turnAlertMessage,
  turnAlertStage,
} from '../src/lib/navigation/turns.ts';
import { normalizeRideDisplayMode } from '../src/lib/activities/display-mode.ts';
import {
  displayedRideSpeedKmh,
  gpsAssessmentKeepsSignalAlive,
  GPS_RESUME_RESTART_MS,
  GPS_STALE_RESTART_MS,
  shouldRestartGpsWatch,
} from '../src/lib/activities/gps-watchdog.ts';
import {
  REJOIN_MAX_AGE_MS,
  REJOIN_RETRY_MAX_MS,
  rejoinRetryDelayMs,
  shouldRequestRejoinRoute,
} from '../src/lib/navigation/rejoin-routing.ts';
import {
  FALLBACK_MAP_STYLES,
  OPEN_MAP_STYLES,
} from '../src/lib/open-map-styles.ts';
import {
  buildOverpassTrailQuery,
  buildOverpassTrailOnlyQuery,
  overpassWaysToGeoJson,
  summarizeOfflineMap,
  sampleOfflineRoute,
} from '../src/lib/navigation/offline-map-data.ts';
import {
  OFFLINE_MAP_VERSION,
  offlineMapMatchesRoute,
  offlineRouteFingerprint,
} from '../src/lib/navigation/offline-map-version.ts';
import {
  buildLiveConditionAlert,
  deriveLiveRideConditions,
  effectiveWeatherAgeMinutes,
  findUpcomingWeatherHazard,
  minutesUntilClockTime,
  selectCurrentWeatherPhase,
  shouldRefreshLiveWeather,
} from '../src/lib/navigation/live-ride-conditions.ts';
import {
  normalizeBRouterResponse,
  routerProfileForMode,
} from '../src/lib/navigation/routing.ts';
import { sugerirSiguientesTracks } from '../src/lib/forfait/geo-utils.ts';
import {
  matchCompetitiveSegments,
  personalSegmentBests,
} from '../src/lib/segments/matcher.ts';
import {
  buildAuthCallbackUrl,
  getPostAuthDestination,
  normalizeAuthProvider,
  normalizeAuthExchangeError,
  normalizeAuthNextPath,
  resolveAuthSiteOrigin,
} from '../src/lib/auth/redirect.ts';
import {
  normalizeProviderAvailability,
} from '../src/lib/supabase/provider-status.ts';
import {
  oppositeTheme,
  resolveThemePreference,
} from '../src/lib/theme.ts';
import { aemetWindMpsToKmh } from '../src/lib/weather-units.ts';
import {
  compactActivityForLocalStorage,
  compactRideDraftForLocalStorage,
  mergeActivityVersions,
  mergeRideDraftVersions,
} from '../src/lib/activities/durable-storage.ts';
import { completeRidePointsForSave } from '../src/lib/activities/finalize.ts';
import { plannedRouteFromSavedRoute } from '../src/lib/navigation/cloud-route.ts';
import {
  externalGpxFileName,
  isPublicNetworkAddress,
  looksLikeGpx,
  validateExternalGpxUrl,
} from '../src/lib/navigation/external-gpx.ts';

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

test('la importación por enlace solo admite destinos HTTPS públicos', () => {
  assert.equal(validateExternalGpxUrl('https://example.com/routes/day.gpx').hostname, 'example.com');
  assert.throws(() => validateExternalGpxUrl('http://example.com/route.gpx'), /https/);
  assert.throws(() => validateExternalGpxUrl('https://localhost/route.gpx'), /público/);
  assert.throws(() => validateExternalGpxUrl('https://127.0.0.1/route.gpx'), /público/);
  assert.throws(() => validateExternalGpxUrl('https://10.0.0.4/route.gpx'), /público/);
  assert.throws(() => validateExternalGpxUrl('https://[::1]/route.gpx'), /público/);
  assert.throws(() => validateExternalGpxUrl('https://user:secret@example.com/route.gpx'), /credenciales/);
});

test('clasifica direcciones públicas y privadas para impedir SSRF', () => {
  assert.equal(isPublicNetworkAddress('1.1.1.1'), true);
  assert.equal(isPublicNetworkAddress('8.8.8.8'), true);
  assert.equal(isPublicNetworkAddress('192.168.1.8'), false);
  assert.equal(isPublicNetworkAddress('169.254.169.254'), false);
  assert.equal(isPublicNetworkAddress('fc00::1'), false);
  assert.equal(isPublicNetworkAddress('2001:4860:4860::8888'), true);
});

test('reconoce contenido GPX y genera un nombre de archivo seguro', () => {
  const xml = '<?xml version="1.0"?><gpx version="1.1"><trk><trkseg><trkpt lat="40" lon="-0.1"/></trkseg></trk></gpx>';
  assert.equal(looksLikeGpx(xml), true);
  assert.equal(looksLikeGpx('<html><body>Login</body></html>'), false);
  assert.equal(
    externalGpxFileName(
      new URL('https://example.com/download/123'),
      'attachment; filename="Ruta Els Ports.gpx"',
    ),
    'Ruta Els Ports.gpx',
  );
  assert.equal(
    externalGpxFileName(new URL('https://example.com/files/track'), null),
    'track.gpx',
  );
});

test('rechaza deriva estacionaria e incorpora movimiento acumulado real', () => {
  const origin = point({ timestamp: 1_000, accuracy: 20 });
  const drift = point({ longitude: -0.09999, timestamp: 2_000, accuracy: 20 });
  const moved = point({ longitude: -0.0999, timestamp: 5_000, accuracy: 20 });

  assert.equal(assessRidePoint(origin, drift).reason, 'drift');
  const afterDrift = appendRidePoint([origin], drift);
  assert.equal(afterDrift.length, 1);
  assert.equal(appendRidePoint(afterDrift, moved).length, 2);
});

test('el guardado incorpora una última posición GPS aceptada sin duplicarla', () => {
  const first = point({ timestamp: 1_000 });
  const final = point({ longitude: -0.0998, timestamp: 5_000 });

  assert.deepEqual(completeRidePointsForSave([first], final), [first, final]);
  assert.deepEqual(completeRidePointsForSave([first, final], final), [first, final]);
  assert.deepEqual(completeRidePointsForSave([first, final], first), [first, final]);
});

test('una ruta privada conserva modo y controles al viajar entre dispositivos', () => {
  const controls = [
    { latitude: 40.6, longitude: -0.1, elevation: 900 },
    { latitude: 40.61, longitude: -0.09, elevation: 960 },
  ];
  const route = plannedRouteFromSavedRoute({
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Ruta e-bike editable',
    track_ids: [],
    distance_km: 4.2,
    elevation_gain_m: 120,
    elevation_loss_m: 90,
    estimated_time_min: 24,
    difficulty: 'azul',
    route_points: controls,
    control_points: controls,
    routing_mode: 'ebike',
    reference: null,
    warnings: [],
    created_at: '2026-07-19T00:00:00.000Z',
    updated_at: '2026-07-19T00:00:00.000Z',
  });

  assert.equal(route.routingMode, 'ebike');
  assert.deepEqual(route.controlPoints, controls);
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

test('el índice local reduce un track largo sin perder inicio ni final', () => {
  const points = Array.from({ length: 10_000 }, (_, index) => point({
    longitude: -0.1 + index * 0.000001,
    timestamp: index * 1_000,
  }));
  const original = activity('long-ride', '2026-07-18T10:00:00Z', 'ebike', points);
  const compact = compactActivityForLocalStorage(original, 600);

  assert.equal(compact.points.length, 600);
  assert.deepEqual(compact.points[0], points[0]);
  assert.deepEqual(compact.points.at(-1), points.at(-1));
  assert.equal(compact.distanceM, original.distanceM);
});

test('el diario de emergencia limita una salida larga y conserva el tramo reciente', () => {
  const points = Array.from({ length: 10_000 }, (_, index) => point({
    longitude: -0.1 + index * 0.000001,
    timestamp: index * 1_000,
  }));
  const draft = {
    id: 'long-draft',
    startedAt: 0,
    updatedAt: 10_000_000,
    durationSeconds: 10_000,
    points,
    settings: {
      sportType: 'ebike',
      batteryStart: 100,
      batteryCapacityWh: 700,
      assistMode: 'trail',
    },
    isDemo: false,
  };
  const compact = compactRideDraftForLocalStorage(draft, 2_000);

  assert.equal(compact.points.length, 2_000);
  assert.deepEqual(compact.points[0], points[0]);
  assert.deepEqual(compact.points.at(-1), points.at(-1));
  assert.deepEqual(compact.points.slice(-500), points.slice(-500));
  assert.equal(compact.durationSeconds, draft.durationSeconds);
});

test('la recuperación une el track duradero completo con la cola local más reciente', () => {
  const fullPoints = Array.from({ length: 10_200 }, (_, index) => point({
    longitude: -0.1 + index * 0.000001,
    timestamp: index * 1_000,
  }));
  const baseDraft = {
    id: 'recover-long-draft',
    startedAt: 0,
    updatedAt: 10_000_000,
    durationSeconds: 10_000,
    points: fullPoints.slice(0, 10_000),
    settings: {
      sportType: 'ebike',
      batteryStart: 100,
      batteryCapacityWh: 700,
      assistMode: 'trail',
    },
    isDemo: false,
  };
  const localDraft = compactRideDraftForLocalStorage({
    ...baseDraft,
    updatedAt: 10_200_000,
    durationSeconds: 10_200,
    points: fullPoints,
  });
  const recovered = mergeRideDraftVersions(baseDraft, localDraft);

  assert.equal(recovered?.points.length, 10_200);
  assert.deepEqual(recovered?.points, fullPoints);
  assert.equal(recovered?.durationSeconds, 10_200);
});

test('una actualización de estado nunca sustituye el track completo por el índice reducido', () => {
  const full = activity(
    'protected-track',
    '2026-07-18T10:00:00Z',
    'ebike',
    Array.from({ length: 2_000 }, (_, index) => point({ timestamp: index * 1_000 })),
  );
  const statusUpdate = {
    ...compactActivityForLocalStorage(full, 100),
    syncStatus: 'synced',
    remoteId: 'remote-1',
  };
  const merged = mergeActivityVersions(full, statusUpdate);

  assert.equal(merged.points.length, 2_000);
  assert.equal(merged.syncStatus, 'synced');
  assert.equal(merged.remoteId, 'remote-1');
});

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

test('la navegación proyecta la posición sobre un tramo aunque el GPX tenga pocos puntos', () => {
  const route = [
    { latitude: 40, longitude: -0.1, elevation: 100 },
    { latitude: 40, longitude: -0.08, elevation: 200 },
  ];
  const halfway = point({ latitude: 40, longitude: -0.09, accuracy: 5 });
  const navigation = calculateNavigationProgress(route, halfway);

  assert.ok(navigation);
  assert.ok(navigation.offRouteM < 1);
  assert.ok(navigation.progressPercent > 49 && navigation.progressPercent < 51);
  assert.ok(navigation.remainingGainM > 49 && navigation.remainingGainM < 51);
});

test('la navegación respeta los límites de avance dentro de un mismo tramo', () => {
  const route = [
    { latitude: 40, longitude: -0.1, elevation: 100 },
    { latitude: 40, longitude: -0.08, elevation: 100 },
  ];
  const nearFinish = point({ latitude: 40, longitude: -0.081, accuracy: 4 });
  const navigation = calculateNavigationProgress(route, nearFinish, 500);

  assert.ok(navigation);
  assert.ok(navigation.completedM <= 500.01);
  assert.ok(navigation.offRouteM > 900);
});

test('la navegación fuera de ruta calcula un punto y rumbo de reenganche offline', () => {
  const route = [
    { latitude: 40, longitude: -0.1, elevation: 100 },
    { latitude: 40, longitude: -0.08, elevation: 100 },
  ];
  const northOfTrack = point({ latitude: 40.001, longitude: -0.09, accuracy: 5 });
  const navigation = calculateNavigationProgress(route, northOfTrack);

  assert.ok(navigation);
  assert.ok(navigation.offRouteM > 100 && navigation.offRouteM < 120);
  assert.ok(Math.abs(navigation.rejoinLatitude - 40) < 0.000001);
  assert.ok(Math.abs(navigation.rejoinLongitude + 0.09) < 0.000001);
  assert.ok(navigation.bearingToRejoinDeg > 175 && navigation.bearingToRejoinDeg < 185);
  assert.equal(cardinalForBearing(navigation.bearingToRejoinDeg), 'S');
});

test('el reenganche online no recalcula por cada punto GPS pequeño', () => {
  const previous = {
    originLatitude: 40,
    originLongitude: -0.1,
    targetLatitude: 40,
    targetLongitude: -0.09,
    requestedAt: 1_000,
  };

  assert.equal(shouldRequestRejoinRoute({
    previous,
    originLatitude: 40.0001,
    originLongitude: -0.1,
    targetLatitude: 40,
    targetLongitude: -0.0899,
    now: 10_000,
  }), false);
  assert.equal(shouldRequestRejoinRoute({
    previous,
    originLatitude: 40.001,
    originLongitude: -0.1,
    targetLatitude: 40,
    targetLongitude: -0.09,
    now: 10_000,
  }), true);
});

test('el reenganche online se renueva por cambio de objetivo o antigüedad', () => {
  const previous = {
    originLatitude: 40,
    originLongitude: -0.1,
    targetLatitude: 40,
    targetLongitude: -0.09,
    requestedAt: 1_000,
  };

  assert.equal(shouldRequestRejoinRoute({
    previous,
    originLatitude: 40,
    originLongitude: -0.1,
    targetLatitude: 40,
    targetLongitude: -0.089,
    now: 10_000,
  }), true);
  assert.equal(shouldRequestRejoinRoute({
    previous,
    originLatitude: 40,
    originLongitude: -0.1,
    targetLatitude: 40,
    targetLongitude: -0.09,
    now: 1_000 + REJOIN_MAX_AGE_MS,
  }), true);
});

test('el reenganche aplica espera progresiva y respeta el límite del servidor', () => {
  assert.equal(rejoinRetryDelayMs(1), 15_000);
  assert.equal(rejoinRetryDelayMs(2), 30_000);
  assert.equal(rejoinRetryDelayMs(3, 60_000), 60_000);
  assert.equal(rejoinRetryDelayMs(20), REJOIN_RETRY_MAX_MS);
  assert.equal(rejoinRetryDelayMs(2, 300_000), 300_000);
});

test('cada estilo Mapbox conserva un respaldo cartográfico independiente', () => {
  assert.deepEqual(
    FALLBACK_MAP_STYLES.map((item) => item.label),
    OPEN_MAP_STYLES.map((item) => item.label),
  );
  for (const item of FALLBACK_MAP_STYLES) {
    const serialized = JSON.stringify(item.style);
    assert.doesNotMatch(serialized, /api\.mapbox\.com|mapbox:\/\//);
    assert.match(serialized, /attribution/);
  }
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

test('el parcial en vivo expone progreso, proyección y tendencia sin esperar 100 metros', () => {
  const points = Array.from({ length: 24 }, (_, index) => point({
    latitude: 40,
    longitude: -0.1 + index * 0.001,
    timestamp: index * 30_000,
  }));
  const live = calculateLiveRideSplitState(points);

  assert.equal(live.currentIndex, 2);
  assert.ok(live.currentDistanceM > 700);
  assert.ok(live.currentProgressPercent > 70);
  assert.ok((live.projectedMovingSeconds ?? 0) > 0);
  assert.equal(live.lastCompleted?.index, 1);
  assert.equal(live.deltaFromPreviousSeconds, null);
  assert.equal(live.fastestCompletedIndex, 1);
});

test('la tendencia del parcial en vivo compara únicamente kilómetros completos', () => {
  const points = Array.from({ length: 34 }, (_, index) => point({
    latitude: 40,
    longitude: -0.1 + index * 0.001,
    timestamp: index <= 15 ? index * 35_000 : 525_000 + (index - 15) * 20_000,
  }));
  const live = calculateLiveRideSplitState(points);

  assert.equal(live.currentIndex, 3);
  assert.equal(live.lastCompleted?.index, 2);
  assert.ok((live.deltaFromPreviousSeconds ?? 0) < 0);
  assert.equal(live.fastestCompletedIndex, 2);
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

test('los avisos de giro se escalonan para preparar, acercar y ejecutar', () => {
  assert.equal(turnAlertStage(450), null);
  assert.equal(turnAlertStage(350), 'prepare');
  assert.equal(turnAlertStage(120), 'near');
  assert.equal(turnAlertStage(25), 'now');
  assert.equal(turnAlertMessage({ label: 'Gira a la derecha', distanceM: 117 }, 'near'), 'Gira a la derecha en 120 metros.');
  assert.equal(turnAlertMessage({ label: 'Gira a la derecha', distanceM: 20 }, 'now'), 'Gira a la derecha, ahora.');
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

test('el paquete offline solo sirve para la versión exacta del trazado', () => {
  const route = [
    { latitude: 40.123456, longitude: -0.123456, elevation: 600 },
    { latitude: 40.223456, longitude: -0.023456, elevation: 700 },
  ];
  const routeFingerprint = offlineRouteFingerprint(route);

  assert.equal(routeFingerprint, offlineRouteFingerprint(structuredClone(route)));
  assert.equal(offlineMapMatchesRoute({
    version: OFFLINE_MAP_VERSION,
    routeFingerprint,
  }, route), true);
  assert.equal(offlineMapMatchesRoute({
    version: 2,
    routeFingerprint,
  }, route), false);
  assert.equal(offlineMapMatchesRoute({
    version: OFFLINE_MAP_VERSION,
    routeFingerprint,
  }, [{ ...route[0], longitude: -0.123455 }, route[1]]), false);
});

test('la consulta offline compacta corredores solapados y cubre caminos, agua y puntos útiles', () => {
  const route = Array.from({ length: 30 }, (_, index) => ({
    latitude: 40 + index * 0.001,
    longitude: -0.1,
    elevation: null,
  }));
  const query = buildOverpassTrailQuery(route, 9_000);

  assert.match(query, /highway\|waterway\|barrier/);
  assert.match(query, /drinking_water\|shelter\|parking/);
  const corridorCount = query.match(/way\[~"\^\(highway/g)?.length ?? 0;
  assert.ok(corridorCount >= 2 && corridorCount < 12);
  assert.match(query, /39\.982034/);
  assert.match(query, /out tags geom qt/);
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

test('la descarga offline conserva una consulta ligera de rescate si Overpass está saturado', () => {
  const query = buildOverpassTrailOnlyQuery([
    { latitude: 40, longitude: -0.1, elevation: null },
    { latitude: 40.01, longitude: -0.1, elevation: null },
  ]);
  assert.match(query, /way\["highway"\]/);
  assert.doesNotMatch(query, /drinking_water/);
  assert.match(query, /timeout:15/);
});

test('el paquete offline incorpora agua, refugios, fuentes y barreras sin depender de teselas', () => {
  const collection = overpassWaysToGeoJson([
    {
      type: 'way',
      id: 1,
      tags: { waterway: 'stream', name: 'Arroyo del Pinar' },
      geometry: [{ lat: 40, lon: -0.1 }, { lat: 40.001, lon: -0.099 }],
    },
    {
      type: 'node',
      id: 2,
      tags: { amenity: 'drinking_water', name: 'Fuente del Collado' },
      lat: 40.002,
      lon: -0.098,
    },
    {
      type: 'node',
      id: 3,
      tags: { tourism: 'wilderness_hut' },
      lat: 40.003,
      lon: -0.097,
    },
    {
      type: 'way',
      id: 4,
      tags: { barrier: 'fence' },
      geometry: [{ lat: 40, lon: -0.096 }, { lat: 40.001, lon: -0.095 }],
    },
  ]);

  assert.deepEqual(summarizeOfflineMap(collection), {
    trails: 0,
    water: 1,
    barriers: 1,
    pois: 2,
  });
  assert.equal(collection.features[1].properties.poiType, 'drinking_water');
  assert.equal(collection.features[1].geometry.type, 'Point');
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

test('la antigüedad meteorológica sigue aumentando después de la consulta', () => {
  const now = new Date('2026-07-18T12:45:00Z');
  const fetchedAt = new Date('2026-07-18T12:00:00Z');
  assert.equal(effectiveWeatherAgeMinutes(90, fetchedAt, now), 135);
  assert.equal(effectiveWeatherAgeMinutes(null, fetchedAt, now), null);
});

test('una observación de más de dos horas deja de presentarse como favorable en vivo', () => {
  const summary = deriveLiveRideConditions({
    phases: [{
      id: 'W1',
      fromKm: 0,
      toKm: 10,
      centerKm: 5,
      routeBearingDeg: 0,
      temperatureC: 22,
      humidityPct: 55,
      windKmh: 8,
      maxWindKmh: 12,
      precipitationMm: 0,
      windEffect: 'calm',
      confidence: 'low',
      nearestStationKm: 18,
      stationCount: 1,
      feelLabel: 'sensación neutra',
      riskLevel: 'green',
    }],
    completedM: 2_000,
    remainingM: 8_000,
    averageSpeedKmh: 14,
    movingSeconds: 1_200,
    sportType: 'ebike',
    weatherDataAgeMin: 121,
  });

  assert.equal(summary.weatherDataIsStale, true);
  assert.equal(summary.overallRisk, 'yellow');
  assert.match(summary.recommendation, /no la trates como tiempo real/i);
  assert.equal(buildLiveConditionAlert(summary)?.key, 'weather:stale');
});

test('el refresco meteo evita rate limit, respeta ocho minutos y reacciona al volver la cobertura', () => {
  const now = 1_000_000;
  assert.equal(shouldRefreshLiveWeather({
    now,
    lastFetchAt: now - 60_000,
    lastAttemptAt: 0,
    force: false,
    online: true,
  }), false);
  assert.equal(shouldRefreshLiveWeather({
    now,
    lastFetchAt: now - 9 * 60_000,
    lastAttemptAt: 0,
    force: false,
    online: true,
  }), true);
  assert.equal(shouldRefreshLiveWeather({
    now,
    lastFetchAt: now - 60_000,
    lastAttemptAt: now - 10_000,
    force: true,
    online: true,
  }), false);
  assert.equal(shouldRefreshLiveWeather({
    now,
    lastFetchAt: now - 60_000,
    lastAttemptAt: 0,
    force: true,
    online: true,
  }), true);
  assert.equal(shouldRefreshLiveWeather({
    now,
    lastFetchAt: 0,
    lastAttemptAt: 0,
    force: true,
    online: false,
  }), false);
});

test('anticipa el primer tramo meteorológico sensible dentro de cinco kilómetros', () => {
  const phases = [
    { id: 'W1', fromKm: 0, toKm: 2, centerKm: 1, riskLevel: 'green' },
    { id: 'W2', fromKm: 2, toKm: 4, centerKm: 3, riskLevel: 'yellow' },
    { id: 'W3', fromKm: 4, toKm: 6, centerKm: 5, riskLevel: 'red' },
  ];
  const hazard = findUpcomingWeatherHazard(phases, 1.25);
  assert.equal(hazard?.phase.id, 'W2');
  assert.equal(hazard?.distanceM, 750);
  assert.equal(findUpcomingWeatherHazard(phases, 6.1), null);
});

test('genera una alerta preventiva antes de entrar en un tramo rojo', () => {
  const common = {
    routeBearingDeg: 0,
    temperatureC: 20,
    humidityPct: 55,
    windKmh: 12,
    maxWindKmh: 18,
    precipitationMm: 0,
    windEffect: 'headwind',
    confidence: 'high',
    nearestStationKm: 4,
    stationCount: 3,
  };
  const summary = deriveLiveRideConditions({
    phases: [
      {
        ...common,
        id: 'W1',
        fromKm: 0,
        toKm: 2,
        centerKm: 1,
        feelLabel: 'sensación neutra',
        riskLevel: 'green',
      },
      {
        ...common,
        id: 'W2',
        fromKm: 2,
        toKm: 4,
        centerKm: 3,
        maxWindKmh: 48,
        feelLabel: 'viento lateral fuerte',
        riskLevel: 'red',
      },
    ],
    completedM: 500,
    remainingM: 3_500,
    averageSpeedKmh: 14,
    movingSeconds: 900,
    sportType: 'ebike',
  });
  const alert = buildLiveConditionAlert(summary);
  assert.equal(alert?.key, 'weather:W2:red');
  assert.equal(alert?.risk, 'red');
  assert.match(alert?.message ?? '', /1.5 kilómetros/i);
  assert.match(alert?.message ?? '', /viento lateral fuerte/i);
});

test('la alerta de falta de luz tiene prioridad sobre la meteo próxima', () => {
  const summary = deriveLiveRideConditions({
    phases: [{
      id: 'W1',
      fromKm: 0,
      toKm: 10,
      centerKm: 5,
      routeBearingDeg: 0,
      temperatureC: 20,
      humidityPct: 55,
      windKmh: 30,
      maxWindKmh: 35,
      precipitationMm: 0,
      windEffect: 'crosswind',
      confidence: 'high',
      nearestStationKm: 4,
      stationCount: 3,
      feelLabel: 'viento lateral',
      riskLevel: 'yellow',
    }],
    daylight: { sunset: '19:00' },
    completedM: 1_000,
    remainingM: 8_000,
    averageSpeedKmh: 8,
    movingSeconds: 900,
    sportType: 'mtb',
    now: new Date(2026, 0, 1, 18, 30),
  });
  const alert = buildLiveConditionAlert(summary);
  assert.equal(alert?.key, 'light:red');
  assert.match(alert?.message ?? '', /ocaso/i);
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

test('la vista de conducción arranca en Basic y conserva Pro si se eligió', () => {
  assert.equal(normalizeRideDisplayMode(null), 'basic');
  assert.equal(normalizeRideDisplayMode('basic'), 'basic');
  assert.equal(normalizeRideDisplayMode('pro'), 'pro');
  assert.equal(normalizeRideDisplayMode('unexpected'), 'basic');
});

test('el watchdog recupera el GPS suspendido sin duplicar reinicios', () => {
  const now = 100_000;
  assert.equal(shouldRestartGpsWatch({
    recording: true,
    demo: false,
    lastFixAt: now - GPS_STALE_RESTART_MS,
    lastRestartAt: 0,
    now,
  }), true);
  assert.equal(shouldRestartGpsWatch({
    recording: true,
    demo: false,
    lastFixAt: now - GPS_STALE_RESTART_MS,
    lastRestartAt: now - 5_000,
    now,
  }), false);
  assert.equal(shouldRestartGpsWatch({
    recording: true,
    demo: false,
    lastFixAt: now - GPS_RESUME_RESTART_MS,
    lastRestartAt: 0,
    now,
    staleAfterMs: GPS_RESUME_RESTART_MS,
  }), true);
  assert.equal(shouldRestartGpsWatch({
    recording: true,
    demo: true,
    lastFixAt: now - GPS_STALE_RESTART_MS,
    lastRestartAt: 0,
    now,
  }), false);
  assert.equal(shouldRestartGpsWatch({
    recording: true,
    demo: false,
    lastFixAt: 0,
    watchStartedAt: now - GPS_STALE_RESTART_MS,
    lastRestartAt: 0,
    now,
  }), true);
});

test('solo una posición GPS utilizable mantiene viva la señal', () => {
  assert.equal(gpsAssessmentKeepsSignalAlive(null), true);
  assert.equal(gpsAssessmentKeepsSignalAlive('drift'), true);
  assert.equal(gpsAssessmentKeepsSignalAlive('accuracy'), false);
  assert.equal(gpsAssessmentKeepsSignalAlive('jump'), false);
  assert.equal(gpsAssessmentKeepsSignalAlive('timestamp'), false);
  assert.equal(gpsAssessmentKeepsSignalAlive('invalid'), false);
});

test('la velocidad instantánea cae a cero al pausar o perder señal', () => {
  assert.equal(displayedRideSpeedKmh({
    recording: true,
    demo: false,
    signalAgeSeconds: 2,
    speedMps: 5,
  }), 18);
  assert.equal(displayedRideSpeedKmh({
    recording: false,
    demo: false,
    signalAgeSeconds: 2,
    speedMps: 5,
  }), 0);
  assert.equal(displayedRideSpeedKmh({
    recording: true,
    demo: false,
    signalAgeSeconds: 15,
    speedMps: 5,
  }), 0);
});

test('el callback de acceso solo acepta destinos internos seguros', () => {
  assert.equal(normalizeAuthNextPath('/planifica?ruta=abc'), '/planifica?ruta=abc');
  assert.equal(normalizeAuthNextPath('https://evil.example'), '/account');
  assert.equal(normalizeAuthNextPath('//evil.example/path'), '/account');
  assert.equal(normalizeAuthNextPath(null), '/account');
  assert.equal(normalizeAuthNextPath('/auth?next=/planifica'), '/account');
  assert.equal(normalizeAuthNextPath('/onboarding'), '/account');
  assert.equal(
    getPostAuthDestination('/planifica?ruta=abc', null),
    '/onboarding?next=%2Fplanifica%3Fruta%3Dabc',
  );
  assert.equal(
    getPostAuthDestination('/planifica?ruta=abc', null, 'google'),
    '/onboarding?next=%2Fplanifica%3Fruta%3Dabc&signed_in=google',
  );
  assert.equal(
    getPostAuthDestination('/planifica?ruta=abc', null, 'provider-inventado'),
    '/onboarding?next=%2Fplanifica%3Fruta%3Dabc',
  );
  assert.equal(normalizeAuthProvider('apple'), null);
  assert.equal(normalizeAuthProvider('provider-inventado'), null);
  assert.equal(
    getPostAuthDestination('/planifica?ruta=abc', '2026-07-18T17:35:00Z'),
    '/planifica?ruta=abc',
  );
});

test('OAuth vuelve al mismo origen para conservar el verificador PKCE', () => {
  assert.equal(
    resolveAuthSiteOrigin(undefined, 'https://levo-git-feature-example.vercel.app'),
    'https://levo-git-feature-example.vercel.app',
  );
  assert.equal(
    resolveAuthSiteOrigin('https://rutas.example.com/', 'https://levo-preview.vercel.app'),
    'https://levo-preview.vercel.app',
  );
  assert.equal(resolveAuthSiteOrigin('https://rutas.example.com/', undefined), 'https://rutas.example.com');
});

test('OAuth conserva el desarrollo local y codifica un destino interno seguro', () => {
  assert.equal(
    resolveAuthSiteOrigin(undefined, 'http://localhost:3000'),
    'http://localhost:3000',
  );
  assert.equal(
    buildAuthCallbackUrl(
      '/planifica?ruta=sierra norte',
      undefined,
      'https://levo-preview.vercel.app',
    ),
    'https://levo-preview.vercel.app/auth/callback?next=%2Fplanifica%3Fruta%3Dsierra%2520norte',
  );
  assert.equal(
    buildAuthCallbackUrl('https://evil.example', undefined, 'https://levo-preview.vercel.app'),
    'https://levo-preview.vercel.app/auth/callback?next=%2Faccount',
  );
});

test('el callback oculta errores OAuth técnicos y ofrece códigos accionables', () => {
  assert.equal(
    normalizeAuthExchangeError('PKCE code verifier not found in storage'),
    'invalid_code',
  );
  assert.equal(normalizeAuthExchangeError('session_not_found'), 'session_not_found');
  assert.equal(normalizeAuthExchangeError('unexpected upstream failure'), 'auth_exchange_failed');
});

test('la pantalla de acceso refleja los proveedores realmente activados', () => {
  assert.deepEqual(normalizeProviderAvailability({
    external: { email: true, google: false, apple: true },
  }), {
    email: true,
    google: false,
  });
  assert.deepEqual(normalizeProviderAvailability(null), {
    email: false,
    google: false,
  });
});

test('el Forfait adapta las recomendaciones al nivel real del rider', () => {
  const current = {
    id: 'inicio',
    dificultad: 'azul',
    estado: 'abierto',
    aptoEbike: true,
  };
  const redTrail = {
    id: 'roja',
    dificultad: 'rojo',
    estado: 'abierto',
    aptoEbike: false,
  };
  const connection = {
    id: 'inicio-roja',
    fromTrackId: current.id,
    toTrackId: redTrail.id,
    distanciaMetros: 10,
    recomendado: true,
  };

  const initiation = sugerirSiguientesTracks(
    current,
    [current, redTrail],
    [connection],
    'iniciacion',
    [current.id],
  );
  const advanced = sugerirSiguientesTracks(
    current,
    [current, redTrail],
    [connection],
    'avanzado',
    [current.id],
  );
  const ebike = sugerirSiguientesTracks(
    current,
    [current, redTrail],
    [connection],
    'ebike',
    [current.id],
  );

  assert.equal(initiation[0]?.tipo, 'no_recomendado');
  assert.equal(advanced[0]?.tipo, 'recomendado');
  assert.equal(ebike[0]?.tipo, 'con_precaucion');
});
