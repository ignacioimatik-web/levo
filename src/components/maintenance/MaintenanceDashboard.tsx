'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, BatteryCharging, Bike, Check, ChevronDown, CircleGauge,
  Disc3, Gauge, Loader2, Plus, RefreshCw, Settings2, ShieldCheck, Trash2, Wrench,
} from 'lucide-react';
import { getActivities } from '@/lib/activities/storage';
import { pullActivities } from '@/lib/activities/sync';
import { activityOdometerKm, maintenanceHealth } from '@/lib/maintenance/analytics';
import {
  deleteMaintenanceItem, getMaintenanceItems, MAINTENANCE_CHANGED_EVENT,
  saveMaintenanceItem,
} from '@/lib/maintenance/storage';
import {
  deleteRemoteMaintenanceItem, reconcileMaintenance,
} from '@/lib/maintenance/sync';
import type {
  MaintenanceCategory, MaintenanceItem,
} from '@/lib/maintenance/types';

const CATEGORY_OPTIONS: Array<{ value: MaintenanceCategory; label: string }> = [
  { value: 'drivetrain', label: 'Transmisión' },
  { value: 'brakes', label: 'Frenos' },
  { value: 'suspension', label: 'Suspensión' },
  { value: 'tires', label: 'Cubiertas' },
  { value: 'motor', label: 'Motor e-bike' },
  { value: 'other', label: 'Otro' },
];

function CategoryIcon({ category, className = 'h-5 w-5' }: { category: MaintenanceCategory; className?: string }) {
  if (category === 'brakes') return <Disc3 className={className} />;
  if (category === 'motor') return <BatteryCharging className={className} />;
  if (category === 'suspension') return <Settings2 className={className} />;
  if (category === 'tires') return <CircleGauge className={className} />;
  return <Wrench className={className} />;
}

function categoryLabel(category: MaintenanceCategory): string {
  return CATEGORY_OPTIONS.find((option) => option.value === category)?.label ?? 'Otro';
}

export default function MaintenanceDashboard() {
  const [items, setItems] = useState<MaintenanceItem[]>([]);
  const [odometerKm, setOdometerKm] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftInterval, setDraftInterval] = useState(500);
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState<MaintenanceCategory>('other');
  const [newInterval, setNewInterval] = useState(500);

  const refresh = useCallback(() => {
    const odometer = activityOdometerKm(getActivities());
    setOdometerKm(odometer);
    setItems(getMaintenanceItems(odometer));
  }, []);

  const sync = useCallback(async () => {
    setSyncing(true);
    await reconcileMaintenance(activityOdometerKm(getActivities()));
    refresh();
    setSyncing(false);
  }, [refresh]);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => {
      void pullActivities().then(() => {
        refresh();
        setLoaded(true);
        void sync();
      });
    }, 0);
    window.addEventListener(MAINTENANCE_CHANGED_EVENT, refresh);
    return () => {
      window.clearTimeout(initialLoad);
      window.removeEventListener(MAINTENANCE_CHANGED_EVENT, refresh);
    };
  }, [refresh, sync]);

  const healthById = useMemo(() => Object.fromEntries(
    items.map((item) => [item.id, maintenanceHealth(item, odometerKm)]),
  ), [items, odometerKm]);
  const dueCount = items.filter((item) => healthById[item.id].state === 'due').length;
  const soonCount = items.filter((item) => healthById[item.id].state === 'soon').length;
  const sortedItems = useMemo(() => [...items].sort(
    (a, b) => healthById[b.id].progressPercent - healthById[a.id].progressPercent,
  ), [healthById, items]);

  const markServiced = (item: MaintenanceItem) => {
    saveMaintenanceItem({
      ...item,
      lastServiceOdometerKm: odometerKm,
      lastServiceAt: new Date().toISOString(),
      serviceCount: item.serviceCount + 1,
      updatedAt: new Date().toISOString(),
      syncStatus: 'local',
    });
    void sync();
  };

  const saveInterval = (item: MaintenanceItem) => {
    saveMaintenanceItem({
      ...item,
      intervalKm: Math.min(10_000, Math.max(10, draftInterval)),
      updatedAt: new Date().toISOString(),
      syncStatus: 'local',
    });
    setEditingId(null);
    void sync();
  };

  const addItem = () => {
    const name = newName.trim();
    if (!name) return;
    saveMaintenanceItem({
      id: crypto.randomUUID(),
      name,
      category: newCategory,
      intervalKm: Math.min(10_000, Math.max(10, newInterval)),
      lastServiceOdometerKm: odometerKm,
      lastServiceAt: null,
      serviceCount: 0,
      updatedAt: new Date().toISOString(),
      syncStatus: 'local',
    });
    setNewName('');
    setNewCategory('other');
    setNewInterval(500);
    setShowAdd(false);
    void sync();
  };

  const removeItem = async (item: MaintenanceItem) => {
    if (!window.confirm(`¿Eliminar “${item.name}” del taller?`)) return;
    deleteMaintenanceItem(item.id);
    await deleteRemoteMaintenanceItem(item);
  };

  if (!loaded) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-950 text-white">
        <Loader2 className="h-7 w-7 animate-spin text-orange-400" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 pb-28 text-white md:pb-16">
      <div className="mx-auto max-w-6xl px-4 py-7 sm:px-6 md:py-12">
        <header className="mb-7 flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-orange-400">
              <Wrench className="h-4 w-4" /> Bike care
            </p>
            <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Mi taller</h1>
            <p className="mt-2 max-w-xl text-sm text-slate-400">Mantenimiento basado en tus kilómetros reales, para llegar al monte con la bici preparada.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => { void sync(); }} disabled={syncing} aria-label="Sincronizar mantenimiento"
              className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-xs font-black text-slate-300 disabled:opacity-50">
              <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} /> <span className="hidden sm:inline">Sincronizar</span>
            </button>
            <button onClick={() => setShowAdd((value) => !value)}
              className="flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-3 text-xs font-black uppercase">
              <Plus className="h-4 w-4" /> Componente
            </button>
          </div>
        </header>

        <section className="mb-5 grid grid-cols-3 gap-3">
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
            <p className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-slate-500"><Gauge className="h-4 w-4" /> Odómetro</p>
            <p className="mt-2 text-xl font-black sm:text-3xl">{odometerKm.toFixed(0)} <span className="text-xs text-slate-500">km</span></p>
          </div>
          <div className={`rounded-2xl border p-4 ${dueCount ? 'border-red-500/25 bg-red-500/10' : 'border-white/10 bg-slate-900/60'}`}>
            <p className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-slate-500"><AlertTriangle className="h-4 w-4" /> Vencidos</p>
            <p className={`mt-2 text-xl font-black sm:text-3xl ${dueCount ? 'text-red-300' : ''}`}>{dueCount}</p>
          </div>
          <div className={`rounded-2xl border p-4 ${soonCount ? 'border-amber-500/25 bg-amber-500/10' : 'border-white/10 bg-slate-900/60'}`}>
            <p className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-slate-500"><ShieldCheck className="h-4 w-4" /> Próximos</p>
            <p className={`mt-2 text-xl font-black sm:text-3xl ${soonCount ? 'text-amber-300' : ''}`}>{soonCount}</p>
          </div>
        </section>

        {showAdd && (
          <section className="mb-5 rounded-3xl border border-orange-500/20 bg-orange-500/5 p-5">
            <div className="grid gap-3 md:grid-cols-[1fr_180px_160px_auto]">
              <label className="text-xs font-bold text-slate-400">
                Componente
                <input value={newName} onChange={(event) => setNewName(event.target.value)} maxLength={80}
                  placeholder="Ej. Rodamientos de dirección"
                  className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-3 text-sm text-white outline-none focus:border-orange-500" />
              </label>
              <label className="text-xs font-bold text-slate-400">
                Categoría
                <select value={newCategory} onChange={(event) => setNewCategory(event.target.value as MaintenanceCategory)}
                  className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-3 text-sm text-white">
                  {CATEGORY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
              <label className="text-xs font-bold text-slate-400">
                Intervalo
                <span className="mt-2 flex items-center rounded-xl border border-white/10 bg-slate-950 px-3">
                  <input type="number" min="10" max="10000" value={newInterval}
                    onChange={(event) => setNewInterval(Number(event.target.value))}
                    className="w-full bg-transparent py-3 text-sm text-white outline-none" />
                  <span className="text-xs text-slate-600">km</span>
                </span>
              </label>
              <button onClick={addItem} disabled={!newName.trim()}
                className="self-end rounded-xl bg-orange-500 px-4 py-3 text-xs font-black uppercase disabled:opacity-40">
                Añadir
              </button>
            </div>
          </section>
        )}

        {odometerKm === 0 && (
          <div className="mb-5 flex items-start gap-3 rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4 text-xs text-blue-200">
            <Bike className="mt-0.5 h-5 w-5 shrink-0" />
            <p>El seguimiento empieza hoy. Graba una salida para que el odómetro y los avisos comiencen a avanzar.</p>
          </div>
        )}

        <section className="grid gap-4 md:grid-cols-2">
          {sortedItems.map((item) => {
            const health = healthById[item.id];
            const stateStyle = health.state === 'due'
              ? 'border-red-500/30 bg-red-500/5'
              : health.state === 'soon'
                ? 'border-amber-500/25 bg-amber-500/5'
                : 'border-white/10 bg-slate-900/55';
            const accent = health.state === 'due' ? 'bg-red-500' : health.state === 'soon' ? 'bg-amber-400' : 'bg-emerald-400';
            return (
              <article key={item.id} className={`rounded-3xl border p-5 ${stateStyle}`}>
                <div className="flex items-start gap-3">
                  <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${
                    health.state === 'due' ? 'bg-red-500/15 text-red-300' : health.state === 'soon' ? 'bg-amber-500/15 text-amber-300' : 'bg-emerald-500/10 text-emerald-400'
                  }`}>
                    <CategoryIcon category={item.category} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="font-black">{item.name}</h2>
                        <p className="mt-1 text-[10px] uppercase tracking-widest text-slate-500">
                          {categoryLabel(item.category)} · {item.syncStatus === 'synced' ? 'En la nube' : 'En este dispositivo'}
                        </p>
                      </div>
                      <button onClick={() => { void removeItem(item); }} className="rounded-lg p-2 text-slate-600 hover:bg-red-500/10 hover:text-red-400" aria-label={`Eliminar ${item.name}`}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="mt-4 flex items-end justify-between gap-3">
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">
                          {health.state === 'due' ? 'Servicio vencido' : 'Próximo servicio'}
                        </p>
                        <p className={`mt-1 text-xl font-black ${health.state === 'due' ? 'text-red-300' : health.state === 'soon' ? 'text-amber-300' : ''}`}>
                          {health.state === 'due'
                            ? `${Math.abs(health.remainingKm).toFixed(0)} km pasado`
                            : `en ${health.remainingKm.toFixed(0)} km`}
                        </p>
                      </div>
                      <p className="text-right text-[10px] text-slate-500">{health.riddenKm.toFixed(0)} / {item.intervalKm.toFixed(0)} km</p>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-950">
                      <div className={`h-full rounded-full ${accent}`} style={{ width: `${health.progressPercent}%` }} />
                    </div>

                    {editingId === item.id ? (
                      <div className="mt-4 flex items-center gap-2">
                        <label className="flex flex-1 items-center rounded-xl border border-white/10 bg-slate-950 px-3">
                          <span className="sr-only">Intervalo de {item.name}</span>
                          <input type="number" min="10" max="10000" value={draftInterval}
                            onChange={(event) => setDraftInterval(Number(event.target.value))}
                            className="w-full bg-transparent py-2.5 text-sm outline-none" />
                          <span className="text-xs text-slate-600">km</span>
                        </label>
                        <button onClick={() => saveInterval(item)} className="grid h-10 w-10 place-items-center rounded-xl bg-white text-slate-950" aria-label="Guardar intervalo">
                          <Check className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="mt-4 flex gap-2">
                        <button onClick={() => markServiced(item)}
                          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-3 py-2.5 text-xs font-black text-slate-950">
                          <Check className="h-4 w-4" /> Marcar revisado
                        </button>
                        <button onClick={() => { setEditingId(item.id); setDraftInterval(item.intervalKm); }}
                          className="flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2.5 text-xs font-bold text-slate-400">
                          <ChevronDown className="h-4 w-4" /> Intervalo
                        </button>
                      </div>
                    )}
                    {item.lastServiceAt && (
                      <p className="mt-3 text-[10px] text-slate-600">
                        Última revisión: {new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' }).format(new Date(item.lastServiceAt))} · {item.serviceCount} registradas
                      </p>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </section>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-900/40 p-4">
          <p className="max-w-xl text-xs leading-relaxed text-slate-500">Los intervalos son recordatorios configurables, no sustituyen la inspección del fabricante o de un taller profesional.</p>
          <Link href="/actividades" className="text-xs font-black text-orange-400 hover:text-orange-300">Revisar kilometraje →</Link>
        </div>
      </div>
    </main>
  );
}
