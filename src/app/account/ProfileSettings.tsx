'use client';

import { useState } from 'react';
import { BatteryCharging, Bike, Check, Loader2, MapPin, UserRound } from 'lucide-react';
import { createClient } from '@/lib/supabase/browser';

export default function ProfileSettings({
  userId,
  initialDisplayName,
  initialBikeName,
  initialBatteryCapacityWh,
  initialBio,
  initialHomeRegion,
  initialRiderType,
}: {
  userId: string;
  initialDisplayName: string;
  initialBikeName: string;
  initialBatteryCapacityWh: number;
  initialBio: string;
  initialHomeRegion: string;
  initialRiderType: 'ebike' | 'mtb' | 'both';
}) {
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [bikeName, setBikeName] = useState(initialBikeName);
  const [batteryCapacityWh, setBatteryCapacityWh] = useState(initialBatteryCapacityWh);
  const [bio, setBio] = useState(initialBio);
  const [homeRegion, setHomeRegion] = useState(initialHomeRegion);
  const [riderType, setRiderType] = useState(initialRiderType);
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
        bio: bio.trim() || null,
        home_region: homeRegion.trim() || null,
        rider_type: riderType,
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
        Zona habitual
        <div className="relative mt-2">
          <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
          <input value={homeRegion} onChange={(event) => setHomeRegion(event.target.value)} maxLength={80} placeholder="Ej. Els Ports, Castellón"
            className="w-full rounded-xl border border-white/10 bg-slate-950 py-3 pl-10 pr-3 text-sm text-white outline-none focus:border-orange-500" />
        </div>
      </label>
      <label className="block text-xs font-bold text-slate-400">
        Modalidad
        <select value={riderType} onChange={(event) => setRiderType(event.target.value as 'ebike' | 'mtb' | 'both')}
          className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-3 text-sm text-white outline-none focus:border-orange-500">
          <option value="both">MTB + E-bike</option>
          <option value="ebike">E-bike</option>
          <option value="mtb">MTB muscular</option>
        </select>
      </label>
      <label className="block text-xs font-bold text-slate-400">
        Sobre ti
        <textarea value={bio} onChange={(event) => setBio(event.target.value)} maxLength={240} rows={3}
          placeholder="Terreno favorito, tipo de salidas, objetivos…"
          className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-slate-950 px-3 py-3 text-sm text-white outline-none focus:border-orange-500" />
        <span className="mt-1 block text-right text-[10px] font-normal text-slate-600">{bio.length}/240</span>
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
      <button disabled={status === 'saving'} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-orange-500 py-3 text-xs font-black uppercase text-white disabled:opacity-50">
        {status === 'saving' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
        {status === 'saved' ? 'Perfil guardado' : 'Guardar perfil'}
      </button>
    </form>
  );
}
