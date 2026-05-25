'use client';

import { useState, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { MTBTrail } from '@/data/trails';
import ForfaitMap from './ForfaitMap';
import TrailDrawer from './TrailDrawer';

const RealMap = dynamic(() => import('./RealMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[500px] lg:h-[600px] rounded-3xl bg-slate-950/80 border border-white/5 flex items-center justify-center">
      <p className="text-slate-500 text-sm font-bold">Cargando mapa interactivo…</p>
    </div>
  ),
});

interface ForfaitInteractiveProps {
  trails: MTBTrail[];
  selectedTrailId?: string | null;
  onTrailSelect?: (id: string | null) => void;
}

function hasRealTrails(trails: MTBTrail[]): boolean {
  return trails.some(t => t.coordinates && t.coordinates.length > 0);
}

export default function ForfaitInteractive({ trails, selectedTrailId: externalId, onTrailSelect: externalOnSelect }: ForfaitInteractiveProps) {
  const [internalId, setInternalId] = useState<string | null>(null);

  const selectedTrailId = externalId ?? internalId;
  const handleSelect = externalOnSelect ?? setInternalId;

  const selectedTrail = selectedTrailId
    ? trails.find(t => t.id === selectedTrailId) ?? null
    : null;

  const handleTrailSelect = useCallback((id: string | null) => {
    handleSelect(id);
  }, [handleSelect]);

  const handleClose = useCallback(() => {
    handleSelect(null);
  }, [handleSelect]);

  const useRealMap = useMemo(() => hasRealTrails(trails), [trails]);

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <div className="flex-1 min-w-0">
        {useRealMap ? (
          <RealMap
            trails={trails}
            selectedTrailId={selectedTrailId}
            onTrailSelect={handleTrailSelect}
          />
        ) : (
          <ForfaitMap
            trails={trails}
            selectedTrailId={selectedTrailId}
            onTrailSelect={handleTrailSelect}
          />
        )}
      </div>
      <TrailDrawer trail={selectedTrail} onClose={handleClose} />
    </div>
  );
}
