'use client';

import { FormEvent, useRef, useState } from 'react';
import { LocateFixed, MapPin, Search, X } from 'lucide-react';
import type { GeocodingResult } from '@/lib/geocoding';

export default function PlaceSearch({
  onSelect,
  onUseAsStart,
}: {
  onSelect: (result: GeocodingResult) => void;
  onUseAsStart: (result: GeocodingResult) => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeocodingResult[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  const search = async (event: FormEvent) => {
    event.preventDefault();
    const normalized = query.trim().replace(/\s+/g, ' ');
    if (normalized.length < 2) {
      setStatus('error');
      setMessage('Escribe al menos 2 caracteres.');
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setStatus('loading');
    setMessage('');
    try {
      const response = await fetch(`/api/geocode?q=${encodeURIComponent(normalized)}`, {
        signal: controller.signal,
      });
      const payload = await response.json() as {
        results?: GeocodingResult[];
        error?: string;
      };
      if (!response.ok) throw new Error(payload.error || 'No se pudo buscar el lugar.');
      const next = payload.results ?? [];
      setResults(next);
      setStatus('ready');
      setMessage(next.length === 0 ? 'No encontramos ese lugar. Prueba con provincia o país.' : '');
    } catch (error) {
      if (controller.signal.aborted) return;
      setResults([]);
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'No se pudo buscar el lugar.');
    }
  };

  const close = () => {
    abortRef.current?.abort();
    setResults([]);
    setMessage('');
    setStatus('idle');
  };

  return (
    <div className="pointer-events-auto w-[min(360px,calc(100vw-5.5rem))]">
      <form
        onSubmit={search}
        className="flex min-h-12 overflow-hidden rounded-xl border border-white/15 bg-slate-950/95 shadow-2xl backdrop-blur"
        role="search"
      >
        <Search className="ml-3 h-4 w-4 self-center text-orange-400" aria-hidden="true" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Localidad, puerto o sendero…"
          maxLength={120}
          aria-label="Buscar un lugar en el mapa"
          className="min-w-0 flex-1 bg-transparent px-3 text-sm text-white outline-none placeholder:text-slate-500"
        />
        {(results.length > 0 || message) && (
          <button
            type="button"
            onClick={close}
            className="grid min-h-11 w-11 place-items-center text-slate-400"
            aria-label="Cerrar resultados"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        <button
          type="submit"
          disabled={status === 'loading'}
          className="min-h-11 bg-orange-500 px-3 text-[10px] font-black uppercase text-white disabled:opacity-60"
        >
          {status === 'loading' ? 'Buscando' : 'Buscar'}
        </button>
      </form>

      {(results.length > 0 || message) && (
        <div
          className="mt-2 max-h-[42svh] overflow-y-auto rounded-xl border border-white/15 bg-slate-950/95 p-1.5 shadow-2xl backdrop-blur"
          aria-live="polite"
        >
          {message && <p className="p-3 text-xs leading-relaxed text-slate-300">{message}</p>}
          {results.map((result) => (
            <div key={result.id} className="flex gap-1 border-b border-white/5 p-1 last:border-0">
              <button
                type="button"
                onClick={() => onSelect(result)}
                className="flex min-h-12 min-w-0 flex-1 items-start gap-2 rounded-lg px-2 py-2 text-left hover:bg-white/5"
              >
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-orange-400" />
                <span className="min-w-0">
                  <span className="line-clamp-2 block text-xs font-bold leading-relaxed text-white">{result.name}</span>
                  <span className="mt-0.5 block text-[9px] uppercase text-slate-500">{result.type}</span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onUseAsStart(result);
                  close();
                }}
                className="flex min-h-12 w-16 shrink-0 flex-col items-center justify-center rounded-lg bg-emerald-500/15 text-[8px] font-black uppercase text-emerald-300"
                aria-label={`Usar ${result.name} como punto de ruta`}
              >
                <LocateFixed className="mb-0.5 h-4 w-4" />
                Punto
              </button>
            </div>
          ))}
          <p className="px-3 py-2 text-[8px] text-slate-600">© colaboradores de OpenStreetMap · búsqueda manual, sin autocompletar</p>
        </div>
      )}
    </div>
  );
}
