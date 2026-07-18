'use client';

import { useState } from 'react';
import { BatteryCharging, Bike, Check, Loader2, UserRound } from 'lucide-react';
import { createClient } from '@/lib/supabase/browser';

export default function ProfileSettings({
  userId,
  initialDisplayName,
  initialBikeName,
  initialBatteryCapacityWh,
}: {
  userId: string;
  initialDisplayName: string;
  initialBikeName: string;
  initialBatteryCapacityWh: number;
}) {
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [bikeName, setBikeName] = useState(initialBikeName);
  const [batteryCapacityWh, setBatteryCapacityWh] = useState(initialBatteryCapacityWh);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    const supabase = createClient();
    if (!supabase || !displayName.trim()) return;
    setStatus('saving');
    const { error } = await supabase
      .from('profiles')
      .upsert({
        user_id: userId,
        display_name: displayName.trim(),
        bike_name: bikeName.trim() || null,
        battery_capacity_wh: batteryCapacityWh,
      }, { onConflict: 'user_id' });
    setStatus(error ? 'error' : 'saved');
    if (!error) window.setTimeout(() => setStatus('idle'), 2_000);
  };

  return (
    <form onSubmit={save} className="space-y-4 border-t border-white/10 pt-6">
      <div>
        <h2 className="font-black text-white">Perfil rider</h2>
        <p className="mt-1 text-xs text-slate-500">Estos datos identifican tus actividades públicas y personalizan la e-bike.</p>
      </div>
      <label className="block text-xs font-bold text-slate-400">
        Nombre visible
        <div className="relative mt-2">
          <UserRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
          <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} required maxLength={60}
            className="w-full rounded-xl border border-white/10 bg-slate-950 py-3 pl-10 pr-3 text-sm text-white outline-none focus:border-orange-500" />
        </div>
      </label>
      <label className="block text-xs font-bold text-slate-400">
        Tu bici
        <div className="relative mt-2">
          <Bike className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
          <input value={bikeName} onChange={(event) => setBikeName(event.target.value)} maxLength={80} placeholder="Ej. Specialized Turbo Levo"
            className="w-full rounded-xl border border-white/10 bg-slate-950 py-3 pl-10 pr-3 text-sm text-white outline-none focus:border-orange-500" />
        </div>
      </label>
      <label className="block text-xs font-bold text-slate-400">
        Capacidad de batería
        <div className="relative mt-2">
          <BatteryCharging className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
          <select value={batteryCapacityWh} onChange={(event) => setBatteryCapacityWh(Number(event.target.value))}
            className="w-full appearance-none rounded-xl border border-white/10 bg-slate-950 py-3 pl-10 pr-3 text-sm text-white outline-none focus:border-orange-500">
            {[500, 625, 700, 750, 900].map((capacity) => <option key={capacity} value={capacity}>{capacity} Wh</option>)}
          </select>
        </div>
      </label>
      {status === 'error' && <p role="alert" className="text-xs text-red-400">No hemos podido guardar el perfil.</p>}
      <button disabled={status === 'saving'} className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 py-3 text-xs font-black uppercase text-white disabled:opacity-50">
        {status === 'saving' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
        {status === 'saved' ? 'Perfil guardado' : 'Guardar perfil'}
      </button>
    </form>
  );
}
