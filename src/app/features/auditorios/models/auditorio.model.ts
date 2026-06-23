import { UserModel } from '../../users/models/user.model';

export interface AuditorioModel {
  idauditorio: number;
  nombre: string;
}

export interface CreateAuditorioDto {
  nombre: string;
}

export interface UpdateAuditorioDto extends Partial<CreateAuditorioDto> {}

export interface ReservaAuditorioModel {
  idreserva: number;
  idusuario: number;
  idauditorio: number;
  fecha_hora: string | Date;
  fecha_hora_fin?: string | Date | null;
  idasignacion: number | null;
  usuario?: UserModel;
  auditorio?: AuditorioModel;
}

export interface CreateReservaAuditorioDto {
  idusuario: number;
  idauditorio: number;
  fecha_hora: string;
  fecha_hora_fin: string;
  idasignacion?: number | null;
}

export interface UpdateReservaAuditorioDto extends Partial<CreateReservaAuditorioDto> {}
