import { UserModel } from "../../users/models/user.model";

export interface CursoModel {
  id?: number;
  idCurso?: number;
  nombreCurso?: string;
  name?: string;
  nombre?: string;
  description?: string;
}

export interface EstudianteModel {
  id?: number;
  idEstudiante?: number;
  tipoDocTutor: string;
  documentoTutor: string;
  emailTutor: string;
  nombreTutor: string;
  apellidoTutor: string;
  ocupacionTutor: string;
  telefonoTutor: string;
  user: UserModel;
  curso: CursoModel;
}

export interface CreateEstudianteDto {
  tipoDocTutor: string;
  documentoTutor: string;
  emailTutor: string;
  nombreTutor: string;
  apellidoTutor: string;
  ocupacionTutor: string;
  telefonoTutor: string;
  userId: number;
  cursoId: number;
}

export interface UpdateEstudianteDto extends Partial<CreateEstudianteDto> {}
