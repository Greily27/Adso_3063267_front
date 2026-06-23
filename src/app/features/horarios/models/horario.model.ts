import { AsignacionModel } from '../../cursos/models/curso.model';

export type DiaHorario = 'lunes' | 'martes' | 'miércoles' | 'jueves' | 'viernes';

export interface HorarioModel {
  idHorario?: number;
  id?: number;
  dia: DiaHorario;
  horaInicio: string;
  horaFin: string;
  asignacionId: number;
  asignacion?: AsignacionModel;
}

export interface CreateHorarioDto {
  dia: DiaHorario;
  horaInicio: string;
  horaFin: string;
  asignacionId: number;
}

export interface UpdateHorarioDto extends Partial<CreateHorarioDto> {}
