'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  BatteryCharging,
  Bike,
  Check,
  ChevronRight,
  Gauge,
  Loader2,
  MapPin,
  Mountain,
  UserRound,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/browser';

type RiderType = 'ebike' | 'mtb' | 'both';

type RiderOnboardingProps = {
  userId: string;
  next: string;
  initialDisplayName: string;
  initialBikeName: string;
  initialBatteryCapacityWh: number;
  initialHomeRegion: string;
  initialRiderType: RiderType;
};

const RIDER_TYPES: Array<{
  value: RiderType;
  label: string;
  detail: string;
  icon: typeof Bike;
}> = [
  { value: 'ebike', label: 'E-bike', detail: 'Autonomía y asistencia', icon: BatteryCharging },
  { value: 'mtb', label: 'MTB', detail: 'Ritmo y desnivel', icon: Mountain },
  { value: 'both', label: 'Ambas', detail: 'Cambio según la salida', icon: Bike },
];

export default function RiderOnboarding({
  userId,
  next,
  initialDisplayName,
  initialBikeName,
  initialBatteryCapacityWh,
  initialHomeRegion,
  initialRiderType,
}: RiderOnboardingProps) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [bikeName, setBikeName] = useState(initialBikeName);
  const [batteryCapacityWh, setBatteryCapacityWh] = useState(initialBatteryCapacityWh);
  const [homeRegion, setHomeRegion] = useState(initialHomeRegion);
  const [riderType, setRiderType] = useState<RiderType>(initialRiderType);
  const [status, setStatus] = useState<'idle' | 'saving' | 'skipping' | 'error'>('idle');

  const completeOnboarding = async (skip = false) => {
    if (!skip && !displayName.trim()) return;
    const supabase = createClient();
    if (!supabase) {
      setStatus('error');
      return;
    }

    setStatus(skip ? 'skipping' : 'saving');
    const { error } = await supabase
      .from('profiles')
      .upsert({
        user_id: userId,
        display_name: displayName.trim() || 'Rider',
        bike_name: bikeName.trim() || null,
        battery_capacity_wh: riderType === 'mtb' ? null : batteryCapacityWh,
        home_region: homeRegion.trim() || null,
        rider_type: riderType,
        onboarding_completed_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

    if (error) {
      setStatus('error');
      return;
    }

    router.replace(next);
    router.refresh();
  };

  return (
    <main className="topo-pattern-subtle min-h-[calc(100svh-4rem)] px-4 pb-28 pt-6 sm:px-6 sm:pt-10 md:pb-16">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center gap-3 text-xs font-black uppercase tracking-[0.2em] text-orange-400">
          <span className="h-px w-10 bg-orange-500" />
          Primera puesta a punto
        </div>

        <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
          <section className="rounded-3xl border border-orange-500/20 bg-gradient-to-br from-orange-500/15 via-slate-900/70 to-slate-950 p-6 sm:p-8">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-500 text-white shadow-lg shadow-orange-950/30">
              <Gauge className="h-7 w-7" />
            </div>
            <h1 className="mt-6 text-3xl font-black leading-tight text-white sm:text-4xl">
              Tu bici. Tu terreno. Tus datos.
            </h1>
            <p className="mt-4 text-sm leading-relaxed text-slate-300 sm:text-base">
              Estos datos permiten ajustar estimaciones de autonomía, ritmo, luz restante y avisos meteorológicos a tu forma de rodar.
            </p>
            <div className="mt-8 space-y-3 text-xs text-slate-400">
              {['Recomendaciones según modalidad', 'Autonomía adaptada a tu batería', 'Rutas y meteo de tu zona'].map((benefit) => (
                <div key={benefit} className="flex items-center gap-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
                    <Check className="h-3.5 w-3.5" />
                  </span>
                  {benefit}
                </div>
              ))}
            </div>
          </section>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              void completeOnboarding();
            }}
            className="glass-card rounded-3xl p-5 sm:p-8"
          >
            <fieldset>
              <legend className="text-sm font-black text-white">¿Cómo sueles salir?</legend>
              <div className="mt-3 grid grid-cols-3 gap-2 sm:gap-3">
                {RIDER_TYPES.map(({ value, label, detail, icon: Icon }) => {
                  const selected = riderType === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setRiderType(value)}
                      className={`min-h-24 rounded-2xl border p-3 text-left transition ${
                        selected
                          ? 'border-orange-500 bg-orange-500/15 text-white'
                          : 'border-white/10 bg-slate-950/50 text-slate-400 hover:border-orange-500/40'
                      }`}
                    >
                      <Icon className={`h-5 w-5 ${selected ? 'text-orange-400' : 'text-slate-500'}`} />
                      <span className="mt-2 block text-xs font-black sm:text-sm">{label}</span>
                      <span className="mt-1 hidden text-[10px] leading-tight sm:block">{detail}</span>
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <label className="block text-xs font-bold text-slate-400">
                Nombre visible
                <div className="relative mt-2">
                  <UserRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
                  <input
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    required
                    maxLength={60}
                    autoComplete="name"
                    className="min-h-12 w-full rounded-xl border border-white/10 bg-slate-950 py-3 pl-10 pr-3 text-base text-white outline-none focus:border-orange-500 sm:text-sm"
                  />
                </div>
              </label>

              <label className="block text-xs font-bold text-slate-400">
                Zona habitual
                <div className="relative mt-2">
                  <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
                  <input
                    value={homeRegion}
                    onChange={(event) => setHomeRegion(event.target.value)}
                    maxLength={80}
                    placeholder="Ej. Els Ports"
                    className="min-h-12 w-full rounded-xl border border-white/10 bg-slate-950 py-3 pl-10 pr-3 text-base text-white outline-none focus:border-orange-500 sm:text-sm"
                  />
                </div>
              </label>
            </div>

            <label className="mt-4 block text-xs font-bold text-slate-400">
              Tu bici
              <div className="relative mt-2">
                <Bike className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
                <input
                  value={bikeName}
                  onChange={(event) => setBikeName(event.target.value)}
                  maxLength={80}
                  placeholder={riderType === 'mtb' ? 'Ej. Orbea Occam' : 'Ej. Specialized Turbo Levo'}
                  className="min-h-12 w-full rounded-xl border border-white/10 bg-slate-950 py-3 pl-10 pr-3 text-base text-white outline-none focus:border-orange-500 sm:text-sm"
                />
              </div>
            </label>

            {riderType !== 'mtb' && (
              <label className="mt-4 block text-xs font-bold text-slate-400">
                Capacidad de batería
                <div className="relative mt-2">
                  <BatteryCharging className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
                  <select
                    value={batteryCapacityWh}
                    onChange={(event) => setBatteryCapacityWh(Number(event.target.value))}
                    className="min-h-12 w-full appearance-none rounded-xl border border-white/10 bg-slate-950 py-3 pl-10 pr-3 text-base text-white outline-none focus:border-orange-500 sm:text-sm"
                  >
                    {[320, 500, 625, 700, 750, 900].map((capacity) => (
                      <option key={capacity} value={capacity}>{capacity} Wh</option>
                    ))}
                  </select>
                </div>
              </label>
            )}

            {status === 'error' && (
              <p role="alert" className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300">
                No hemos podido guardar la configuración. Comprueba la conexión e inténtalo de nuevo.
              </p>
            )}

            <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                disabled={status !== 'idle' && status !== 'error'}
                onClick={() => void completeOnboarding(true)}
                className="min-h-12 rounded-xl px-4 text-xs font-bold text-slate-500 hover:text-slate-300 disabled:opacity-50"
              >
                {status === 'skipping' ? 'Guardando…' : 'Configurar más tarde'}
              </button>
              <button
                type="submit"
                disabled={status !== 'idle' && status !== 'error'}
                className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-orange-500 px-6 text-sm font-black text-white shadow-lg shadow-orange-950/20 hover:bg-orange-400 disabled:opacity-50"
              >
                {status === 'saving' ? <Loader2 className="h-5 w-5 animate-spin" /> : <ChevronRight className="h-5 w-5" />}
                Empezar
              </button>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}
