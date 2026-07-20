'use client';

import { useEffect } from 'react';

export default function PwaRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) {
      return;
    }

    let active = true;
    let registration: ServiceWorkerRegistration | null = null;
    const refreshWorker = () => {
      if (!active || !registration || !navigator.onLine || document.visibilityState !== 'visible') return;
      void registration.update().catch(() => {
        // La versión ya instalada sigue siendo válida aunque no se pueda comprobar una actualización.
      });
    };

    void navigator.serviceWorker.register('/sw.js', {
      scope: '/',
      updateViaCache: 'none',
    }).then((nextRegistration) => {
      if (!active) return;
      registration = nextRegistration;
      refreshWorker();
    }).catch(() => {
      // La aplicación sigue funcionando online aunque el modo offline no esté disponible.
    });

    window.addEventListener('online', refreshWorker);
    document.addEventListener('visibilitychange', refreshWorker);
    return () => {
      active = false;
      window.removeEventListener('online', refreshWorker);
      document.removeEventListener('visibilitychange', refreshWorker);
    };
  }, []);

  return null;
}
