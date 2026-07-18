import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'E-nduro Ebiketracks',
    short_name: 'E-nduro',
    description: 'Explora, combina y descarga rutas MTB y e-bike de Morella y Els Ports.',
    start_url: '/',
    display: 'standalone',
    background_color: '#020617',
    theme_color: '#020617',
    orientation: 'any',
    categories: ['sports', 'navigation', 'travel'],
    lang: 'es',
    icons: [
      {
        src: '/images/logo-enduro-ebiketracks.png',
        sizes: '1024x1024',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/images/logo-enduro-ebiketracks.png',
        sizes: '1024x1024',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
