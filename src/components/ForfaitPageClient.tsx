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
import { Search, ChevronDown, Map as MapIcon, LayoutGrid, Table as TableIcon, Compass } from 'lucide-react';
import QuickTypeFilters from './QuickTypeFilters';

type ForfaitTab = 'map' | 'catalog' | 'compare';

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
  const [activeTab, setActiveTab] = useState<ForfaitTab>('map');
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

  const tabs: { id: ForfaitTab; label: string; icon: React.ReactNode }[] = [
    { id: 'map', label: 'Explorar Mapa', icon: <MapIcon className="w-4 h-4" /> },
    { id: 'catalog', label: 'Catálogo', icon: <LayoutGrid className="w-4 h-4" /> },
    { id: 'compare', label: 'Comparativa', icon: <TableIcon className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header & Tabs */}
      <header className="sticky top-0 z-50 bg-slate-950/80 backdrop-blur-md border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/20">
                <Compass className="text-white w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl font-black text-white tracking-tight">Forfait MTB</h1>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Morella Singletracks</p>
              </div>
            </div>

            <nav className="flex bg-slate-900/50 p-1 rounded-xl border border-white/5 w-fit">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                    activeTab === tab.id
                      ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                  }`}
                >
                  {tab.icon}
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              ))}
            </nav>
          </div>
        </div>
      </header>

      <main className="animate-in fade-in duration-500">
        {/* Tab Content */}
        {activeTab === 'map' && (
          <div className="space-y-0">
            {/* Map Section */}
            <section id="forfait-map-section" className="py-8 px-6">
              <div className="max-w-7xl mx-auto">
                <SectionHeading 
                  title="Exploración Visual" 
                  subtitle="Navega por el mapa interactivo para descubrir las rutas disponibles." 
                />
                <ForfaitInteractive
                  trails={filteredTrails}
                  selectedTrailId={selectedTrailId}
                  onTrailSelect={handleTrailSelect}
                />
              </div>
            </section>

            {/* Legend Section */}
            <section className="py-16 px-6 bg-slate-950/30 topo-pattern-subtle">
              <div className="max-w-5xl mx-auto">
                <SectionHeading 
                  title="Leyenda de niveles" 
                  subtitle="Clasificación de dificultad de los senderos." 
                  align="center" 
                />
                <TrailLegend />
              </div>
            </section>
          </div>
        )}

        {activeTab === 'catalog' && (
          <div className="space-y-12 py-12 px-6">
            <div className="max-w-7xl mx-auto space-y-12">
              {/* Filters & Title */}
              <div className="space-y-8">
                <SectionHeading
                  title="Catálogo de senderos"
                  subtitle={`${filteredTrails.length} senderos organizados por nivel, estado y tipo.`}
                  actions={
                    <QuickTypeFilters
                      filters={filters}
                      onChange={setFilters}
                    />
                  }
                />
                <TrailFilters
                  filters={filters}
                  trails={demoTrails}
                  onChange={setFilters}
                />
              </div>

              {/* Grid */}
              {filteredTrails.length === 0 ? (
                <EmptyState />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
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
          </div>
        )}

        {activeTab === 'compare' && (
          <div className="space-y-12 py-12 px-6">
            <div className="max-w-7xl mx-auto space-y-12">
              {/* Filters & Title */}
              <div className="space-y-8">
                <SectionHeading
                  title="Comparativa Técnica"
                  subtitle="Compara los detalles técnicos de los senderos para elegir tu próxima aventura."
                  actions={
                    <QuickTypeFilters
                      filters={filters}
                      onChange={setFilters}
                    />
                  }
                />
                <TrailFilters
                  filters={filters}
                  trails={demoTrails}
                  onChange={setFilters}
                />
              </div>

              {/* Table */}
              {filteredTrails.length === 0 ? (
                <EmptyState />
              ) : (
                <div className="overflow-hidden">
                  <button
                    onClick={() => setTableOpen(!tableOpen)}
                    className="w-full flex items-center justify-between px-6 py-4 bg-slate-900/60 border border-white/5 rounded-2xl hover:border-white/10 transition-colors mb-4"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-white">Ver tabla de datos detallada</span>
                      <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest bg-slate-800 px-2 py-0.5 rounded-full">
                        {filteredTrails.length} senderos
                      </span>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${tableOpen ? "rotate-180" : ""}`} />
                  </button>
                  
                  {tableOpen && (
                    <div className="mt-4">
                      <TrailComparisonTable
                        trails={filteredTrails}
                        selectedTrailId={selectedTrailId}
                        onSelect={handleTrailSelect}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
