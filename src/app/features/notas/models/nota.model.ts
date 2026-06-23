import { MateriaModel } from '../../materias/models/materia.model';
import { EstudianteModel } from '../../estudiantes/models/estudiante.model';

export interface NotaModel {
  idNota?: number;
  id?: number;
  cursoId?: number;
  estudianteId?: number;
  materiaId?: number;
  periodoId?: number;
  idPeriodo?: number;
  valor: number;
  descripcion?: string | null;
  estado: boolean;
  materia?: MateriaModel;
  estudiante?: EstudianteModel;
}

export interface CreateNotaDto {
  valor: number;
  descripcion: string;
  estado: boolean;
  estudianteId: number;
  cursoId: number;
  materiaId: number;
  periodoId: number;
}

export interface UpdateNotaDto extends Partial<CreateNotaDto> {}
