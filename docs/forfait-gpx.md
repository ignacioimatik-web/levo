# Forfait MTB — Integración de GPX reales

## Estado actual

Todo el Forfait MTB funciona con datos demo. Los senderos tienen `dataStatus: "placeholder"` y las rutas del mapa SVG son curvas Bezier sintéticas (`src/data/map-demo-paths.ts`).

Este documento describe la arquitectura preparada para migrar a tracks GPX reales sin reescribir la aplicación.

---

## 1. Dónde guardar los archivos GPX

Los GPX se almacenan como archivos estáticos dentro del proyecto, en un directorio dedicado:

```
public/gpx/
├── sendero-verde.gpx
├── sendero-azul.gpx
├── bajada-roja.gpx
└── ...
```

### Alternativas futuras (cuando haya muchos archivos)

- Bucket S3 / Cloudflare R2 + descarga firmada.
- API propia que sirva el binario bajo autenticación.
- Base de datos con columna `gpx_data` (evitar para archivos > 1 MB).

### Regla de negocio

Los GPX se consideran contenido editorial. No se parsean en cliente salvo para visualización. El servidor (Node/Next) puede parsearlos en build-time o bajo demanda para extraer metadatos.

---

## 2. Cómo vincular un GPX a un sendero

El modelo `MTBTrail` ya tiene el campo:

```ts
gpxFile?: string;   // ruta relativa dentro de public/
```

### Ejemplo

```ts
{
  id: "demo-01",
  slug: "sendero-verde-demo",
  gpxFile: "/gpx/sendero-verde.gpx",
  // ...
}
```

### Convención de nombres

Preferir el slug del sendero como nombre de archivo:

| Slug                    | Archivo GPX               |
|-------------------------|---------------------------|
| `sendero-verde-demo`    | `sendero-verde-demo.gpx`  |
| `bajada-roja-demo`      | `bajada-roja-demo.gpx`    |

### Validación

- El archivo debe existir en `public/gpx/` antes de referenciarlo en `gpxFile`.
- Si el GPX se elimina, el campo debe ponerse a `undefined`.

---

## 3. Campos extraíbles del GPX

Usando un parser como `@tmcw/togeojson` o `xml-js` + `@mapbox/polyline`, se pueden extraer estos campos del modelo `MTBTrail`:

### 3a. Coordenadas

```ts
coordinates?: TrailPoint[];
```

```ts
interface TrailPoint {
  lat: number;
  lng: number;
  elevation?: number;
}
```

Extracción: recorrer `<trkpt>` en el GPX y volcar `lat`, `lon`, y `ele`.

### 3b. Distancia

```ts
distanceKm?: number;
```

Cálculo: Haversine entre cada par de puntos consecutivos. Librerías útiles:

- `geolib` – `getPathLength()`
- `@turf/length` – computa sobre GeoJSON

### 3c. Desnivel acumulado

```ts
elevationGainM?: number;
elevationLossM?: number;
```

Cálculo: sumar subidas (`ele[i] > ele[i-1]`) y bajadas (`ele[i] < ele[i-1]`) usando la elevación de cada trackpoint. Ignorar diferencias < 1 m para evitar ruido GPS.

### 3d. Altitud máxima y mínima

```ts
// Nuevos campos sugeridos (no existen actualmente)
maxElevationM?: number;
minElevationM?: number;
```

Estos campos son útiles para el perfil altimétrico y para mostrar "cota máxima" en la ficha del sendero.

### 3e. Perfil altimétrico

No almacenar el perfil completo en el modelo. En su lugar:

1. Decimar la serie de elevaciones (ej. 100 puntos para el gráfico).
2. Almacenar como `elevationProfile?: number[]` en el sendero, o calcularlo bajo demanda desde `coordinates`.

---

## 4. Campos que requieren revisión manual

Estos campos **no** se pueden determinar automáticamente del GPX. Deben ser asignados por un editor:

### Dificultad técnica

```ts
technicalRating?: 1 | 2 | 3 | 4 | 5;
```

El GPX no refleja obstáculos, exposición, peraltes, raíces, roca suelta, ni anchura de senda. Requiere evaluación sobre el terreno o consenso local.

### Dificultad física

```ts
physicalRating?: 1 | 2 | 3 | 4 | 5;
```

Aunque el desnivel acumulado y la distancia ayudan, la dificultad física también depende del tipo de terreno, superficie, pendientes sostenidas y altitud. Requiere ajuste manual.

### Estado

```ts
status: TrailStatus; // "open" | "caution" | "closed" | "seasonal" | "unknown"
```

El estado cambia con el tiempo (obras, meteorología, batidas, ganado). No se deduce del track.

### Warnings

```ts
warnings: string[];
```

Advertencias editoriales: "paso expuesto", "sin cobertura", "no recomendado en mojado". Dependen del conocimiento local.

### Compatibilidad e-bike

```ts
ebikeFriendly?: boolean;
```

Depende de la anchura del sendero, tipo de obstáculos y regulación local. No deducible del GPX.

### Flujo de trabajo recomendado

1. Subir GPX → se extraen coordenadas, distancia, desniveles, altitudes.
2. Creador de contenido revisa y asigna: dificultad técnica, dificultad física, estado, warnings, e-bike.
3. Se publica el sendero con `dataStatus: "real"`.

---

## 5. Migración del mapa SVG a mapas reales

El mapa SVG (`ForfaitMap.tsx`) es provisional. Para integrar GPX reales hay tres caminos:

### Opción A — Leaflet (recomendada para empezar)

```bash
npm install leaflet @types/leaflet react-leaflet
```

- Reemplazar `ForfaitMap.tsx` por un componente que renderice `<MapContainer>`.
- Usar `<Polyline>` con las coordenadas de cada sendero.
- Dificultad baja; integración directa con React.
- Limitación: no tiene soporte nativo para terreno 3D o tiles vectoriales.

### Opción B — MapLibre GL JS

```bash
npm install maplibre-gl @maplibre/maplibre-gl-react
```

- Soporta tiles vectoriales, estilo personalizado, terreno 3D.
- Más complejo que Leaflet pero más potente.
- Requiere un estilo base (p. ej. demotiles de MapLibre o propio).

### Opción C — OpenStreetMap (solo fondo)

Usar Leaflet + tileLayer de OSM. No requiere API key.

```ts
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {...})
```

### Dónde hacer el cambio

El punto de entrada es `ForfaitInteractive.tsx`. Actualmente:

```
ForfaitInteractive
  ├─ ForfaitMap        ← SVG provisional
  └─ TrailDrawer
```

Futuro:

```
ForfaitInteractive
  ├─ RealMap           ← Leaflet / MapLibre
  └─ TrailDrawer
```

### Modelo de datos para el mapa real

Cuando se migre, el mapa leerá `trail.coordinates` directamente (no `map-demo-paths.ts`). Si un sendero no tiene coordenadas, se omite del mapa (o se muestra marcador genérico).

La transformación de coordenadas GPX → `[lng, lat]` para Leaflet se hace en un helper:

```ts
// src/lib/gpx-utils.ts (por crear)
export function trailToGeoJSON(trail: MTBTrail): Feature {
  return {
    type: "Feature",
    geometry: {
      type: "LineString",
      coordinates: trail.coordinates?.map(p => [p.lng, p.lat]) ?? [],
    },
    properties: { id: trail.id, difficulty: trail.difficulty },
  };
}
```

---

## 6. Riesgos y consideraciones

### 6a. SSR en Next.js

Leaflet, MapLibre y `window` no existen en el servidor. Los componentes de mapa deben cargarse con:

```ts
import dynamic from 'next/dynamic';

const RealMap = dynamic(() => import('@/components/RealMap'), { ssr: false });
```

Ya se hace algo similar con `ForfaitPageClient` (cliente). Pero el mapa actual (`ForfaitMap`) se renderiza dentro de un cliente, por lo que no hay conflicto actual. Al migrar, mantener el mapa dentro de un componente cliente.

### 6b. Peso de archivos GPX

- Un track de 50 km con muestreo cada segundo pesa 1–3 MB XML.
- En cliente: no parsear GPX completos en el navegador. Servir las coordenadas ya extraídas desde el modelo.
- En build: si se parsean todos los GPX en `getStaticProps`, el tiempo de build puede aumentar. Considerar leerlos bajo demanda con una API Route.

### 6c. Tracks duplicados

Un mismo segmento físico puede aparecer en múltiples senderos (p. ej., un enlace compartido). Para evitar duplicación:

- Si un track se solapa > 80 % con otro, el sistema debe advertirlo.
- No hay implementación actual; se recomienda revisión manual al incorporar cada GPX.

### 6d. Derechos y autorización de tracks

- Si los tracks provienen de voluntarios, asegurar que quien los graba autoriza su publicación.
- Si se importan de Wikidata, OpenStreetMap o Strava, verificar licencia.
- No incluir tracks de terceros sin permiso explícito.

### 6e. Coordenadas privadas o sensibles

- Algunos senderos pueden pasar por propiedades privadas, zonas de nidificación o parques con restricciones.
- No publicar tracks de acceso restringido.
- Considerar un campo `publicCoordinates?: boolean` para ocultar el track en el mapa si es sensible, mostrando solo el inicio/sector.

---

## Resumen de tareas pendientes (futuro)

| Tarea | Dependencia |
|-------|-------------|
| Elegir parser GPX (`@tmcw/togeojson` o `xml-js`) | — |
| Crear `src/lib/gpx-utils.ts` con `parseGPX()`, `computeDistance()`, `computeElevation()` | parser |
| Crear `src/lib/geo-utils.ts` con `toGeoJSON()` | — |
| Añadir campos `maxElevationM`, `minElevationM`, `elevationProfile` al modelo (opcional) | modelo |
| Migrar `ForfaitMap` → `RealMap` con Leaflet o MapLibre | decisión mapa |
| Añadir API Route `/api/gpx/[slug]` para servir GPX bajo demanda | — |
| Implementar advertencia de tracks duplicados | parseador |
| Definir política de licencias y autorización de tracks | legal |
