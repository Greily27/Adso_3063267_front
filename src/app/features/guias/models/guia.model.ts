import { CursoModel, MateriaModel } from '../../cursos/models/curso.model';
import { AsignacionModel } from '../../cursos/models/curso.model';
import { UserModel } from '../../users/models/user.model';

export interface GuiaModel {
  id?: number;
  idGuia?: number;
  nombreGuia?: string;
  titulo?: string;
  title?: string;
  descripcion?: string;
  description?: string;
  archivoUrl?: string;
  fileUrl?: string;
  url?: string;
  estado?: boolean;
  isActive?: boolean;
  asignacionId?: number | null;
  asignacion?: AsignacionModel;
  cursoId?: number | null;
  materiaId?: number | null;
  docenteId?: number | null;
  curso?: CursoModel;
  materia?: MateriaModel;
  docente?: UserModel;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateGuiaDto {
  nombreGuia?: string;
  titulo?: string;
  descripcion: string;
  archivoUrl?: string;
  archivo?: File | null;
  estado: boolean;
  asignacionId?: number | null;
  cursoId?: number | null;
  materiaId?: number | null;
  docenteId?: number | null;
}

export interface UpdateGuiaDto extends Partial<CreateGuiaDto> {}
