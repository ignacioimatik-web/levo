import { MetadataRoute } from 'next';
import { routes } from '@/data/routes';
import { demoTrails } from '@/data/trails';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://gpxtour.vercel.app';

  const staticRoutes = [
    '', '/rutas', '/sectores', '/top-tracks', '/travesias',
    '/forfait', '/planifica', '/morella', '/seguridad', '/contacto',
  ].map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: 'monthly' as const,
    priority: route === '' ? 1 : 0.8,
  }));

  const routePages = routes.map((route) => ({
    url: `${baseUrl}/rutas/${route.slug}`,
    lastModified: new Date(),
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }));

  const trailPages = demoTrails.map((trail) => ({
    url: `${baseUrl}/forfait/${trail.slug}`,
    lastModified: new Date(),
    changeFrequency: 'monthly' as const,
    priority: 0.5,
  }));

  return [...staticRoutes, ...routePages, ...trailPages];
}
