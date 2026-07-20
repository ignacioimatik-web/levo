import React from 'react';
import Link from 'next/link';
import { promises as fs } from 'fs';
import path from 'path';
import {
  Map,
  ArrowRight,
  Bike,
  ChevronRight,
  ShieldCheck,
  MapPin,
  Mountain
} from 'lucide-react';
import TopoBackground from '@/components/TopoBackground';
import SectionHeading from '@/components/SectionHeading';
import RouteCard from '@/components/RouteCard';
import ContinuousProfile from '@/components/ContinuousProfile';
import { routes, sectors } from '@/data/routes';
import { parseGPX } from '@/lib/gpx-utils';
import { analyzeRoute } from '@/lib/route-analysis';

export default async function Home() {
  let profileSeries: Array<{ km: number; elevationM: number }> = [];
  try {
    const gpxPath = path.join(process.cwd(), 'public/tracks/coronel-perdido.gpx');
    const xml = await fs.readFile(gpxPath, 'utf8');
    const points = parseGPX(xml);
    const result = analyzeRoute(points);
    profileSeries = result.profileSeries;
  } catch {
    // silently fall through — profile won't render
  }
  return (
    <div className="relative min-h-screen overflow-x-hidden">
      {/* --- HERO SECTION --- */}
      <section className="relative min-h-screen flex items-start justify-center pt-[8vh] overflow-visible">
        <video
          autoPlay
          muted
          loop
          playsInline
          className="absolute inset-0 w-full h-full object-cover z-0"
        >
          <source src="/videos/hero-bg.mp4" type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/70 via-slate-950/50 to-slate-950/80 z-[1]"></div>

        <div className="relative z-20 text-center px-6 max-w-5xl">
          <img
            src="/images/logo-enduro-ebiketracks.png"
            alt="E-nduro Ebiketracks"
            className="w-full max-w-3xl mx-auto mb-2 -mt-6 object-contain"
          />
          <h1 className="text-5xl md:text-8xl font-black tracking-tighter text-white mb-6 leading-none">
            E-NDURO <br />
            <span className="text-orange-500">EBIKETRACKS</span>
          </h1>
          <p className="text-xl md:text-3xl font-light text-slate-300 mb-12 max-w-3xl mx-auto leading-relaxed">
            Enduro, all-mountain y sendas históricas en Els Ports.
          </p>
          <p className="text-lg text-slate-400 mb-12 max-w-2xl mx-auto">
            Rutas autoguiadas por GPS para descubrir la esencia de Morella sobre dos ruedas.
          </p>

          <div className="flex flex-col sm:flex-row gap-5 justify-center items-center">
            <Link
              href="/rutas"
              className="w-full sm:w-auto px-10 py-4 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold text-lg transition-all shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2"
            >
              Explorar rutas <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* --- SECTORES SECTION --- */}
      <section className="py-24 px-6 relative">
        <div className="max-w-7xl mx-auto">
          <SectionHeading
            title="Rutas por Sectores"
            subtitle="Explora las diferentes zonas que hacen de Morella un destino único."
            align="center"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {sectors.map((sector) => (
              <Link key={sector.id} href={`/rutas?sector=${encodeURIComponent(sector.name)}`} className="group">
                <div className="bg-slate-900 border border-white/5 p-6 rounded-2xl hover:border-orange-500/50 transition-all h-full">
                  <h3 className="text-lg font-bold text-white mb-2 group-hover:text-orange-500 transition-colors">{sector.name}</h3>
                  <p className="text-slate-500 text-xs leading-relaxed mb-4">{sector.description}</p>
                  <div className="flex items-center text-[10px] font-bold text-orange-500 uppercase tracking-widest">
                    Explorar <ChevronRight className="w-3 h-3 ml-1 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* --- TOP TRACKS SECTION --- */}
      <section className="py-24 px-6 bg-slate-950/50 relative">
        <TopoBackground />
        <div className="max-w-7xl mx-auto relative z-10">
          <SectionHeading
            title="Top Tracks"
            subtitle="Nuestros tramos más técnicos y emblemáticos. El corazón del enduro."
            align="center"
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {routes.slice(0, 3).map(route => (
              <RouteCard key={route.id} route={route} />
            ))}
          </div>
        </div>
      </section>

      {/* --- SEGURIDAD SECTION --- */}
      <section className="py-24 px-6 bg-slate-950">
        <div className="max-w-lg mx-auto">
          <SectionHeading title="Seguridad" />
          <div className="p-8 bg-orange-500/5 border border-orange-500/20 rounded-3xl">
            <div className="flex items-start gap-4">
              <ShieldCheck className="w-10 h-10 text-orange-500 flex-shrink-0" />
              <div>
                <h4 className="text-white font-bold text-xl mb-3">Tu seguridad es primero</h4>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Las rutas son autoguiadas. Es fundamental conocer tu nivel, llevar equipo adecuado y consultar la meteorología.
                </p>
              </div>
            </div>
            <Link href="/seguridad" className="mt-8 inline-flex items-center gap-2 text-sm font-bold text-orange-500 hover:text-orange-400 transition-colors">
              Leer consejos de seguridad <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* --- FORFAIT MTB SECTION --- */}
      <section className="py-24 px-6 bg-slate-950/50">
        <div className="max-w-7xl mx-auto">
          <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-white/10 rounded-3xl overflow-hidden flex flex-col md:flex-row">
            <div className="md:w-1/2 p-6 flex items-center">
              {profileSeries.length > 0 ? (
                <ContinuousProfile series={profileSeries} />
              ) : (
                <div className="w-full h-64 flex items-center justify-center bg-slate-900 rounded-xl border border-white/5">
                  <Mountain className="w-24 h-24 text-orange-500/20" />
                </div>
              )}
            </div>
            <div className="md:w-1/2 p-12 flex flex-col justify-center">
              <div className="flex items-center gap-2 text-orange-500 mb-4">
                <Map className="w-5 h-5" />
                <span className="text-xs font-bold uppercase tracking-widest">Forfait MTB</span>
              </div>
              <h2 className="text-3xl md:text-4xl font-bold heading-gradient-strong mb-6">Plano de senderos</h2>
              <p className="text-slate-400 text-lg mb-8">
                Todos los senderos de Morella Singletracks organizados como un plano de pistas: por sectores, niveles, estado y tipo de recorrido.
              </p>
              <Link href="/forfait" className="text-white font-bold flex items-center gap-2 hover:text-orange-500 transition-colors">
                Explorar forfait <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* --- MORELLA SECTION --- */}
      <section className="py-24 px-6 relative overflow-hidden">
        <TopoBackground />
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center gap-16">
          <div className="md:w-1/2 relative overflow-hidden rounded-3xl shadow-2xl">
            <div className="absolute -top-4 -left-4 w-24 h-24 bg-orange-500/20 rounded-full blur-3xl"></div>
            <div className="absolute -bottom-4 -right-4 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl"></div>
            <video
              autoPlay
              muted
              loop
              playsInline
              className="w-full h-full object-cover relative z-10 rounded-3xl"
            >
              <source src="/videos/morella-dron.mp4" type="video/mp4" />
            </video>
          </div>
          <div className="md:w-1/2">
            <div className="flex items-center gap-2 text-orange-500 mb-4">
              <MapPin className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-widest">Destino</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">Morella: El corazón de la aventura</h2>
            <p className="text-slate-400 text-lg leading-relaxed mb-8">
              Más que un destino de MTB, Morella es un viaje al pasado. Sus murallas medievales, su castillo imponente y la naturaleza indómita de Els Ports te esperan para una experiencia inolvidable.
            </p>
            <Link href="/morella" className="inline-flex items-center gap-2 px-8 py-3 bg-white text-slate-950 rounded-xl font-bold hover:bg-orange-500 hover:text-white transition-all">
              Descubrir Morella <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
