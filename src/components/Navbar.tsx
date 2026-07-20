'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
import { Menu, ChevronDown, X, LogOut } from 'lucide-react';
import { createClient } from '@/lib/supabase/browser';
import { signOut } from '@/lib/supabase/auth';
import type { User } from '@supabase/supabase-js';

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
        <div className="absolute top-full left-1/2 -translate-x-1/2 pt-2 z-[100]">
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
  { label: 'Rutas', items: [
    { label: 'Todas las rutas', href: '/rutas' },
    { label: 'Sectores', href: '/sectores' },
    { label: 'Top Tracks', href: '/top-tracks' },
  ]},
  { label: 'Forfait', href: '/forfait' },
  { label: 'Alerta Presión', href: '/alerta-presion' },
  { label: 'Nosotros', items: [
    { label: 'Quiénes Somos', href: '/quienes-somos' },
    { label: 'Morella', href: '/morella' },
  ]},
];

const socialIconClass = "w-4 h-4 text-slate-400 hover:text-orange-500 transition-colors";

function SocialIcons() {
  return (
    <div className="flex items-center gap-3">
      <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" className={socialIconClass} aria-label="Instagram">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
          <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
          <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
        </svg>
      </a>
      <a href="https://x.com" target="_blank" rel="noopener noreferrer" className={socialIconClass} aria-label="X">
        <svg viewBox="0 0 24 24" fill="currentColor" stroke="none">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      </a>
      <a href="https://www.youtube.com/channel/UCjdDoPPgvPCUAw3-IsiFYUg" target="_blank" rel="noopener noreferrer" className={socialIconClass} aria-label="YouTube">
        <svg viewBox="0 0 24 24" fill="currentColor" stroke="none">
          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
        </svg>
      </a>
    </div>
  );
}

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
              href="/auth"
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
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
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
    <nav className="bg-slate-950/80 backdrop-blur-md border-b border-white/5 sticky top-0 z-[60]">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group">
          <img
            src="/images/logo-enduro-ebiketracks.png"
            alt="E-nduro Ebiketracks"
            className="h-8 w-auto group-hover:scale-110 transition-transform"
          />
          <span className="text-lg font-black tracking-tighter text-white uppercase hidden sm:inline">
            E-nduro <span className="text-orange-500">Ebiketracks</span>
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-6 text-xs font-bold uppercase tracking-widest">
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
          <SocialIcons />
        </div>

        <div className="md:hidden">
          <button onClick={() => setMobileOpen(!mobileOpen)} className="text-white p-1">
            {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-white/5 bg-slate-950/95 backdrop-blur-md">
          <div className="px-6 py-4 space-y-4">
            <div className="pb-4 border-b border-white/5">
              {user ? (
                <div className="space-y-2">
                  <p className="text-sm font-bold text-white">
                    {user.user_metadata?.full_name as string || user.email}
                  </p>
                  <button
                    onClick={handleSignOut}
                    className="flex items-center gap-2 text-sm font-bold text-red-400 hover:text-red-300 transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Cerrar sesión
                  </button>
                </div>
              ) : (
                <Link
              href="/account"
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
            <div className="border-t border-white/5 pt-4">
              <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-3">Síguenos</p>
              <SocialIcons />
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
