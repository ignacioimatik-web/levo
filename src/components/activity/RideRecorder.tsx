'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle, BatteryCharging, Bike, CircleStop, Flag, Gauge, LocateFixed, Mountain,
  Navigation, Pause, Play, Radio, RotateCcw, Save, Share2, ShieldCheck, Timer, Trash2, Upload, Zap,
} from 'lucide-react';
import RideNavigationMap from '@/components/activity/RideNavigationMap';
import RideControlDock from '@/components/activity/RideControlDock';
import TurnGuidanceHud from '@/components/activity/TurnGuidanceHud';
import LiveRideConditions from '@/components/activity/LiveRideConditions';
import RideDisplayToolbar from '@/components/activity/RideDisplayToolbar';
import RideReadinessCard from '@/components/activity/RideReadinessCard';
import LiveSplitCard from '@/components/activity/LiveSplitCard';
import useRejoinRoute from '@/components/activity/useRejoinRoute';
import {
  assessRidePoint, calculateRideMetrics, estimateBattery, pointFromPosition,
} from '@/lib/activities/geo';
import type { RidePointRejection } from '@/lib/activities/geo';
import { buildBatteryModel, predictBatteryForRoute } from '@/lib/activities/battery';
import {
  clearRideDraft, getActivitiesDurable, getRideDraftDurable, saveActivity, saveRideDraft,
} from '@/lib/activities/storage';
import { syncActivity } from '@/lib/activities/sync';
import type {
  AssistMode, RideActivity, RideDraft, RidePoint, RideSettings, SportType,
  RideWeatherSample,
} from '@/lib/activities/types';
import {
  normalizeRideDisplayMode,
  RIDE_DISPLAY_MODE_EVENT,
  RIDE_DISPLAY_MODE_STORAGE_KEY,
} from '@/lib/activities/display-mode';
import type { RideDisplayMode } from '@/lib/activities/display-mode';
import {
  displayedRideSpeedKmh, gpsAssessmentKeepsSignalAlive,
  GPS_RESUME_RESTART_MS,
  GPS_STALE_RESTART_MS,
  shouldRestartGpsWatch,
} from '@/lib/activities/gps-watchdog';
import { calculateNavigationProgress, cardinalForBearing } from '@/lib/navigation/progress';
import type { LiveRideConditionAlert } from '@/lib/navigation/live-ride-conditions';
import {
  calculateGhostComparison, calculateSecuredNavigation,
} from '@/lib/navigation/repeat';
import { getPlannedRoute, savePlannedRoute } from '@/lib/navigation/storage';
import type { PlannedRoute } from '@/lib/navigation/types';
import { requestPersistentRideStorage } from '@/lib/activities/durable-storage';
import { getOfflineMapPackage } from '@/lib/navigation/offline-map-storage';
import type { OfflineMapPackage } from '@/lib/navigation/offline-map-storage';
import { summarizeOfflineMap } from '@/lib/navigation/offline-map-data';
import { offlineMapMatchesRoute } from '@/lib/navigation/offline-map-version';
import { parseNavigationGpx } from '@/lib/navigation/gpx';
import {
  calculateUpcomingTurn, turnAlertMessage, turnAlertStage,
} from '@/lib/navigation/turns';
import type { TurnAlertStage } from '@/lib/navigation/turns';
import { matchCompetitiveSegments } from '@/lib/segments/matcher';
import { createClient } from '@/lib/supabase/browser';
import { calculateLiveRideSplitState } from '@/lib/activities/track-analysis';

type RecorderStatus = 'idle' | 'requesting' | 'recording' | 'paused' | 'finished' | 'error';

const DEFAULT_SETTINGS: RideSettings = {
  sportType: 'ebike',
  batteryStart: 100,
  batteryCapacityWh: 700,
  assistMode: 'trail',
};

function subscribeRideDisplayMode(onStoreChange: () => void): () => void {
  const notifyFromStorage = (event: StorageEvent) => {
    if (event.key === RIDE_DISPLAY_MODE_STORAGE_KEY) onStoreChange();
  };
  window.addEventListener('storage', notifyFromStorage);
  window.addEventListener(RIDE_DISPLAY_MODE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener('storage', notifyFromStorage);
    window.removeEventListener(RIDE_DISPLAY_MODE_EVENT, onStoreChange);
  };
}

function readRideDisplayMode(): RideDisplayMode {
  return normalizeRideDisplayMode(window.localStorage.getItem(RIDE_DISPLAY_MODE_STORAGE_KEY));
}

function readServerRideDisplayMode(): RideDisplayMode {
  return 'basic';
}

function subscribeOnlineStatus(onStoreChange: () => void): () => void {
  window.addEventListener('online', onStoreChange);
  window.addEventListener('offline', onStoreChange);
  return () => {
    window.removeEventListener('online', onStoreChange);
    window.removeEventListener('offline', onStoreChange);
  };
}

function readOnlineStatus(): boolean {
  return navigator.onLine;
}

function readServerOnlineStatus(): boolean {
  return true;
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor(seconds % 3600 / 60);
  const remaining = seconds % 60;
  return [hours, minutes, remaining].map((value) => String(value).padStart(2, '0')).join(':');
}

function formatGap(seconds: number): string {
  const absolute = Math.abs(Math.round(seconds));
  const minutes = Math.floor(absolute / 60);
  const remaining = absolute % 60;
  return `${minutes}:${String(remaining).padStart(2, '0')}`;
}

function buildDemoPoint(index: number): RidePoint {
  const angle = index * 0.22;
  return {
    latitude: 40.6197 + Math.sin(angle) * 0.006 + index * 0.00012,
    longitude: -0.0989 + Math.cos(angle * 0.8) * 0.008,
    elevation: 930 + Math.sin(angle * 0.7) * 55 + index * 1.8,
    accuracy: 4,
    speed: 5.5 + Math.sin(angle) * 1.5,
    timestamp: Date.now() + index * 14_000,
  };
}

function Metric({ icon: Icon, label, value, unit }: {
  icon: typeof Gauge;
  label: string;
  value: string;
  unit?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
      <div className="mb-2 flex items-center gap-2 text-slate-500">
        <Icon className="h-4 w-4" />
        <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
      </div>
      <p className="text-2xl font-black tabular-nums text-white">
        {value} {unit && <span className="text-xs text-slate-500">{unit}</span>}
      </p>
    </div>
  );
}

export default function RideRecorder({ plannedRouteId }: { plannedRouteId?: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<RecorderStatus>('idle');
  const [settings, setSettings] = useState<RideSettings>(DEFAULT_SETTINGS);
  const [points, setPoints] = useState<RidePoint[]>([]);
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [error, setError] = useState('');
  const [title, setTitle] = useState('');
  const [batteryEnd, setBatteryEnd] = useState(100);
  const [liveSession, setLiveSession] = useState<{ id: string; shareToken: string } | null>(null);
  const [liveStatus, setLiveStatus] = useState<'idle' | 'starting' | 'active' | 'error'>('idle');
  const [liveError, setLiveError] = useState('');
  const [recoverableDraft, setRecoverableDraft] = useState<RideDraft | null>(null);
  const [batteryHistory, setBatteryHistory] = useState<RideActivity[]>([]);
  const [plannedRoute, setPlannedRoute] = useState<PlannedRoute | null>(null);
  const [offlineMap, setOfflineMap] = useState<OfflineMapPackage | null>(null);
  const [navigationFloorM, setNavigationFloorM] = useState(0);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [lastGpsFixAt, setLastGpsFixAt] = useState(0);
  const [gpsSignalAgeSeconds, setGpsSignalAgeSeconds] = useState(0);
  const [gpsRejection, setGpsRejection] = useState<RidePointRejection | null>(null);
  const [finishArmed, setFinishArmed] = useState(false);
  const [voiceGuidance, setVoiceGuidance] = useState(false);
  const displayMode = useSyncExternalStore(
    subscribeRideDisplayMode,
    readRideDisplayMode,
    readServerRideDisplayMode,
  );
  const online = useSyncExternalStore(
    subscribeOnlineStatus,
    readOnlineStatus,
    readServerOnlineStatus,
  );
  const [rideFocused, setRideFocused] = useState(false);
  const [locationPermission, setLocationPermission] = useState<PermissionState | 'unknown'>('unknown');
  const [storageProtected, setStorageProtected] = useState<boolean | null>(null);
  const [gpsRecoveryActive, setGpsRecoveryActive] = useState(false);
  const [demoRide, setDemoRide] = useState(false);
  const [weatherSamples, setWeatherSamples] = useState<RideWeatherSample[]>([]);
  const [announcedSplitIndex, setAnnouncedSplitIndex] = useState<number | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const draftIdRef = useRef<string | null>(null);
  const durationBaseRef = useRef(0);
  const recordingStartedAtRef = useRef<number | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const demoTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const demoIndexRef = useRef(0);
  const isDemoRef = useRef(false);
  const wakeLockRef = useRef<{ release: () => Promise<void> } | null>(null);
  const lastLiveUpdateRef = useRef(0);
  const lastAcceptedPointRef = useRef<RidePoint | null>(null);
  const announcedTurnRef = useRef<{ turnIndex: number; stage: TurnAlertStage } | null>(null);
  const announcedRecoveryTurnRef = useRef<{ turnIndex: number; stage: TurnAlertStage } | null>(null);
  const lastOffRouteAlertRef = useRef(0);
  const lastGpsRestartAtRef = useRef(0);
  const gpsWatchStartedAtRef = useRef(0);
  const lastAnnouncedSplitRef = useRef(0);

  const requestWakeLock = useCallback(async () => {
    try {
      const wakeLockNavigator = navigator as Navigator & {
        wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> };
      };
      wakeLockRef.current = await wakeLockNavigator.wakeLock?.request('screen') ?? null;
    } catch {
      wakeLockRef.current = null;
    }
  }, []);

  const releaseWakeLock = useCallback(async () => {
    try {
      await wakeLockRef.current?.release();
    } finally {
      wakeLockRef.current = null;
    }
  }, []);

  const clearGpsWatch = useCallback(() => {
    if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current);
    watchIdRef.current = null;
    gpsWatchStartedAtRef.current = 0;
  }, []);

  const stopWatch = useCallback(() => {
    clearGpsWatch();
    if (demoTimerRef.current) clearInterval(demoTimerRef.current);
    demoTimerRef.current = null;
  }, [clearGpsWatch]);

  useEffect(() => stopWatch, [stopWatch]);
  useEffect(() => () => { void releaseWakeLock(); }, [releaseWakeLock]);

  useEffect(() => {
    if (!rideFocused) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setRideFocused(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [rideFocused]);

  useEffect(() => {
    let cancelled = false;
    const draftRead = window.setTimeout(() => {
      void Promise.all([getRideDraftDurable(), getActivitiesDurable()]).then(([draft, activities]) => {
        if (cancelled) return;
        setRecoverableDraft(draft);
        setBatteryHistory(activities);
        const routeId = plannedRouteId ?? draft?.plannedRouteId;
        if (routeId) {
          setPlannedRoute(getPlannedRoute(routeId));
          setNavigationFloorM(0);
        }
      });
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(draftRead);
    };
  }, [plannedRouteId]);

  useEffect(() => {
    let cancelled = false;
    void requestPersistentRideStorage().then((persisted) => {
      if (!cancelled) setStorageProtected(persisted);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!navigator.permissions?.query) return;
    let cancelled = false;
    let permissionStatus: PermissionStatus | null = null;
    const updatePermission = () => {
      if (!cancelled && permissionStatus) setLocationPermission(permissionStatus.state);
    };
    void navigator.permissions.query({ name: 'geolocation' }).then((statusResult) => {
      if (cancelled) return;
      permissionStatus = statusResult;
      setLocationPermission(statusResult.state);
      statusResult.addEventListener('change', updatePermission);
    }).catch(() => {
      if (!cancelled) setLocationPermission('unknown');
    });
    return () => {
      cancelled = true;
      permissionStatus?.removeEventListener('change', updatePermission);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!plannedRoute?.id) return;
    void getOfflineMapPackage(plannedRoute.id).then((mapPackage) => {
      if (!cancelled) {
        setOfflineMap(offlineMapMatchesRoute(mapPackage, plannedRoute.points) ? mapPackage : null);
      }
    });
    return () => { cancelled = true; };
  }, [plannedRoute]);
  const activeOfflineMap = offlineMap?.routeId === plannedRoute?.id ? offlineMap : null;
  const activeOfflineSummary = activeOfflineMap
    ? activeOfflineMap.summary ?? summarizeOfflineMap(activeOfflineMap.trails)
    : null;

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) return;
    void supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: profile } = await supabase
        .from('profiles')
        .select('battery_capacity_wh')
        .eq('user_id', data.user.id)
        .maybeSingle();
      if (profile?.battery_capacity_wh) {
        setSettings((current) => ({ ...current, batteryCapacityWh: profile.battery_capacity_wh }));
      }
    });
  }, []);

  useEffect(() => {
    if (status !== 'recording' && status !== 'requesting') return;
    const timer = setInterval(() => {
      const freshnessAnchor = lastGpsFixAt || gpsWatchStartedAtRef.current;
      if (freshnessAnchor > 0) {
        setGpsSignalAgeSeconds(Math.max(0, Math.floor((Date.now() - freshnessAnchor) / 1_000)));
      }
      if (status !== 'recording') return;
      if (isDemoRef.current) {
        setDurationSeconds((value) => value + 14);
      } else if (recordingStartedAtRef.current != null) {
        setDurationSeconds(
          durationBaseRef.current + Math.floor((Date.now() - recordingStartedAtRef.current) / 1000),
        );
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [lastGpsFixAt, status]);

  const persistCurrentDraft = useCallback((forceDurable = false) => {
    if (status !== 'recording' && status !== 'paused' && status !== 'finished') return;
    if (!draftIdRef.current || startedAtRef.current == null) return;
    const lastAcceptedPoint = lastAcceptedPointRef.current;
    const persistedLastPoint = points.at(-1);
    const recoveryPoints = lastAcceptedPoint
      && persistedLastPoint?.timestamp !== lastAcceptedPoint.timestamp
      ? [...points, lastAcceptedPoint]
      : points;
    const currentDuration = status === 'recording'
      && !isDemoRef.current
      && recordingStartedAtRef.current != null
      ? durationBaseRef.current + Math.floor((Date.now() - recordingStartedAtRef.current) / 1000)
      : durationSeconds;
    saveRideDraft({
      id: draftIdRef.current,
      startedAt: startedAtRef.current,
      updatedAt: Date.now(),
      durationSeconds: currentDuration,
      points: recoveryPoints,
      settings,
      isDemo: isDemoRef.current,
      liveSession,
      plannedRouteId: plannedRoute?.id,
      navigationCompletedM: navigationFloorM,
      weatherSamples,
    }, forceDurable);
  }, [durationSeconds, liveSession, navigationFloorM, plannedRoute?.id, points, settings, status, weatherSamples]);

  useEffect(() => {
    persistCurrentDraft();
  }, [persistCurrentDraft]);

  useEffect(() => {
    const flushHiddenDraft = () => {
      if (document.visibilityState === 'hidden') persistCurrentDraft(true);
    };
    const flushDurableDraft = () => persistCurrentDraft(true);
    window.addEventListener('pagehide', flushDurableDraft);
    document.addEventListener('visibilitychange', flushHiddenDraft);
    return () => {
      window.removeEventListener('pagehide', flushDurableDraft);
      document.removeEventListener('visibilitychange', flushHiddenDraft);
    };
  }, [persistCurrentDraft]);

  useEffect(() => {
    if (!finishArmed) return;
    const timer = window.setTimeout(() => setFinishArmed(false), 5_000);
    return () => window.clearTimeout(timer);
  }, [finishArmed]);

  useEffect(() => {
    const warnBeforeExit = (event: BeforeUnloadEvent) => {
      if (status !== 'recording' && status !== 'paused') return;
      event.preventDefault();
    };
    window.addEventListener('beforeunload', warnBeforeExit);
    return () => window.removeEventListener('beforeunload', warnBeforeExit);
  }, [status]);

  const metrics = useMemo(() => calculateRideMetrics(points), [points]);
  const liveSplit = useMemo(() => calculateLiveRideSplitState(points), [points]);
  const currentPosition = points.at(-1) ?? null;
  const currentSpeedMps = currentPosition?.speed ?? null;
  const currentSpeedKmh = displayedRideSpeedKmh({
    recording: status === 'recording',
    demo: demoRide,
    signalAgeSeconds: gpsSignalAgeSeconds,
    speedMps: currentSpeedMps,
  });
  const batteryModel = useMemo(
    () => buildBatteryModel(batteryHistory, settings.assistMode),
    [batteryHistory, settings.assistMode],
  );
  const battery = useMemo(() => estimateBattery(
    metrics.distanceM,
    settings.batteryStart,
    settings.batteryCapacityWh,
    settings.assistMode,
    batteryModel.conservativeWhPerKm,
  ), [batteryModel.conservativeWhPerKm, metrics.distanceM, settings]);
  const plannedBattery = useMemo(() => (
    plannedRoute && settings.sportType === 'ebike'
      ? predictBatteryForRoute({
        model: batteryModel,
        distanceKm: plannedRoute.distanceKm,
        elevationGainM: plannedRoute.elevationGainM,
        batteryStart: settings.batteryStart,
        capacityWh: settings.batteryCapacityWh,
      })
      : null
  ), [batteryModel, plannedRoute, settings]);
  const navigation = useMemo(() => {
    const latestPosition = points.at(-1);
    if (!plannedRoute || !latestPosition) return null;
    return calculateNavigationProgress(
      plannedRoute.points,
      latestPosition,
      metrics.distanceM + 1_000,
      Math.max(0, navigationFloorM - 200),
    );
  }, [metrics.distanceM, navigationFloorM, plannedRoute, points]);
  const rejoinTarget = useMemo(() => (
    navigation && navigation.offRouteM > 75
      ? {
          latitude: navigation.rejoinLatitude,
          longitude: navigation.rejoinLongitude,
          elevation: plannedRoute?.points[navigation.nearestIndex]?.elevation ?? null,
        }
      : null
  ), [navigation, plannedRoute]);
  const rejoinRoute = useRejoinRoute({
    active: status === 'recording' && Boolean(plannedRoute),
    online,
    offRouteM: navigation?.offRouteM ?? 0,
    currentPoint: currentPosition,
    targetPoint: rejoinTarget,
    sportType: settings.sportType,
  });
  const rejoinNavigation = useMemo(() => {
    const latestPosition = points.at(-1);
    return rejoinRoute.path && latestPosition
      ? calculateNavigationProgress(
          rejoinRoute.path.points,
          latestPosition,
          Number.POSITIVE_INFINITY,
          0,
        )
      : null;
  }, [points, rejoinRoute.path]);
  const rejoinTurn = useMemo(() => (
    rejoinRoute.path
      ? calculateUpcomingTurn(rejoinRoute.path.points, rejoinNavigation)
      : null
  ), [rejoinNavigation, rejoinRoute.path]);
  const rejoinRemainingM = rejoinNavigation?.remainingM
    ?? rejoinRoute.path?.distanceM
    ?? navigation?.offRouteM
    ?? 0;
  const ghost = useMemo(() => (
    plannedRoute ? calculateGhostComparison(plannedRoute, navigation, durationSeconds) : null
  ), [durationSeconds, navigation, plannedRoute]);
  const securedNavigation = useMemo(() => {
    if (!plannedRoute) return { completedM: 0, remainingM: 0, progressPercent: 0 };
    return calculateSecuredNavigation(navigation, navigationFloorM, plannedRoute.distanceKm * 1000);
  }, [navigation, navigationFloorM, plannedRoute]);
  const remainingBattery = useMemo(() => (
    navigation && settings.sportType === 'ebike'
      ? predictBatteryForRoute({
        model: batteryModel,
        distanceKm: securedNavigation.remainingM / 1000,
        elevationGainM: navigation.remainingGainM,
        batteryStart: battery.batteryPercent,
        capacityWh: settings.batteryCapacityWh,
      })
      : null
  ), [battery.batteryPercent, batteryModel, navigation, securedNavigation.remainingM, settings]);
  const upcomingTurn = useMemo(() => (
    plannedRoute ? calculateUpcomingTurn(plannedRoute.points, navigation) : null
  ), [navigation, plannedRoute]);
  const gpsQuality = useMemo(() => {
    if (gpsAccuracy == null) return null;
    if (status === 'recording' && gpsSignalAgeSeconds > 30) {
      return {
        label: `Sin GPS · ${gpsSignalAgeSeconds} s`,
        color: 'text-red-300 bg-red-500/10',
      };
    }
    if (gpsRejection && gpsRejection !== 'drift') {
      return {
        label: gpsRejection === 'accuracy' || gpsRejection === 'invalid'
          ? 'Sin señal fiable'
          : 'GPS inestable',
        color: 'text-amber-300 bg-amber-500/10',
      };
    }
    if (gpsAccuracy <= 8) return { label: 'GPS excelente', color: 'text-emerald-400 bg-emerald-500/10' };
    if (gpsAccuracy <= 20) return { label: 'GPS correcto', color: 'text-blue-300 bg-blue-500/10' };
    if (gpsAccuracy <= 100) return { label: 'GPS débil', color: 'text-amber-300 bg-amber-500/10' };
    return { label: 'Sin señal fiable', color: 'text-red-300 bg-red-500/10' };
  }, [gpsAccuracy, gpsRejection, gpsSignalAgeSeconds, status]);

  const completedSplitIndex = liveSplit.lastCompleted?.index ?? 0;
  useEffect(() => {
    if (status !== 'recording' || completedSplitIndex <= lastAnnouncedSplitRef.current) return;
    lastAnnouncedSplitRef.current = completedSplitIndex;
    setAnnouncedSplitIndex(completedSplitIndex);
    navigator.vibrate?.([150, 70, 150]);
  }, [completedSplitIndex, status]);

  useEffect(() => {
    if (announcedSplitIndex == null) return;
    const timer = window.setTimeout(() => setAnnouncedSplitIndex(null), 8_000);
    return () => window.clearTimeout(timer);
  }, [announcedSplitIndex]);

  useEffect(() => {
    if (!navigation || navigation.completedM <= navigationFloorM) return;
    const floorUpdate = window.setTimeout(() => setNavigationFloorM(navigation.completedM), 0);
    return () => window.clearTimeout(floorUpdate);
  }, [navigation, navigationFloorM]);

  useEffect(() => {
    if (status !== 'recording' || !navigation || !plannedRoute) return;
    const speak = (message: string) => {
      if (!voiceGuidance || !('speechSynthesis' in window)) return;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(message);
      utterance.lang = 'es-ES';
      utterance.rate = 1.05;
      window.speechSynthesis.speak(utterance);
    };
    if (navigation.offRouteM > 75) {
      if (rejoinTurn) {
        const recoveryStage = turnAlertStage(rejoinTurn.distanceM);
        const previousRecoveryAlert = announcedRecoveryTurnRef.current;
        const recoveryStageRank: Record<TurnAlertStage, number> = { prepare: 1, near: 2, now: 3 };
        if (
          recoveryStage
          && (
            previousRecoveryAlert?.turnIndex !== rejoinTurn.turnIndex
            || recoveryStageRank[recoveryStage] > recoveryStageRank[previousRecoveryAlert.stage]
          )
        ) {
          announcedRecoveryTurnRef.current = {
            turnIndex: rejoinTurn.turnIndex,
            stage: recoveryStage,
          };
          navigator.vibrate?.(recoveryStage === 'now' ? [220, 80, 220] : [140]);
          speak(turnAlertMessage(rejoinTurn, recoveryStage));
          return;
        }
      }
      if (Date.now() - lastOffRouteAlertRef.current > 30_000) {
        lastOffRouteAlertRef.current = Date.now();
        navigator.vibrate?.([180, 90, 180, 90, 180]);
        if (rejoinRoute.path) {
          speak(
            `Fuera de ruta. Reenganche por caminos calculado, `
            + `${Math.round(rejoinRemainingM)} metros hasta el track.`,
          );
        } else {
          speak(
            `Fuera de ruta, a ${Math.round(navigation.offRouteM)} metros del track. `
            + `Vuelve rumbo ${cardinalForBearing(navigation.bearingToRejoinDeg)}.`,
          );
        }
      }
      return;
    }
    const alertStage = upcomingTurn ? turnAlertStage(upcomingTurn.distanceM) : null;
    const previousAlert = announcedTurnRef.current;
    const stageRank: Record<TurnAlertStage, number> = { prepare: 1, near: 2, now: 3 };
    if (
      upcomingTurn
      && upcomingTurn.direction !== 'continue'
      && alertStage
      && (
        previousAlert?.turnIndex !== upcomingTurn.turnIndex
        || stageRank[alertStage] > stageRank[previousAlert.stage]
      )
    ) {
      announcedTurnRef.current = { turnIndex: upcomingTurn.turnIndex, stage: alertStage };
      navigator.vibrate?.(
        alertStage === 'now'
          ? [220, 80, 220, 80, 220]
          : alertStage === 'near'
            ? [160, 80, 160]
            : [120],
      );
      speak(turnAlertMessage(upcomingTurn, alertStage));
    }
  }, [
    navigation,
    plannedRoute,
    rejoinRemainingM,
    rejoinRoute.path,
    rejoinTurn,
    status,
    upcomingTurn,
    voiceGuidance,
  ]);

  useEffect(() => {
    announcedRecoveryTurnRef.current = null;
  }, [rejoinRoute.path]);

  useEffect(() => {
    const currentPoint = points.at(-1);
    if (!liveSession || !currentPoint || status !== 'recording') return;
    if (Date.now() - lastLiveUpdateRef.current < 10_000) return;
    lastLiveUpdateRef.current = Date.now();
    const supabase = createClient();
    if (!supabase) return;
    void supabase
      .from('live_sessions')
      .update({
        latitude: currentPoint.latitude,
        longitude: currentPoint.longitude,
        elevation_m: currentPoint.elevation,
        distance_m: metrics.distanceM,
        battery_percent: settings.sportType === 'ebike' ? battery.batteryPercent : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', liveSession.id);
  }, [battery.batteryPercent, lastGpsFixAt, liveSession, metrics.distanceM, points, settings.sportType, status]);

  const beginGpsWatch = useCallback((recovering = false) => {
    if (!('geolocation' in navigator)) {
      setError('Este dispositivo no ofrece ubicación GPS.');
      setStatus('error');
      setGpsRecoveryActive(false);
      void releaseWakeLock();
      return;
    }
    clearGpsWatch();
    gpsWatchStartedAtRef.current = Date.now();
    if (!recovering || !lastAcceptedPointRef.current) setStatus('requesting');
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const candidate = pointFromPosition(position);
        setGpsAccuracy(candidate.accuracy);
        const assessment = assessRidePoint(lastAcceptedPointRef.current, candidate);
        const usableFix = gpsAssessmentKeepsSignalAlive(assessment.reason);
        if (!usableFix) {
          setGpsRejection(assessment.reason);
          return;
        }
        setLastGpsFixAt(Date.now());
        setGpsSignalAgeSeconds(0);
        setGpsRejection(null);
        setGpsRecoveryActive(false);
        setError('');
        setStatus('recording');
        if (!assessment.accepted) return;
        lastAcceptedPointRef.current = candidate;
        setPoints((current) => [...current, candidate]);
      },
      (gpsError) => {
        const message = gpsError.code === 1
          ? 'Necesitamos permiso de ubicación para grabar. Puedes usar el modo demo mientras tanto.'
          : 'Se ha perdido temporalmente la señal GPS. La grabación seguirá intentando recuperarla.';
        setError(message);
        if (gpsError.code === 1) {
          setGpsRecoveryActive(false);
          setLocationPermission('denied');
          if (lastAcceptedPointRef.current) {
            if (recordingStartedAtRef.current != null) {
              const nextDuration = durationBaseRef.current
                + Math.floor((Date.now() - recordingStartedAtRef.current) / 1000);
              durationBaseRef.current = nextDuration;
              setDurationSeconds(nextDuration);
            }
            recordingStartedAtRef.current = null;
            stopWatch();
            void releaseWakeLock();
            setStatus('paused');
          } else {
            clearGpsWatch();
            recordingStartedAtRef.current = null;
            void releaseWakeLock();
            setStatus('error');
          }
          return;
        }
        setGpsRecoveryActive(Boolean(lastAcceptedPointRef.current));
        setStatus(lastAcceptedPointRef.current ? 'recording' : 'requesting');
      },
      { enableHighAccuracy: true, maximumAge: 1_000, timeout: 20_000 },
    );
  }, [clearGpsWatch, releaseWakeLock, stopWatch]);

  const restartGpsWatch = useCallback((staleAfterMs: number) => {
    const now = Date.now();
    if (!shouldRestartGpsWatch({
      recording: status === 'recording' || status === 'requesting',
      demo: isDemoRef.current,
      lastFixAt: lastGpsFixAt,
      watchStartedAt: gpsWatchStartedAtRef.current,
      lastRestartAt: lastGpsRestartAtRef.current,
      now,
      staleAfterMs,
    })) return;
    lastGpsRestartAtRef.current = now;
    setGpsRecoveryActive(true);
    beginGpsWatch(true);
  }, [beginGpsWatch, lastGpsFixAt, status]);

  useEffect(() => {
    restartGpsWatch(GPS_STALE_RESTART_MS);
  }, [gpsSignalAgeSeconds, restartGpsWatch]);

  useEffect(() => {
    const restoreFieldServices = () => {
      if (document.visibilityState !== 'visible' || status !== 'recording') return;
      void requestWakeLock();
      restartGpsWatch(GPS_RESUME_RESTART_MS);
    };
    document.addEventListener('visibilitychange', restoreFieldServices);
    return () => document.removeEventListener('visibilitychange', restoreFieldServices);
  }, [requestWakeLock, restartGpsWatch, status]);

  const start = (demo = false) => {
    setRideFocused(false);
    setPoints([]);
    setDurationSeconds(0);
    setError('');
    setTitle('');
    setBatteryEnd(settings.batteryStart);
    setLiveSession(null);
    setLiveStatus('idle');
    setLiveError('');
    setGpsAccuracy(null);
    setLastGpsFixAt(0);
    setGpsSignalAgeSeconds(0);
    setGpsRejection(null);
    setGpsRecoveryActive(false);
    lastGpsRestartAtRef.current = 0;
    gpsWatchStartedAtRef.current = 0;
    setNavigationFloorM(0);
    setFinishArmed(false);
    setWeatherSamples([]);
    setAnnouncedSplitIndex(null);
    lastAnnouncedSplitRef.current = 0;
    lastAcceptedPointRef.current = null;
    startedAtRef.current = Date.now();
    draftIdRef.current = crypto.randomUUID();
    durationBaseRef.current = 0;
    recordingStartedAtRef.current = Date.now();
    isDemoRef.current = demo;
    setDemoRide(demo);
    setRecoverableDraft(null);
    void requestWakeLock();
    if (demo) {
      const firstDemoPoint = buildDemoPoint(0);
      lastAcceptedPointRef.current = firstDemoPoint;
      setPoints([firstDemoPoint]);
      demoIndexRef.current = 1;
      demoTimerRef.current = setInterval(() => {
        const index = demoIndexRef.current;
        setPoints((current) => [...current, buildDemoPoint(index)]);
        demoIndexRef.current += 1;
      }, 1000);
      setStatus('recording');
    } else {
      beginGpsWatch();
    }
  };

  const pause = () => {
    persistCurrentDraft(true);
    if (!isDemoRef.current && recordingStartedAtRef.current != null) {
      const nextDuration = durationBaseRef.current
        + Math.floor((Date.now() - recordingStartedAtRef.current) / 1000);
      durationBaseRef.current = nextDuration;
      setDurationSeconds(nextDuration);
    } else {
      durationBaseRef.current = durationSeconds;
    }
    recordingStartedAtRef.current = null;
    setGpsRecoveryActive(false);
    stopWatch();
    void releaseWakeLock();
    setStatus('paused');
  };

  const resume = () => {
    durationBaseRef.current = durationSeconds;
    recordingStartedAtRef.current = Date.now();
    setGpsRecoveryActive(false);
    void requestWakeLock();
    if (isDemoRef.current) {
      demoTimerRef.current = setInterval(() => {
        const index = demoIndexRef.current;
        setPoints((current) => [...current, buildDemoPoint(index)]);
        demoIndexRef.current += 1;
      }, 1000);
      setStatus('recording');
    } else {
      beginGpsWatch();
    }
  };

  const trackingUrl = liveSession
    ? `${typeof window === 'undefined' ? '' : window.location.origin}/seguimiento/${liveSession.shareToken}`
    : '';

  const shareTrackingLink = async (session = liveSession) => {
    if (!session) return;
    const url = `${window.location.origin}/seguimiento/${session.shareToken}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Sigue mi salida en directo',
          text: 'Esta es mi última posición compartida desde E-nduro Ebiketracks.',
          url,
        });
      } else {
        await navigator.clipboard.writeText(url);
        setLiveError('Enlace copiado.');
      }
    } catch (shareError) {
      if (shareError instanceof DOMException && shareError.name === 'AbortError') return;
      setLiveError('No se pudo abrir el menú de compartir. Copia el enlace manualmente.');
    }
  };

  const startLiveTracking = async () => {
    const supabase = createClient();
    if (!supabase) return;
    setLiveStatus('starting');
    setLiveError('');
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLiveStatus('error');
      setLiveError('Inicia sesión para compartir tu ubicación en directo.');
      return;
    }
    const currentPoint = points.at(-1);
    const { data, error: liveInsertError } = await supabase
      .from('live_sessions')
      .insert({
        user_id: user.id,
        title: plannedRoute?.name || 'Salida en directo',
        latitude: currentPoint?.latitude ?? null,
        longitude: currentPoint?.longitude ?? null,
        elevation_m: currentPoint?.elevation ?? null,
        distance_m: metrics.distanceM,
        battery_percent: settings.sportType === 'ebike' ? battery.batteryPercent : null,
      })
      .select('id,share_token')
      .single();
    if (liveInsertError || !data) {
      setLiveStatus('error');
      setLiveError('No hemos podido iniciar el seguimiento.');
      return;
    }
    const session = { id: data.id, shareToken: data.share_token };
    setLiveSession(session);
    setLiveStatus('active');
    lastLiveUpdateRef.current = Date.now();
    await shareTrackingLink(session);
  };

  const stopLiveTracking = async () => {
    if (!liveSession) return;
    const supabase = createClient();
    if (supabase) {
      await supabase
        .from('live_sessions')
        .update({
          status: 'ended',
          ended_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', liveSession.id);
    }
    setLiveStatus('idle');
    setLiveSession(null);
  };

  const finish = () => {
    persistCurrentDraft(true);
    setRideFocused(false);
    setFinishArmed(false);
    if (!isDemoRef.current && recordingStartedAtRef.current != null) {
      const nextDuration = durationBaseRef.current
        + Math.floor((Date.now() - recordingStartedAtRef.current) / 1000);
      durationBaseRef.current = nextDuration;
      setDurationSeconds(nextDuration);
    }
    recordingStartedAtRef.current = null;
    setGpsRecoveryActive(false);
    stopWatch();
    void releaseWakeLock();
    void stopLiveTracking();
    const activityType = settings.sportType === 'ebike' ? 'e-bike' : 'MTB';
    setTitle(plannedRoute?.name
      ? `${plannedRoute.name} · ${activityType}`
      : `Salida ${activityType} · ${new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' }).format(new Date())}`);
    setBatteryEnd(battery.batteryPercent);
    setStatus('finished');
  };

  const recoverDraft = () => {
    if (!recoverableDraft) return;
    draftIdRef.current = recoverableDraft.id;
    startedAtRef.current = recoverableDraft.startedAt;
    durationBaseRef.current = recoverableDraft.durationSeconds;
    recordingStartedAtRef.current = null;
    isDemoRef.current = recoverableDraft.isDemo;
    setDemoRide(recoverableDraft.isDemo);
    demoIndexRef.current = recoverableDraft.points.length;
    setSettings(recoverableDraft.settings);
    setPoints(recoverableDraft.points);
    lastAcceptedPointRef.current = recoverableDraft.points.at(-1) ?? null;
    setDurationSeconds(recoverableDraft.durationSeconds);
    setLiveSession(recoverableDraft.liveSession ?? null);
    setLiveStatus(recoverableDraft.liveSession ? 'active' : 'idle');
    setNavigationFloorM(recoverableDraft.navigationCompletedM ?? 0);
    setWeatherSamples(recoverableDraft.weatherSamples ?? []);
    setAnnouncedSplitIndex(null);
    lastAnnouncedSplitRef.current = calculateLiveRideSplitState(
      recoverableDraft.points,
    ).lastCompleted?.index ?? 0;
    setGpsRecoveryActive(false);
    lastGpsRestartAtRef.current = 0;
    if (recoverableDraft.plannedRouteId) {
      setPlannedRoute(getPlannedRoute(recoverableDraft.plannedRouteId));
    }
    setRecoverableDraft(null);
    setStatus('paused');
  };

  const discardDraft = () => {
    const abandonedLiveSession = recoverableDraft?.liveSession;
    if (abandonedLiveSession) {
      const supabase = createClient();
      void supabase?.from('live_sessions').update({
        status: 'ended',
        ended_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', abandonedLiveSession.id);
    }
    clearRideDraft();
    setRecoverableDraft(null);
  };

  const importGpx = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const route = parseNavigationGpx(await file.text(), file.name);
      savePlannedRoute(route);
      setPlannedRoute(route);
      setNavigationFloorM(0);
      setError('');
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : 'No hemos podido leer este GPX.');
    } finally {
      event.target.value = '';
    }
  };

  const save = async () => {
    const now = Date.now();
    const id = draftIdRef.current ?? crypto.randomUUID();
    const actualEnergyUsedWh = settings.sportType === 'ebike'
      ? settings.batteryCapacityWh * Math.max(0, settings.batteryStart - batteryEnd) / 100
      : null;
    const activity: RideActivity = {
      id,
      title: title.trim() || (settings.sportType === 'ebike' ? 'Salida e-bike' : 'Salida MTB'),
      sportType: settings.sportType,
      startedAt: new Date(startedAtRef.current ?? now).toISOString(),
      endedAt: new Date(now).toISOString(),
      durationSeconds,
      ...metrics,
      batteryStart: settings.sportType === 'ebike' ? settings.batteryStart : null,
      batteryEnd: settings.sportType === 'ebike' ? batteryEnd : null,
      batteryCapacityWh: settings.sportType === 'ebike' ? settings.batteryCapacityWh : null,
      assistMode: settings.sportType === 'ebike' ? settings.assistMode : null,
      energyUsedWh: actualEnergyUsedWh,
      points,
      weatherSamples,
      segmentEfforts: matchCompetitiveSegments(points),
      privacy: 'private',
      syncStatus: 'local',
    };
    await saveActivity(activity);
    clearRideDraft();
    await stopLiveTracking();
    await syncActivity(activity);
    router.push('/actividades');
  };

  const recordWeatherSample = useCallback((sample: RideWeatherSample) => {
    setWeatherSamples((current) => {
      const next = [...current, sample];
      return next.length > 200 ? next.slice(-200) : next;
    });
  }, []);

  const announceConditionAlert = useCallback((alert: LiveRideConditionAlert) => {
    navigator.vibrate?.(
      alert.risk === 'red'
        ? [240, 100, 240, 100, 240]
        : [160, 90, 160],
    );
    if (!voiceGuidance || !('speechSynthesis' in window)) return;
    const utterance = new SpeechSynthesisUtterance(alert.message);
    utterance.lang = 'es-ES';
    utterance.rate = 1.05;
    window.speechSynthesis.speak(utterance);
  }, [voiceGuidance]);

  const active = status === 'recording' || status === 'paused' || status === 'requesting';
  const activeDisplayMode: RideDisplayMode = active ? displayMode : 'basic';
  const changeDisplayMode = (mode: RideDisplayMode) => {
    window.localStorage.setItem(RIDE_DISPLAY_MODE_STORAGE_KEY, mode);
    window.dispatchEvent(new Event(RIDE_DISPLAY_MODE_EVENT));
  };

  return (
    <main className={`min-h-screen bg-slate-950 text-white ${
      rideFocused
        ? 'fixed inset-0 z-[2000] overflow-y-auto overscroll-contain pb-24'
        : 'pb-28 md:pb-16'
    }`}>
      <div className={`mx-auto max-w-6xl px-4 sm:px-6 ${rideFocused ? 'ride-focus-shell py-3' : 'py-6 md:py-10'}`}>
        <header className={`mb-6 flex items-end justify-between gap-4 ${rideFocused ? 'ride-focus-header' : ''}`}>
          <div>
            <p className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-orange-400">
              <Radio className={`h-4 w-4 ${status === 'recording' ? 'animate-pulse' : ''}`} />
              Ride recorder
            </p>
            <h1 className={`${rideFocused ? 'text-xl' : 'text-3xl sm:text-4xl'} font-black tracking-tight`}>
              {rideFocused ? plannedRoute?.name ?? 'Salida en curso' : 'Graba tu salida'}
            </h1>
            {!rideFocused && (
              <p className="mt-2 max-w-xl text-sm text-slate-400">GPS, desnivel y autonomía e-bike. Se guarda incluso sin cobertura.</p>
            )}
          </div>
          {active && (
            <div className="flex flex-col items-end gap-2">
              <span className={`rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-widest ${
                status === 'paused' ? 'bg-amber-500/15 text-amber-300' : 'bg-red-500/15 text-red-400'
              }`}>
                {status === 'paused' ? 'En pausa' : status === 'requesting' ? 'Buscando GPS' : 'Grabando'}
              </span>
              {gpsQuality && (
                <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[9px] font-black uppercase ${gpsQuality.color}`}>
                  <LocateFixed className="h-3 w-3" />
                  {gpsQuality.label} · ±{Math.round(gpsAccuracy ?? 0)} m
                </span>
              )}
            </div>
          )}
        </header>

        {active && (
          <RideDisplayToolbar
            mode={displayMode}
            focused={rideFocused}
            onModeChange={changeDisplayMode}
            onFocusedChange={setRideFocused}
          />
        )}

        {active && gpsRecoveryActive && (
          <div
            role="status"
            className="mb-4 flex items-start gap-3 rounded-2xl border border-amber-400/25 bg-amber-400/10 px-4 py-3 text-amber-100"
          >
            <LocateFixed className="mt-0.5 h-5 w-5 shrink-0 animate-pulse" />
            <div>
              <p className="text-xs font-black uppercase tracking-wider">Reconectando GPS</p>
              <p className="mt-1 text-[10px] leading-relaxed text-amber-100/70">
                La salida sigue activa y está guardada hasta el último punto válido.
              </p>
            </div>
          </div>
        )}

        <div className={`grid gap-5 lg:grid-cols-[1.15fr_.85fr] ${rideFocused ? 'ride-focus-grid' : ''}`}>
          <section className="space-y-5">
            <RideNavigationMap
              points={points}
              plannedPoints={plannedRoute?.points}
              active={active}
              offRouteM={navigation?.offRouteM}
              rejoinPoint={navigation && navigation.offRouteM > 75
                ? {
                    latitude: navigation.rejoinLatitude,
                    longitude: navigation.rejoinLongitude,
                  }
                : null}
              rejoinPoints={rejoinRoute.path?.points}
              navigationCue={navigation
                ? navigation.offRouteM > 75
                  ? {
                      label: rejoinTurn?.label
                        ?? (rejoinRoute.status === 'loading'
                          ? 'Calculando reenganche'
                          : rejoinRoute.path
                            ? 'Reenganche por caminos'
                            : 'Volver al track'),
                      distanceM: rejoinTurn?.distanceM ?? rejoinRemainingM,
                      offRoute: true,
                      bearingDeg: rejoinRoute.path ? null : navigation.bearingToRejoinDeg,
                    }
                  : upcomingTurn
                    ? {
                        label: upcomingTurn.label,
                        distanceM: upcomingTurn.distanceM,
                        offRoute: false,
                      }
                    : null
                : null}
              offlineMap={activeOfflineMap}
              focused={rideFocused}
            />
            {plannedRoute && (
              <div className={`rounded-2xl border p-4 ${
                navigation && navigation.offRouteM > 75
                  ? 'border-red-500/30 bg-red-500/10'
                  : 'border-blue-500/25 bg-blue-500/5'
              }`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-blue-300">
                      <Navigation className="h-4 w-4 fill-current" /> Siguiendo ruta
                    </p>
                    <h2 className="mt-1 truncate font-black">{plannedRoute.name}</h2>
                    {activeOfflineSummary && (
                      <p className="mt-1 text-[9px] font-black uppercase tracking-wider text-blue-300">
                        Mapa offline preparado · {activeOfflineSummary.trails} caminos · {activeOfflineSummary.pois} puntos útiles
                      </p>
                    )}
                  </div>
                  {navigation && navigation.offRouteM > 75 && (
                    <span className="flex shrink-0 items-center gap-1 rounded-full bg-red-500 px-2.5 py-1 text-[9px] font-black uppercase">
                      <AlertTriangle className="h-3 w-3" /> Fuera de ruta
                    </span>
                  )}
                </div>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-800">
                  <div className="h-full rounded-full bg-blue-400 transition-all" style={{ width: `${securedNavigation.progressPercent}%` }} />
                </div>
                <TurnGuidanceHud
                  instruction={upcomingTurn}
                  offRouteM={navigation?.offRouteM ?? 0}
                  rejoinBearingDeg={rejoinRoute.path ? null : navigation?.bearingToRejoinDeg}
                  recovery={navigation && navigation.offRouteM > 75
                    ? {
                        status: rejoinRoute.status,
                        routed: Boolean(rejoinRoute.path),
                        distanceM: rejoinRemainingM,
                        instruction: rejoinTurn,
                      }
                    : null}
                  voiceEnabled={voiceGuidance}
                  onVoiceChange={setVoiceGuidance}
                />
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-[9px] uppercase text-slate-500">Restante</p>
                    <p className="mt-1 text-sm font-black">{(securedNavigation.remainingM / 1000).toFixed(1)} km</p>
                  </div>
                  <div>
                    <p className="text-[9px] uppercase text-slate-500">Subida pendiente</p>
                    <p className="mt-1 text-sm font-black">{Math.round(navigation?.remainingGainM ?? plannedRoute.elevationGainM)} m</p>
                  </div>
                  <div>
                    <p className="text-[9px] uppercase text-slate-500">Desvío</p>
                    <p className={`mt-1 text-sm font-black ${(navigation?.offRouteM ?? 0) > 75 ? 'text-red-400' : 'text-emerald-400'}`}>
                      {navigation ? `${Math.round(navigation.offRouteM)} m` : '—'}
                    </p>
                  </div>
                </div>
                {settings.sportType === 'ebike' && navigation && remainingBattery && (
                  <p className={`mt-3 flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold ${
                    remainingBattery.state === 'safe'
                      ? 'bg-emerald-500/10 text-emerald-300'
                      : remainingBattery.state === 'tight'
                        ? 'bg-amber-500/10 text-amber-300'
                        : 'bg-red-500/10 text-red-300'
                  }`}>
                    <BatteryCharging className="h-4 w-4" />
                    {remainingBattery.state === 'safe'
                      ? `Llegada estimada con ${Math.round(remainingBattery.arrivalPercent)}% de batería`
                      : remainingBattery.state === 'tight'
                        ? `Batería justa: llegarías con ${Math.round(remainingBattery.arrivalPercent)}%`
                        : `Batería insuficiente para conservar ${remainingBattery.reservePercent}% de reserva`}
                  </p>
                )}
                {activeDisplayMode === 'pro' && plannedRoute.reference && (
                  <div className="mt-3 rounded-xl border border-orange-500/20 bg-orange-500/5 px-3 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-orange-300">
                          <RotateCcw className="h-3.5 w-3.5" /> Ghost personal
                        </p>
                        <p className={`mt-1 text-lg font-black ${
                          ghost?.deltaSeconds != null && ghost.deltaSeconds <= 0 ? 'text-emerald-300' : 'text-amber-300'
                        }`}>
                          {navigation && navigation.offRouteM > 100
                            ? 'Comparación pausada'
                            : ghost
                              ? `${formatGap(ghost.deltaSeconds)} ${ghost.deltaSeconds <= 0 ? 'por delante' : 'por detrás'}`
                              : 'Buscando tu ritmo de referencia…'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[9px] uppercase text-slate-600">Tu referencia</p>
                        <p className="mt-1 text-xs font-black">{formatDuration(plannedRoute.reference.durationSeconds)}</p>
                        {ghost?.projectedFinishSeconds != null && (
                          <p className="mt-1 text-[9px] text-slate-500">Proyección {formatDuration(ghost.projectedFinishSeconds)}</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Metric icon={Timer} label="Tiempo" value={formatDuration(durationSeconds)} />
              <Metric icon={Mountain} label="Distancia" value={(metrics.distanceM / 1000).toFixed(2)} unit="km" />
              <Metric icon={Gauge} label="Velocidad" value={currentSpeedKmh.toFixed(1)} unit="km/h" />
              {(activeDisplayMode === 'pro' || settings.sportType === 'mtb') && (
                <Metric icon={Mountain} label="Desnivel +" value={Math.round(metrics.elevationGainM).toString()} unit="m" />
              )}
              {activeDisplayMode === 'pro' && (
                <Metric icon={Gauge} label="Media" value={metrics.averageSpeedKmh.toFixed(1)} unit="km/h" />
              )}
              {activeDisplayMode === 'pro' && (
                <Metric icon={Zap} label="Máxima" value={metrics.maxSpeedKmh.toFixed(1)} unit="km/h" />
              )}
              {settings.sportType === 'ebike' && (
                <Metric icon={BatteryCharging} label="Batería est." value={`${battery.batteryPercent}`} unit="%" />
              )}
            </div>
            {active && points.length > 1 && (
              <LiveSplitCard
                mode={activeDisplayMode}
                state={liveSplit}
                announcement={
                  announcedSplitIndex === liveSplit.lastCompleted?.index
                    ? liveSplit.lastCompleted
                    : null
                }
              />
            )}
            <LiveRideConditions
              active={active && status !== 'requesting'}
              routeId={plannedRoute?.id}
              routeName={plannedRoute?.name}
              routePoints={plannedRoute?.points ?? points}
              completedM={plannedRoute ? securedNavigation.completedM : metrics.distanceM}
              remainingM={plannedRoute ? securedNavigation.remainingM : null}
              averageSpeedKmh={metrics.averageSpeedKmh}
              movingSeconds={metrics.movingSeconds}
              sportType={settings.sportType}
              displayMode={activeDisplayMode}
              onSample={recordWeatherSample}
              onAlert={announceConditionAlert}
            />

            {settings.sportType === 'ebike' && active && (activeDisplayMode === 'pro' || !plannedRoute) && (
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Autonomía estimada</p>
                    <p className="mt-1 text-2xl font-black">{battery.remainingRangeKm.toFixed(0)} km</p>
                  </div>
                  <p className="max-w-48 text-right text-xs text-slate-400">
                    Cálculo provisional en modo {settings.assistMode}. Mejorará con tus salidas.
                  </p>
                </div>
              </div>
            )}
            {active && (activeDisplayMode === 'pro' || liveSession) && (
              <div className={`rounded-2xl border p-4 ${
                liveSession ? 'border-blue-500/25 bg-blue-500/5' : 'border-white/10 bg-slate-900/50'
              }`}>
                <div className="flex items-start gap-3">
                  <ShieldCheck className={`mt-0.5 h-5 w-5 shrink-0 ${liveSession ? 'text-blue-400' : 'text-slate-500'}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-black">{liveSession ? 'Seguimiento en vivo activo' : 'Comparte tu seguridad'}</p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-500">
                      {liveSession
                        ? 'El enlace muestra tu última posición, batería y distancia. Solo accede quien lo recibe.'
                        : 'Envía un enlace privado para que alguien pueda seguir tu última posición.'}
                    </p>
                    {liveSession ? (
                      <div className="mt-3 space-y-2">
                        <input value={trackingUrl} readOnly aria-label="Enlace de seguimiento"
                          className="w-full truncate rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-[10px] text-slate-400" />
                        <div className="flex gap-2">
                          <button onClick={() => shareTrackingLink()} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-500 px-3 py-2.5 text-xs font-black text-white">
                            <Share2 className="h-4 w-4" /> Compartir enlace
                          </button>
                          <button onClick={() => { void stopLiveTracking(); }} className="rounded-xl border border-white/10 px-3 py-2.5 text-xs font-bold text-slate-400">
                            Detener
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => { void startLiveTracking(); }}
                        disabled={liveStatus === 'starting' || status === 'requesting'}
                        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-500 px-3 py-3 text-xs font-black text-white disabled:opacity-40"
                      >
                        <Share2 className="h-4 w-4" />
                        {liveStatus === 'starting' ? 'Preparando…' : 'Compartir seguimiento'}
                      </button>
                    )}
                    {liveError && (
                      <p className={`mt-2 text-[10px] ${liveStatus === 'error' ? 'text-red-400' : 'text-blue-300'}`}>
                        {liveError}
                        {liveStatus === 'error' && liveError.includes('Inicia sesión') && (
                          <> <a href="/auth?next=/grabar" className="font-black underline">Entrar</a></>
                        )}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </section>

          <aside className="rounded-3xl border border-white/10 bg-slate-900/50 p-5 sm:p-6">
            {!active && status !== 'finished' ? (
              <div className="space-y-6">
                {recoverableDraft && (
                  <div className="rounded-2xl border border-amber-400/25 bg-amber-400/10 p-4">
                    <div className="flex items-start gap-3">
                      <RotateCcw className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-black text-amber-200">Salida sin terminar</p>
                        <p className="mt-1 text-xs text-slate-400">
                          {formatDuration(recoverableDraft.durationSeconds)} · {(calculateRideMetrics(recoverableDraft.points).distanceM / 1000).toFixed(2)} km
                        </p>
                        <div className="mt-3 flex gap-2">
                          <button onClick={recoverDraft} className="rounded-lg bg-amber-300 px-3 py-2 text-[10px] font-black uppercase text-slate-950">
                            Recuperar
                          </button>
                          <button onClick={discardDraft} className="rounded-lg p-2 text-slate-500 hover:text-red-400" aria-label="Descartar salida sin terminar">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <h2 className="text-lg font-black">Configura la bici</h2>
                  <p className="mt-1 text-xs text-slate-500">Podrás cambiar estos datos antes de cada salida.</p>
                </div>

                {plannedRoute && (
                  <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4">
                    <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-blue-300">
                      <Flag className="h-4 w-4" /> Ruta preparada
                    </p>
                    <p className="mt-2 font-black">{plannedRoute.name}</p>
                    <p className="mt-1 text-xs text-slate-400">{plannedRoute.distanceKm.toFixed(1)} km · +{Math.round(plannedRoute.elevationGainM)} m · {plannedRoute.difficulty}</p>
                    {plannedRoute.reference && (
                      <p className="mt-2 flex items-center gap-1.5 text-[10px] font-bold text-orange-300">
                        <RotateCcw className="h-3.5 w-3.5" /> Tu tiempo: {formatDuration(plannedRoute.reference.durationSeconds)}
                      </p>
                    )}
                    {settings.sportType === 'ebike' && plannedBattery && (
                      <div className={`mt-3 rounded-xl border px-3 py-3 ${
                        plannedBattery.state === 'safe'
                          ? 'border-emerald-500/20 bg-emerald-500/10'
                          : plannedBattery.state === 'tight'
                            ? 'border-amber-500/25 bg-amber-500/10'
                            : 'border-red-500/25 bg-red-500/10'
                      }`}>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-slate-400">
                              <BatteryCharging className="h-3.5 w-3.5" /> Predicción personal
                            </p>
                            <p className="mt-1 text-sm font-black">
                              {plannedBattery.state === 'safe'
                                ? `Llegarías con ~${Math.round(plannedBattery.arrivalPercent)}%`
                                : plannedBattery.state === 'tight'
                                  ? `Margen justo: ~${Math.round(plannedBattery.arrivalPercent)}% al llegar`
                                  : `Faltan ~${Math.ceil(Math.abs(plannedBattery.marginWh))} Wh para mantener reserva`}
                            </p>
                          </div>
                          <span className="shrink-0 rounded-full bg-slate-950/50 px-2 py-1 text-[9px] font-black uppercase text-slate-400">
                            {batteryModel.confidence === 'high' ? 'Alta' : batteryModel.confidence === 'medium' ? 'Media' : 'Inicial'}
                          </span>
                        </div>
                        <p className="mt-2 text-[10px] leading-relaxed text-slate-400">
                          {plannedBattery.adjustedWhPerKm.toFixed(1)} Wh/km · reserva del {plannedBattery.reservePercent}% · {batteryModel.sampleCount > 0
                            ? `${batteryModel.sampleCount} ${batteryModel.sampleCount === 1 ? 'salida analizada' : 'salidas analizadas'}`
                            : 'estimación conservadora hasta tener historial'}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                <RideReadinessCard
                  locationPermission={locationPermission}
                  storageProtected={storageProtected}
                  online={online}
                  hasRoute={Boolean(plannedRoute)}
                  hasOfflineMap={Boolean(activeOfflineMap)}
                />

                <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-950 p-1.5">
                  {(['ebike', 'mtb'] as SportType[]).map((sport) => (
                    <button key={sport} onClick={() => setSettings({ ...settings, sportType: sport })}
                      className={`flex items-center justify-center gap-2 rounded-xl py-3 text-xs font-black uppercase ${
                        settings.sportType === sport ? 'bg-orange-500 text-white' : 'text-slate-500'
                      }`}>
                      <Bike className="h-4 w-4" /> {sport === 'ebike' ? 'E-bike' : 'MTB'}
                    </button>
                  ))}
                </div>

                {settings.sportType === 'ebike' && (
                  <>
                    <label className="block text-xs font-bold text-slate-300">
                      Batería inicial: <span className="text-orange-400">{settings.batteryStart}%</span>
                      <input type="range" min="10" max="100" step="5" value={settings.batteryStart}
                        onChange={(event) => setSettings({ ...settings, batteryStart: Number(event.target.value) })}
                        className="mt-3 w-full accent-orange-500" />
                    </label>
                    <label className="block text-xs font-bold text-slate-300">
                      Capacidad
                      <select value={settings.batteryCapacityWh}
                        onChange={(event) => setSettings({ ...settings, batteryCapacityWh: Number(event.target.value) })}
                        className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-3 text-sm">
                        {[500, 625, 700, 750, 900].map((capacity) => <option key={capacity} value={capacity}>{capacity} Wh</option>)}
                      </select>
                    </label>
                    <div>
                      <p className="mb-2 text-xs font-bold text-slate-300">Asistencia</p>
                      <div className="grid grid-cols-4 gap-2">
                        {(['eco', 'trail', 'turbo', 'smart'] as AssistMode[]).map((mode) => (
                          <button key={mode} onClick={() => setSettings({ ...settings, assistMode: mode })}
                            className={`rounded-xl py-2.5 text-[10px] font-black uppercase ${
                              settings.assistMode === mode ? 'bg-white text-slate-950' : 'bg-slate-950 text-slate-500'
                            }`}>{mode}</button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
                {error && <p role="alert" className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300">{error}</p>}

                <button onClick={() => start(false)}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-orange-500 py-4 text-sm font-black uppercase tracking-wider shadow-lg shadow-orange-950/30 hover:bg-orange-400">
                  <LocateFixed className="h-5 w-5" /> {plannedRoute ? 'Iniciar navegación GPS' : 'Iniciar con GPS'}
                </button>
                <button onClick={() => start(true)}
                  className="w-full text-xs font-bold text-slate-500 underline decoration-slate-700 underline-offset-4 hover:text-slate-300">
                  Probar grabación en modo demo
                </button>
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 px-4 py-3 text-xs font-bold text-slate-400 hover:border-orange-500/40 hover:text-orange-300">
                  <Upload className="h-4 w-4" />
                  Importar ruta GPX
                  <input type="file" accept=".gpx,application/gpx+xml" onChange={importGpx} className="sr-only" />
                </label>
                <p className="flex items-center justify-center gap-2 text-[10px] text-slate-600">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Autoguardado y pantalla activa durante la ruta
                </p>
              </div>
            ) : status === 'finished' ? (
              <div className="space-y-5">
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-emerald-400">Salida terminada</p>
                  <h2 className="mt-2 text-2xl font-black">{(metrics.distanceM / 1000).toFixed(2)} km</h2>
                </div>
                {plannedRoute?.reference && (
                  <div className={`rounded-2xl border p-4 ${
                    securedNavigation.progressPercent >= 95
                      ? durationSeconds <= plannedRoute.reference.durationSeconds
                        ? 'border-emerald-500/25 bg-emerald-500/10'
                        : 'border-amber-500/25 bg-amber-500/10'
                      : 'border-white/10 bg-slate-950/60'
                  }`}>
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Reto personal</p>
                    {securedNavigation.progressPercent >= 95 ? (
                      <>
                        <p className="mt-2 text-xl font-black">
                          {durationSeconds <= plannedRoute.reference.durationSeconds
                            ? `${formatGap(durationSeconds - plannedRoute.reference.durationSeconds)} más rápido`
                            : `${formatGap(durationSeconds - plannedRoute.reference.durationSeconds)} más lento`}
                        </p>
                        <p className="mt-1 text-[10px] text-slate-500">Referencia {formatDuration(plannedRoute.reference.durationSeconds)}</p>
                      </>
                    ) : (
                      <>
                        <p className="mt-2 font-black">Ruta completada al {Math.round(securedNavigation.progressPercent)}%</p>
                        <p className="mt-1 text-[10px] text-slate-500">Completa al menos el 95% para registrar la comparación.</p>
                      </>
                    )}
                  </div>
                )}
                <label className="block text-xs font-bold text-slate-300">
                  Nombre de la actividad
                  <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120}
                    className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm outline-none focus:border-orange-500" />
                </label>
                {settings.sportType === 'ebike' && (
                  <label className="block rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-xs font-bold text-slate-300">
                    <span className="flex items-center justify-between">
                      Batería al terminar
                      <strong className="text-lg text-emerald-400">{batteryEnd}%</strong>
                    </span>
                    <input
                      type="range"
                      min="0"
                      max={settings.batteryStart}
                      step="1"
                      value={batteryEnd}
                      onChange={(event) => setBatteryEnd(Number(event.target.value))}
                      className="mt-3 w-full accent-emerald-400"
                    />
                    <span className="mt-2 block text-[10px] font-normal leading-relaxed text-slate-500">
                      Indica la lectura real de la bici para personalizar consumo y autonomía.
                    </span>
                  </label>
                )}
                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                  <p className="flex items-center gap-2 text-xs font-bold text-emerald-200">
                    <ShieldCheck className="h-4 w-4" /> Actividad privada
                  </p>
                  <p className="mt-2 text-[10px] leading-relaxed text-slate-500">
                    Solo tú podrás verla. Se sincroniza de forma segura entre tus dispositivos.
                  </p>
                </div>
                <button onClick={save}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 py-4 text-sm font-black uppercase text-slate-950 hover:bg-emerald-400">
                  <Save className="h-5 w-5" /> Guardar actividad
                </button>
                <button onClick={() => { clearRideDraft(); setStatus('idle'); }} className="w-full text-xs font-bold text-slate-500 hover:text-white">Descartar</button>
              </div>
            ) : (
              <div className="flex min-h-72 flex-col items-center justify-center text-center">
                <div className={`mb-5 grid h-24 w-24 place-items-center rounded-full border-4 ${
                  status === 'paused' ? 'border-amber-400/30 bg-amber-400/10' : 'border-red-500/30 bg-red-500/10'
                }`}>
                  <span className="text-xl font-black tabular-nums">{formatDuration(durationSeconds).slice(3)}</span>
                </div>
                <p className="mb-7 text-sm text-slate-400">
                  {status === 'requesting' ? 'Buscando señal GPS…' : status === 'paused' ? 'La ruta está en pausa' : 'Mantén el móvil bien sujeto'}
                </p>
                <div className="flex gap-3">
                  {status === 'paused' ? (
                    <button onClick={resume} className="grid h-16 w-16 place-items-center rounded-full bg-emerald-500 text-slate-950" aria-label="Reanudar">
                      <Play className="h-7 w-7 fill-current" />
                    </button>
                  ) : (
                    <button onClick={pause} disabled={status === 'requesting'} className="grid h-16 w-16 place-items-center rounded-full bg-amber-400 text-slate-950 disabled:opacity-40" aria-label="Pausar">
                      <Pause className="h-7 w-7 fill-current" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => finishArmed ? finish() : setFinishArmed(true)}
                    className={`grid h-16 min-w-16 place-items-center rounded-full px-3 text-white transition-all ${
                      finishArmed ? 'w-auto bg-red-500' : 'w-16 bg-red-500/80'
                    }`}
                    aria-label={finishArmed ? 'Confirmar fin de la actividad' : 'Preparar fin de la actividad'}
                  >
                    {finishArmed ? <span className="text-[10px] font-black uppercase">Confirmar fin</span> : <CircleStop className="h-7 w-7" />}
                  </button>
                </div>
                {finishArmed && (
                  <p role="status" className="mt-3 text-[10px] font-bold text-red-300">
                    Toca «Confirmar fin» antes de 5 segundos. Pausar no requiere confirmación.
                  </p>
                )}
              </div>
            )}
          </aside>
        </div>
      </div>
      {active && (
        <RideControlDock
          status={status === 'requesting' ? 'requesting' : status === 'paused' ? 'paused' : 'recording'}
          duration={formatDuration(durationSeconds)}
          finishArmed={finishArmed}
          onPause={pause}
          onResume={resume}
          onArmFinish={() => setFinishArmed(true)}
          onFinish={finish}
          focused={rideFocused}
        />
      )}
    </main>
  );
}
