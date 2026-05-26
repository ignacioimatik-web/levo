'use client';

import React, { useState, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { routes, MTBRoute, RouteDifficulty, RouteType } from '@/data/routes';
import RouteCard from './RouteCard';
import { Filter, Search, RotateCcw } from 'lucide-react';

export default function RouteFilter() {
  const searchParams = useSearchParams();
  const initialSector = searchParams.get('sector') || 'all';
  const [search, setSearch] = useState('');
  const [sector, setSector] = useState(initialSector);
  const [difficulty, setDifficulty] = useState('all');
  const [type, setType] = useState('all');
  const [distanceRange, setDistanceRange] = useState('all');

  const filteredRoutes = useMemo(() => {
    return routes.filter((route) => {
      const matchesSearch = route.name.toLowerCase().includes(search.toLowerCase()) || 
                            route.summary.toLowerCase().includes(search.toLowerCase());
      const matchesSector = sector === 'all' || route.sector === sector;
      const matchesDifficulty = difficulty === 'all' || route.physicalDifficulty === difficulty;
      const matchesType = type === 'all' || route.type === type;
      const matchesDistance = distanceRange === 'all' || (() => {
        const d = route.distanceKm ?? 0;
        const [min, max] = distanceRange.split('-').map(Number);
        return max ? d >= min && d < max : d >= min;
      })();

      return matchesSearch && matchesSector && matchesDifficulty && matchesType && matchesDistance;
    });
  }, [search, sector, difficulty, type, distanceRange]);

  const resetFilters = () => {
    setSearch('');
    setSector('all');
    setDifficulty('all');
    setType('all');
    setDistanceRange('all');
  };

  // Get unique sectors from routes
  const availableSectors = Array.from(new Set(routes.map(r => r.sector))).sort();

  // Map difficulty to the type expected by the select
  const difficultyOptions: { label: string; value: string }[] = [
    { label: 'Todas', value: 'all' },
    { label: 'Verde', value: 'verde' },
    { label: 'Azul', value: 'azul' },
    { label: 'Roja', value: 'roja' },
    { label: 'Negra', value: 'negra' },
    { label: 'Doble Negra', value: 'doble-negra' },
  ];

  const typeOptions: { label: string; value: string }[] = [
    { label: 'Todos', value: 'all' },
    { label: 'Circular', value: 'circular' },
    { label: 'Lineal', value: 'lineal' },
    { label: 'Travesía', value: 'travesia' },
    { label: 'Top Track', value: 'top-track' },
  ];

  return (
    <div className="space-y-8">
      <div className="p-6 bg-slate-900/50 backdrop-blur-md rounded-2xl border border-white/10 shadow-xl">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-end">
          
          {/* Search Input */}
          <div className="lg:col-span-3">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 block">
              Buscar ruta
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                placeholder="Nombre o descripción..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-slate-800 border border-white/10 text-white text-sm rounded-xl pl-10 pr-4 py-2.5 outline-none focus:ring-2 focus:ring-orange-500/50 transition-all"
              />
            </div>
          </div>

          {/* Sector Filter */}
          <div className="lg:col-span-2">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 block">
              Sector
            </label>
            <select
              value={sector}
              onChange={(e) => setSector(e.target.value)}
              className="w-full bg-slate-800 border border-white/10 text-white text-sm rounded-xl py-2.5 outline-none focus:ring-2 focus:ring-orange-500/50 transition-all"
            >
              <option value="all">Todos</option>
              {availableSectors.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* Difficulty Filter */}
          <div className="lg:col-span-2">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 block">
              Dificultad
            </label>
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              className="w-full bg-slate-800 border border-white/10 text-white text-sm rounded-xl py-2.5 outline-none focus:ring-2 focus:ring-orange-500/50 transition-all"
            >
              {difficultyOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>

          {/* Type Filter */}
          <div className="lg:col-span-2">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 block">
              Tipo
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full bg-slate-800 border border-white/10 text-white text-sm rounded-xl py-2.5 outline-none focus:ring-2 focus:ring-orange-500/50 transition-all"
            >
              {typeOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>

          {/* Distance Range Filter */}
          <div className="lg:col-span-2">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 block">
              Distancia
            </label>
            <select
              value={distanceRange}
              onChange={(e) => setDistanceRange(e.target.value)}
              className="w-full bg-slate-800 border border-white/10 text-white text-sm rounded-xl py-2.5 outline-none focus:ring-2 focus:ring-orange-500/50 transition-all"
            >
              <option value="all">Todas</option>
              <option value="0-15">&lt; 15 km</option>
              <option value="15-25">15 – 25 km</option>
              <option value="25-35">25 – 35 km</option>
              <option value="35-45">35 – 45 km</option>
              <option value="45-999">&gt; 45 km</option>
            </select>
          </div>

          {/* Reset Button */}
          <div className="lg:col-span-1">
            <button
              onClick={resetFilters}
              className="w-full flex items-center justify-center gap-2 text-xs font-bold text-slate-400 hover:text-white transition-colors py-2.5"
            >
              <RotateCcw className="w-4 h-4" />
              Limpiar
            </button>
          </div>
        </div>
      </div>

      {/* Results Info */}
      <div className="flex justify-between items-center text-sm text-slate-500">
        <p>{filteredRoutes.length} {filteredRoutes.length === 1 ? 'ruta' : 'rutas'} encontradas</p>
      </div>

      {/* Routes Grid */}
      {filteredRoutes.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredRoutes.map((route) => (
            <RouteCard key={route.id} route={route} />
          ))}
        </div>
      ) : (
        <div className="py-20 text-center bg-slate-900/30 rounded-3xl border border-white/5">
          <Search className="w-12 h-12 text-slate-700 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-white">No se han encontrado rutas</h3>
          <p className="text-slate-500">Prueba con otros filtros o términos de búsqueda.</p>
        </div>
      )}
    </div>
  );
}
