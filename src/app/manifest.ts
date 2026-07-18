import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'E-nduro Ebiketracks',
    short_name: 'E-nduro',
    description: 'Planifica, descarga, navega y graba rutas MTB y e-bike con meteo y autonomía.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#020617',
    theme_color: '#020617',
    orientation: 'any',
    categories: ['sports', 'navigation', 'travel'],
    lang: 'es',
    shortcuts: [
      {
        name: 'Grabar salida',
        short_name: 'Grabar',
        description: 'Iniciar una salida GPS',
        url: '/grabar',
        icons: [{ src: '/images/logo-enduro-ebiketracks.png', sizes: '1024x1024' }],
      },
      {
        name: 'Planificar ruta',
        short_name: 'Planificar',
        description: 'Crear o importar una ruta MTB',
        url: '/planifica',
        icons: [{ src: '/images/logo-enduro-ebiketracks.png', sizes: '1024x1024' }],
      },
    ],
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
