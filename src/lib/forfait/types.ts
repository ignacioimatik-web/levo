export type DificultadMTB = "verde" | "azul" | "rojo" | "negro" | "doble-negro";

export type EstadoTrack = "abierto" | "cerrado" | "precaucion" | "revision";

export type TipoTrack =
  | "subida"
  | "bajada"
  | "enlace"
  | "enduro"
  | "trail"
  | "xc"
  | "ebike"
  | "circular";

export type TipoConexion = "contacto" | "cruce" | "cercania" | "superposicion" | "enlace_manual";

export type NivelUsuario = "iniciacion" | "medio" | "avanzado" | "experto" | "ebike";

export interface TrackPoint {
  lat: number;
  lng: number;
  elevation?: number;
}

export interface TrackMTB {
  id: string;
  nombre: string;
  sector: string;
  dificultad: DificultadMTB;
  estado: EstadoTrack;
  tipo: TipoTrack[];
  distanciaKm: number;
  desnivelPositivo: number;
  desnivelNegativo: number;
  nivelTecnico: 1 | 2 | 3 | 4 | 5;
  exigenciaFisica: 1 | 2 | 3 | 4 | 5;
  sentidoRecomendado: "unidireccional" | "bidireccional";
  aptoEbike: boolean;
  aptoLluvia: boolean;
  tiempoEstimadoMin: number;
  descripcion: string;
  advertencias: string[];
  gpxUrl?: string;
  points: TrackPoint[];
  startPoint: { lat: number; lng: number };
  endPoint: { lat: number; lng: number };
  dataStatus: "real" | "placeholder";
}

export interface ConexionTrack {
  id: string;
  fromTrackId: string;
  toTrackId: string;
  tipoConexion: TipoConexion;
  distanciaMetros: number;
  dificultadConexion?: DificultadMTB;
  descripcion: string;
  puntoConexion: { lat: number; lng: number };
  recomendado: boolean;
}

export interface RutaConstruida {
  id: string;
  nombre: string;
  tracks: TrackMTB[];
  conexiones: ConexionTrack[];
  distanciaTotalKm: number;
  desnivelPositivoTotal: number;
  desnivelNegativoTotal: number;
  dificultadGlobal: DificultadMTB;
  nivelTecnicoMaximo: number;
  exigenciaFisicaMedia: number;
  tiempoEstimadoTotalMin: number;
  pointsCombinados: TrackPoint[];
  connectionWaypoints: Array<{ lat: number; lng: number; descripcion: string; distancia: number }>;
  advertencias: string[];
}

export interface FiltrosForfait {
  dificultad: DificultadMTB[];
  estado: EstadoTrack[];
  sector: string[];
  tipo: TipoTrack[];
  soloEbike: boolean;
  soloLluvia: boolean;
  nivelTecnicoMax: number;
  exigenciaFisicaMax: number;
  distanciaMin: number;
  distanciaMax: number;
  soloAbiertos: boolean;
  soloConectables: boolean;
  nivelUsuario: NivelUsuario;
  busqueda: string;
}
