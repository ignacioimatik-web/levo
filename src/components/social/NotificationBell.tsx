'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { createClient } from '@/lib/supabase/browser';

export const NOTIFICATIONS_READ_EVENT = 'levo:notifications-read';

export default function NotificationBell({
  userId,
  onNavigate,
}: {
  userId: string;
  onNavigate?: () => void;
}) {
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) return;
    let active = true;

    const fetchCount = () => {
      void supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('recipient_id', userId)
        .is('read_at', null)
        .then(({ count }) => {
          if (active) setUnread(count ?? 0);
        });
    };
    fetchCount();

    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_id=eq.${userId}`,
        },
        () => setUnread((value) => value + 1),
      )
      .subscribe();

    window.addEventListener(NOTIFICATIONS_READ_EVENT, fetchCount);
    return () => {
      active = false;
      window.removeEventListener(NOTIFICATIONS_READ_EVENT, fetchCount);
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  return (
    <Link
      href="/notificaciones"
      onClick={onNavigate}
      aria-label={unread > 0 ? `${unread} notificaciones sin leer` : 'Notificaciones'}
      className="relative grid h-11 w-11 shrink-0 place-items-center rounded-xl text-slate-400 transition hover:bg-white/5 hover:text-orange-400"
    >
      <Bell className="h-5 w-5" />
      {unread > 0 && (
        <span className="absolute right-0.5 top-0.5 grid min-h-4 min-w-4 place-items-center rounded-full bg-orange-500 px-1 text-[9px] font-black leading-none text-white ring-2 ring-slate-950">
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </Link>
  );
}
