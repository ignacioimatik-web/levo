'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

interface TrailHoverState {
  hoveredKm: number | null;
  setHoveredKm: (km: number | null) => void;
}

const TrailHoverContext = createContext<TrailHoverState>({
  hoveredKm: null,
  setHoveredKm: () => {},
});

export function TrailHoverProvider({ children }: { children: ReactNode }) {
  const [hoveredKm, setHoveredKm] = useState<number | null>(null);
  return (
    <TrailHoverContext.Provider value={{ hoveredKm, setHoveredKm }}>
      {children}
    </TrailHoverContext.Provider>
  );
}

export function useTrailHover(): TrailHoverState {
  return useContext(TrailHoverContext);
}
