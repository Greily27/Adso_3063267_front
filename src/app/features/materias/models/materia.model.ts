import { CursoModel } from '../../cursos/models/curso.model';

export interface MateriaModel {
  idMateria?: number;
  nombreMateria: string;
  estado: boolean;
  cursos?: CursoModel[];
  cursoIds?: number[];
  cursosIds?: number[];
  asignaciones?: Array<{ cursoId?: number; materiaId?: number; materiasIdMateria?: number }>;
}

export interface CreateMateriaDto {
  nombreMateria: string;
  estado: boolean;
  cursosIds?: number[];
}

export interface UpdateMateriaDto extends Partial<CreateMateriaDto> {}
