'use client';

import { useCallback, useState } from 'react';
import {
  FALLBACK_MAP_STYLES,
  MAPBOX_ACCESS_TOKEN,
  OPEN_MAP_STYLES,
} from '@/lib/open-map-styles';

export default function useResilientMapStyle(styleIndex = 0) {
  const [usingFallback, setUsingFallback] = useState(!MAPBOX_ACCESS_TOKEN);
  const safeStyleIndex = Math.min(
    Math.max(0, styleIndex),
    OPEN_MAP_STYLES.length - 1,
  );
  const handleMapError = useCallback(() => {
    setUsingFallback(true);
  }, []);

  return {
    mapStyle: usingFallback
      ? FALLBACK_MAP_STYLES[safeStyleIndex].style
      : OPEN_MAP_STYLES[safeStyleIndex].style,
    usingFallback,
    handleMapError,
  };
}
