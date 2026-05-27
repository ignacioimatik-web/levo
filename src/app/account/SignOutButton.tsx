'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from '@/lib/supabase/auth';
import { LogOut, Loader2 } from 'lucide-react';

export default function SignOutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleSignOut = async () => {
    if (loading) return;
    setLoading(true);
    await signOut();
    router.push('/');
  };

  return (
    <button
      onClick={handleSignOut}
      disabled={loading}
      className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-red-400 hover:text-red-300 bg-slate-800/50 hover:bg-slate-800 border border-white/10 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <LogOut className="w-4 h-4" />
      )}
      {loading ? 'Cerrando sesión...' : 'Cerrar sesión'}
    </button>
  );
}
