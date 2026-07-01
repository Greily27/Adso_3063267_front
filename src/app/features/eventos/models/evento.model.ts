export type EventoEstado = 'BORRADOR' | 'PUBLICADO' | 'CANCELADO';
export type EventoDestinatario = 'DOCENTE' | 'ESTUDIANTE' | 'ACUDIENTE';

export interface EventoModel {
  id?: number;
  idEvento?: number;
  titulo: string;
  descripcion: string;
  categoria: string;
  fechaInicio: string;
  fechaFin: string;
  ubicacion: string;
  imagen?: string;
  imagenUrl?: string;
  imageUrl?: string;
  rutaImagen?: string;
  imagenPath?: string;
  destinatarios: EventoDestinatario[];
  estado: EventoEstado;
}

export interface EventoFormValue {
  titulo: string;
  descripcion: string;
  categoria: string;
  fechaInicio: string;
  fechaFin: string;
  ubicacion: string;
  destinatarios: EventoDestinatario[];
  estado: EventoEstado;
}
