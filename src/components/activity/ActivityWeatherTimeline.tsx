import { CloudSun, Droplets, Sunset, Wind } from 'lucide-react';
import type { RideWeatherSample } from '@/lib/activities/types';

function average(values: Array<number | null>): number | null {
  const valid = values.filter((value): value is number => value != null && Number.isFinite(value));
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : null;
}

function sparkPath(
  samples: RideWeatherSample[],
  value: (sample: RideWeatherSample) => number | null,
): string {
  const points = samples.flatMap((sample) => {
    const current = value(sample);
    return current == null ? [] : [{ distanceM: sample.distanceM, value: current }];
  });
  if (points.length < 2) return '';
  const maxDistance = Math.max(...points.map((point) => point.distanceM), 1);
  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const range = Math.max(Math.max(...values) - min, 1);
  return points.map((point, index) => {
    const x = 4 + point.distanceM / maxDistance * 92;
    const y = 52 - (point.value - min) / range * 42;
    return `${index === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(' ');
}

function effectLabel(effect: RideWeatherSample['windEffect']): string {
  if (effect === 'headwind') return 'de cara';
  if (effect === 'tailwind') return 'a favor';
  if (effect === 'crosswind') return 'lateral';
  if (effect === 'calm') return 'calma';
  return 'variable';
}

function sampleAgeLabel(sample: RideWeatherSample): string | null {
  if (sample.dataAgeMin == null) return null;
  if (sample.dataAgeMin < 60) return `dato ${Math.round(sample.dataAgeMin)} min`;
  const hours = Math.floor(sample.dataAgeMin / 60);
  const minutes = Math.round(sample.dataAgeMin % 60);
  return `dato ${hours} h${minutes ? ` ${minutes} min` : ''}`;
}

export default function ActivityWeatherTimeline({ samples }: { samples: RideWeatherSample[] }) {
  const ordered = [...samples]
    .filter((sample) => Number.isFinite(sample.distanceM))
    .sort((a, b) => a.distanceM - b.distanceM);
  if (ordered.length === 0) return null;

  const averageTemperature = average(ordered.map((sample) => sample.temperatureC));
  const averageHumidity = average(ordered.map((sample) => sample.humidityPct));
  const maxWind = Math.max(0, ...ordered.map((sample) => sample.maxWindKmh ?? sample.windKmh ?? 0));
  const minimumLightMargin = ordered.reduce<number | null>((minimum, sample) => (
    sample.lightMarginMinutes == null
      ? minimum
      : minimum == null
        ? sample.lightMarginMinutes
        : Math.min(minimum, sample.lightMarginMinutes)
  ), null);
  const temperaturePath = sparkPath(ordered, (sample) => sample.temperatureC);
  const windPath = sparkPath(ordered, (sample) => sample.windKmh);
  const sourceLabel = ordered.find((sample) => sample.sourceLabel)?.sourceLabel;
  const staleSampleCount = ordered.filter((sample) => sample.dataIsStale).length;

  return (
    <section className="mt-5 overflow-hidden rounded-3xl border border-cyan-500/20 bg-cyan-500/5">
      <div className="border-b border-white/10 px-5 py-4">
        <p className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-cyan-300">
          <CloudSun className="h-4 w-4" /> Meteo vivida por tramos
        </p>
        <p className="mt-1 text-[10px] text-slate-500">
          {sourceLabel ?? 'Meteo inferida por tramos'} capturada durante la marcha; no procede de sensores montados en la bicicleta.
          {staleSampleCount > 0 ? ` ${staleSampleCount} ${staleSampleCount === 1 ? 'lectura era antigua' : 'lecturas eran antiguas'}.` : ''}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-4">
        <div className="rounded-xl bg-slate-950/55 p-3">
          <p className="text-[8px] font-black uppercase text-slate-500">Temperatura media</p>
          <p className="mt-1 text-xl font-black">{averageTemperature == null ? '—' : `${averageTemperature.toFixed(1)}°`}</p>
        </div>
        <div className="rounded-xl bg-slate-950/55 p-3">
          <p className="flex items-center gap-1 text-[8px] font-black uppercase text-slate-500"><Droplets className="h-3 w-3" /> Humedad media</p>
          <p className="mt-1 text-xl font-black">{averageHumidity == null ? '—' : `${averageHumidity.toFixed(0)}%`}</p>
        </div>
        <div className="rounded-xl bg-slate-950/55 p-3">
          <p className="flex items-center gap-1 text-[8px] font-black uppercase text-slate-500"><Wind className="h-3 w-3" /> Ráfaga máxima</p>
          <p className="mt-1 text-xl font-black">{maxWind ? `${maxWind.toFixed(0)} km/h` : '—'}</p>
        </div>
        <div className={`rounded-xl p-3 ${minimumLightMargin != null && minimumLightMargin < 15 ? 'bg-red-500/15' : 'bg-slate-950/55'}`}>
          <p className="flex items-center gap-1 text-[8px] font-black uppercase text-slate-500"><Sunset className="h-3 w-3" /> Margen de luz mínimo</p>
          <p className="mt-1 text-xl font-black">{minimumLightMargin == null ? '—' : `${Math.round(minimumLightMargin)} min`}</p>
        </div>
      </div>

      {(temperaturePath || windPath) && (
        <div className="mx-4 mb-4 rounded-2xl border border-white/5 bg-slate-950/50 p-3">
          <div className="mb-2 flex flex-wrap gap-3 text-[9px] font-bold text-slate-400">
            <span className="flex items-center gap-1"><i className="h-0.5 w-4 bg-orange-400" /> temperatura</span>
            <span className="flex items-center gap-1"><i className="h-0.5 w-4 bg-cyan-400" /> viento</span>
            <span className="ml-auto">evolución por distancia · escalas independientes</span>
          </div>
          <svg viewBox="0 0 100 58" className="h-28 w-full" role="img" aria-label="Evolución de temperatura y viento a lo largo de la actividad">
            {[10, 24, 38, 52].map((y) => <line key={y} x1="4" x2="96" y1={y} y2={y} stroke="#334155" strokeWidth=".5" />)}
            {temperaturePath && <path d={temperaturePath} fill="none" stroke="#fb923c" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />}
            {windPath && <path d={windPath} fill="none" stroke="#22d3ee" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />}
          </svg>
        </div>
      )}

      <div className="flex gap-3 overflow-x-auto px-4 pb-4">
        {ordered.map((sample, index) => (
          <article key={`${sample.capturedAt}-${sample.phaseId}-${index}`} className="min-w-56 rounded-2xl border border-white/10 bg-slate-950/55 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[9px] font-black uppercase text-cyan-300">km {(sample.distanceM / 1000).toFixed(1)}</p>
              <span className={`rounded-full px-2 py-0.5 text-[8px] font-black uppercase ${
                sample.dataIsStale
                  ? 'bg-amber-500/20 text-amber-300'
                  : sample.riskLevel === 'red'
                    ? 'bg-red-500/20 text-red-300'
                    : sample.riskLevel === 'yellow'
                      ? 'bg-amber-500/20 text-amber-300'
                      : 'bg-emerald-500/15 text-emerald-300'
              }`}>{sample.dataIsStale ? 'dato antiguo' : sample.confidence}</span>
            </div>
            <p className="mt-2 text-sm font-black">
              {sample.temperatureC == null ? '—' : `${sample.temperatureC.toFixed(0)}°`}
              <span className="mx-2 text-slate-700">·</span>
              {sample.windKmh == null ? '—' : `${sample.windKmh.toFixed(0)} km/h`}
            </p>
            <p className="mt-1 text-[10px] text-slate-500">{effectLabel(sample.windEffect)} · {sample.humidityPct == null ? 'humedad —' : `${sample.humidityPct}% humedad`}</p>
            <p className="mt-2 text-xs leading-relaxed text-slate-300">{sample.feelLabel}</p>
            {sampleAgeLabel(sample) && (
              <p className={`mt-2 text-[9px] ${sample.dataIsStale ? 'font-bold text-amber-300' : 'text-slate-500'}`}>
                {sampleAgeLabel(sample)} al capturar
              </p>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
