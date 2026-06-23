import { RoleModel } from '../../roles/models/roles.model';
import { MateriaModel } from '../../materias/models/materia.model';
import { CreateUserDto, UpdateUserDto, UserModel } from '../models/user.model';

export const DEFAULT_PROFILE_PHOTO = 'default.jpg';

export interface UserFormValue {
  names?: string;
  lastNames?: string;
  phone?: string;
  address?: string;
  docType?: string;
  document?: string;
  photo?: string;
  email?: string;
  password?: string;
  isActive?: boolean;
  roles?: RoleModel[];
  materias?: MateriaModel[];
}

export interface StudentUserFormValue {
  user?: UserModel;
  userNames?: string;
  userLastNames?: string;
  userPhone?: string;
  userAddress?: string;
  userDocType?: string;
  userDocument?: string;
  userPhoto?: string;
  userEmail?: string;
  userIsActive?: boolean;
  userPassword?: string;
}

export function buildCreateUserDto(formValue: UserFormValue): CreateUserDto {
  const dto: CreateUserDto = {
    names: formValue.names ?? '',
    lastNames: formValue.lastNames ?? '',
    phone: formValue.phone ?? '',
    address: formValue.address ?? '',
    docType: formValue.docType ?? '',
    document: formValue.document ?? '',
    photo: getProfilePhoto(formValue.photo),
    email: formValue.email ?? '',
    password: formValue.password ?? '',
    isActive: formValue.isActive ?? true,
    roleIds: getRoleIds(formValue.roles)
  };

  if (shouldSendMaterias(formValue)) {
    const materiaIds = getMateriaIds(formValue.materias);
    dto.materiasIds = materiaIds;
    dto.materiaIds = materiaIds;
  }

  return dto;
}

export function buildUpdateUserDto(formValue: UserFormValue): UpdateUserDto {
  const dto: UpdateUserDto = {
    names: formValue.names ?? '',
    lastNames: formValue.lastNames ?? '',
    phone: formValue.phone ?? '',
    address: formValue.address ?? '',
    docType: formValue.docType ?? '',
    document: formValue.document ?? '',
    photo: getProfilePhoto(formValue.photo),
    email: formValue.email ?? '',
    isActive: formValue.isActive ?? true,
    roleIds: getRoleIds(formValue.roles)
  };

  if (shouldSendMaterias(formValue)) {
    const materiaIds = getMateriaIds(formValue.materias);
    dto.materiasIds = materiaIds;
    dto.materiaIds = materiaIds;
  }

  if (!dto.password) {
    delete dto.password;
  }

  if (formValue.password) {
    dto.password = formValue.password;
  }

  return dto;
}

export function buildUserUpdateDtoFromStudentForm(
  formValue: StudentUserFormValue,
  currentUser: UserModel
): UpdateUserDto {
  return buildUpdateUserDto({
    names: formValue.userNames ?? currentUser.names,
    lastNames: formValue.userLastNames ?? currentUser.lastNames,
    phone: formValue.userPhone ?? currentUser.phone,
    address: formValue.userAddress ?? currentUser.address,
    docType: formValue.userDocType ?? currentUser.docType,
    document: formValue.userDocument ?? currentUser.document,
    photo: getProfilePhoto(formValue.userPhoto ?? currentUser.photo),
    email: formValue.userEmail ?? currentUser.email,
    password: formValue.userPassword,
    isActive: formValue.userIsActive ?? currentUser.isActive,
    roles: currentUser.roles ?? []
  });
}

function getRoleIds(roles: RoleModel[] = []) {
  return roles
    .map(role => role.id)
    .filter((id): id is number => id !== undefined);
}

export function getProfilePhoto(photo?: string | null) {
  return photo?.trim() || DEFAULT_PROFILE_PHOTO;
}

function getMateriaIds(materias: MateriaModel[] = []) {
  return materias
    .map(materia => materia.idMateria ?? (materia as MateriaModel & { id?: number }).id)
    .filter((id): id is number => id !== undefined);
}

function shouldSendMaterias(formValue: UserFormValue) {
  return hasDocenteRole(formValue.roles) && getMateriaIds(formValue.materias).length > 0;
}

function hasDocenteRole(roles: RoleModel[] = []) {
  return roles.some(role => normalizeRoleName(role.name).includes('docente'));
}

function normalizeRoleName(roleName: string) {
  return roleName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase();
}
