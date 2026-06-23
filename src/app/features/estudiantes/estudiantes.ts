import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleChange, MatSlideToggleModule } from '@angular/material/slide-toggle';
import { forkJoin, switchMap } from 'rxjs';
import Swal from 'sweetalert2';
import * as XLSX from 'xlsx';
import { CursoModel, CreateEstudianteDto, EstudianteModel, UpdateEstudianteDto } from './models/estudiante.model';
import { EstudiantesForm } from './components/estudiantes-form/estudiantes-form';
import { EstudiantesService } from './services/estudiantes-service';
import { CreateUserDto, UpdateUserDto, UserModel } from '../users/models/user.model';
import { UsersService } from '../users/services/users-service';
import { DEFAULT_PROFILE_PHOTO, buildUserUpdateDtoFromStudentForm, StudentUserFormValue } from '../users/utils/user-dto.mapper';
import { CursosService } from '../cursos/services/cursos-service';
import { Auth } from '../../core/services/auth';

interface EstudianteFormValue {
  tipoDocTutor: string;
  documentoTutor: string;
  emailTutor: string;
  nombreTutor: string;
  apellidoTutor: string;
  ocupacionTutor: string;
  telefonoTutor: string;
  user?: UserModel | null;
  names: string;
  lastNames: string;
  phone: string;
  address: string;
  docType: string;
  document: string;
  photo: string;
  email: string;
  isActive: boolean;
  password: string;
  cursoId: number | CursoModel | null;
}

interface EstudianteCreatePayload {
  estudiante: Omit<CreateEstudianteDto, 'userId'>;
  user: CreateUserDto;
}

interface ImportStudentRow {
  usuario: string;
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
  cursoId: number;
  tipoDocTutor: string;
  documentoTutor: string;
  emailTutor: string;
  nombreTutor: string;
  apellidoTutor: string;
  ocupacionTutor: string;
  telefonoTutor: string;
}

interface EstudianteTableRow extends EstudianteModel {
  displayId: number | string;
  userIdLabel: number | string;
  studentName: string;
  studentDocType: string;
  studentDocument: string;
  studentEmail: string;
  studentPhone: string;
  studentAddress: string;
  tutorName: string;
  courseName: string;
}

type StudentSortKey = 'studentName' | 'studentDocument' | 'courseName' | 'status';
type SortDirection = 'asc' | 'desc';

@Component({
  selector: 'app-estudiantes',
  imports: [CommonModule, MatButtonModule, MatDialogModule, MatIconModule, MatSlideToggleModule],
  templateUrl: './estudiantes.html',
  styleUrl: './estudiantes.scss',
})
export class Estudiantes {
  private estudiantesService = inject(EstudiantesService);
  private usersService = inject(UsersService);
  private cursosService = inject(CursosService);
  private authService = inject(Auth);
  public cursos = this.cursosService.cursos;
  public expandedStudentId = signal<number | string | null>(null);
  public pageSize = signal(5);
  public currentPage = signal(1);
  public sortKey = signal<StudentSortKey>('studentName');
  public sortDirection = signal<SortDirection>('asc');
  public isImporting = signal(false);
  private readonly studentRole = { id: 4, name: 'ESTUDIANTE', description: 'Estudiante', modules: [] };
  private readonly estudianteDialogConfig = {
    width: '100vw',
    maxWidth: '100vw',
    height: 'auto',
    panelClass: 'full-screen-dialog'
  };

  public currentUser = this.authService.currentUser;

  public isDocenteMode = computed(() =>
    this.hasRole('docente')
    && !this.hasRole('admin')
    && !this.hasRole('administrador')
    && !this.hasRole('auxiliar administrativo')
  );

  public docenteCursoIds = computed(() => {
    const currentUserId = this.currentUser()?.id;
    if (!currentUserId || !this.isDocenteMode()) return new Set<number>();

    return new Set(
      this.cursosService.asignaciones()
        .filter(asignacion => this.getAsignacionDocenteId(asignacion) === currentUserId)
        .map(asignacion => this.getAsignacionCursoId(asignacion))
        .filter((cursoId): cursoId is number => !!cursoId)
    );
  });

  public docenteHasAssignedCursos = computed(() => this.docenteCursoIds().size > 0);

  public canManageStudents = computed(() => !this.isDocenteMode());

  public estudiantesVisibles = computed(() => {
    const estudiantes = this.estudiantesService.estudiantes();

    if (!this.isDocenteMode()) return estudiantes;

    const cursoIds = this.docenteCursoIds();
    if (cursoIds.size === 0) return estudiantes;

    return estudiantes.filter(estudiante => cursoIds.has(this.getCursoId(estudiante.curso)));
  });

  public estudiantesForTable = computed<EstudianteTableRow[]>(() => this.estudiantesVisibles().map(estudiante => ({
    ...estudiante,
    displayId: this.getEstudianteId(estudiante) ?? 'Sin ID',
    userIdLabel: estudiante.user?.id ?? 'Sin usuario',
    studentName: `${estudiante.user?.names ?? ''} ${estudiante.user?.lastNames ?? ''}`.trim() || 'Sin usuario',
    studentDocType: estudiante.user?.docType ?? '',
    studentDocument: estudiante.user?.document ?? '',
    studentEmail: estudiante.user?.email ?? '',
    studentPhone: estudiante.user?.phone ?? '',
    studentAddress: estudiante.user?.address ?? '',
    tutorName: `${estudiante.nombreTutor} ${estudiante.apellidoTutor}`,
    courseName: this.getCursoName(estudiante.curso)
  })));

  public estudiantesWithCourseCount = computed(() =>
    this.estudiantesVisibles().filter(estudiante => !!this.getCursoId(estudiante.curso)).length
  );

  public sortedStudents = computed(() => {
    const key = this.sortKey();
    const direction = this.sortDirection();

    return [...this.estudiantesForTable()].sort((a, b) => {
      const firstValue = this.getSortValue(a, key);
      const secondValue = this.getSortValue(b, key);
      const comparison = firstValue.localeCompare(secondValue, 'es', { numeric: true, sensitivity: 'base' });

      return direction === 'asc' ? comparison : -comparison;
    });
  });

  public totalPages = computed(() =>
    Math.max(1, Math.ceil(this.sortedStudents().length / this.pageSize()))
  );

  public paginatedStudents = computed(() => {
    const safePage = Math.min(this.currentPage(), this.totalPages());
    const start = (safePage - 1) * this.pageSize();

    return this.sortedStudents().slice(start, start + this.pageSize());
  });

  public paginationStart = computed(() => {
    if (this.sortedStudents().length === 0) return 0;
    return (Math.min(this.currentPage(), this.totalPages()) - 1) * this.pageSize() + 1;
  });

  public paginationEnd = computed(() =>
    Math.min(this.paginationStart() + this.pageSize() - 1, this.sortedStudents().length)
  );

  public setPageSize(value: string | number) {
    this.pageSize.set(Number(value));
    this.currentPage.set(1);
    this.expandedStudentId.set(null);
  }

  public goToPage(page: number) {
    const nextPage = Math.max(1, Math.min(page, this.totalPages()));
    this.currentPage.set(nextPage);
    this.expandedStudentId.set(null);
  }

  public sortBy(key: StudentSortKey) {
    if (this.sortKey() === key) {
      this.sortDirection.set(this.sortDirection() === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortKey.set(key);
      this.sortDirection.set('asc');
    }

    this.currentPage.set(1);
    this.expandedStudentId.set(null);
  }

  public getSortIcon(key: StudentSortKey) {
    if (this.sortKey() !== key) return 'unfold_more';
    return this.sortDirection() === 'asc' ? 'arrow_upward' : 'arrow_downward';
  }

  public toggleStudentDetails(estudiante: EstudianteTableRow) {
    const estudianteId = this.getStudentRowId(estudiante);
    this.expandedStudentId.set(this.expandedStudentId() === estudianteId ? null : estudianteId);
  }

  public isStudentExpanded(estudiante: EstudianteTableRow) {
    return this.expandedStudentId() === this.getStudentRowId(estudiante);
  }

  public getStudentRowId(estudiante: EstudianteModel | EstudianteTableRow) {
    return this.getEstudianteId(estudiante) ?? estudiante.user?.id ?? estudiante.user?.document ?? 'sin-id';
  }

  public getStudentInitials(estudiante: EstudianteTableRow) {
    const names = estudiante.studentName.split(' ').filter(Boolean);
    return names.slice(0, 2).map(name => name[0]?.toUpperCase()).join('') || 'ES';
  }

  private getSortValue(estudiante: EstudianteTableRow, key: StudentSortKey) {
    if (key === 'status') return estudiante.user.isActive ? 'Activo' : 'Inactivo';
    return String(estudiante[key] ?? '');
  }

  constructor(private dialog: MatDialog) { }

  ngOnInit() {
    this.cursosService.loadCursos();
    this.cursosService.loadAsignaciones();
    this.usersService.loadUsers();
  }

  openDialog() {
    const dialogRef = this.dialog.open(EstudiantesForm, {
      ...this.estudianteDialogConfig
    });

    dialogRef.afterClosed().subscribe((result?: EstudianteFormValue) => {
      if (result) {
        this.createStudentFromFormValue(result).subscribe({
          next: () => {
            this.estudiantesService.loadEstudiantes();
            this.showSuccess('Estudiante creado', 'El estudiante se guardo correctamente.');
          },
          error: (err: HttpErrorResponse) => {
            console.error('Error al crear estudiante', err);
            this.showError('Error al guardar', this.getErrorMessage(err));
          }
        });
      }
    });
  }

  importExcel(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';

    if (!file) return;

    this.isImporting.set(true);

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const workbook = XLSX.read(reader.result, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
        const formValues = this.buildImportFormValues(rows);

        if (!formValues.length) {
          this.isImporting.set(false);
          this.showError('Archivo vacío', 'No se encontraron estudiantes válidos para importar.');
          return;
        }

        forkJoin(formValues.map(formValue => this.createStudentFromFormValue(formValue))).subscribe({
          next: () => {
            this.isImporting.set(false);
            this.estudiantesService.loadEstudiantes();
            this.showSuccess('Estudiantes importados', `Se importaron ${formValues.length} estudiante${formValues.length === 1 ? '' : 's'} correctamente.`);
          },
          error: (err: HttpErrorResponse) => {
            this.isImporting.set(false);
            this.showError('Error al importar', this.getErrorMessage(err));
          }
        });
      } catch (error) {
        this.isImporting.set(false);
        const message = error instanceof Error ? error.message : 'No se pudo leer el archivo.';
        this.showError('Excel inválido', message);
      }
    };

    reader.onerror = () => {
      this.isImporting.set(false);
      this.showError('Error al leer', 'No se pudo leer el archivo seleccionado.');
    };

    reader.readAsArrayBuffer(file);
  }

  handleEdit(estudiante: EstudianteModel) {
    if (!this.canEditStudent(estudiante)) return;

    const dialogRef = this.dialog.open(EstudiantesForm, {
      ...this.estudianteDialogConfig,
      data: estudiante
    });

    dialogRef.afterClosed().subscribe((result?: EstudianteFormValue) => {
      const estudianteId = this.getEstudianteId(estudiante);

      if (result && estudianteId && estudiante.user?.id) {
        const estudianteDto: UpdateEstudianteDto = this.toEstudianteDto(result);
        const selectedUser = this.getUserById(estudiante.user.id) ?? result.user ?? estudiante.user;
        const userDto: UpdateUserDto = buildUserUpdateDtoFromStudentForm(
          this.toStudentUserFormValue(result),
          selectedUser
        );
        const selectedRoles = selectedUser.roles ?? [];

        forkJoin({
          estudiante: this.estudiantesService.updateEstudiante(estudianteId, estudianteDto),
          user: this.usersService.updateUser(estudiante.user.id, userDto, selectedRoles)
        }).subscribe({
          next: response => {
            this.estudiantesService.loadEstudiantes();
            console.log('Actualizado con exito', response);
            this.showSuccess('Estudiante actualizado', 'La información del estudiante se actualizó correctamente.');
          },
          error: (err: HttpErrorResponse) => {
            console.error('Error al actualizar', err);
            this.showError('Error al actualizar', this.getErrorMessage(err));
          }
        });
      }
    });
  }

  private buildImportFormValues(rows: Record<string, unknown>[]): EstudianteFormValue[] {
    const parsedRows = rows
      .map((row, index) => this.parseImportRow(row, index + 2))
      .filter((row): row is ImportStudentRow => !!row);

    this.validateImportRows(parsedRows);

    return parsedRows.map(row => this.toImportFormValue(row));
  }

  private parseImportRow(row: Record<string, unknown>, rowNumber: number): ImportStudentRow | null {
    const normalized = this.normalizeImportRow(row);
    const isEmpty = Object.values(normalized).every(value => !String(value).trim());
    if (isEmpty) return null;

    const document = this.getImportString(normalized, ['documento', 'document', 'numeroDocumento', 'documentoEstudiante', 'estudianteDocumentoEstudiante']);
    const password = this.getImportString(normalized, ['password', 'contraseña', 'contraseñaUsuario', 'usuarioContraseñaUsuario']);
    const cursoId = this.resolveCursoId(
      this.getImportString(normalized, ['cursoId', 'idCurso', 'cursoCursoId']),
      this.getImportString(normalized, ['curso', 'nombreCurso', 'cursoCurso'])
    );

    if (!cursoId) {
      throw new Error(`Curso no encontrado en la fila ${rowNumber}. Usa cursoId o el nombre exacto del curso.`);
    }

    return {
      names: this.requireImportValue(normalized, ['nombres', 'names', 'nombreEstudiante', 'nombresEstudiante', 'estudianteNombresEstudiante'], `nombres fila ${rowNumber}`),
      lastNames: this.requireImportValue(normalized, ['apellidos', 'lastNames', 'apellidoEstudiante', 'apellidosEstudiante', 'estudianteApellidosEstudiante'], `apellidos fila ${rowNumber}`),
      phone: this.getImportString(normalized, ['teléfono', 'phone', 'teléfonoEstudiante', 'estudianteTeléfonoEstudiante']),
      address: this.getImportString(normalized, ['dirección', 'address', 'direcciónEstudiante', 'estudianteDirecciónEstudiante']),
      docType: this.getImportString(normalized, ['tipoDocumento', 'docType', 'tipoDoc', 'tipoDocumentoEstudiante', 'estudianteTipoDocumentoEstudiante']) || 'CC',
      document: document || this.throwImportError(`documento fila ${rowNumber}`),
      photo: this.getImportString(normalized, ['foto', 'photo', 'fotoEstudiante', 'estudianteFotoEstudiante']),
      email: this.requireImportValue(normalized, ['correo', 'email', 'emailEstudiante', 'correoEstudiante', 'estudianteCorreoEstudiante'], `correo fila ${rowNumber}`),
      password: password || document || '123456',
      isActive: this.parseBoolean(this.getImportString(normalized, ['activo', 'isActive', 'estado', 'estadoUsuario', 'usuarioEstadoUsuario']), true),
      cursoId,
      usuario: this.getImportString(normalized, ['usuario', 'user', 'usuarioUsuarioExistente']),
      tipoDocTutor: this.getImportString(normalized, ['tipoDocTutor', 'tipoDocumentoTutor', 'tutorTipoDocumentoTutor']) || 'CC',
      documentoTutor: this.getImportString(normalized, ['documentoTutor', 'docTutor', 'tutorDocumentoTutor']),
      emailTutor: this.getImportString(normalized, ['emailTutor', 'correoTutor', 'tutorEmailTutor']),
      nombreTutor: this.getImportString(normalized, ['nombreTutor', 'nombresTutor', 'tutorNombreTutor']),
      apellidoTutor: this.getImportString(normalized, ['apellidoTutor', 'apellidosTutor', 'tutorApellidoTutor']),
      ocupacionTutor: this.getImportString(normalized, ['ocupacionTutor', 'tutorOcupacionTutor']),
      telefonoTutor: this.getImportString(normalized, ['telefonoTutor', 'celularTutor', 'tutorTeléfonoTutor'])
    };
  }

  private validateImportRows(rows: ImportStudentRow[]) {
    const existingDocuments = new Set(this.estudiantesService.estudiantes().map(estudiante => estudiante.user?.document).filter(Boolean));
    const existingEmails = new Set(this.estudiantesService.estudiantes().map(estudiante => this.normalizeText(estudiante.user?.email ?? '')).filter(Boolean));
    const fileDocuments = new Set<string>();
    const fileEmails = new Set<string>();

    rows.forEach(row => {
      const email = this.normalizeText(row.email);

      if (existingDocuments.has(row.document)) {
        throw new Error(`Ya existe un estudiante con documento ${row.document}.`);
      }

      if (existingEmails.has(email)) {
        throw new Error(`Ya existe un estudiante con correo ${row.email}.`);
      }

      if (fileDocuments.has(row.document)) {
        throw new Error(`El documento ${row.document} esta repetido en el archivo.`);
      }

      if (fileEmails.has(email)) {
        throw new Error(`El correo ${row.email} esta repetido en el archivo.`);
      }

      fileDocuments.add(row.document);
      fileEmails.add(email);
    });
  }

  handleToggleStatus(estudiante: EstudianteModel, event: MatSlideToggleChange) {
    if (!this.canEditStudent(estudiante)) {
      event.source.checked = !!estudiante.user?.isActive;
      return;
    }

    const user = estudiante.user;
    if (!user?.id) {
      event.source.checked = !!user?.isActive;
      return;
    }

    const nextState = event.checked;
    const actionLabel = nextState ? 'activar' : 'inactivar';
    Swal.fire({
      icon: nextState ? 'question' : 'warning',
      title: `${nextState ? 'Activar' : 'Inactivar'} estudiante`,
      text: `Estas seguro de ${actionLabel} a ${user.names ?? 'este estudiante'}?`,
      showCancelButton: true,
      confirmButtonText: nextState ? 'Si, activar' : 'Si, inactivar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: nextState ? '#146b50' : '#cf2f2f'
    }).then(result => {
      if (!result.isConfirmed) {
        event.source.checked = user.isActive;
        return;
      }

      this.usersService.updateUser(user.id, { isActive: nextState }, user.roles ?? []).subscribe({
        next: () => {
          this.estudiantesService.loadEstudiantes();
          Swal.fire({
            icon: 'success',
            title: nextState ? 'Estudiante activado' : 'Estudiante inactivado',
            text: `${user.names ?? 'El estudiante'} se actualizó correctamente.`,
            confirmButtonText: 'Aceptar'
          });
        },
        error: err => {
          event.source.checked = user.isActive;
          console.error('Error al cambiar estado del estudiante', err);
          Swal.fire({
            icon: 'error',
            title: 'No se pudo cambiar el estado',
            text: this.getErrorMessage(err),
            confirmButtonText: 'Aceptar'
          });
        }
      });
    });
  }

  private toCreatePayload(formValue: EstudianteFormValue): EstudianteCreatePayload {
    return {
      estudiante: this.toEstudianteDto(formValue),
      user: this.toUserDto(formValue)
    };
  }

  private createStudentFromFormValue(formValue: EstudianteFormValue) {
    const payload = this.toCreatePayload(formValue);

    if (formValue.user?.id) {
      return this.estudiantesService.createEstudiante({
        ...payload.estudiante,
        userId: formValue.user.id
      });
    }

    return this.usersService.createUser(payload.user, [this.studentRole]).pipe(
      switchMap((newUser: UserModel) => this.estudiantesService.createEstudiante({
        ...payload.estudiante,
        userId: newUser.id
      }))
    );
  }

  private toImportFormValue(row: ImportStudentRow): EstudianteFormValue {
    return {
      tipoDocTutor: row.tipoDocTutor,
      documentoTutor: row.documentoTutor,
      emailTutor: row.emailTutor,
      nombreTutor: row.nombreTutor,
      apellidoTutor: row.apellidoTutor,
      ocupacionTutor: row.ocupacionTutor,
      telefonoTutor: row.telefonoTutor,
      user: this.resolveImportUser(row.usuario),
      names: row.names,
      lastNames: row.lastNames,
      phone: row.phone,
      address: row.address,
      docType: row.docType,
      document: row.document,
      photo: row.photo,
      email: row.email,
      isActive: row.isActive,
      password: row.password,
      cursoId: row.cursoId
    };
  }

  private resolveImportUser(value: string) {
    const search = this.normalizeText(value);
    if (!search) return null;

    const directId = Number(value);

    return this.usersService.users().find(user => {
      const fullName = this.normalizeText(`${user.names ?? ''} ${user.lastNames ?? ''}`);
      const document = this.normalizeText(user.document ?? '');
      const email = this.normalizeText(user.email ?? '');

      return user.id === directId
        || document === search
        || email === search
        || fullName === search;
    }) ?? null;
  }

  private toEstudianteDto(formValue: EstudianteFormValue): Omit<CreateEstudianteDto, 'userId'> {
    return {
      tipoDocTutor: formValue.tipoDocTutor,
      documentoTutor: formValue.documentoTutor,
      emailTutor: formValue.emailTutor,
      nombreTutor: formValue.nombreTutor,
      apellidoTutor: formValue.apellidoTutor,
      ocupacionTutor: formValue.ocupacionTutor,
      telefonoTutor: formValue.telefonoTutor,
      cursoId: this.getCursoId(formValue.cursoId)
    };
  }

  private toUserDto(formValue: EstudianteFormValue): CreateUserDto {
    return {
      names: formValue.names,
      lastNames: formValue.lastNames,
      phone: formValue.phone,
      address: formValue.address,
      docType: formValue.docType,
      document: formValue.document,
      photo: formValue.photo || DEFAULT_PROFILE_PHOTO,
      email: formValue.email,
      isActive: formValue.isActive,
      password: formValue.password,
      roleIds: [4]
    };
  }

  private toStudentUserFormValue(formValue: EstudianteFormValue): StudentUserFormValue {
    return {
      user: formValue.user ?? undefined,
      userNames: formValue.names,
      userLastNames: formValue.lastNames,
      userPhone: formValue.phone,
      userAddress: formValue.address,
      userDocType: formValue.docType,
      userDocument: formValue.document,
      userPhoto: formValue.photo,
      userEmail: formValue.email,
      userIsActive: formValue.isActive,
      userPassword: formValue.password
    };
  }

  private getCursoName(curso?: CursoModel) {
    if (!curso) return 'Sin curso';
    return curso.nombreCurso || curso.name || curso.nombre || `Curso ${curso.id ?? curso.idCurso}`;
  }

  private resolveCursoId(cursoIdValue: string, cursoNameValue: string) {
    const directId = Number(cursoIdValue);
    if (Number.isFinite(directId) && directId > 0) return directId;

    const cursoName = this.normalizeText(cursoNameValue);
    const curso = this.cursos().find(item => this.normalizeText(this.getCursoName(item)) === cursoName);

    return curso ? this.getCursoId(curso) : 0;
  }

  private getCursoId(curso: number | CursoModel | null | undefined) {
    if (typeof curso === 'number') return curso;
    return curso?.id ?? curso?.idCurso ?? 0;
  }

  public canEditStudent(estudiante: EstudianteModel) {
    if (!this.isDocenteMode()) return true;
    if (!this.docenteHasAssignedCursos()) return false;

    return this.docenteCursoIds().has(this.getCursoId(estudiante.curso));
  }

  public getEmptyStateMessage() {
    if (this.isDocenteMode() && this.docenteHasAssignedCursos()) {
      return 'No hay estudiantes registrados en los cursos asignados.';
    }

    return 'Aún no hay estudiantes registrados.';
  }

  private getAsignacionCursoId(asignacion: { cursoId?: number | string; curso?: { id?: number | string; idCurso?: number | string; cursoId?: number | string } }) {
    return this.toNumber(asignacion.cursoId ?? asignacion.curso?.id ?? asignacion.curso?.idCurso ?? asignacion.curso?.cursoId);
  }

  private getAsignacionDocenteId(asignacion: { docenteId?: number | string; docente?: { id?: number | string } }) {
    return this.toNumber(asignacion.docenteId ?? asignacion.docente?.id);
  }

  private toNumber(value: number | string | null | undefined) {
    const parsedValue = Number(value);
    return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : 0;
  }

  private hasRole(roleName: string) {
    const normalizedRole = this.normalizeText(roleName);

    return (this.currentUser()?.roles ?? []).some(role =>
      this.normalizeText(role.name ?? '').includes(normalizedRole)
    );
  }

  private normalizeImportRow(row: Record<string, unknown>) {
    return Object.entries(row).reduce<Record<string, unknown>>((acc, [key, value]) => {
      acc[this.normalizeText(key).replace(/[^a-z0-9]/g, '')] = value;
      return acc;
    }, {});
  }

  private getImportString(row: Record<string, unknown>, aliases: string[]) {
    const key = aliases
      .map(alias => this.normalizeText(alias).replace(/[^a-z0-9]/g, ''))
      .find(alias => Object.prototype.hasOwnProperty.call(row, alias));

    return key ? String(row[key] ?? '').trim() : '';
  }

  private requireImportValue(row: Record<string, unknown>, aliases: string[], label: string) {
    const value = this.getImportString(row, aliases);
    if (!value) this.throwImportError(label);
    return value;
  }

  private throwImportError(label: string): never {
    throw new Error(`Falta el campo ${label}.`);
  }

  private parseBoolean(value: string, fallback: boolean) {
    if (!value) return fallback;

    const normalized = this.normalizeText(value);
    if (['true', '1', 'si', 'activo', 'activa'].includes(normalized)) return true;
    if (['false', '0', 'no', 'inactivo', 'inactiva'].includes(normalized)) return false;

    return fallback;
  }

  private normalizeText(value: string) {
    return value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  private getUserById(id: number) {
    return this.usersService.users().find(user => user.id === id);
  }

  private getEstudianteId(estudiante: EstudianteModel) {
    return estudiante.id ?? estudiante.idEstudiante;
  }

  private getErrorMessage(err: HttpErrorResponse) {
    const message = err.error?.message;

    return Array.isArray(message)
      ? message.join(', ')
      : message || 'Error desconocido';
  }

  private showSuccess(title: string, text: string) {
    Swal.fire({ icon: 'success', title, text, confirmButtonText: 'Aceptar', confirmButtonColor: '#146b50' });
  }

  private showError(title: string, text: string) {
    Swal.fire({ icon: 'error', title, text, confirmButtonText: 'Aceptar', confirmButtonColor: '#b4232f' });
  }
}
