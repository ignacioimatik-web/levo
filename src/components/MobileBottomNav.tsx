'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Activity, CircleDot, Compass, Route, Users } from 'lucide-react';

const items = [
  { href: '/comunidad', label: 'Comunidad', icon: Users },
  { href: '/rutas', label: 'Explorar', icon: Compass },
  { href: '/grabar', label: 'Grabar', icon: CircleDot, primary: true },
  { href: '/forfait', label: 'Planificar', icon: Route },
  { href: '/actividades', label: 'Actividad', icon: Activity },
] as const;

function isActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navegación principal móvil"
      className="fixed inset-x-0 bottom-0 z-[1900] border-t border-white/10 bg-slate-950/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
    >
      <div className="mx-auto grid h-16 max-w-md grid-cols-5">
        {items.map(({ href, label, icon: Icon, ...item }) => {
          const active = isActive(pathname, href);
          const primary = 'primary' in item && item.primary;
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={`relative flex min-w-0 flex-col items-center justify-center gap-1 px-1 text-[10px] font-bold transition-colors ${
                active ? 'text-orange-400' : 'text-slate-500 hover:text-slate-200'
              }`}
            >
              <span className={primary ? '-mt-5 grid h-11 w-11 place-items-center rounded-full border-4 border-slate-950 bg-orange-500 text-white shadow-lg shadow-orange-950/50' : ''}>
                <Icon className="h-5 w-5" strokeWidth={active ? 2.5 : 2} />
              </span>
              <span className="truncate">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
