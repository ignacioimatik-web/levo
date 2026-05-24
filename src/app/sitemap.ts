import { Metadata } from 'next';
import { routes } from '@/data/routes';

export default function sitemap(): Promise<Metadata[]> {
  const baseUrl = 'https://ignacioimatik-web.github.io/levo'; // Adjust to actual domain if needed

  const staticRoutes = [
    '',
    '/rutas',
    '/sectores',
    '/top-tracks',
    '/travesias',
    '/planifica',
    '/morella',
    '/seguridad',
    '/contacto',
  ].map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: 'monthly' as const,
    priority: route === '' ? 1 : 0.8,
  }));

  const dynamicRoutes = routes.map((route) => ({
    url: `${baseUrl}/rutas/${route.slug}`,
    lastModified: new Date(),
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }));

  return Promise.resolve([...staticRoutes, ...dynamicRoutes]);
}
