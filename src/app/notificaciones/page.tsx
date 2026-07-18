import type { Metadata } from 'next';
import NotificationInbox from '@/components/social/NotificationInbox';
import { requireAuth } from '@/lib/auth/guards';

export const metadata: Metadata = {
  title: 'Notificaciones',
  description: 'Seguidores, kudos y comentarios de tu comunidad rider.',
  robots: { index: false, follow: false },
};

export default async function NotificationsPage() {
  const user = await requireAuth();
  return (
    <main className="min-h-screen bg-slate-950 pb-28 text-white md:pb-16">
      <div className="mx-auto max-w-3xl px-4 py-7 sm:px-6 md:py-12">
        <NotificationInbox userId={user.id} />
      </div>
    </main>
  );
}
