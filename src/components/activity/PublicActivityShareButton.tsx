'use client';

import { useState } from 'react';
import { Check, Share2 } from 'lucide-react';

export default function PublicActivityShareButton({ title, summary }: { title: string; summary: string }) {
  const [shared, setShared] = useState(false);

  const share = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title, text: summary, url: window.location.href });
      } else {
        await navigator.clipboard.writeText(`${summary} ${window.location.href}`);
      }
      setShared(true);
      window.setTimeout(() => setShared(false), 2_000);
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) setShared(false);
    }
  };

  return (
    <button onClick={share} className="flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-3 text-xs font-black">
      {shared ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
      {shared ? 'Copiado' : 'Compartir'}
    </button>
  );
}
