'use client';

import { useCallback, useState } from 'react';
import {
  FALLBACK_MAP_STYLES,
  MAPBOX_ACCESS_TOKEN,
  OPEN_MAP_STYLES,
} from '@/lib/open-map-styles';

type MapErrorEvent = { error?: { message?: string } } | undefined;

/**
 * Mapbox emits an `error` event for a few recoverable style-diff notices while
 * it rebuilds a style. Those notices do not mean that tiles or the token have
 * failed; switching to CARTO at that point makes the configured satellite map
 * disappear. Only genuine load/auth failures should activate the fallback.
 */
export function isNonFatalMapboxError(event: MapErrorEvent): boolean {
  const message = event?.error?.message?.toLowerCase() ?? '';
  return message.includes('style diff')
    || message.includes('unimplemented: setsprite')
    || message.includes('unimplemented: setglyphs')
    || message.includes('rebuilding the style from scratch');
}

export default function useResilientMapStyle(styleIndex = 0) {
  const [usingFallback, setUsingFallback] = useState(!MAPBOX_ACCESS_TOKEN);
  const safeStyleIndex = Math.min(
    Math.max(0, styleIndex),
    OPEN_MAP_STYLES.length - 1,
  );
  const handleMapError = useCallback((event?: MapErrorEvent) => {
    if (isNonFatalMapboxError(event)) return;
    setUsingFallback(true);
  }, []);
  const retryMapbox = useCallback(() => {
    if (MAPBOX_ACCESS_TOKEN) setUsingFallback(false);
  }, []);
  const selectedStyle = usingFallback
    ? FALLBACK_MAP_STYLES[safeStyleIndex]
    : OPEN_MAP_STYLES[safeStyleIndex];

  return {
    mapStyle: selectedStyle.style,
    usingFallback,
    handleMapError,
    retryMapbox,
    canRetryMapbox: usingFallback && Boolean(MAPBOX_ACCESS_TOKEN),
    providerName: selectedStyle.provider,
    styleLabel: selectedStyle.label,
  };
}
