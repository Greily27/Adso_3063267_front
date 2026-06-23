import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { forkJoin, map, of, switchMap, throwError } from 'rxjs';
import Swal from 'sweetalert2';
import { CursosForm } from './components/cursos-form/cursos-form';
import { CreateAsignacionDto, CreateCursoDto, CursoModel, MateriaModel, UpdateCursoDto } from './models/curso.model';
import { CursosService } from './services/cursos-service';
import { UserModel } from '../users/models/user.model';
import { EstudiantesService } from '../estudiantes/services/estudiantes-service';
import { EstudianteModel } from '../estudiantes/models/estudiante.model';
import { StudentCourseForm } from './components/student-course-form/student-course-form';
import { UsersService } from '../users/services/users-service';
import { Auth } from '../../core/services/auth';

interface CursoDictado {
  curso: CursoModel;
  materias: MateriaModel[];
}

@Component({
  selector: 'app-cursos',
  imports: [
    CommonModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule
  ],
  templateUrl: './cursos.html',
  styleUrl: './cursos.scss',
})
export class Cursos {
  private cursosService = inject(CursosService);
  private estudiantesService = inject(EstudiantesService);
  private usersService = inject(UsersService);
  private authService = inject(Auth);
  public expandedCursoId: number | null = null;
  public studentSearchTerms: Record<number, string> = {};

  public isDocente = computed(() => this.hasDocenteRole());

  public cursosAsignados = computed(() => {
    const currentUser = this.authService.currentUser();

    if (!this.isDocente() || !currentUser?.id) return [];

    return this.getCursosAsignadosDelDocente(currentUser.id);
  });

  public cursosDondeDicta = computed<CursoDictado[]>(() => {
    const currentUser = this.authService.currentUser();

    if (!this.isDocente() || !currentUser?.id) return [];

    const cursosDictados = new Map<number, CursoDictado>();

    this.cursosService.asignaciones()
      .filter(asignacion => asignacion.docenteId === currentUser.id)
      .forEach(asignacion => {
        const curso = this.getCursoFromAsignacion(asignacion.cursoId);
        if (!curso) return;

        const materia = this.getMateriaFromAsignacion(asignacion.materiaId, asignacion.materia);
        const currentCurso = cursosDictados.get(asignacion.cursoId) ?? { curso, materias: [] };

        if (materia && !currentCurso.materias.some(currentMateria => this.getMateriaId(currentMateria) === this.getMateriaId(materia))) {
          currentCurso.materias.push(materia);
        }

        cursosDictados.set(asignacion.cursoId, currentCurso);
      });

    return Array.from(cursosDictados.values());
  });

  public cursosDictados = computed(() => this.cursosDondeDicta().map(item => item.curso));

  public cursosDisponibles = computed(() => {
    if (!this.isDocente()) return this.cursosService.cursos();

    return this.uniqueCursos([
      ...this.cursosAsignados(),
      ...this.cursosDictados()
    ]);
  });

  public cursosForTable = computed(() => this.cursosDisponibles().map(curso => ({
    ...curso,
    status: curso.isActive ? 'Activo' : 'Inactivo',
    directorName: this.getDirectorName(curso),
    docenteCount: this.getDocenteCount(curso),
    studentCount: this.getStudentCountByCurso(curso.id),
    materiaCount: curso.materias?.length ?? 0
  })));

  public getMateriasDictadasLabel(materias: MateriaModel[]) {
    if (materias.length === 0) return 'Sin materias';

    return materias.map(materia => this.getMateriaName(materia)).join(', ');
  }

  constructor(private dialog: MatDialog) {}

  ngOnInit() {
    this.usersService.loadUsers();
    this.cursosService.loadCursos();
    this.cursosService.loadMaterias();
    this.cursosService.loadAsignaciones();
    this.estudiantesService.loadEstudiantes();
  }

  openDialog() {
    const dialogRef = this.dialog.open(CursosForm, { width: '700px' });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        const cursoDto = this.toDto(result);
        const asignacionesDto = this.toAsignacionesDto(result);

        console.log('Payload enviado a cursos:', cursoDto);
        console.log('Payload enviado a asignaciones:', asignacionesDto);

        this.cursosService.createCurso(cursoDto, result.users, result.materias).pipe(
          switchMap((cursoCreado: CursoModel) => {
            const cursoId = this.cursosService.getCursoId(cursoCreado);

            if (!cursoId) {
              return throwError(() => new Error('El backend creó el curso, pero no retornó el id para guardar asignaciones.'));
            }

            const asignacionesConCurso = asignacionesDto.map(asignacion => ({
              ...asignacion,
              cursoId
            }));

            console.log('Payload final enviado a asignaciones:', asignacionesConCurso);

            if (asignacionesConCurso.length === 0) {
              return of(cursoCreado);
            }

            return forkJoin(
              asignacionesConCurso.map(asignacion => this.cursosService.createAsignacion(asignacion))
            ).pipe(map(() => cursoCreado));
          })
        ).subscribe({
          next: (response: CursoModel) => {
            this.cursosService.loadAsignaciones();
            console.log('Guardado con exito', response);
            this.showSuccess('Curso creado', `${this.getCursoName(response)} se guardo correctamente.`);
          },
          error: (err: HttpErrorResponse) => {
            console.error('Error al guardar', this.getErrorMessage(err), err);
            this.showError('Error al guardar', this.getErrorMessage(err));
          }
        });
      }
    });
  }

  handleEdit(curso: CursoModel) {
    if (!curso.id) return;

    this.cursosService.getCursoById(curso.id).subscribe({
      next: completeCurso => this.openEditDialog(completeCurso),
      error: () => this.openEditDialog(curso)
    });
  }

  private openEditDialog(curso: CursoModel) {
    const dialogRef = this.dialog.open(CursosForm, { width: '700px', data: curso });

    dialogRef.afterClosed().subscribe(result => {
      if (result && curso.id) {
        const cursoDto: UpdateCursoDto = this.toDto(result, true);
        const asignacionesDto = this.toAsignacionesDto(result);

        console.log('Payload enviado a cursos:', cursoDto);
        console.log('Payload enviado a asignaciones:', asignacionesDto);

        this.cursosService.updateCurso(curso.id, cursoDto, result.users, result.materias).pipe(
          switchMap(response => this.replaceAsignacionesForCurso(curso.id!, asignacionesDto).pipe(
            map(() => response)
          ))
        ).subscribe({
          next: response => {
            this.cursosService.loadAsignaciones();
            console.log('Actualizado con exito', response);
            this.showSuccess('Curso actualizado', `${this.getCursoName(response)} se actualizó correctamente.`);
          },
          error: (err: HttpErrorResponse) => {
            console.error('Error al actualizar', this.getErrorMessage(err), err);
            this.showError('Error al actualizar', this.getErrorMessage(err));
          }
        });
      }
    });
  }

  async handleDelete(curso: CursoModel) {
    if (curso.id === undefined) return;

    const result = await Swal.fire({
      icon: 'warning',
      title: 'Eliminar curso',
      text: `Estas seguro de eliminar ${this.getCursoName(curso)}?`,
      showCancelButton: true,
      confirmButtonText: 'Si, eliminar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#b4232f'
    });

    if (!result.isConfirmed) return;

    this.cursosService.deleteCurso(curso.id).subscribe({
      next: () => this.showSuccess('Curso eliminado', 'El curso se eliminó correctamente.'),
      error: (err: HttpErrorResponse) => {
        console.error('Error al eliminar', err);
        this.showError('Error al eliminar', this.getErrorMessage(err));
      }
    });
  }

  toggleCurso(curso: CursoModel) {
    if (!curso.id) return;

    this.expandedCursoId = this.expandedCursoId === curso.id ? null : curso.id;
  }

  setStudentSearch(cursoId: number, value: string) {
    this.studentSearchTerms = {
      ...this.studentSearchTerms,
      [cursoId]: value
    };
  }

  getStudentsForCurso(curso: CursoModel) {
    const cursoId = curso.id;
    if (!cursoId) return [];

    const search = (this.studentSearchTerms[cursoId] ?? '').toLowerCase().trim();
    const estudiantes = this.estudiantesService.estudiantes().filter(estudiante =>
      estudiante.curso?.id === cursoId
    );

    if (!search) return estudiantes;

    return estudiantes.filter(estudiante => {
      const text = [
        estudiante.user?.names,
        estudiante.user?.lastNames,
        estudiante.user?.document,
        estudiante.nombreTutor,
        estudiante.apellidoTutor,
        estudiante.documentoTutor,
        estudiante.emailTutor
      ].join(' ').toLowerCase();

      return text.includes(search);
    });
  }

  handleEditStudent(estudiante: EstudianteModel, event?: Event) {
    event?.stopPropagation();

    const dialogRef = this.dialog.open(StudentCourseForm, { width: '420px', data: estudiante });

    dialogRef.afterClosed().subscribe((curso: CursoModel | undefined) => {
      const cursoId = curso?.id ?? curso?.idCurso;
      const estudianteId = estudiante.id ?? estudiante.idEstudiante;

      if (cursoId && estudianteId) {
        this.estudiantesService.updateEstudiante(estudianteId, { cursoId }).subscribe({
          next: response => {
            this.estudiantesService.loadEstudiantes();
            console.log('Curso del estudiante actualizado con exito', response);
            this.showSuccess('Curso actualizado', 'El curso del estudiante se actualizó correctamente.');
          },
          error: (err: HttpErrorResponse) => {
            console.error('Error al actualizar estudiante', err);
            this.showError('Error al actualizar', this.getErrorMessage(err));
          }
        });
      }
    });
  }

  private toDto(formValue: {
    nombreCurso: string;
    isActive: boolean;
    directorCurso?: number | null;
    users?: UserModel[];
    materias?: MateriaModel[];
  }, includeEmptyMaterias = false): CreateCursoDto {
    const usersIds = (formValue.users ?? [])
      .map(user => this.getEntityId(user))
      .filter((id): id is number => id !== undefined);
    const materiasIds = (formValue.materias ?? [])
      .map(materia => this.getEntityId(materia, 'idMateria'))
      .filter((id): id is number => id !== undefined);

    const cursoDto: CreateCursoDto = {
      nombreCurso: formValue.nombreCurso,
      isActive: formValue.isActive,
      directorCurso: formValue.directorCurso ?? null
    };

    this.addIdsField(cursoDto, 'docentesIds', usersIds);

    if (materiasIds.length > 0 || includeEmptyMaterias) {
      this.addIdsField(cursoDto, 'materiasIds', materiasIds, includeEmptyMaterias);
    }

    return cursoDto;
  }

  private toAsignacionesDto(formValue: {
    asignaciones?: Array<{ docente: UserModel; materia: MateriaModel }>;
    asignacionesIds?: Array<Omit<CreateAsignacionDto, 'cursoId'>>;
  }): Array<Omit<CreateAsignacionDto, 'cursoId'>> {
    if (formValue.asignacionesIds?.length) {
      return formValue.asignacionesIds;
    }

    return (formValue.asignaciones ?? [])
      .map(asignacion => ({
        docenteId: this.getEntityId(asignacion.docente) ?? 0,
        materiaId: this.getEntityId(asignacion.materia, 'idMateria') ?? 0
      }))
      .filter(asignacion => asignacion.docenteId > 0 && asignacion.materiaId > 0);
  }

  private replaceAsignacionesForCurso(cursoId: number, asignaciones: Array<Omit<CreateAsignacionDto, 'cursoId'>>) {
    const existentes = this.cursosService.asignaciones().filter(asignacion => asignacion.cursoId === cursoId);
    const deleteRequests = existentes
      .filter(asignacion => asignacion.idAsignacion !== undefined)
      .map(asignacion => this.cursosService.deleteAsignacion(asignacion.idAsignacion!));
    const createRequests = asignaciones.map(asignacion =>
      this.cursosService.createAsignacion({
        ...asignacion,
        cursoId
      })
    );

    console.log('Payload final enviado a asignaciones:', createRequests.length ? asignaciones.map(asignacion => ({
      ...asignacion,
      cursoId
    })) : []);

    const requests = [...deleteRequests, ...createRequests];

    if (requests.length === 0) return of(null);

    return forkJoin(requests).pipe(
      switchMap(() => of(null))
    );
  }

  public getStudentName(estudiante: EstudianteModel) {
    return `${estudiante.user?.names ?? ''} ${estudiante.user?.lastNames ?? ''}`.trim() || 'Sin usuario';
  }

  public getTutorName(estudiante: EstudianteModel) {
    return `${estudiante.nombreTutor} ${estudiante.apellidoTutor}`.trim();
  }

  public getDirectorName(curso: CursoModel) {
    const directorId = curso.directorCurso ?? this.getEntityId(curso.director);

    if (!directorId) return 'Sin director';

    const director = curso.director
      ?? this.usersService.users().find(user => user.id === directorId);

    return director
      ? `${director.names ?? ''} ${director.lastNames ?? ''}`.trim() || director.email || `Usuario ${director.id}`
      : `Usuario ${directorId}`;
  }

  public getMateriaName(materia: MateriaModel) {
    return materia.nombreMateria || materia.nombre || materia.name || `Materia ${materia.idMateria ?? materia.id}`;
  }

  public getCursoName(curso: CursoModel) {
    return curso.nombreCurso || `Curso ${this.getCursoId(curso) ?? ''}`.trim();
  }

  public getCursoId(curso: CursoModel) {
    return this.cursosService.getCursoId(curso);
  }

  private getDocenteCount(curso: CursoModel) {
    return curso.users?.length ?? curso.docentes?.length ?? curso.docentesAsignados?.length ?? 0;
  }

  private getStudentCountByCurso(cursoId?: number) {
    if (!cursoId) return 0;

    return this.estudiantesService.estudiantes().filter(estudiante =>
      estudiante.curso?.id === cursoId
    ).length;
  }

  private getEntityId(
    value: number | {
      id?: number;
      idMateria?: number;
      idUsuario?: number;
      idUser?: number;
      userId?: number;
    } | null | undefined,
    fallbackKey: 'idMateria' | 'id' = 'id'
  ) {
    if (typeof value === 'number') return value;

    return fallbackKey === 'idMateria'
      ? value?.idMateria ?? value?.id
      : value?.id ?? value?.idUsuario ?? value?.idUser ?? value?.userId;
  }

  private hasDocenteRole() {
    const currentUser = this.authService.currentUser();
    const fullUser = this.usersService.users().find(user => user.id === currentUser?.id);
    const roles = currentUser?.roles?.length ? currentUser.roles : fullUser?.roles ?? [];

    return roles.some(role => role.name.toLowerCase().includes('docente'));
  }

  private getCursosAsignadosDelDocente(docenteId: number) {
    const cursos = this.cursosService.cursos();

    return cursos.filter(curso =>
        this.getEntityId(curso.director) === docenteId
        || this.getEntityId(curso.directorCurso) === docenteId
    );
  }

  private uniqueCursos(cursos: CursoModel[]) {
    const cursosById = new Map<number, CursoModel>();

    cursos.forEach(curso => {
      const cursoId = this.getCursoId(curso);
      if (cursoId !== undefined && !cursosById.has(cursoId)) {
        cursosById.set(cursoId, curso);
      }
    });

    return Array.from(cursosById.values());
  }

  private getCursoFromAsignacion(cursoId: number) {
    return this.cursosService.cursos().find(curso => this.getCursoId(curso) === cursoId);
  }

  private getMateriaFromAsignacion(materiaId: number, materia?: MateriaModel) {
    return materia
      ?? this.cursosService.materias().find(currentMateria => this.getMateriaId(currentMateria) === materiaId)
      ?? { idMateria: materiaId, nombreMateria: `Materia ${materiaId}`, estado: true };
  }

  private getMateriaId(materia: MateriaModel) {
    return materia.idMateria ?? materia.id;
  }

  private addIdsField<T extends CreateCursoDto>(dto: T, key: keyof CreateCursoDto, ids: number[], includeEmpty = true) {
    if (ids.length > 0 || includeEmpty) {
      dto[key] = ids as never;
    }
  }

  private getErrorMessage(err: HttpErrorResponse) {
    const message = err.error?.message;

    return Array.isArray(message)
      ? message.join(', ')
      : message || 'No se pudo guardar el curso.';
  }

  private showSuccess(title: string, text: string) {
    Swal.fire({ icon: 'success', title, text, confirmButtonText: 'Aceptar', confirmButtonColor: '#146b50' });
  }

  private showError(title: string, text: string) {
    Swal.fire({ icon: 'error', title, text, confirmButtonText: 'Aceptar', confirmButtonColor: '#b4232f' });
  }

}
