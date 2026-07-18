'use client';

import { useEffect, useRef, useState } from 'react';
import type { RidePoint, SportType } from '@/lib/activities/types';
import type { PlannedRoutePoint } from '@/lib/navigation/types';
import type { RoutedPath, RouterProfile } from '@/lib/navigation/routing';
import {
  REJOIN_ROUTE_THRESHOLD_M,
  rejoinRetryDelayMs,
  shouldRequestRejoinRoute,
} from '@/lib/navigation/rejoin-routing';
import type { RejoinRouteAnchor } from '@/lib/navigation/rejoin-routing';

export type RejoinRouteStatus = 'idle' | 'loading' | 'ready' | 'offline' | 'error';

export interface RejoinRouteResult {
  status: RejoinRouteStatus;
  path: RoutedPath | null;
}

const EMPTY_RESULT: RejoinRouteResult = { status: 'idle', path: null };

export default function useRejoinRoute({
  active,
  online,
  offRouteM,
  currentPoint,
  targetPoint,
  sportType,
}: {
  active: boolean;
  online: boolean;
  offRouteM: number;
  currentPoint: RidePoint | null;
  targetPoint: PlannedRoutePoint | null;
  sportType: SportType;
}): RejoinRouteResult {
  const [result, setResult] = useState<RejoinRouteResult>(EMPTY_RESULT);
  const requestRef = useRef<AbortController | null>(null);
  const anchorRef = useRef<RejoinRouteAnchor | null>(null);
  const sequenceRef = useRef(0);
  const failureCountRef = useRef(0);
  const retryAtRef = useRef(0);

  const originLatitude = currentPoint?.latitude ?? null;
  const originLongitude = currentPoint?.longitude ?? null;
  const targetLatitude = targetPoint?.latitude ?? null;
  const targetLongitude = targetPoint?.longitude ?? null;

  useEffect(() => () => {
    requestRef.current?.abort();
  }, []);

  useEffect(() => {
    if (
      !active
      || offRouteM < REJOIN_ROUTE_THRESHOLD_M
      || originLatitude == null
      || originLongitude == null
      || targetLatitude == null
      || targetLongitude == null
    ) {
      requestRef.current?.abort();
      requestRef.current = null;
      anchorRef.current = null;
      failureCountRef.current = 0;
      retryAtRef.current = 0;
      const reset = window.setTimeout(() => setResult(EMPTY_RESULT), 0);
      return () => window.clearTimeout(reset);
    }

    if (!online) {
      requestRef.current?.abort();
      requestRef.current = null;
      const markOffline = window.setTimeout(() => {
        setResult((current) => ({ status: 'offline', path: current.path }));
      }, 0);
      return () => window.clearTimeout(markOffline);
    }

    const now = Date.now();
    if (now < retryAtRef.current) return;
    if (!shouldRequestRejoinRoute({
      previous: anchorRef.current,
      originLatitude,
      originLongitude,
      targetLatitude,
      targetLongitude,
      now,
    })) return;

    anchorRef.current = {
      originLatitude,
      originLongitude,
      targetLatitude,
      targetLongitude,
      requestedAt: now,
    };
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    const sequence = sequenceRef.current + 1;
    sequenceRef.current = sequence;
    const profile: RouterProfile = sportType === 'mtb' ? 'mtb' : 'trekking';
    const markLoading = window.setTimeout(() => {
      setResult((current) => ({ status: 'loading', path: current.path }));
    }, 0);

    void fetch('/api/route-path', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        profile,
        points: [
          { latitude: originLatitude, longitude: originLongitude, elevation: null },
          { latitude: targetLatitude, longitude: targetLongitude, elevation: null },
        ],
      }),
      signal: controller.signal,
    }).then(async (response) => {
      const retryAfterSeconds = Number(response.headers.get('Retry-After'));
      const retryAfterMs = Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
        ? retryAfterSeconds * 1_000
        : null;
      const payload = await response.json() as { route?: RoutedPath; error?: string };
      if (!response.ok || !payload.route?.points || payload.route.points.length < 2) {
        throw Object.assign(
          new Error(payload.error || 'No se encontró un camino de reenganche.'),
          { retryAfterMs },
        );
      }
      if (controller.signal.aborted || sequence !== sequenceRef.current) return;
      failureCountRef.current = 0;
      retryAtRef.current = 0;
      setResult({ status: 'ready', path: payload.route });
    }).catch((error: unknown) => {
      if (controller.signal.aborted || sequence !== sequenceRef.current) return;
      failureCountRef.current += 1;
      const retryAfterMs = error instanceof Error
        && 'retryAfterMs' in error
        && typeof error.retryAfterMs === 'number'
        ? error.retryAfterMs
        : null;
      retryAtRef.current = Date.now() + rejoinRetryDelayMs(
        failureCountRef.current,
        retryAfterMs,
      );
      setResult((current) => ({ status: 'error', path: current.path }));
    });

    return () => {
      window.clearTimeout(markLoading);
    };
  }, [
    active,
    offRouteM,
    online,
    originLatitude,
    originLongitude,
    sportType,
    targetLatitude,
    targetLongitude,
  ]);

  return result;
}
