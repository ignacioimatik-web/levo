export type RouteDifficulty = "verde" | "azul" | "roja" | "negra" | "doble-negra" | "pendiente";

export type RouteType = "circular" | "lineal" | "travesia" | "top-track" | "sector-link";

export interface Sector {
  id: string;
  slug: string;
  name: string;
  description: string;
  longDescription: string;
  terrain: string;
  dominantDifficulty: RouteDifficulty;
  image?: string;
}

export interface MTBRoute {
  id: string;
  slug: string;
  name: string;
  sector: string;
  type: RouteType;
  summary: string;
  description: string;
  distanceKm?: number;
  elevationGainM?: number;
  elevationLossM?: number;
  maxAltitudeM?: number;
  minAltitudeM?: number;
  estimatedTime?: string;
  physicalDifficulty: RouteDifficulty;
  technicalDifficulty: RouteDifficulty;
  recommendedLevel: "iniciacion" | "medio" | "avanzado" | "experto" | "pendiente";
  recommendedBike: string[];
  ebikeFriendly?: boolean;
  trailPercent?: number;
  trackUrl?: string;
  mapEmbedUrl?: string;
  gpxFile?: string;
  kmlFile?: string;
  images: string[];
  warnings: string[];
  waterPoints: string[];
  bestSeason: string[];
  tags: string[];
  relatedRoutes: string[];
  status: "publicada" | "pendiente-datos" | "cerrada-temporalmente";
}

export const sectors: Sector[] = [
  {
    id: "bergantes",
    slug: "bergantes",
    name: "Bergantes",
    description: "El río Bergantes y sus espectaculares muelas.",
    longDescription: "El río Bergantes es una punta de lanza de la cuenca del Ebro en el Norte de Castellón. Sus fuentes están en las muelas de Fusters (Morella), y va cobrando vigor aguas abajo de Morella. Es a partir de este momento donde ha excavado la tierra contundentemente, con predominio de la orografía en forma de grandes muelas, dando pie a fantásticos Top Tracks, caracterizados por los tramos altos llanos y abiertos a excelentes vistas panorámicas, y por el pronunciado desnivel de los tramos descendentes. Esta configuración ofrece un alto interés para la práctica del enduro mtb, ya que combina pedaleo y descensos ya con cierta complejidad. En este sector se encuentra la Fábrica de Giner, Punto de Acogida del Centre BTT de Els Ports. También tenemos la localidad de Forcall, un bonito pueblo con diferentes servicios turísticos que puede tomarse como inicio de gran cantidad de rutas BTT.",
    terrain: "Mixto: muelas y valles",
    dominantDifficulty: "roja",
    image: "https://images.unsplash.com/photo-1544198365-f5d60b6d8190?auto=format&fit=crop&q=80&w=1000",
  },
  {
    id: "celumbres",
    slug: "celumbres",
    name: "Celumbres",
    description: "Un abismo entre Cinctorres y Castellfort.",
    longDescription: "Se abre como un abismo entre las localidades de Cinctorres, Portell de Morella y Castellfort. Reflejo de la calidad ambiental de este entorno es la figura de Paraje Natural que lo protege. Ofrece panorámicas asombrosas en un entorno de bosque rocoso muy poco humanizado y riquísimo en flora y fauna.",
    terrain: "Rocoso y boscoso",
    dominantDifficulty: "negra",
    image: "https://images.unsplash.com/photo-1575548393466-0df1618ba410?auto=format&fit=crop&q=80&w=1000",
  },
  {
    id: "el-riu-de-les-corces",
    slug: "el-riu-de-les-corces",
    name: "El Riu de les Corces",
    description: "El valle de 'Mundo Perdido'.",
    longDescription: "El tramo superior del Riu de les Corces (también conocido como Riu Cervol) es para cualquier amante del medio natural un paraíso, y para quienes buscan auténtico mtb por singletracks, un entorno perfecto. Uno de los mejores Morella Top Tracks es el 'Mundo Perdido', tal podría ser el nombre de todo el valle de este río entre Morella y Vallibona: un valle orográficamente marcado por una geología retorcida, que lo encierra profundo y sombrío, con el agua dando pie a una variedad botánica impropia de estas latitudes. En todo el valle la humanización siempre ha sido leve y muy integrada, y hoy sus escasos vestigios son armoniosas piezas del paisaje. Por aquí discurren algunas de las mejores rutas de singletrack que podréis encontrar en ninguna parte, aptas tanto para un enfoque 'all mountain' como para el enduro mtb de dificultad moderada.",
    terrain: "Singletrack profundo",
    dominantDifficulty: "roja",
    image: "https://images.unsplash.com/photo-1568991004407-cdd5d0930945?auto=format&fit=crop&q=80&w=1000",
  },
  {
    id: "peter-rules",
    slug: "peter-rules",
    name: "Peter Rules",
    description: "Bosques de gran calidad y orografía quebrada.",
    longDescription: "Este sector se sitúa al nordeste de Morella, a caballo entre el precioso pueblecillo de Herbeset y el fantástico monte público de Pereroles. Resulta especialmente interesante para el mtb por varios motivos. Por una parte alberga bosques de gran calidad y muy variados. Por otra parte su orografía continuamente quebrada le aporta mucha intensidad, ya que los tramos llanos y de transición desaparecen, y todo es subir o bajar, constituyendo un escenario ideal para el auténtico enduro mtb que no renuncia a los duros pedaleos, o para el all mountain. Además la humanización de este sector nunca fue muy intensa. Para la práctica del mtb es hábil todo el año, pero especialmente constituye una buena alternativa en verano, cuando combinado con los top tracks del Riu de les Corces, aporta rutas arboladas y frescas aún en días de intensa calor.",
    terrain: "Boscoso y quebrado",
    dominantDifficulty: "azul",
    image: "https://images.unsplash.com/photo-1633707167682-9068729bc84c?auto=format&fit=crop&q=80&w=1000",
  },
  {
    id: "torre-miro-xiva",
    slug: "torre-miro-xiva",
    name: "Torre Miró - Xiva",
    description: "Un valle de orfebrería de roca y bosque.",
    longDescription: "Este es un sector precioso: un valle de orfebrería de roca y bosque, en el que se enreda un ovillo de sendas, muy variado en cuanto a requerimientos técnicos y sin llegar a dificultades extremas. Algunas de estas sendas son ciclables en ambos sentidos, no al 100% pero casi. La combinación de las sendas entre sí da para algunas rutas de mtb enduro extraordinariamente intensas. Además son senderos muy a mano como final de rutas que nos regresan de tracks más alejados, y es que está muy cerca de Morella, lo que lo habilita perfectamente para medias jornadas o días inciertos que aconsejan vías de aborto rápidas. El regreso natural del valle alcanza Morella bien desde la senda de 'Romeo' o bien desde la de 'Julieta', ambas comparten un duro pero hermoso inicio. En la parte más baja del sector se encuentra la localidad de Xiva, pedanía de Morella, que tiene bar y varios alojamientos turísticos.",
    terrain: "Roca y bosque",
    dominantDifficulty: "azul",
    image: "https://images.unsplash.com/photo-1604748954134-457791b2ce9b?auto=format&fit=crop&q=80&w=1000",
  },
];

export const routes: MTBRoute[] = [
  {
    id: "1",
    slug: "garumba-gigante",
    name: "Garumba Gigante",
    sector: "Bergantes",
    type: "circular",
    summary: "Una combinación de Top Tracks de calidad con espectaculares panorámicas y skylines de Morella.",
    description: "Una combinación de Top Tracks de calidad, que trasiegan paisajes muy diversos, y una espectacular sucesión de panorámicas entre las que se encuentra una colección de 'Skylines' de Morella a cual mejor. Sus descensos empiezan a exigir todas las habilidades propias del enduro mtb: sucesiones de curvas cerradas, curvas rápidas, zonas rocosas, escalones. Esta ruta incorpora un importante tramo de porteo (entre 15 y 20 minutos), el cual da acceso al 'Balcó de Pilatos', situado a los pies de la 'Roca de Migdia'. Un precio alto aunque justificado por la belleza y singularidad de este lugar, así como del tramo de senda que los sigue.",
    distanceKm: 34.1,
    elevationGainM: 1137,
    elevationLossM: 1137,
    maxAltitudeM: 1200,
    minAltitudeM: 600,
    estimatedTime: "4 - 5:30 h",
    physicalDifficulty: "roja",
    technicalDifficulty: "roja",
    recommendedLevel: "avanzado",
    recommendedBike: ["Enduro", "All-mountain"],
    ebikeFriendly: true,
    trailPercent: 39,
    trackUrl: "/tracks/garumba-gigante.rar",
    images: [
      "https://images.unsplash.com/photo-1544198365-f5d60b6d8190?auto=format&fit=crop&q=80&w=1000",
      "https://images.unsplash.com/photo-1604677657548-4ced0c4f40c6?auto=format&fit=crop&q=80&w=1000",
    ],
    warnings: [
      "Importante tramo de porteo (15-20 min) para acceder al Balcó de Pilatos",
      "Punto de navegación confuso cerca de reja verde metálica - seguir senda paralela a pared de piedra",
      "Puede haber vacas negras de raza avileña en el camino (no son bravas aunque lo parezcan)",
      "Al inicio, acceder por paso habilitado entre postes de madera, no por puerta metálica"
    ],
    waterPoints: ["Forcall (mitad de ruta)"],
    bestSeason: ["Primavera", "Otoño"],
    tags: ["Bergantes", "Enduro", "Panorámicas", "Porteo"],
    relatedRoutes: ["vuelta-garumba", "santets-gegants"],
    status: "publicada",
  },
  {
    id: "2",
    slug: "vuelta-garumba",
    name: "Vuelta Garumba",
    sector: "Bergantes",
    type: "circular",
    summary: "Recorrido circular por las zonas de Garumba con alto porcentaje de senda.",
    description: "Descripción detallada de la ruta Vuelta Garumba. (Pendiente de completar)",
    distanceKm: 23,
    elevationGainM: 842,
    elevationLossM: 842,
    estimatedTime: "3 - 4:30 h",
    physicalDifficulty: "azul",
    technicalDifficulty: "azul",
    recommendedLevel: "medio",
    recommendedBike: ["Trail", "All-mountain"],
    ebikeFriendly: true,
    trailPercent: 60,
    images: [
      "https://images.unsplash.com/photo-1632258334576-c338d143773c?auto=format&fit=crop&q=80&w=1000",
    ],
    warnings: [],
    waterPoints: [],
    bestSeason: ["Primavera", "Otoño"],
    tags: ["Bergantes", "Circular"],
    relatedRoutes: ["garumba-gigante"],
    status: "pendiente-datos",
  },
  {
    id: "3",
    slug: "santets-gegants",
    name: "Santets Gegants",
    sector: "Bergantes",
    type: "circular",
    summary: "Ruta por el sector Bergantes con vistas espectaculares.",
    description: "Descripción detallada de la ruta Santets Gegants. (Pendiente de completar)",
    distanceKm: 29,
    elevationGainM: 750,
    elevationLossM: 750,
    estimatedTime: "3:30 - 5 h",
    physicalDifficulty: "azul",
    technicalDifficulty: "azul",
    recommendedLevel: "medio",
    recommendedBike: ["Trail", "All-mountain"],
    ebikeFriendly: true,
    trailPercent: 27,
    images: [
      "https://images.unsplash.com/photo-1562862570-d9e821847237?auto=format&fit=crop&q=80&w=1000",
    ],
    warnings: [],
    waterPoints: [],
    bestSeason: ["Primavera", "Otoño"],
    tags: ["Bergantes", "Vistas"],
    relatedRoutes: [],
    status: "pendiente-datos",
  },
  {
    id: "4",
    slug: "coronel-perdido",
    name: "Coronel Perdido",
    sector: "El Riu de les Corces",
    type: "circular",
    summary: "La ruta reina de Enduro Singletracks. Enduro mtb en su sentido más inclusivo y montañero.",
    description: "Coronel Perdido es para muchos la ruta reina de Enduro Singletracks, una propuesta de enduro mtb en su sentido más inclusivo y montañero, y también duro. Esto incluye diferentes tramos de PORTEO, o al menos de empujar la bici. No son largos pero están ahí. Es una ruta BTT impactante, plagada de sendas, en un ambiente excepcional. No puede dejar a nadie indiferente, si bien tampoco será del gusto de todo el mundo, ya que aunque incorpora bajadas rápidas y muy divertidas, resulta una ruta DURA y montañera, cosa que no siempre gusta a los más motivados por los rápidos descensos. Otra dificultad añadida es la navegación. Parte de la ruta se ha construido sobre antiguas vías pecuarias, cuya anchura llega a los 75 m y en las que el camino es poco evidente. Incorpora uno de los Top Tracks más espectaculares de Enduro Singletracks: Coronel Trumel, con parte de otro que no le va a la zaga, Mundo Perdido, y con un feliz retorno a casa como es Red Hot.",
    distanceKm: 44.8,
    elevationGainM: 1500,
    elevationLossM: 1500,
    maxAltitudeM: 1250,
    minAltitudeM: 500,
    estimatedTime: "6:30 - 8:30 h",
    physicalDifficulty: "negra",
    technicalDifficulty: "roja",
    recommendedLevel: "experto",
    recommendedBike: ["Enduro", "All-mountain"],
    ebikeFriendly: false,
    trailPercent: 70,
    trackUrl: "/tracks/coronel-perdido.rar",
    images: [
      "https://images.unsplash.com/photo-1551632811-561732d1e306?auto=format&fit=crop&q=80&w=1000",
      "https://images.unsplash.com/photo-1604850613811-b50ad1aeeecd?auto=format&fit=crop&q=80&w=1000",
    ],
    warnings: [
      "Varios tramos de porteo obligatorio",
      "La navegación requiere atención: vías pecuarias con camino poco evidente",
      "No hay opciones de reponer agua hasta Vallibona",
      "La senda de aproximación previa a Vallibona incluye tramos donde una caída podría tener graves consecuencias",
      "Extremar precauciones en tramos cercanos al Turmell"
    ],
    waterPoints: ["Vallibona", "Fuentes varias después de Vallibona"],
    bestSeason: ["Primavera", "Otoño"],
    tags: ["Enduro", "Montaña", "Porteo", "Singletrack", "Mundo Perdido"],
    relatedRoutes: ["medio-perdido", "todo-perdido"],
    status: "publicada",
  },
  {
    id: "5",
    slug: "romeo-julieta",
    name: "Romeo o Julieta y Julieta",
    sector: "Torre Miró - Xiva",
    type: "circular",
    summary: "Propuesta rápida para una ruta corta muy endurera, con descenso de muy buen nivel.",
    description: "Una propuesta rápida para hacer una ruta corta muy endurera, con aproximación en asfalto y descenso de muy buen nivel. Ideal para llenar un hueco en la agenda. La senda de 'Romeo o Julieta' comparte un duro pero hermoso inicio, pero cuando empieza de verdad el disfrute rompen y siguen cada una por su lado.",
    distanceKm: 9.4,
    elevationGainM: 260,
    estimatedTime: "1 - 1:45 h",
    physicalDifficulty: "azul",
    technicalDifficulty: "roja",
    recommendedLevel: "medio",
    recommendedBike: ["Enduro", "Trail"],
    ebikeFriendly: true,
    trailPercent: 39,
    trackUrl: "/tracks/romeo-julieta.rar",
    images: [
      "https://images.unsplash.com/photo-1615406308854-4805ac35ef25?auto=format&fit=crop&q=80&w=1000",
    ],
    warnings: [
      "Al inicio, acceder por paso entre postes de madera, no por puerta metálica",
      "Puede haber vacas negras de raza avileña (no son bravas)"
    ],
    waterPoints: [],
    bestSeason: ["Todo el año"],
    tags: ["Torre Miró", "Enduro", "Corta"],
    relatedRoutes: ["romeo-y-romeo", "torre-cipres"],
    status: "publicada",
  },
  {
    id: "6",
    slug: "hard-pertxos",
    name: "Hard Pertxòs",
    sector: "Celumbres",
    type: "circular",
    summary: "Ruta exigente por el Paraje Natural de Celumbres, entre Cinctorres y Castellfort.",
    description: "Descripción detallada de la ruta Hard Pertxòs en el impresionante entorno del Paraje Natural de Celumbres. (Pendiente de completar)",
    distanceKm: 28.7,
    elevationGainM: 1100,
    estimatedTime: "4 - 6 h",
    physicalDifficulty: "roja",
    technicalDifficulty: "negra",
    recommendedLevel: "avanzado",
    recommendedBike: ["Enduro", "All-mountain"],
    ebikeFriendly: false,
    trailPercent: 56,
    images: [
      "https://images.unsplash.com/photo-1594032362338-04b9952eb440?auto=format&fit=crop&q=80&w=1000",
    ],
    warnings: [
      "Paraje Natural - respetar el entorno",
      "Zona remota, llevar agua en abundancia"
    ],
    waterPoints: [],
    bestSeason: ["Primavera", "Otoño"],
    tags: ["Celumbres", "Paraje Natural", "Exigente"],
    relatedRoutes: [],
    status: "pendiente-datos",
  },
  {
    id: "7",
    slug: "big-peter",
    name: "Big Peter",
    sector: "Peter Rules",
    type: "circular",
    summary: "Intensa ruta por los bosques de Pereroles, ideal para enduro que no renuncia al pedaleo.",
    description: "Descripción detallada de la ruta Big Peter por el sector Peter Rules. (Pendiente de completar)",
    distanceKm: 41,
    elevationGainM: 1329,
    estimatedTime: "5 - 7 h",
    physicalDifficulty: "roja",
    technicalDifficulty: "roja",
    recommendedLevel: "avanzado",
    recommendedBike: ["Enduro", "All-mountain"],
    ebikeFriendly: true,
    trailPercent: 52,
    images: [
      "https://images.unsplash.com/photo-1637624681315-8a3025be66c0?auto=format&fit=crop&q=80&w=1000",
    ],
    warnings: [
      "Orografía quebrada: todo es subir o bajar"
    ],
    waterPoints: ["Herbeset"],
    bestSeason: ["Primavera", "Verano", "Otoño"],
    tags: ["Peter Rules", "Bosque", "Intensa"],
    relatedRoutes: ["herbeset", "herbesot"],
    status: "pendiente-datos",
  },
  {
    id: "8",
    slug: "teacher-perdido",
    name: "Teacher Perdido",
    sector: "El Riu de les Corces",
    type: "circular",
    summary: "Versión más accesible de la zona de Mundo Perdido.",
    description: "Descripción detallada de la ruta Teacher Perdido. (Pendiente de completar)",
    distanceKm: 28.54,
    elevationGainM: 866,
    estimatedTime: "3:30 - 5:30 h",
    technicalDifficulty: "roja",
    physicalDifficulty: "roja",
    recommendedLevel: "avanzado",
    recommendedBike: ["Enduro", "All-mountain"],
    ebikeFriendly: false,
    trailPercent: 43,
    images: [
      "https://images.unsplash.com/photo-1564912677462-6a1d6102473d?auto=format&fit=crop&q=80&w=1000",
    ],
    warnings: [],
    waterPoints: [],
    bestSeason: ["Primavera", "Otoño"],
    tags: ["Mundo Perdido", "Riu de les Corces"],
    relatedRoutes: ["coronel-perdido", "medio-perdido"],
    status: "pendiente-datos",
  },
  {
    id: "9",
    slug: "medio-perdido",
    name: "Medio Perdido",
    sector: "El Riu de les Corces",
    type: "circular",
    summary: "Singletracks de gran calidad en el entorno único del Riu de les Corces.",
    description: "Descripción detallada de la ruta Medio Perdido. (Pendiente de completar)",
    distanceKm: 20.5,
    elevationGainM: 600,
    estimatedTime: "2:30 - 4 h",
    physicalDifficulty: "roja",
    technicalDifficulty: "roja",
    recommendedLevel: "avanzado",
    recommendedBike: ["Enduro", "All-mountain"],
    ebikeFriendly: false,
    trailPercent: 48,
    images: [
      "https://images.unsplash.com/photo-1645520719499-6856445fe4ad?auto=format&fit=crop&q=80&w=1000",
    ],
    warnings: [],
    waterPoints: [],
    bestSeason: ["Primavera", "Otoño"],
    tags: ["Mundo Perdido", "Singletrack"],
    relatedRoutes: ["teacher-perdido", "todo-perdido"],
    status: "publicada",
  },
  {
    id: "10",
    slug: "todo-perdido",
    name: "Todo Perdido",
    sector: "El Riu de les Corces",
    type: "circular",
    summary: "La versión completa de la experiencia Mundial Perdido.",
    description: "Descripción detallada de la ruta Todo Perdido. (Pendiente de completar)",
    distanceKm: 44.7,
    elevationGainM: 1200,
    estimatedTime: "6 - 8 h",
    physicalDifficulty: "roja",
    technicalDifficulty: "negra",
    recommendedLevel: "experto",
    recommendedBike: ["Enduro"],
    ebikeFriendly: false,
    trailPercent: 48,
    images: [
      "https://images.unsplash.com/photo-1632258334576-c338d143773c?auto=format&fit=crop&q=80&w=1000",
      "https://images.unsplash.com/photo-1604850613811-b50ad1aeeecd?auto=format&fit=crop&q=80&w=1000",
    ],
    warnings: ["Ruta larga y exigente"],
    waterPoints: [],
    bestSeason: ["Primavera", "Otoño"],
    tags: ["Mundo Perdido", "Larga", "Exigente"],
    relatedRoutes: ["coronel-perdido", "medio-perdido"],
    status: "pendiente-datos",
  },
];
