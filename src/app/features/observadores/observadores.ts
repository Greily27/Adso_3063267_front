import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import Swal from 'sweetalert2';
import { Auth } from '../../core/services/auth';
import { CustomTable, TableColumn } from '../../shared/components/custom-table/custom-table';
import { CursoModel } from '../cursos/models/curso.model';
import { CursosService } from '../cursos/services/cursos-service';
import { EstudianteModel } from '../estudiantes/models/estudiante.model';
import { EstudiantesService } from '../estudiantes/services/estudiantes-service';
import { UsersService } from '../users/services/users-service';
import { CreateObservadorDto, ObservadorModel, UpdateObservadorDto } from './models/observador.model';
import { ObservadoresService } from './services/observadores-service';

type CurrentUserStudentInfo = {
  id?: number;
  estudianteId?: number | string;
  idEstudiante?: number | string;
  estudiante?: {
    id?: number | string;
    idEstudiante?: number | string;
  };
};

@Component({
  selector: 'app-observadores',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    CustomTable
  ],
  templateUrl: './observadores.html',
  styleUrl: './observadores.scss',
})
export class Observadores {
  private fb = inject(FormBuilder);
  private authService = inject(Auth);
  private cursosService = inject(CursosService);
  private estudiantesService = inject(EstudiantesService);
  private usersService = inject(UsersService);
  private observadoresService = inject(ObservadoresService);

  public cursos = this.cursosService.cursos;
  public estudiantes = this.estudiantesService.estudiantes;
  public showCreatePanel = false;
  public errorMessage = '';
  public editingObservador = signal<ObservadorModel | null>(null);
  public selectedCurso = signal<CursoModel | null>(null);
  public canManageObservadores = computed(() => (this.isAdmin() || this.isDocente()) && !this.isEstudiante());
  public docentesDisponibles = computed(() =>
    this.usersService.users().filter(user =>
      user.roles?.some(role => this.normalizeRoleName(role.name).includes('docente'))
    )
  );

  public categorias = [
    'Academica',
    'Convivencia',
    'Asistencia',
    'Reconocimiento',
    'Seguimiento'
  ];

  public form = this.fb.group({
    curso: [null as CursoModel | null, Validators.required],
    estudiante: [null as EstudianteModel | null, Validators.required],
    docente: [null as any],
    fecha: [this.getToday(), Validators.required],
    categoria: ['', [Validators.required, Validators.maxLength(100)]],
    descripcion: ['', Validators.required]
  });

  private loadedStudentObservadoresId: number | null = null;
  private loadStudentObservadoresEffect = effect(() => {
    if (!this.isEstudiante()) return;

    const estudianteId = this.getCurrentStudentId();
    if (!estudianteId || this.loadedStudentObservadoresId === estudianteId) return;

    this.loadedStudentObservadoresId = estudianteId;
    this.observadoresService.loadObservadoresByEstudiante(estudianteId);
  });

  public columns: TableColumn[] = [
    { label: 'Fecha', key: 'fechaDisplay' },
    { label: 'Estudiante', key: 'studentName' },
    { label: 'Curso', key: 'cursoName' },
    { label: 'Categoria', key: 'categoria' },
    { label: 'Descripcion', key: 'descripcion' },
    { label: 'Docente', key: 'docenteName' }
  ];

  public cursosDisponibles = computed(() => {
    const cursos = this.cursos();
    const currentUser = this.authService.currentUser();
    const fullUser = this.getCurrentUserWithRelations();

    if (!this.isDocente()) return cursos;

    const userCourseIds = new Set((currentUser?.cursos ?? fullUser?.cursos ?? [])
      .map(curso => this.getCursoId(curso))
      .filter((id): id is number => id !== undefined));

    this.cursosService.asignaciones()
      .filter(asignacion => asignacion.docenteId === currentUser?.id)
      .forEach(asignacion => userCourseIds.add(asignacion.cursoId));

    if (userCourseIds.size > 0) {
      return cursos.filter(curso => {
        const cursoId = this.getCursoId(curso);
        return cursoId !== undefined && userCourseIds.has(cursoId);
      });
    }

    const cursosByUsers = cursos.filter(curso =>
      curso.users?.some(user => user.id === currentUser?.id)
      || this.getUserId(curso.directorCurso) === currentUser?.id
      || this.getUserId(curso.director) === currentUser?.id
    );

    return cursosByUsers.length > 0 ? cursosByUsers : cursos;
  });

  public estudiantesFiltrados = computed(() => {
    const cursoId = this.getCursoId(this.selectedCurso());
    const estudiantes = this.estudiantes();

    if (!cursoId) {
      if (!this.isDocente()) return estudiantes;

      const cursosIds = new Set(
        this.cursosDisponibles()
          .map(curso => this.getCursoId(curso))
          .filter((id): id is number => id !== undefined)
      );

      return estudiantes.filter(estudiante =>
        cursosIds.has(this.getCursoId(estudiante.curso) ?? 0)
      );
    }

    return estudiantes.filter(estudiante => this.getCursoId(estudiante.curso) === cursoId);
  });

  public observadoresForTable = computed(() => {
    const currentStudentId = this.getCurrentStudentId();
    const currentUserId = this.authService.currentUser()?.id ?? 0;

    return this.observadoresService.observadores()
      .filter(observador => {
        if (!this.isEstudiante()) return true;
        if (!currentStudentId) return false;

        return this.observadorBelongsToStudent(observador, currentStudentId, currentUserId);
      })
      .map(observador => {
        const estudiante = this.getObservadorEstudiante(observador);
        const curso = this.getObservadorCurso(observador, estudiante);
        const docente = this.getObservadorDocente(observador);

        return {
          ...observador,
          fechaDisplay: this.formatDate(observador.fecha),
          studentName: this.getStudentName(estudiante),
          cursoName: this.getCursoName(curso),
          docenteName: this.getDocenteName(docente),
          descripcion: observador.descripcion?.trim() || 'Sin descripcion'
        };
      });
  });

  ngOnInit() {
    this.cursosService.loadCursos();
    this.cursosService.loadAsignaciones();
    this.estudiantesService.loadEstudiantes();
    this.usersService.loadUsers();

    if (!this.isEstudiante()) {
      this.observadoresService.loadObservadores();
    }

    if (this.isAdmin()) {
      this.form.controls.docente.addValidators(Validators.required);
      this.form.controls.docente.updateValueAndValidity();
    }

    this.form.controls.curso.valueChanges.subscribe(curso => {
      this.selectedCurso.set(curso);
      this.form.controls.estudiante.setValue(null);
    });
  }

  openPanel() {
    if (!this.canManageObservadores()) return;

    this.showCreatePanel = !this.showCreatePanel;
    if (!this.showCreatePanel) this.clearPanel();
  }

  saveObservador() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    const docenteId = this.getSelectedDocenteId(value.docente);
    if (!docenteId) {
      this.errorMessage = this.isAdmin()
        ? 'Debes seleccionar el docente del observador.'
        : 'No se pudo identificar el docente logueado.';
      return;
    }

    if (!this.canManageObservadores()) {
      this.errorMessage = 'No tienes permisos para crear observadores.';
      return;
    }

    const dto = this.toDto(value, docenteId);
    const editing = this.editingObservador();
    const editingId = editing ? this.getObservadorId(editing) : undefined;

    if (!dto.cursoId || !dto.estudianteId) {
      this.errorMessage = 'Debes seleccionar un curso y un estudiante válidos.';
      return;
    }

    this.errorMessage = '';

    if (editingId) {
      const updateDto: UpdateObservadorDto = dto;
      this.observadoresService.updateObservador(editingId, updateDto).subscribe({
        next: () => {
          this.clearPanel();
          this.showSuccess('Observador actualizado', 'El observador se actualizó correctamente.');
        },
        error: (err: HttpErrorResponse) => {
          console.error('Error al actualizar observador', err);
          this.errorMessage = this.getErrorMessage(err, 'No se pudo actualizar el observador.');
          this.showError('Error al actualizar', this.errorMessage);
        }
      });
      return;
    }

    this.observadoresService.createObservador(dto, {
      estudiante: value.estudiante!,
      curso: value.curso!,
      docente: value.docente ?? this.authService.currentUser()
    }).subscribe({
      next: () => {
        this.clearPanel();
        this.showSuccess('Observador creado', 'El observador se guardo correctamente.');
      },
      error: (err: HttpErrorResponse) => {
        console.error('Error al guardar observador', err);
        this.errorMessage = this.getErrorMessage(err, 'No se pudo crear el observador.');
        this.showError('Error al guardar', this.errorMessage);
      }
    });
  }

  handleEdit(observador: ObservadorModel) {
    if (!this.canManageObservadores()) return;

    const estudiante = this.getObservadorEstudiante(observador);
    const curso = this.getObservadorCurso(observador, estudiante);

    this.editingObservador.set(observador);
    this.showCreatePanel = true;
    this.form.patchValue({
      curso: curso ?? null,
      estudiante: estudiante ?? null,
      docente: this.isAdmin() ? this.getObservadorDocente(observador) ?? null : null,
      fecha: this.toInputDate(observador.fecha),
      categoria: observador.categoria,
      descripcion: observador.descripcion
    });
  }

  async handleDelete(observador: ObservadorModel) {
    if (!this.canManageObservadores()) return;

    const id = this.getObservadorId(observador);
    if (!id) return;

    const result = await Swal.fire({
      icon: 'warning',
      title: 'Eliminar observador',
      text: `Estas seguro de eliminar el observador de ${this.formatDate(observador.fecha)}?`,
      showCancelButton: true,
      confirmButtonText: 'Si, eliminar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#b4232f'
    });

    if (!result.isConfirmed) return;

    this.errorMessage = '';
    this.observadoresService.deleteObservador(id).subscribe({
      next: () => this.showSuccess('Observador eliminado', 'El observador se eliminó correctamente.'),
      error: (err: HttpErrorResponse) => {
        console.error('Error al eliminar observador', err);
        this.errorMessage = this.getErrorMessage(err, 'No se pudo eliminar el observador.');
        this.showError('Error al eliminar', this.errorMessage);
      }
    });
  }

  clearPanel() {
    this.form.reset({
      curso: null,
      estudiante: null,
      docente: null,
      fecha: this.getToday(),
      categoria: '',
      descripcion: ''
    });
    this.selectedCurso.set(null);
    this.editingObservador.set(null);
  }

  compareCurso(item1: CursoModel | null, item2: CursoModel | null) {
    return item1 && item2 ? this.getCursoId(item1) === this.getCursoId(item2) : item1 === item2;
  }

  compareEstudiante(item1: EstudianteModel | null, item2: EstudianteModel | null) {
    return item1 && item2 ? this.getEstudianteId(item1) === this.getEstudianteId(item2) : item1 === item2;
  }

  compareDocente(item1: { id?: number } | null, item2: { id?: number } | null) {
    return item1 && item2 ? item1.id === item2.id : item1 === item2;
  }

  getCursoName(curso?: Partial<CursoModel> & { nombre?: string; name?: string }) {
    if (!curso) return 'Sin curso';
    return curso.nombreCurso || curso.nombre || curso.name || `Curso ${this.getCursoId(curso)}`;
  }

  getStudentName(estudiante?: EstudianteModel) {
    if (!estudiante) return 'Sin estudiante';
    return `${estudiante.user?.names ?? ''} ${estudiante.user?.lastNames ?? ''}`.trim()
      || `Estudiante ${this.getEstudianteId(estudiante)}`;
  }

  getUserName(user?: { names?: string; lastNames?: string; email?: string }) {
    if (!user) return 'Sin docente';
    return `${user.names ?? ''} ${user.lastNames ?? ''}`.trim() || user.email || 'Sin docente';
  }

  private toDto(value: {
    curso: CursoModel | null;
    estudiante: EstudianteModel | null;
    docente?: { id?: number } | null;
    fecha: string | null;
    categoria: string | null;
    descripcion: string | null;
  }, docenteId: number): CreateObservadorDto {
    return {
      estudianteId: value.estudiante ? this.getEstudianteId(value.estudiante) : 0,
      cursoId: this.getCursoId(value.curso) ?? this.getCursoId(value.estudiante?.curso) ?? 0,
      docenteId,
      fecha: this.normalizeDateForApi(value.fecha),
      categoria: value.categoria?.trim() ?? '',
      descripcion: value.descripcion?.trim() ?? ''
    };
  }

  private getObservadorId(observador: ObservadorModel) {
    return observador.idObservador ?? observador.id;
  }

  private getEstudianteId(estudiante: EstudianteModel) {
    return this.toNumber(estudiante.id
      ?? estudiante.idEstudiante
      ?? estudiante.user?.estudiante?.id
      ?? 0);
  }

  private getObservadorEstudiante(observador: ObservadorModel) {
    const estudianteId = observador.estudiante
      ? this.getEstudianteId(observador.estudiante)
      : observador.estudianteId;

    return observador.estudiante
      ?? this.estudiantes().find(estudiante => this.getEstudianteId(estudiante) === estudianteId);
  }

  private getObservadorCurso(observador: ObservadorModel, estudiante?: EstudianteModel) {
    const cursoId = this.getCursoId(observador.curso) ?? observador.cursoId ?? this.getCursoId(estudiante?.curso);

    return observador.curso
      ?? estudiante?.curso as CursoModel | undefined
      ?? this.cursos().find(curso => this.getCursoId(curso) === cursoId);
  }

  private getObservadorDocente(observador: ObservadorModel) {
    return observador.docente
      ?? this.usersService.users().find(user => user.id === observador.docenteId);
  }

  private getDocenteName(docente?: { names?: string; lastNames?: string; email?: string }) {
    return this.getUserName(docente);
  }

  private getSelectedDocenteId(docente?: { id?: number } | null) {
    return this.isAdmin()
      ? docente?.id
      : this.authService.currentUser()?.id;
  }

  private getCurrentUserWithRelations() {
    const currentUser = this.authService.currentUser();
    return this.usersService.users().find(user => user.id === currentUser?.id);
  }

  private getCurrentStudentId() {
    const currentUser = this.authService.currentUser() as CurrentUserStudentInfo | undefined;
    const fullUser = this.getCurrentUserWithRelations();
    const relationId = currentUser?.estudiante?.id
      ?? currentUser?.estudiante?.idEstudiante
      ?? currentUser?.estudianteId
      ?? currentUser?.idEstudiante
      ?? fullUser?.estudiante?.id;

    if (relationId) return this.toNumber(relationId);

    const estudiante = this.estudiantes().find(estudiante => estudiante.user?.id === currentUser?.id);
    return estudiante ? this.getEstudianteId(estudiante) : 0;
  }

  private observadorBelongsToStudent(observador: ObservadorModel, estudianteId: number, userId: number) {
    const observadorEstudianteId = this.toNumber(
      observador.estudianteId
      ?? observador.estudiante?.id
      ?? observador.estudiante?.idEstudiante
      ?? observador.estudiante?.user?.estudiante?.id
    );

    if (observadorEstudianteId && observadorEstudianteId === estudianteId) return true;

    const observadorUserId = this.toNumber(observador.estudiante?.user?.id);
    return !!observadorUserId && observadorUserId === userId;
  }

  private toNumber(value: number | string | null | undefined) {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : 0;
  }

  private getUserId(user: number | { id?: number } | null | undefined) {
    return typeof user === 'number' ? user : user?.id;
  }

  public getCursoId(curso?: Partial<CursoModel> | null) {
    return curso?.id ?? curso?.idCurso;
  }

  public isDocente() {
    const currentUser = this.authService.currentUser();
    const fullUser = this.getCurrentUserWithRelations();
    const roles = currentUser?.roles?.length ? currentUser.roles : fullUser?.roles ?? [];

    return roles.some(role => this.normalizeRoleName(role.name).includes('docente'));
  }

  public isAdmin() {
    const currentUser = this.authService.currentUser();
    const fullUser = this.getCurrentUserWithRelations();
    const roles = currentUser?.roles?.length ? currentUser.roles : fullUser?.roles ?? [];

    return roles.some(role => this.normalizeRoleName(role.name).includes('admin'));
  }

  public isEstudiante() {
    const currentUser = this.authService.currentUser();
    const fullUser = this.getCurrentUserWithRelations();
    const roles = currentUser?.roles?.length ? currentUser.roles : fullUser?.roles ?? [];

    return roles.some(role => this.normalizeRoleName(role.name).includes('estudiante'));
  }

  private normalizeRoleName(roleName: string) {
    return roleName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]/g, '')
      .toLowerCase();
  }

  private getToday() {
    return new Date().toISOString().slice(0, 10);
  }

  private toInputDate(value: string | Date) {
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    return value?.slice(0, 10) || this.getToday();
  }

  private formatDate(value: string | Date) {
    const normalizedDate = this.toInputDate(value);
    const [year, month, day] = normalizedDate.split('-').map(Number);
    const date = new Date(year, month - 1, day);

    if (Number.isNaN(date.getTime())) return String(value);

    return new Intl.DateTimeFormat('es-CO', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(date);
  }

  private normalizeDateForApi(value?: string | null) {
    const dateValue = value || this.getToday();
    return `${dateValue.slice(0, 10)}T12:00:00.000`;
  }

  private getErrorMessage(err: HttpErrorResponse, fallback: string) {
    const message = err.error?.message;

    if (Array.isArray(message)) {
      return message.join(' ');
    }

    if (message) {
      return message;
    }

    return err.status ? `${fallback} Error ${err.status}: ${err.statusText}` : fallback;
  }

  private showSuccess(title: string, text: string) {
    Swal.fire({ icon: 'success', title, text, confirmButtonText: 'Aceptar', confirmButtonColor: '#146b50' });
  }

  private showError(title: string, text: string) {
    Swal.fire({ icon: 'error', title, text, confirmButtonText: 'Aceptar', confirmButtonColor: '#b4232f' });
  }
}
