import React from 'react';
import Link from 'next/link';
import { MTBRoute } from '@/data/routes';
import { 
  Navigation, 
  Timer, 
  TrendingUp, 
  Mountain, 
  Download,
  Route,
} from 'lucide-react';

interface RouteCardProps {
  route: MTBRoute;
}

const DifficultyBadge = ({ difficulty }: { difficulty: string }) => {
  const colors: Record<string, string> = {
    verde: 'bg-green-500/20 text-green-400 border-green-500/30',
    azul: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    roja: 'bg-red-500/20 text-red-400 border-red-500/30',
    negra: 'bg-slate-700/50 text-slate-300 border-slate-500/30',
    'doble-negra': 'bg-black/50 text-red-600 border-red-900/50',
    pendiente: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  };

  return (
    <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded border ${colors[difficulty] || colors.pendiente}`}>
      {difficulty}
    </span>
  );
};

const StatusBadge = ({ status }: { status: MTBRoute['status'] }) => {
  const configs: Record<string, { label: string; color: string }> = {
    publicada: { label: 'Disponible', color: 'bg-green-500 text-white' },
    'pendiente-datos': { label: 'Pendiente', color: 'bg-orange-500 text-white' },
    'cerrada-temporalmente': { label: 'Cerrada', color: 'bg-red-600 text-white' },
  };

  const config = configs[status] || configs['pendiente-datos'];

  return (
    <span className={`text-[9px] uppercase tracking-tighter font-black px-1.5 py-0.5 rounded ${config.color}`}>
      {config.label}
    </span>
  );
};

const RouteCard = ({ route }: RouteCardProps) => {
  const isClosed = route.status === 'cerrada-temporalmente';
  const isPending = route.status === 'pendiente-datos';

  return (
    <div className={`group relative bg-slate-900/50 border rounded-xl overflow-hidden transition-all duration-300 flex flex-col h-full ${
      isClosed ? 'border-red-900/50 opacity-80' : isPending ? 'border-orange-900/30' : 'border-white/5 hover:border-orange-500/50 hover:shadow-xl hover:shadow-orange-500/5'
    }`}>
      {/* Image Container */}
      <div className="relative h-48 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 to-transparent z-10" />
        <div className="absolute inset-0 bg-slate-800 flex items-center justify-center text-slate-600 italic text-sm">
          {["coronel-perdido", "garumba-gigante", "santets-gegants", "vuelta-garumba"].includes(route.slug) ? (
            <video
              autoPlay
              muted
              loop
              playsInline
              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
            >
              <source src={`/videos/${route.slug}.mp4`} type="video/mp4" />
            </video>
          ) : route.images.length > 0 ? (
            <img src={route.images[0]} alt={route.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
          ) : (
            "Image placeholder"
          )}
        </div>
        
        <div className="absolute top-3 left-3 z-20 flex gap-2">
          <DifficultyBadge difficulty={route.physicalDifficulty} />
        </div>

        <div className="absolute top-3 right-3 z-20">
          <StatusBadge status={route.status} />
        </div>

        <div className="absolute bottom-3 left-3 z-20">
          <div className="flex items-center gap-1 text-xs font-medium text-slate-300 bg-black/40 backdrop-blur-sm px-2 py-1 rounded">
            <Navigation className="w-3 h-3" />
            {route.sector}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-5 flex-grow flex flex-col">
        <h3 className="text-xl font-bold text-white mb-2 group-hover:text-orange-500 transition-colors">
          {route.name}
        </h3>
        <p className="text-slate-400 text-sm line-clamp-2 mb-4">
          {route.summary}
        </p>

        {/* Technical Specs Grid */}
        <div className="grid grid-cols-2 gap-y-3 gap-x-4 mb-6 text-xs border-t border-white/5 pt-4">
          <div className="flex items-center gap-2 text-slate-300">
            <Navigation className="w-3.5 h-3.5 text-orange-500" />
            <span>{route.distanceKm ? `${route.distanceKm} km` : '--'}</span>
          </div>
          <div className="flex items-center gap-2 text-slate-300">
            <TrendingUp className="w-3.5 h-3.5 text-orange-500" />
            <span>{route.elevationGainM ? `${route.elevationGainM} m` : '--'}</span>
          </div>
          <div className="flex items-center gap-2 text-slate-300">
            <Timer className="w-3.5 h-3.5 text-orange-500" />
            <span>{route.estimatedTime || '--'}</span>
          </div>
          <div className="flex items-center gap-2 text-slate-300">
            <Mountain className="w-3.5 h-3.5 text-orange-500" />
            <span>{route.trailPercent ? `${route.trailPercent}% senda` : '--'}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-auto pt-4 flex items-center gap-3">
          <Link 
            href={`/rutas/${route.slug}`}
            className="flex-grow text-center bg-white text-slate-950 py-2 rounded-lg text-xs font-bold hover:bg-orange-500 hover:text-white transition-all"
          >
            DETALLES
          </Link>
          <a
            href={route.trackUrl || '#'}
            download
            className={`min-h-11 min-w-11 inline-flex items-center justify-center bg-slate-800 text-white rounded-lg hover:bg-orange-500 transition-colors disabled:opacity-30 ${(!route.trackUrl || isClosed || isPending) ? 'pointer-events-none opacity-30' : ''}`}
            title="Descargar GPX"
          >
            <Download className="w-4 h-4" />
          </a>
          <Link
            href={route.trackUrl
              ? `/planifica?gpx=${encodeURIComponent(route.trackUrl)}&name=${encodeURIComponent(route.name)}`
              : '#'}
            className={`min-h-11 min-w-11 inline-flex items-center justify-center bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors ${(!route.trackUrl || isClosed || isPending) ? 'pointer-events-none opacity-30' : ''}`}
            title="Preparar y navegar"
            aria-label={`Preparar y navegar ${route.name}`}
          >
            <Route className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
};

export default RouteCard;
