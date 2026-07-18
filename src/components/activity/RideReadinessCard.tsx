'use client';

import Link from 'next/link';
import {
  CheckCircle2, Database, LocateFixed, MapPinned, ShieldAlert, Wifi, WifiOff,
} from 'lucide-react';

type LocationPermissionState = PermissionState | 'unknown';

function ReadinessItem({
  icon: Icon,
  label,
  detail,
  state,
}: {
  icon: typeof LocateFixed;
  label: string;
  detail: string;
  state: 'ready' | 'notice' | 'blocked';
}) {
  return (
    <li className="flex min-h-12 items-center gap-3 rounded-xl bg-slate-950/60 px-3 py-2.5">
      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${
        state === 'ready'
          ? 'bg-emerald-500/10 text-emerald-300'
          : state === 'blocked'
            ? 'bg-red-500/10 text-red-300'
            : 'bg-amber-500/10 text-amber-300'
      }`}>
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-[10px] font-black uppercase tracking-wider text-slate-300">{label}</span>
        <span className="mt-0.5 block text-[10px] leading-snug text-slate-500">{detail}</span>
      </span>
    </li>
  );
}

export default function RideReadinessCard({
  locationPermission,
  storageProtected,
  online,
  hasRoute,
  hasOfflineMap,
}: {
  locationPermission: LocationPermissionState;
  storageProtected: boolean | null;
  online: boolean;
  hasRoute: boolean;
  hasOfflineMap: boolean;
}) {
  const gpsState = locationPermission === 'denied'
    ? {
        detail: 'Bloqueado por el navegador. Activa Ubicación en los ajustes del sitio.',
        state: 'blocked' as const,
      }
    : locationPermission === 'granted'
      ? { detail: 'Permiso concedido; buscará precisión alta al iniciar.', state: 'ready' as const }
      : { detail: 'El dispositivo pedirá permiso al iniciar la grabación.', state: 'notice' as const };

  const routeState = !hasRoute
    ? { detail: 'Salida libre: podrás grabar sin una ruta cargada.', state: 'notice' as const }
    : hasOfflineMap
      ? { detail: 'Track y caminos cercanos guardados en el dispositivo.', state: 'ready' as const }
      : { detail: 'La ruta está lista, pero sus caminos cercanos dependen de cobertura.', state: 'notice' as const };
  const preparationReady = locationPermission === 'granted' && (hasOfflineMap || !hasRoute);

  return (
    <section aria-labelledby="ride-readiness-title" className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p id="ride-readiness-title" className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-300">
            Preparación de campo
          </p>
          <p className="mt-1 text-[10px] text-slate-500">Comprueba lo esencial antes de salir.</p>
        </div>
        {preparationReady && (
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" aria-label="Preparación correcta" />
        )}
        {locationPermission === 'denied' && (
          <ShieldAlert className="h-5 w-5 shrink-0 text-red-400" aria-label="Preparación bloqueada" />
        )}
        {!preparationReady && locationPermission !== 'denied' && (
          <ShieldAlert className="h-5 w-5 shrink-0 text-amber-300" aria-label="Preparación pendiente" />
        )}
      </div>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        <ReadinessItem icon={LocateFixed} label="GPS" detail={gpsState.detail} state={gpsState.state} />
        <ReadinessItem icon={MapPinned} label="Ruta offline" detail={routeState.detail} state={routeState.state} />
        <ReadinessItem
          icon={Database}
          label="Autoguardado"
          detail={storageProtected
            ? 'Almacenamiento persistente concedido.'
            : storageProtected === false
              ? 'Doble copia local activa; evita limpiar datos del navegador durante la ruta.'
              : 'Comprobando protección del almacenamiento…'}
          state={storageProtected ? 'ready' : 'notice'}
        />
        <ReadinessItem
          icon={online ? Wifi : WifiOff}
          label="Cobertura"
          detail={online
            ? 'Meteo y seguimiento en vivo disponibles.'
            : 'Sin red: GPS, track y mapa preparado siguen funcionando.'}
          state={online ? 'ready' : 'notice'}
        />
      </ul>
      {hasRoute && !hasOfflineMap && (
        <Link href="/planifica" className="mt-3 inline-flex min-h-11 items-center text-[10px] font-black uppercase text-orange-300 underline underline-offset-4">
          Preparar mapa offline
        </Link>
      )}
    </section>
  );
}
