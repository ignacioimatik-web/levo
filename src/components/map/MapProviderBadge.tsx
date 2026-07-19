'use client';

import { memo } from 'react';
import { RefreshCw } from 'lucide-react';

type MapProviderBadgeProps = {
  usingFallback: boolean;
  providerName: string;
  styleLabel: string;
  canRetry?: boolean;
  onRetry?: () => void;
};

export const MapProviderBadge = memo(function MapProviderBadge({
  usingFallback,
  providerName,
  styleLabel,
  canRetry = false,
  onRetry,
}: MapProviderBadgeProps) {
  const interactive = usingFallback && canRetry && Boolean(onRetry);
  const className = `pointer-events-auto flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9px] font-black uppercase shadow-lg backdrop-blur ${
    interactive ? 'min-h-11 touch-manipulation px-3 active:scale-[.98]' : 'min-h-8'
  } ${
    usingFallback
      ? 'border-amber-400/30 bg-amber-950/90 text-amber-100'
      : 'border-sky-400/25 bg-slate-950/88 text-sky-200'
  }`;
  const content = (
    <>
      <span
        aria-hidden
        className={`h-1.5 w-1.5 rounded-full ${
          usingFallback ? 'bg-amber-300' : 'bg-emerald-400'
        }`}
      />
      <span>
        {usingFallback ? 'Respaldo' : providerName} · {usingFallback ? providerName : styleLabel}
      </span>
      {usingFallback && canRetry && <RefreshCw aria-hidden className="h-3 w-3" />}
    </>
  );

  if (interactive && onRetry) {
    return (
      <button
        type="button"
        onClick={onRetry}
        aria-label={`Mapa de respaldo ${providerName}. Reintentar Mapbox`}
        className={className}
      >
        {content}
      </button>
    );
  }

  return (
    <span
      aria-label={usingFallback
        ? `Mapa de respaldo ${providerName}`
        : `Mapa ${providerName}, estilo ${styleLabel}`}
      className={className}
    >
      {content}
    </span>
  );
});
