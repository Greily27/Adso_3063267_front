import { CursoModel } from '../../cursos/models/curso.model';
import { EstudianteModel } from '../../estudiantes/models/estudiante.model';
import { UserModel } from '../../users/models/user.model';

export interface ObservadorModel {
  idObservador?: number;
  id?: number;
  estudianteId?: number;
  cursoId?: number;
  docenteId?: number;
  fecha: string | Date;
  categoria: string;
  descripcion: string;
  estudiante?: EstudianteModel;
  curso?: CursoModel;
  docente?: UserModel;
}

export interface CreateObservadorDto {
  estudianteId: number;
  cursoId: number;
  docenteId: number;
  fecha: string;
  categoria: string;
  descripcion: string;
}

export interface UpdateObservadorDto extends Partial<CreateObservadorDto> {}
