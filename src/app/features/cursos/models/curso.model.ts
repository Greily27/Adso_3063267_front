import { UserModel } from "../../users/models/user.model";

export interface MateriaModel {
  id?: number;
  nombre?: string;
  name?: string;
  descripcion?: string;
  description?: string;
  idMateria?: number;
  nombreMateria?: string;
  estado?: boolean;
}

export interface CursoModel {
  id?: number;
  idCurso?: number;
  cursoId?: number;
  isActive: boolean;
  nombreCurso: string;
  directorCurso?: number | null;
  director?: UserModel | null;
  userId?: number | null;
  usuarioId?: number | null;
  docenteId?: number | null;
  directorId?: number | null;
  users: UserModel[];
  docentes?: UserModel[];
  docentesAsignados?: UserModel[];
  docentesIds?: number[];
  materias: MateriaModel[];
  materiasIds?: number[];
  materiaIds?: number[];
  asignaciones?: AsignacionModel[];
}

export interface CreateCursoDto {
  isActive: boolean;
  nombreCurso: string;
  directorCurso?: number | null;
  docentesIds?: number[];
  materiasIds?: number[];
}

export interface UpdateCursoDto extends Partial<CreateCursoDto> {}

export interface AsignacionModel {
  idAsignacion?: number;
  cursoId: number;
  materiaId: number;
  materiasIdMateria?: number;
  docenteId: number;
  curso?: CursoModel;
  materia?: MateriaModel;
  docente?: UserModel;
}

export interface CreateAsignacionDto {
  cursoId: number;
  materiaId: number;
  docenteId: number;
}
