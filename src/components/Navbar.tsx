'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
import { Menu, ChevronDown, X, LogOut } from 'lucide-react';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/browser';
import { signOut } from '@/lib/supabase/auth';
import type { User } from '@supabase/supabase-js';
import ThemeToggle from '@/components/theme/ThemeToggle';

interface DropdownItem {
  label: string;
  href: string;
}

function NavDropdown({ label, items }: { label: string; items: DropdownItem[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-slate-400 hover:text-orange-500 transition-colors text-xs font-bold uppercase tracking-widest"
      >
        {label}
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 pt-2">
          <div className="w-48 bg-slate-900 border border-white/10 rounded-xl shadow-2xl py-2 space-y-1">
            {items.map(item => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="block px-4 py-2.5 text-xs font-bold text-slate-400 hover:text-orange-500 hover:bg-white/5 transition-colors"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const navItems: ({ label: string; href: string } | { label: string; items: DropdownItem[] })[] = [
  { label: 'Rider', items: [
    { label: 'Grabar salida', href: '/grabar' },
    { label: 'Mis actividades', href: '/actividades' },
    { label: 'Mapa personal', href: '/mapa-personal' },
    { label: 'Mis segmentos', href: '/segmentos' },
    { label: 'Mi progreso', href: '/progreso' },
    { label: 'Mi taller', href: '/taller' },
    { label: 'Alerta presión', href: '/alerta-presion' },
  ]},
  { label: 'Rutas', items: [
    { label: 'Todas las rutas', href: '/rutas' },
    { label: 'Sectores', href: '/sectores' },
    { label: 'Top Tracks', href: '/top-tracks' },
  ]},
  { label: 'Forfait', href: '/forfait' },
  { label: 'Planifica', items: [
    { label: 'Planifica tu viaje', href: '/planifica' },
    { label: 'Travesías', href: '/travesias' },
  ]},
  { label: 'Nosotros', items: [
    { label: 'Quiénes Somos', href: '/quienes-somos' },
    { label: 'Morella', href: '/morella' },
  ]},
];

function UserMenu({ user, onSignOut, onNavigate }: {
  user: User | null;
  onSignOut: () => void;
  onNavigate?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (!user) {
    return (
      <Link
        href="/auth"
        onClick={onNavigate}
        className="text-slate-400 hover:text-orange-500 transition-colors text-xs font-bold uppercase tracking-widest whitespace-nowrap"
      >
        Iniciar sesión / Registrarse
      </Link>
    );
  }

  const avatarUrl = user.user_metadata?.avatar_url as string | undefined;
  const displayName = user.user_metadata?.full_name as string | undefined || user.email || 'Usuario';

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-slate-400 hover:text-orange-500 transition-colors"
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="w-6 h-6 rounded-full ring-2 ring-white/10" />
        ) : (
          <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center">
            <span className="text-[10px] font-bold text-slate-300">{displayName.charAt(0).toUpperCase()}</span>
          </div>
        )}
        <span className="text-xs font-bold uppercase tracking-widest hidden lg:inline truncate max-w-28">
          {displayName}
        </span>
        <ChevronDown className={`w-3 h-3 transition-transform hidden lg:block ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute top-full right-0 pt-2">
          <div className="w-48 bg-slate-900 border border-white/10 rounded-xl shadow-2xl py-2 space-y-1">
            <Link
              href="/account"
              onClick={() => { setOpen(false); onNavigate?.(); }}
              className="block px-4 py-2.5 text-xs font-bold text-slate-400 hover:text-orange-500 hover:bg-white/5 transition-colors"
            >
              Mi cuenta
            </Link>
            <button
              onClick={() => { onSignOut(); setOpen(false); }}
              className="flex w-full items-center gap-2 px-4 py-2.5 text-xs font-bold text-red-400 hover:text-red-300 hover:bg-white/5 transition-colors"
            >
              <LogOut className="w-3 h-3" />
              Cerrar sesión
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const Navbar = () => {
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(isSupabaseConfigured);

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) return;
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    await signOut();
    setMobileOpen(false);
    router.push('/');
  };

  const closeMobile = () => setMobileOpen(false);

  return (
    <nav className="bg-slate-950/80 backdrop-blur-md border-b border-white/5 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="group flex min-h-11 items-center gap-2">
          <img
            src="/images/logo-enduro-ebiketracks.png"
            alt="E-nduro Ebiketracks"
            className="h-8 w-auto group-hover:scale-110 transition-transform"
          />
          <span className="text-lg font-black tracking-tighter text-white uppercase hidden sm:inline">
            E-nduro <span className="text-orange-500">Ebiketracks</span>
          </span>
        </Link>

        <div className="hidden xl:flex items-center gap-6 text-xs font-bold uppercase tracking-widest">
          {navItems.map(item => {
            if ('items' in item) {
              return <NavDropdown key={item.label} label={item.label} items={item.items} />;
            }
            return (
              <Link key={item.href} href={item.href} className="text-slate-400 hover:text-orange-500 transition-colors">
                {item.label}
              </Link>
            );
          })}
          <div className="h-4 w-px bg-white/10" />
          {!authLoading && <UserMenu user={user} onSignOut={handleSignOut} />}
          <div className="h-4 w-px bg-white/10" />
          <ThemeToggle />
        </div>

        <div className="flex items-center gap-1">
          <div className="xl:hidden">
            <ThemeToggle />
          </div>
          <div className="xl:hidden">
            <button
              type="button"
              onClick={() => setMobileOpen(!mobileOpen)}
              className="-mr-2 flex min-h-11 min-w-11 items-center justify-center text-white"
              aria-label={mobileOpen ? 'Cerrar menú' : 'Abrir menú'}
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="xl:hidden border-t border-white/5 bg-slate-950/95 backdrop-blur-md">
          <div className="px-6 py-4 space-y-4">
            <div className="pb-4 border-b border-white/5">
              {user ? (
                <div className="space-y-2">
                  <p className="text-sm font-bold text-white">
                    {user.user_metadata?.full_name as string || user.email}
                  </p>
                  <Link
                    href="/account"
                    onClick={closeMobile}
                    className="inline-flex min-h-11 items-center text-sm font-bold text-slate-300 transition-colors hover:text-orange-400"
                  >
                    Mi cuenta
                  </Link>
                  <button
                    onClick={handleSignOut}
                    className="flex min-h-11 items-center gap-2 text-sm font-bold text-red-400 hover:text-red-300 transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Cerrar sesión
                  </button>
                </div>
              ) : (
                <Link
                  href="/auth"
                  onClick={closeMobile}
                  className="block text-sm font-bold text-slate-400 hover:text-orange-500 transition-colors"
                >
                  Iniciar sesión / Registrarse
                </Link>
              )}
            </div>
            {navItems.map(item => (
              <div key={'items' in item ? item.label : item.href}>
                <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-2">{item.label}</p>
                <div className="space-y-1 pl-2">
                  {'items' in item ? item.items.map(sub => (
                    <Link
                      key={sub.href}
                      href={sub.href}
                      onClick={() => setMobileOpen(false)}
                      className="block py-2 text-sm font-bold text-slate-400 hover:text-orange-500 transition-colors"
                    >
                      {sub.label}
                    </Link>
                  )) : (
                    <Link
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className="block py-2 text-sm font-bold text-slate-400 hover:text-orange-500 transition-colors"
                    >
                      {item.label}
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
