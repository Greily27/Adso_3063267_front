import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { forkJoin } from 'rxjs';
import Swal from 'sweetalert2';
import { Auth } from '../../core/services/auth';
import { AsignacionModel, CursoModel } from '../cursos/models/curso.model';
import { CursosService } from '../cursos/services/cursos-service';
import { EstudianteModel } from '../estudiantes/models/estudiante.model';
import { EstudiantesService } from '../estudiantes/services/estudiantes-service';
import { MateriasService } from '../materias/services/materias-service';
import { PeriodoModel } from '../periodos/models/periodo.model';
import { PeriodosService } from '../periodos/services/periodos-service';
import { UsersService } from '../users/services/users-service';
import { CreateNotaDto, NotaModel, UpdateNotaDto } from './models/nota.model';
import { NotasForm } from './components/notas-form/notas-form';
import { NotasService } from './services/notas-service';

interface CursoNameOption {
  id?: number;
  idCurso?: number;
  nombreCurso?: string;
  materias?: MateriaOption[];
  asignaciones?: AsignacionModel[];
}

interface MateriaOption {
  id?: number;
  idMateria?: number;
  nombreMateria?: string;
  nombre?: string;
  name?: string;
}

interface NotaTableGroup {
  title: string;
  key: string;
  curso?: CursoNameOption;
  materia?: MateriaOption;
  rows: Array<NotaModel & {
    descripcionText: string;
    valorDisplay: string;
    studentName: string;
    cursoName: string;
    materiaName: string;
  }>;
  students: NotaStudentGroup[];
}

interface AdminCursoAverageGroup {
  key: string;
  title: string;
  docenteName: string;
  students: AdminStudentAverage[];
}

interface AdminStudentAverage {
  key: string;
  studentName: string;
  notaCount: number;
  average: string;
}

interface NotaStudentGroup {
  key: string;
  studentName: string;
  cursoName: string;
  materiaName: string;
  estudiante?: EstudianteModel;
  notas: Array<NotaModel & {
    descripcionText: string;
    valorDisplay: string;
  }>;
}

interface NotaDraft {
  valor: number | null;
  descripcion: string;
}

@Component({
  selector: 'app-notas',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    FormsModule
  ],
  templateUrl: './notas.html',
  styleUrl: './notas.scss',
})
export class Notas {
  private fb = inject(FormBuilder);
  private authService = inject(Auth);
  private cursosService = inject(CursosService);
  private estudiantesService = inject(EstudiantesService);
  private materiasService = inject(MateriasService);
  private periodosService = inject(PeriodosService);
  private usersService = inject(UsersService);
  private notasService = inject(NotasService);

  public cursos = this.cursosService.cursos;
  public asignaciones = this.cursosService.asignaciones;
  public estudiantes = this.estudiantesService.estudiantes;
  public materias = this.materiasService.materias;
  public periodos = this.periodosService.periodos;
  public errorMessage = '';
  public showCreatePanel = false;
  private selectedCursoId = signal<number | null>(null);
  private expandedGroups = signal<Set<string>>(new Set());
  private expandedStudents = signal<Set<string>>(new Set());
  private editDrafts = signal<Record<string, NotaDraft>>({});
  private createDrafts = signal<Record<string, NotaDraft>>({});
  private panelDrafts = signal<Record<string, NotaDraft>>({});

  public form = this.fb.group({
    curso: [null as CursoModel | null, Validators.required],
    periodo: [null as PeriodoModel | null, Validators.required],
    materia: this.fb.control<MateriaOption | null>({ value: null, disabled: true }, Validators.required)
  });

  public notasVisibles = computed(() => {
    const notas = this.notasService.notas();

    if (this.isAdmin() || !this.isDocente()) {
      return notas;
    }

    const allowedAssignmentKeys = new Set(
      this.getCurrentDocenteAsignaciones()
        .map(asignacion => this.getAsignacionKey(asignacion.cursoId, asignacion.materiaId))
    );

    if (allowedAssignmentKeys.size === 0) {
      return [];
    }

    return notas.filter(nota => {
      const curso = this.getNotaCurso(nota);
      const materia = this.getNotaMateria(nota);
      const cursoId = curso ? this.getCursoId(curso) : nota.cursoId;
      const materiaId = materia ? this.getMateriaId(materia) : nota.materiaId;

      return !!cursoId && !!materiaId && allowedAssignmentKeys.has(this.getAsignacionKey(cursoId, materiaId));
    });
  });

  public notasForTable = computed(() => this.notasVisibles().map(nota => ({
    ...nota,
    valorDisplay: Number(nota.valor).toFixed(1),
    descripcionText: nota.descripcion?.trim() || 'Sin descripcion',
    studentName: this.getStudentName(this.getNotaEstudiante(nota)),
    cursoName: this.getCursoName(this.getNotaCurso(nota)),
    materiaName: this.getMateriaName(this.getNotaMateria(nota))
  })));

  public notasGroupedForTable = computed<NotaTableGroup[]>(() => {
    const groups = new Map<string, NotaTableGroup>();

    this.notasForTable().forEach(nota => {
      const key = `${nota.cursoName}|${nota.materiaName}`;
      const title = `Grado: ${nota.cursoName} | Materia: ${nota.materiaName}`;

      if (!groups.has(key)) {
        groups.set(key, {
          title,
          key,
          curso: this.getNotaCurso(nota),
          materia: this.getNotaMateria(nota),
          rows: [],
          students: []
        });
      }

      groups.get(key)!.rows.push(nota);
    });

    groups.forEach(group => {
      const students = new Map<string, NotaStudentGroup>();

      group.rows.forEach(nota => {
        const estudiante = this.getNotaEstudiante(nota);
        const estudianteId = estudiante ? this.getEstudianteId(estudiante) : nota.estudianteId ?? 0;
        const studentKey = `${group.key}|${estudianteId}`;

        if (!students.has(studentKey)) {
          students.set(studentKey, {
            key: studentKey,
            studentName: nota.studentName,
            cursoName: nota.cursoName,
            materiaName: nota.materiaName,
            estudiante,
            notas: []
          });
        }

        students.get(studentKey)!.notas.push(nota);
      });

      group.students = [...students.values()];
    });

    return [...groups.values()];
  });

  public adminAverageGroups = computed<AdminCursoAverageGroup[]>(() => {
    const courseGroups = new Map<string, {
      key: string;
      title: string;
      docenteName: string;
      students: Map<string, {
        key: string;
        studentName: string;
        total: number;
        count: number;
      }>;
    }>();

    this.notasService.notas().forEach(nota => {
      const estudiante = this.getNotaEstudiante(nota);
      const curso = this.getNotaCurso(nota);
      const cursoName = this.getCursoName(curso);
      const cursoKey = String(this.getCursoId(curso) ?? nota.cursoId ?? cursoName);
      const estudianteId = estudiante ? this.getEstudianteId(estudiante) : nota.estudianteId ?? 0;
      const studentKey = `${cursoKey}|${estudianteId}`;

      if (!courseGroups.has(cursoKey)) {
        courseGroups.set(cursoKey, {
          key: cursoKey,
          title: `Curso: ${cursoName}`,
          docenteName: this.getCursoDocenteName(curso),
          students: new Map()
        });
      }

      const group = courseGroups.get(cursoKey)!;

      if (!group.students.has(studentKey)) {
        group.students.set(studentKey, {
          key: studentKey,
          studentName: this.getStudentName(estudiante),
          total: 0,
          count: 0
        });
      }

      const student = group.students.get(studentKey)!;
      student.total += Number(nota.valor);
      student.count += 1;
    });

    return [...courseGroups.values()].map(group => ({
      key: group.key,
      title: group.title,
      docenteName: group.docenteName,
      students: [...group.students.values()].map(student => ({
        key: student.key,
        studentName: student.studentName,
        notaCount: student.count,
        average: student.count > 0 ? (student.total / student.count).toFixed(1) : '0.0'
      }))
    }));
  });

  public cursosDisponibles = computed(() => {
    const cursos = this.cursos();
    const currentUser = this.authService.currentUser();

    if (!this.isDocente()) return cursos;

    const docenteCursoIds = new Set(
      this.getCurrentDocenteAsignaciones()
        .map(asignacion => asignacion.cursoId)
        .filter((id): id is number => !!id)
    );

    if (docenteCursoIds.size === 0) {
      return [];
    }

    return cursos.filter(curso => {
      const cursoId = this.getCursoId(curso);

      return cursoId !== undefined
      && docenteCursoIds.has(cursoId)
      && (curso.users?.some(user => user.id === currentUser?.id) ?? true)
    });
  });

  public estudiantesFiltrados = computed(() => {
    const cursoId = this.selectedCursoId();

    if (!cursoId) {
      if (!this.isDocente()) return this.estudiantes();

      const cursosIds = new Set(
        this.cursosDisponibles()
          .map(curso => this.getCursoId(curso))
          .filter((id): id is number => id !== undefined)
      );

      return this.estudiantes().filter(estudiante =>
        this.getCursoId(estudiante.curso) !== undefined
        && cursosIds.has(this.getCursoId(estudiante.curso)!)
      );
    }

    return this.estudiantes().filter(estudiante => this.getCursoId(estudiante.curso) === cursoId);
  });

  public materiasFiltradas = computed(() => {
    const cursoId = this.selectedCursoId();
    const curso = this.cursos().find(curso => this.getCursoId(curso) === cursoId) ?? this.form.controls.curso.value;
    if (!cursoId) return [];

    if (!this.isDocente()) {
      const materiasCurso = curso?.materias ?? [];
      const materiasBase = materiasCurso.length > 0 ? materiasCurso : this.materias();
      return materiasBase;
    }

    return this.getCurrentDocenteAsignaciones()
      .filter(asignacion => asignacion.cursoId === cursoId)
      .map(asignacion => this.getMateriaFromAsignacion(asignacion))
      .filter((materia): materia is MateriaOption => !!materia);
  });

  constructor(private dialog: MatDialog) {}

  ngOnInit() {
    this.cursosService.loadCursos();
    this.cursosService.loadAsignaciones();
    this.estudiantesService.loadEstudiantes();
    this.materiasService.loadMaterias();
    this.periodosService.loadPeriodos();
    this.usersService.loadUsers();

    this.form.controls.curso.valueChanges.subscribe(curso => {
      this.selectedCursoId.set(this.getCursoId(curso) ?? null);
      this.form.controls.materia.setValue(null, { emitEvent: false });

      if (curso) {
        this.form.controls.materia.enable({ emitEvent: false });
      } else {
        this.form.controls.materia.disable({ emitEvent: false });
      }

      this.panelDrafts.set({});
    });
  }

  openDialog() {
    this.showCreatePanel = !this.showCreatePanel;
  }

  toggleGroup(groupTitle: string) {
    this.expandedGroups.update(groups => {
      const nextGroups = new Set(groups);

      if (nextGroups.has(groupTitle)) {
        nextGroups.delete(groupTitle);
      } else {
        nextGroups.add(groupTitle);
      }

      return nextGroups;
    });
  }

  isGroupCollapsed(groupTitle: string) {
    return !this.expandedGroups().has(groupTitle);
  }

  toggleStudent(studentKey: string) {
    this.expandedStudents.update(students => {
      const nextStudents = new Set(students);

      if (nextStudents.has(studentKey)) {
        nextStudents.delete(studentKey);
      } else {
        nextStudents.add(studentKey);
      }

      return nextStudents;
    });
  }

  isStudentExpanded(studentKey: string) {
    return this.expandedStudents().has(studentKey);
  }

  getNotaDraft(nota: NotaModel): NotaDraft {
    const key = this.getNotaKey(nota);
    const drafts = this.editDrafts();

    return drafts[key] ?? {
      valor: Number(nota.valor),
      descripcion: nota.descripcion?.trim() ?? ''
    };
  }

  updateNotaDraft(nota: NotaModel, field: keyof NotaDraft, value: string) {
    const key = this.getNotaKey(nota);
    const currentDraft = this.getNotaDraft(nota);
    const nextValue = field === 'valor'
      ? (value === '' ? null : Number(value))
      : value;

    this.editDrafts.update(drafts => ({
      ...drafts,
      [key]: {
        ...currentDraft,
        [field]: nextValue
      }
    }));
  }

  getCreateDraft(studentKey: string): NotaDraft {
    return this.createDrafts()[studentKey] ?? { valor: null, descripcion: '' };
  }

  updateCreateDraft(studentKey: string, field: keyof NotaDraft, value: string) {
    const currentDraft = this.getCreateDraft(studentKey);
    const nextValue = field === 'valor'
      ? (value === '' ? null : Number(value))
      : value;

    this.createDrafts.update(drafts => ({
      ...drafts,
      [studentKey]: {
        ...currentDraft,
        [field]: nextValue
      }
    }));
  }

  getPanelDraft(estudiante: EstudianteModel): NotaDraft {
    const key = this.getPanelDraftKey(estudiante);
    return this.panelDrafts()[key] ?? { valor: null, descripcion: '' };
  }

  updatePanelDraft(estudiante: EstudianteModel, field: keyof NotaDraft, value: string) {
    const currentDraft = this.getPanelDraft(estudiante);
    const nextValue = field === 'valor'
      ? (value === '' ? null : Number(value))
      : value;

    this.panelDrafts.update(drafts => ({
      ...drafts,
      [this.getPanelDraftKey(estudiante)]: {
        ...currentDraft,
        [field]: nextValue
      }
    }));
  }

  saveInlineNota(nota: NotaModel) {
    const notaId = this.getNotaId(nota);
    if (!notaId) return;

    const draft = this.getNotaDraft(nota);
    if (draft.valor === null || draft.valor < 1 || draft.valor > 5) {
      this.errorMessage = 'La nota debe estar entre 1 y 5.';
      return;
    }

    this.errorMessage = '';
    this.notasService.updateNota(notaId, {
      valor: Number(draft.valor),
      descripcion: draft.descripcion.trim()
    }).subscribe({
      next: () => {
        this.removeEditDraft(this.getNotaKey(nota));
        this.showSuccess('Nota actualizada', 'La nota se actualizó correctamente.');
      },
      error: (err: HttpErrorResponse) => {
        console.error('Error al actualizar', err);
        this.errorMessage = this.getErrorMessage(err, 'No se pudo actualizar la nota.');
        this.showError('Error al actualizar', this.errorMessage);
      }
    });
  }

  addInlineNota(group: NotaTableGroup, student: NotaStudentGroup) {
    const draft = this.getCreateDraft(student.key);

    if (draft.valor === null || draft.valor < 1 || draft.valor > 5) {
      this.errorMessage = 'La nota debe estar entre 1 y 5.';
      return;
    }

    const estudiante = student.estudiante;
    const cursoId = this.getCursoId(group.curso ?? estudiante?.curso as CursoNameOption) ?? 0;
    const materia = group.materia;
    const periodoId = this.getNotaPeriodoId(student.notas[0]);

    if (!estudiante || !cursoId || !materia || !periodoId) {
      this.errorMessage = 'No se pudo crear la nota: falta estudiante, curso, materia o periodo.';
      return;
    }

    const dto: CreateNotaDto = {
      valor: Number(draft.valor),
      descripcion: draft.descripcion.trim(),
      estado: true,
      estudianteId: this.getEstudianteId(estudiante),
      cursoId,
      materiaId: this.getMateriaId(materia),
      periodoId
    };

    this.errorMessage = '';
    this.notasService.createNota(dto, {
      estudiante,
      materia: materia as any
    }).subscribe({
      next: () => {
        this.removeCreateDraft(student.key);
        this.showSuccess('Nota creada', 'La nota se guardo correctamente.');
      },
      error: (err: HttpErrorResponse) => {
        console.error('Error al guardar', err.error ?? err);
        this.errorMessage = this.getErrorMessage(err, 'No se pudo crear la nota.');
        this.showError('Error al guardar', this.errorMessage);
      }
    });
  }

  get canSavePanel() {
    return !!this.form.controls.curso.value
      && !!this.form.controls.periodo.value
      && !!this.form.controls.materia.value
      && this.estudiantesFiltrados().some(estudiante => this.isValidGradeValue(this.getPanelDraft(estudiante).valor));
  }

  clearMateria() {
    this.form.controls.materia.setValue(null);
  }

  handleEdit(nota: NotaModel) {
    const dialogRef = this.dialog.open(NotasForm, { width: '650px', data: nota });
    const notaId = this.getNotaId(nota);

    dialogRef.afterClosed().subscribe(result => {
      if (result && notaId) {
        const notaDto: UpdateNotaDto = {
          valor: Number(result.valor),
          periodoId: Number(result.periodoId),
          descripcion: result.descripcion?.trim() ?? ''
        };
        this.errorMessage = '';

        this.notasService.updateNota(notaId, notaDto).subscribe({
          next: response => {
            console.log('Actualizado con exito', response);
            this.showSuccess('Nota actualizada', 'La nota se actualizó correctamente.');
          },
          error: (err: HttpErrorResponse) => {
            console.error('Error al actualizar', err);
            this.errorMessage = this.getErrorMessage(err, 'No se pudo actualizar la nota.');
            this.showError('Error al actualizar', this.errorMessage);
          }
        });
      }
    });
  }

  async handleDelete(nota: NotaModel) {
    const notaId = this.getNotaId(nota);
    if (!notaId) return;

    const result = await Swal.fire({
      icon: 'warning',
      title: 'Eliminar nota',
      text: `Estas seguro de eliminar la nota ${nota.valor}?`,
      showCancelButton: true,
      confirmButtonText: 'Si, eliminar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#b4232f'
    });

    if (!result.isConfirmed) return;

    this.errorMessage = '';

    this.notasService.deleteNota(notaId).subscribe({
      next: () => this.showSuccess('Nota eliminada', 'La nota se eliminó correctamente.'),
      error: (err: HttpErrorResponse) => {
        console.error('Error al eliminar', err);
        this.errorMessage = this.getErrorMessage(err, 'No se pudo eliminar la nota.');
        this.showError('Error al eliminar', this.errorMessage);
      }
    });
  }

  deleteInlineNota(nota: NotaModel) {
    this.handleDelete(nota);
  }

  private toDto(formValue: {
    curso: CursoNameOption;
    estudiante: EstudianteModel;
    valor: number;
    descripcion?: string | null;
    estado: boolean;
    materia: MateriaOption;
    periodo: PeriodoModel;
  }): CreateNotaDto {
    const estudianteId = this.getEstudianteId(formValue.estudiante);
    const cursoId = this.getCursoId(formValue.curso) ?? this.getCursoId(formValue.estudiante.curso) ?? 0;

    return {
      valor: formValue.valor,
      descripcion: formValue.descripcion?.trim() ?? '',
      estado: formValue.estado,
      estudianteId,
      cursoId,
      materiaId: this.getMateriaId(formValue.materia),
      periodoId: this.getPeriodoId(formValue.periodo)
    };
  }

  savePanelNotas() {
    if (!this.form.controls.periodo.value) {
      this.errorMessage = 'Debes seleccionar un periodo antes de guardar notas.';
      return;
    }

    if (!this.form.controls.materia.value) {
      this.errorMessage = 'Debes seleccionar una materia antes de guardar notas.';
      return;
    }

    if (!this.form.controls.curso.value) {
      this.errorMessage = 'Debes seleccionar un curso antes de guardar notas.';
      return;
    }

    if (!this.estudiantesFiltrados().some(estudiante => this.isValidGradeValue(this.getPanelDraft(estudiante).valor))) {
      this.errorMessage = 'Debes ingresar al menos una nota válida entre 1 y 5.';
      return;
    }

    const value = this.form.getRawValue();
    const materia = value.materia!;
    const periodo = value.periodo!;
    const notasToSave = this.estudiantesFiltrados()
      .map(estudiante => ({ estudiante, draft: this.getPanelDraft(estudiante) }))
      .filter(item => this.isValidGradeValue(item.draft.valor))
      .map(item => {
        const estudiante = item.estudiante;
        const dto = this.toDto({
          curso: value.curso!,
          estudiante,
          valor: Number(item.draft.valor),
          descripcion: item.draft.descripcion,
          estado: true,
          materia,
          periodo
        });

        return { dto, estudiante };
      })
      .filter(item => item.dto.estudianteId);
    const invalidNota = notasToSave.find(item =>
      !item.dto.cursoId || !item.dto.estudianteId || !item.dto.materiaId
      || !item.dto.periodoId
    );

    if (invalidNota) {
      this.errorMessage = 'No se pudo guardar: falta curso, estudiante, materia o periodo en una de las notas.';
      console.error('Payload inválido para notas:', invalidNota.dto);
      return;
    }

    if (notasToSave.length === 0) {
      this.errorMessage = 'Debes ingresar al menos una nota válida.';
      return;
    }

    this.errorMessage = '';
    console.log('Payload enviado a notas:', notasToSave.map(item => item.dto));

    forkJoin(notasToSave.map(item => this.notasService.createNota(item.dto, {
      estudiante: item.estudiante,
      materia: materia as any
    }))).subscribe({
      next: response => {
        console.log('Guardado con exito', response);
        this.clearPanel();
        this.showSuccess('Notas guardadas', `Se guardaron ${response.length} nota(s) correctamente.`);
      },
      error: (err: HttpErrorResponse) => {
        console.error('Error al guardar', err.error ?? err);
        this.errorMessage = this.getErrorMessage(err, 'No se pudo crear la nota.');
        this.showError('Error al guardar', this.errorMessage);
      }
    });
  }

  clearPanel() {
    this.form.reset();
    this.selectedCursoId.set(null);
    this.form.controls.materia.disable({ emitEvent: false });
    this.panelDrafts.set({});
  }

  compareCurso(item1: CursoModel | null, item2: CursoModel | null) {
    return item1 && item2
      ? this.getCursoId(item1) === this.getCursoId(item2)
      : item1 === item2;
  }

  compareMateria(item1: MateriaOption | null, item2: MateriaOption | null) {
    return item1 && item2
      ? this.getMateriaId(item1) === this.getMateriaId(item2)
      : item1 === item2;
  }

  comparePeriodo(item1: PeriodoModel | null, item2: PeriodoModel | null) {
    return item1 && item2
      ? this.getPeriodoId(item1) === this.getPeriodoId(item2)
      : item1 === item2;
  }

  getMateriaId(materia: MateriaOption) {
    return materia.idMateria ?? materia.id ?? 0;
  }

  private getMateriaKey(materia: MateriaOption) {
    return String(this.getMateriaId(materia));
  }

  private getAsignacionKey(cursoId: number, materiaId: number) {
    return `${cursoId}|${materiaId}`;
  }

  getCursoId(curso?: CursoNameOption | null) {
    return curso?.id ?? curso?.idCurso;
  }

  getPeriodoId(periodo?: PeriodoModel | null) {
    return periodo?.idPeriodo ?? 0;
  }

  formatDate(value?: string | Date | null) {
    if (!value) return 'Sin fecha';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);

    return new Intl.DateTimeFormat('es-CO', {
      year: 'numeric',
      month: 'short',
      day: '2-digit'
    }).format(date);
  }

  private getNotaPeriodoId(nota?: NotaModel) {
    const notaWithPeriodo = nota as NotaModel & {
      periodo?: { idPeriodo?: number; id?: number };
    } | undefined;

    return nota?.periodoId
      ?? nota?.idPeriodo
      ?? notaWithPeriodo?.periodo?.idPeriodo
      ?? notaWithPeriodo?.periodo?.id
      ?? 0;
  }

  private getUserId(user: number | { id?: number } | null | undefined) {
    return typeof user === 'number' ? user : user?.id;
  }

  getCursoName(curso?: CursoNameOption) {
    if (!curso) return 'Sin curso';
    return curso.nombreCurso || `Curso ${this.getCursoId(curso)}`;
  }

  getStudentName(estudiante?: EstudianteModel) {
    if (!estudiante) return 'Sin estudiante';
    return `${estudiante.user?.names ?? ''} ${estudiante.user?.lastNames ?? ''}`.trim()
      || `Estudiante ${estudiante.id}`;
  }

  private getNotaEstudiante(nota: NotaModel) {
    const estudianteId = nota.estudiante
      ? this.getEstudianteId(nota.estudiante)
      : nota.estudianteId;

    return nota.estudiante
      ?? this.estudiantes().find(estudiante => this.getEstudianteId(estudiante) === estudianteId);
  }

  private getNotaCurso(nota: NotaModel) {
    const estudiante = this.getNotaEstudiante(nota);
    const cursoId = this.getCursoId(estudiante?.curso) ?? nota.cursoId;

    return estudiante?.curso
      ?? this.cursos().find(curso => this.getCursoId(curso) === cursoId);
  }

  getEstudianteId(estudiante: EstudianteModel) {
    return estudiante.id
      ?? estudiante.idEstudiante
      ?? estudiante.user?.estudiante?.id
      ?? 0;
  }

  private getNotaMateria(nota: NotaModel) {
    const materiaId = nota.materia
      ? this.getMateriaId(nota.materia)
      : nota.materiaId;

    return nota.materia
      ?? this.materias().find(materia => this.getMateriaId(materia) === materiaId);
  }

  getMateriaName(materia?: MateriaOption) {
    if (!materia) return 'Sin materia';
    return materia.nombreMateria || materia.nombre || materia.name || `Materia ${materia.idMateria ?? materia.id}`;
  }

  getStudentAverage(student: NotaStudentGroup) {
    if (student.notas.length === 0) return '0.0';

    const total = student.notas.reduce((sum, nota) => sum + Number(nota.valor), 0);
    return (total / student.notas.length).toFixed(1);
  }

  private getNotaId(nota: NotaModel) {
    return nota.idNota ?? nota.id;
  }

  private isValidGradeValue(value: number | null | undefined) {
    return value !== null
      && value !== undefined
      && !Number.isNaN(Number(value))
      && Number(value) >= 1
      && Number(value) <= 5;
  }

  private getNotaKey(nota: NotaModel) {
    return String(this.getNotaId(nota) ?? `${nota.estudianteId}-${nota.cursoId}-${nota.materiaId}-${nota.valor}`);
  }

  private getPanelDraftKey(estudiante: EstudianteModel) {
    return String(this.getEstudianteId(estudiante));
  }

  private removeEditDraft(key: string) {
    this.editDrafts.update(drafts => {
      const nextDrafts = { ...drafts };
      delete nextDrafts[key];
      return nextDrafts;
    });
  }

  private removeCreateDraft(key: string) {
    this.createDrafts.update(drafts => {
      const nextDrafts = { ...drafts };
      delete nextDrafts[key];
      return nextDrafts;
    });
  }

  private getCurrentUserWithRelations() {
    const currentUser = this.authService.currentUser();
    return this.usersService.users().find(user => user.id === currentUser?.id);
  }

  private getCurrentDocenteAsignaciones() {
    const currentUser = this.authService.currentUser();
    const currentUserId = currentUser?.id;

    if (!currentUserId) return [];

    return this.asignaciones().filter(asignacion => asignacion.docenteId === currentUserId);
  }

  private getMateriaFromAsignacion(asignacion: AsignacionModel) {
    return asignacion.materia
      ?? this.materias().find(materia => this.getMateriaId(materia) === asignacion.materiaId)
      ?? this.cursos().find(curso => this.getCursoId(curso) === asignacion.cursoId)?.materias?.find(materia =>
        this.getMateriaId(materia) === asignacion.materiaId
      );
  }

  private getCursoDocenteName(curso?: CursoNameOption & {
    directorCurso?: number | null;
    director?: { id?: number; names?: string; lastNames?: string; email?: string } | null;
    users?: Array<{ id?: number; names?: string; lastNames?: string; email?: string; roles?: Array<{ name: string }> }>;
  }) {
    const director = curso?.director;

    if (director) {
      return this.getUserName(director);
    }

    const directorId = this.getUserId(curso?.directorCurso);
    const userByDirectorId = directorId
      ? this.usersService.users().find(user => user.id === directorId)
      : undefined;

    if (userByDirectorId) {
      return this.getUserName(userByDirectorId);
    }

    const docenteInCurso = curso?.users?.find(user =>
      user.roles?.some(role => role.name.toLowerCase().includes('docente'))
    );

    if (docenteInCurso) {
      return this.getUserName(docenteInCurso);
    }

    return 'Sin docente';
  }

  private getUserName(user: { names?: string; lastNames?: string; email?: string }) {
    return `${user.names ?? ''} ${user.lastNames ?? ''}`.trim() || user.email || 'Sin docente';
  }

  private isDocente() {
    const currentUser = this.authService.currentUser();
    const fullUser = this.getCurrentUserWithRelations();
    const roles = currentUser?.roles?.length ? currentUser.roles : fullUser?.roles ?? [];

    return roles.some(role => role.name.toLowerCase().includes('docente'));
  }

  public isAdmin() {
    const currentUser = this.authService.currentUser();
    const fullUser = this.getCurrentUserWithRelations();
    const roles = currentUser?.roles?.length ? currentUser.roles : fullUser?.roles ?? [];

    return roles.some(role => {
      const roleName = role.name.toLowerCase();
      return roleName.includes('admin') || roleName.includes('administrador');
    });
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
