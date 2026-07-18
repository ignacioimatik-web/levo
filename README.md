# LEVO — E-nduro Ebiketracks

**LEVO** es una aplicación web profesional para la planificación, exploración y construcción de rutas de MTB y enduro en la comarca de **Els Ports (Morella, Castellón)**. Combina un catálogo exhaustivo de tracks reales con un constructor de rutas interactivo sobre mapa 3D, perfiles altimétricos, datos meteorológicos en tiempo real (AEMET), y guardado en la nube con autenticación OAuth.

**Desplegada en:** [levo-eta.vercel.app](https://levo-eta.vercel.app)

---

## Stack técnico

| Capa | Tecnología |
|------|-----------|
| **Framework** | Next.js 16 (App Router, Turbopack) |
| **Lenguaje** | TypeScript 5 |
| **Mapas** | Mapbox GL JS (`outdoors-v12`) con terreno 3D (`mapbox-terrain-dem-v1`) |
| **Mapa React** | `react-map-gl/mapbox` v8 |
| **Autenticación** | Supabase Auth (OAuth: Google + Apple) con `@supabase/ssr` |
| **Base de datos** | Supabase PostgreSQL (RLS por usuario) |
| **Estilos** | Tailwind CSS v4 |
| **Iconos** | Lucide React |
| **Geometría** | Turf.js (conexiones, intersecciones, nearest-point-on-line) |
| **GPX** | Parseo nativo de tracks reales; exportación GPX 1.1 |
| **Clima** | API AEMET (Agencia Estatal de Meteorología) |
| **Despliegue** | Vercel (Edge + Serverless) |

---

## Funcionalidades principales

### 🗺️ Explorador de rutas (`/rutas`)
- Catálogo de **29 tracks reales** en GPX, distribuidos en 5 sectores
- Filtros combinados: dificultad, estado, tipo de track, exigencia técnica/física, distancia, apto e-bike, apto lluvia
- Vistas de detalle por track: perfil de elevación, segmentos (subida/bajada/llano), mapa topográfico, descarga GPX

### 🧭 Planificador universal (`/planifica`)
- Búsqueda manual de localidades, puertos y senderos desde cualquier lugar
- Dibujo táctil o con ratón e importación de cualquier GPX
- Análisis AEMET triangulado por tramos, luz restante, ritmo y autonomía e-bike
- Guardado local y en Supabase, exportación GPX y preparación de caminos offline
- Inicio directo de navegación GPS guiada desde la ruta preparada

### 🏔️ Forfait MTB — Constructor de rutas (`/forfait`)
Constructor drag-free que permite al usuario **combinar tracks secuencialmente** para crear una ruta personalizada:

- **Selección por sectores**: panel lateral con árbol expandible de sectores y tracks
- **Sistema de sugerencias**: detecta automáticamente tracks conectables (contacto, cruce, cercanía, superposición, enlace manual) y clasifica en *recomendado*, *con precaución*, *no recomendado*
- **Mapa 3D interactivo**: terreno con sombreado, pitch ajustable, controles de navegación, resalte de tracks seleccionados/previsualizados/recomendados
- **Perfil altimétrico continuo interactivo**: hover/click/teclado para explorar km, altitud, pendiente local, tendencia, porcentajes acumulados de subida/bajada, y máxima restante
- **Correlación mapa-perfil**: al pasar el ratón sobre el perfil de elevación, un marcador naranja se posiciona en el mapa en el punto exacto de la ruta
- **Exportación GPX**: descarga del track completo combinado
- **Cálculos en tiempo real**: distancia total, desnivel acumulado, tiempo estimado, dificultad global, nivel técnico máximo, exigencia física media
- **Advertencias automáticas**: detección de cambios de sentido entre tracks consecutivos

### ☁️ Guardado en la nube
- Rutas guardadas en Supabase (`saved_routes`) con RLS por usuario
- Auto-nombrado incremental ("Mi ruta Forfait", "Mi ruta Forfait 2", …)
- Listado persistente en el panel lateral; carga instantánea al hacer clic
- Copia local en localStorage como respaldo sin conexión

### 🔐 Autenticación
- OAuth exclusivo: Google y Apple (sin email/contraseña)
- Flujo PKCE con `@supabase/ssr` y cookies
- Perfiles auto-creados al registrarse vía trigger de base de datos
- Doble capa de protección: proxy en edge + guard server-side
- Página de cuenta protegida (`/account`) con avatar, nombre, email, proveedor, fechas de registro/último acceso, rol

### 🌤️ Estado de rutas en tiempo real (`/forfait/[slug]`)
- Perfil altimétrico con segmentación subida/bajada/llano
- Meteorología en vivo desde API AEMET
- Cálculo de horas de luz solar (algoritmo NOAA)
- Evaluación de riesgo combinada (clima + terreno)
- Ventana horaria recomendada para salida
- Descarga GPX segmentado con waypoints

### 📄 Páginas de contenido
- **Planifica** (`/planifica`): guía de GPS, alojamiento, meteorología
- **Morella** (`/morella`): información turística de la zona
- **Seguridad** (`/seguridad`): responsabilidad legal, equipo recomendado, buenas prácticas
- **Contacto** (`/contacto`): formulario de contacto
- **Quiénes somos** (`/quienes-somos`): filosofía del proyecto
- **Travesías** (`/travesias`): rutas de varios días (próximamente)

---

## Arquitectura del proyecto

```
src/
├── proxy.ts                    # Edge proxy: auth check rutas protegidas
├── app/
│   ├── layout.tsx              # Layout raíz (Navbar + Footer)
│   ├── page.tsx                # Home / landing
│   ├── globals.css             # Tailwind v4 + tema personalizado
│   ├── sitemap.ts              # Sitemap dinámico
│   ├── account/                # Perfil de usuario (protegido)
│   ├── auth/                   # Login OAuth + callback
│   ├── api/forfait/            # API routes (save-route, route-status, segmented-gpx)
│   ├── forfait/                # Constructor MTB + detalle de track
│   ├── rutas/                  # Catálogo de rutas + detalle
│   ├── sectores/               # Vista por sectores
│   ├── top-tracks/             # Tracks destacados
│   ├── travesias/              # Travesías (próximamente)
│   ├── planifica/              # Guía de planificación
│   ├── morella/                # Información turística
│   ├── seguridad/              # Seguridad y responsabilidad
│   ├── contacto/               # Formulario de contacto
│   └── quienes-somos/          # Sobre el proyecto
├── components/
│   ├── forfait/
│   │   ├── ForfaitBuilder.tsx  # Constructor de rutas (orquestador)
│   │   ├── MTBMap.tsx          # Mapa Mapbox con tracks, rutas, marcadores
│   │   ├── ContinuousProfile.tsx # Perfil altimétrico interactivo
│   │   └── ElevationProfile.tsx  # Perfil estático (legacy)
│   ├── Navbar.tsx              # Navegación principal con auth + redes sociales
│   ├── RouteFilter.tsx         # Filtros y ordenación del catálogo
│   ├── RouteCard.tsx           # Tarjeta de ruta en catálogo
│   ├── TrailCard.tsx           # Tarjeta de trail
│   ├── TrailFilters.tsx        # Filtros de trails
│   ├── TrailStatsPanel.tsx     # Panel de estadísticas
│   ├── TrailNowInsights.tsx    # Insights en tiempo real (weather + daylight)
│   ├── Footer.tsx              # Pie de página
│   └── ...                     # Mapas, leyendas, badges, etc.
├── lib/
│   ├── forfait/
│   │   ├── types.ts            # Tipos: TrackMTB, RutaConstruida, ConexionTrack, etc.
│   │   ├── geo-utils.ts        # Haversine, detección de conexiones, builder de rutas, perfiles
│   │   ├── gpx-export.ts       # Generación y descarga de GPX
│   │   ├── real-tracks.ts      # Parseo de GPX reales a TrackMTB[]
│   │   ├── save-route.ts       # API client para guardado en Supabase
│   │   └── demo-tracks.ts      # Datos demo para pruebas
│   ├── supabase/
│   │   ├── browser.ts          # Cliente Supabase para browser
│   │   ├── server.ts           # Cliente Supabase para server components
│   │   └── auth.ts             # Funciones de autenticación
│   ├── auth/guards.ts          # Guard de rutas protegidas
│   ├── aemet.ts                # Integración API AEMET
│   ├── daylight.ts             # Cálculos de luz solar (NOAA)
│   ├── route-analysis.ts       # Análisis de segmentos y perfil
│   ├── route-status.ts         # Estado completo de ruta (GPX + clima + luz + riesgo)
│   ├── gpx-utils.ts            # Parseo genérico de GPX
│   └── segment-risk.ts         # Evaluación de riesgo por segmento
├── data/
│   ├── routes.ts               # 29 rutas MTB + 5 sectores
│   ├── trails.ts               # 91+ trails demo
│   ├── forfait.ts              # Configuración y datos demo del forfait
│   ├── garumba-coordinates.ts  # Coordenadas demo Garumba
│   └── map-demo-paths.ts       # Paths SVG para mapa demo
└── components/                 # Componentes de página y utilidad
```

```
public/
├── tracks/                     # 29 archivos GPX reales
│   ├── coronel-perdido.gpx
│   ├── garumba-gigante.gpx
│   ├── vuelta-garumba.gpx
│   ├── santets-gegants.gpx
│   └── ... (25 más)
├── videos/                     # Vídeos promocionales
│   ├── hero-bg.mp4
│   ├── morella-dron.mp4
│   ├── coronel-perdido.mp4
│   └── ... (4 más)
└── images/                     # Logos e imágenes
```

```
supabase/                       # Configuración CLI de Supabase
└── .temp/                      # Metadatos del proyecto vinculado
```

---

## Modelo de datos

### TrackMTB
Track individual con datos reales (desde GPX) o demo:
- `id`, `nombre`, `sector`, `dificultad` (verde/azul/rojo/negro/doble-negro)
- `estado` (abierto/cerrado/precaución/revisión)
- `tipo[]` (subida/bajada/enlace/enduro/trail/xc/ebike/circular)
- `distanciaKm`, `desnivelPositivo`, `desnivelNegativo`
- `nivelTecnico` (1-5), `exigenciaFisica` (1-5)
- `aptoEbike`, `aptoLluvia`, `tiempoEstimadoMin`
- `points[]` (lat/lng/elevation), `startPoint`, `endPoint`
- `dataStatus`: "real" | "placeholder"

### RutaConstruida
Ruta combinada de varios tracks:
- `tracks[]`, `conexiones[]`
- `distanciaTotalKm`, `desnivelPositivoTotal`, `desnivelNegativoTotal`
- `dificultadGlobal`, `nivelTecnicoMaximo`, `exigenciaFisicaMedia`
- `pointsCombinados[]`, `connectionWaypoints[]`
- `advertencias[]`

### ConexionTrack
Conexión detectada entre dos tracks:
- `tipoConexion`: contacto | cruce | cercanía | superposición | enlace_manual
- `distanciaMetros`, `dificultadConexion`
- `puntoConexion` (lat/lng), `recomendado`

### saved_routes (Supabase)
- `id` (UUID), `user_id` (FK auth.users)
- `name`, `track_ids` (text[]), `distance_km`, `elevation_gain_m`, `elevation_loss_m`
- `estimated_time_min`, `difficulty`, `created_at`, `updated_at`

### profiles (Supabase)
- `id` (UUID, PK = auth.users.id), `avatar_url`, `full_name`, `last_login_at`, `role`

---

## Variables de entorno

| Variable | Descripción |
|----------|-------------|
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Token público de Mapbox GL JS |
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave anónima de Supabase |
| `AEMET_API_KEY` | API key de la AEMET (meteorología) |
| `GEOCODER_BASE_URL` | Proveedor Nominatim intercambiable; por defecto usa el servicio público de OSM con caché y límite de uso |

---

## Desarrollo local

```bash
# Instalar dependencias
npm install

# Iniciar servidor de desarrollo
npm run dev

# Compilar para producción
npm run build

# Iniciar servidor de producción
npm start

# Lint
npm run lint
```

Abre [http://localhost:3000](http://localhost:3000) en tu navegador.

---

## Autenticación

El sistema usa **Supabase Auth** con OAuth exclusivo (Google + Apple). No hay registro por email/contraseña.

Flujo:
1. El usuario hace clic en "Iniciar sesión con Google" o "Apple" en `/auth`
2. Supabase redirige al proveedor OAuth
3. El callback (`/auth/callback`) intercambia el código PKCE por una sesión
4. El perfil se crea automáticamente mediante un trigger de base de datos
5. La sesión se persiste mediante cookies gestionadas por `@supabase/ssr`
6. Las rutas protegidas (p.ej. `/account`) verifican la sesión en edge (proxy) y server

---

## Despliegue

El proyecto está desplegado en **Vercel** con las siguientes variables de entorno configuradas en producción:

- `NEXT_PUBLIC_MAPBOX_TOKEN`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

El build produce una aplicación Next.js con generación estática para páginas de contenido y renderizado dinámico para rutas protegidas y API.

---

## Licencia

Proyecto privado — E-nduro Ebiketracks.
