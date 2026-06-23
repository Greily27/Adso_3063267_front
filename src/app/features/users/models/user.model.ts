import { RoleModel } from "../../roles/models/roles.model";
import { CursoModel } from "../../cursos/models/curso.model";
import { MateriaModel } from "../../materias/models/materia.model";

export interface EstudianteRelationModel {
  id?: number;
}

export interface UserModel {
  id: number;
  names: string;
  lastNames: string;
  phone: string;
  address: string;
  docType: string;
  document: string;
  photo: string;
  password?: string;
  email: string;
  isActive: boolean;
  roles: RoleModel[];
  cursos?: CursoModel[];
  materias?: MateriaModel[];
  estudiante?: EstudianteRelationModel;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CreateUserDto {
  names: string;
  lastNames: string;
  phone: string;
  address: string;
  docType: string;
  document: string;
  photo: string;
  email: string;
  password: string;
  isActive: boolean;
  roleIds: number[];
  materiasIds?: number[];
  materiaIds?: number[];
}

export interface UpdateUserDto extends Partial<Omit<CreateUserDto, 'password'>> {
  password?: string;
}
