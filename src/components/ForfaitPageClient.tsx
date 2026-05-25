'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { demoTrails } from '@/data/trails';
import { filterTrails } from '@/lib/trail-utils';
import type { TrailFilters as FiltersState } from '@/lib/trail-utils';
import SectionHeading from './SectionHeading';
import TrailFilters from './TrailFilters';
import ForfaitInteractive from './ForfaitInteractive';
import TrailLegend from './TrailLegend';
import TrailComparisonTable from './TrailComparisonTable';
import TrailCard from './TrailCard';
import { Search, ChevronDown } from 'lucide-react';

function EmptyState() {
  return (
    <div className="col-span-full flex flex-col items-center justify-center py-20 px-6 text-center">
      <Search className="w-12 h-12 text-slate-700 mb-4" />
      <p className="text-slate-400 text-lg font-bold mb-2">Ningún sendero coincide con los filtros</p>
      <p className="text-slate-600 text-sm max-w-md">
        Prueba a modificar o limpiar los filtros para ver más resultados.
      </p>
    </div>
  );
}

export default function ForfaitPageClient() {
  const [filters, setFilters] = useState<FiltersState>({});
  const [selectedTrailId, setSelectedTrailId] = useState<string | null>(null);
  const [tableOpen, setTableOpen] = useState(false);

  const filteredTrails = useMemo(() => filterTrails(demoTrails, filters), [filters]);

  useEffect(() => {
    if (selectedTrailId && !filteredTrails.find(t => t.id === selectedTrailId)) {
      setSelectedTrailId(null);
    }
  }, [filteredTrails, selectedTrailId]);

  const handleTrailSelect = useCallback((id: string | null) => {
    setSelectedTrailId(id);
  }, []);

  return (
    <>
      {/* Filters */}
      <section className="py-8 px-6">
        <div className="max-w-7xl mx-auto">
          <TrailFilters
            filters={filters}
            trails={demoTrails}
            onChange={setFilters}
          />
        </div>
      </section>

      {/* Map + Drawer */}
      <section id="forfait-map-section" className="py-12 px-6">
        <div className="max-w-7xl mx-auto">
          <SectionHeading title="Plano de pistas" subtitle="Visualiza los senderos sobre el mapa de Morella Singletracks." />
          <ForfaitInteractive
            trails={filteredTrails}
            selectedTrailId={selectedTrailId}
            onTrailSelect={handleTrailSelect}
          />
        </div>
      </section>

      {/* Difficulty Legend */}
      <section className="py-20 px-6 bg-slate-950/30 topo-pattern-subtle">
        <div className="max-w-5xl mx-auto">
          <SectionHeading title="Leyenda de niveles" subtitle="Clasificación de dificultad de los senderos." align="center" />
          <TrailLegend />
        </div>
      </section>

      {/* Trail Catalog */}
      <section className="py-20 px-6 contour-line">
        <div className="max-w-7xl mx-auto">
          <SectionHeading
            title="Catálogo de senderos"
            subtitle={`${filteredTrails.length} senderos organizados por nivel, estado y tipo.`}
          />
          {filteredTrails.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredTrails.map(trail => (
                <TrailCard
                  key={trail.id}
                  trail={trail}
                  isSelected={selectedTrailId === trail.id}
                  onSelect={handleTrailSelect}
                  mapSectionId="forfait-map-section"
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Comparison Table */}
      <section className="pb-20 px-6">
        <div className="max-w-7xl mx-auto">
          <button
            onClick={() => setTableOpen(!tableOpen)}
            className="w-full flex items-center justify-between px-6 py-4 bg-slate-900/60 border border-white/5 rounded-2xl hover:border-white/10 transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold text-white">Tabla comparativa</span>
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest bg-slate-800 px-2 py-0.5 rounded-full">
                {filteredTrails.length} senderos
              </span>
            </div>
            <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${tableOpen ? "rotate-180" : ""}`} />
          </button>
          {tableOpen && filteredTrails.length > 0 && (
            <div className="mt-4">
              <TrailComparisonTable
                trails={filteredTrails}
                selectedTrailId={selectedTrailId}
                onSelect={handleTrailSelect}
              />
            </div>
          )}
        </div>
      </section>
    </>
  );
}
