import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { forkJoin } from 'rxjs';
import Swal from 'sweetalert2';
import * as XLSX from 'xlsx';
import { Auth } from '../../core/services/auth';
import { AsignacionModel, CursoModel, MateriaModel } from '../cursos/models/curso.model';
import { CursosService } from '../cursos/services/cursos-service';
import { EstudianteModel } from '../estudiantes/models/estudiante.model';
import { EstudiantesService } from '../estudiantes/services/estudiantes-service';
import { UsersService } from '../users/services/users-service';
import { HorarioForm } from './components/horario-form/horario-form';
import { CreateHorarioDto, DiaHorario, HorarioModel } from './models/horario.model';
import { HorariosService } from './services/horarios-service';

interface BloqueHorario {
  horaInicio: string;
  horaFin: string;
  tipo?: 'clase' | 'descanso' | 'almuerzo' | 'extra';
  label?: string;
  diasPermitidos?: DiaHorario[];
}

interface ImportHorarioRow {
  dia: DiaHorario;
  horaInicio: string;
  horaFin: string;
  materia?: string;
  docente?: string;
  asignacionId?: number;
}

@Component({
  selector: 'app-horarios',
  imports: [
    CommonModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatSelectModule
  ],
  templateUrl: './horarios.html',
  styleUrl: './horarios.scss',
})
export class Horarios {
  private authService = inject(Auth);
  private cursosService = inject(CursosService);
  private estudiantesService = inject(EstudiantesService);
  private usersService = inject(UsersService);
  private horariosService = inject(HorariosService);

  public asignaciones = this.cursosService.asignaciones;
  public cursos = this.cursosService.cursos;
  public materias = this.cursosService.materias;
  public users = this.usersService.users;
  public horarios = this.horariosService.horarios;
  public errorMessage = '';
  public selectedCursoId = signal<number | null>(null);
  public selectedDocenteId = signal<number | null>(null);
  public isImporting = signal(false);
  private loadedStudentCourseId = 0;
  private loadedGeneralHorarios = false;

  public dias: Array<{ key: DiaHorario; label: string }> = [
    { key: 'lunes', label: 'Lunes' },
    { key: 'martes', label: 'Martes' },
    { key: 'miércoles', label: 'Miércoles' },
    { key: 'jueves', label: 'Jueves' },
    { key: 'viernes', label: 'Viernes' }
  ];

  public bloques: BloqueHorario[] = [
    { horaInicio: '07:00', horaFin: '08:00', tipo: 'clase' },
    { horaInicio: '08:00', horaFin: '09:00', tipo: 'clase' },
    { horaInicio: '09:00', horaFin: '09:15', tipo: 'descanso', label: 'Descanso' },
    { horaInicio: '09:15', horaFin: '10:15', tipo: 'clase' },
    { horaInicio: '10:15', horaFin: '11:15', tipo: 'clase' },
    { horaInicio: '11:15', horaFin: '12:15', tipo: 'almuerzo', label: 'Almuerzo' },
    { horaInicio: '12:15', horaFin: '13:15', tipo: 'clase' },
    { horaInicio: '13:15', horaFin: '14:15', tipo: 'clase' },
    {
      horaInicio: '14:15',
      horaFin: '15:15',
      tipo: 'extra',
      label: 'Extra 10 y 11',
      diasPermitidos: ['lunes', 'martes']
    },
    {
      horaInicio: '15:15',
      horaFin: '16:00',
      tipo: 'extra',
      label: 'Extra 10 y 11',
      diasPermitidos: ['lunes', 'martes']
    }
  ];

  public horariosOrdenados = computed(() => {
    const diaOrder = new Map(this.dias.map((dia, index) => [dia.key, index]));

    return [...this.horarios()].sort((first, second) => {
      const dayDiff = (diaOrder.get(first.dia) ?? 0) - (diaOrder.get(second.dia) ?? 0);
      return dayDiff || first.horaInicio.localeCompare(second.horaInicio);
    });
  });

  public horariosCurso = computed(() => {
    const cursoId = this.selectedCursoId();
    if (!cursoId) return [];

    return this.horariosOrdenados().filter(horario => this.getHorarioCursoId(horario) === cursoId);
  });

  public selectedCursoName = computed(() => {
    const cursoId = this.selectedCursoId();
    if (!cursoId) return 'Selecciona un curso';

    const curso = this.cursosConsulta().find(item => this.getCursoId(item) === cursoId);
    return curso?.nombreCurso ?? this.currentStudent()?.curso?.nombreCurso ?? `Curso ${cursoId}`;
  });

  public currentUser = computed(() => this.authService.currentUser());
  public isAcudienteProfile = this.authService.isAcudiente;

  public cursosConsulta = computed(() => {
    if (!this.isAcudienteProfile()) return this.cursos();

    const uniqueCourses = new Map<number, CursoModel>();
    this.estudiantesService.estudiantes().forEach(estudiante => {
      const cursoId = this.getEstudianteCursoId(estudiante);
      if (cursoId && estudiante.curso) {
        uniqueCourses.set(cursoId, estudiante.curso as CursoModel);
      }
    });
    return [...uniqueCourses.values()];
  });

  public isStudentProfile = computed(() =>
    (this.currentUser()?.roles ?? []).some(role => role.name.toLowerCase().includes('estudiante'))
  );

  public isAdminProfile = computed(() =>
    (this.currentUser()?.roles ?? []).some(role => {
      const roleName = this.normalizeRoleName(role.name);
      return roleName.includes('admin') || roleName.includes('administrador');
    })
  );

  public isAuxiliarAdministrativoProfile = computed(() =>
    (this.currentUser()?.roles ?? []).some(role =>
      role.id === 6 || this.normalizeRoleName(role.name).includes('auxiliaradministrativo')
    )
  );

  public isDocenteProfile = computed(() =>
    !this.isStudentProfile()
    && !this.isAdminProfile()
    && !this.isAuxiliarAdministrativoProfile()
    && (this.currentUser()?.roles ?? []).some(role => this.normalizeRoleName(role.name).includes('docente'))
  );

  public canViewHorarios = computed(() => !this.isStudentProfile() && !this.isDocenteProfile());
  public canManageHorarios = computed(() => this.isAuxiliarAdministrativoProfile());

  public docenteHorariosActual = computed(() => {
    const docenteId = this.currentUser()?.id;
    if (!docenteId || !this.isDocenteProfile()) return [];

    return this.horariosOrdenados()
      .filter(horario => this.getAsignacionDocenteId(this.getHorarioAsignacion(horario)) === docenteId)
      .map(horario => {
        const asignacion = this.getHorarioAsignacion(horario);

        return {
          horario,
          curso: this.getCursoName(asignacion),
          materia: this.getMateriaName(asignacion)
        };
      })
      .sort((first, second) =>
        first.horario.dia.localeCompare(second.horario.dia, 'es', { numeric: true, sensitivity: 'base' })
        || first.horario.horaInicio.localeCompare(second.horario.horaInicio)
        || first.curso.localeCompare(second.curso, 'es', { numeric: true, sensitivity: 'base' })
      );
  });

  public currentStudent = computed(() => {
    const user = this.currentUser();
    const relationId = this.toNumber(user?.estudiante?.id);

    return this.estudiantesService.estudiantes().find(estudiante =>
      this.getEstudianteId(estudiante) === relationId || estudiante.user?.id === user?.id
    ) ?? null;
  });

  public pageTitle = computed(() => {
    if (this.isAcudienteProfile()) return 'Horarios de mis estudiantes';
    if (this.isStudentProfile()) return 'Mi horario';
    if (this.isDocenteProfile()) return 'Mi horario docente';
    return 'Gestión de Horarios';
  });

  public pageSubtitle = computed(() => {
    if (this.isAcudienteProfile()) return 'Consulta el horario semanal de los cursos asociados.';
    if (this.isStudentProfile()) return 'Consulta el horario semanal de tu curso.';
    if (this.isDocenteProfile()) return 'Consulta en que curso y hora dictas cada materia.';
    if (!this.canManageHorarios()) return 'Consulta las asignaciones por día y bloque de clase.';
    return 'Organiza las asignaciones por día y bloque de clase.';
  });

  public bloquesVisibles = computed(() => {
    const selectedCurso = this.getSelectedCurso();
    const showExtraBlocks = selectedCurso ? this.isUpperGradeCurso(selectedCurso) : false;

    return this.bloques.filter(bloque => bloque.tipo !== 'extra' || showExtraBlocks);
  });

  public docentesConHorario = computed(() => {
    const docenteIds = new Set(
      this.horarios()
        .map(horario => this.getAsignacionDocenteId(this.getHorarioAsignacion(horario)))
        .filter((id): id is number => !!id)
    );

    return this.users()
      .filter(user => docenteIds.has(user.id))
      .sort((first, second) => this.getUserDisplayName(first).localeCompare(this.getUserDisplayName(second)));
  });

  public docenteHorarios = computed(() => {
    const docenteId = this.selectedDocenteId();
    const horarios = docenteId
      ? this.horariosOrdenados().filter(horario => this.getAsignacionDocenteId(this.getHorarioAsignacion(horario)) === docenteId)
      : [];

    return horarios.map(horario => {
      const asignacion = this.getHorarioAsignacion(horario);

      return {
        horario,
        dia: this.getDiaLabel(horario.dia),
        hora: `${horario.horaInicio} - ${horario.horaFin}`,
        curso: this.getCursoName(asignacion),
        materia: this.getMateriaName(asignacion)
      };
    });
  });

  constructor(private dialog: MatDialog) {}

  private loadHorariosByRoleEffect = effect(() => {
    if (!this.currentUser()) return;

    if (this.isAcudienteProfile()) {
      const firstCourseId = this.cursosConsulta().map(curso => this.getCursoId(curso)).find(id => !!id);
      if (firstCourseId && !this.selectedCursoId()) this.selectedCursoId.set(firstCourseId);
      if (!this.loadedGeneralHorarios) {
        this.loadedGeneralHorarios = true;
        this.horariosService.loadHorarios();
      }
      return;
    }

    if (this.isStudentProfile()) {
      const cursoId = this.getEstudianteCursoId(this.currentStudent());
      if (!cursoId || this.loadedStudentCourseId === cursoId) return;

      this.loadedStudentCourseId = cursoId;
      this.selectedCursoId.set(cursoId);
      this.horariosService.loadHorariosByCurso(cursoId);
      return;
    }

    if (this.loadedGeneralHorarios) return;
    this.loadedGeneralHorarios = true;
    this.horariosService.loadHorarios();
  });

  ngOnInit() {
    if (this.isAcudienteProfile()) {
      this.estudiantesService.loadMisAcudidos();
      return;
    }

    this.cursosService.loadCursos();
    this.cursosService.loadMaterias();
    this.cursosService.loadAsignaciones();
    this.estudiantesService.loadEstudiantes();
    this.usersService.loadUsers();
  }

  selectCurso(cursoId: number | null) {
    if (!this.canViewHorarios()) return;
    this.selectedCursoId.set(cursoId);
  }

  selectDocente(docenteId: number | null) {
    this.selectedDocenteId.set(docenteId);
  }

  getHorario(dia: DiaHorario, bloque: BloqueHorario) {
    const cursoId = this.selectedCursoId();
    if (!cursoId) return undefined;

    return this.horarios().find(horario =>
      horario.dia === dia
      && horario.horaInicio === bloque.horaInicio
      && horario.horaFin === bloque.horaFin
      && this.getHorarioCursoId(horario) === cursoId
    );
  }

  getDocenteHorario(dia: DiaHorario, bloque: BloqueHorario) {
    const docenteId = this.currentUser()?.id;
    if (!docenteId) return undefined;

    return this.getDocenteHorarioById(docenteId, dia, bloque);
  }

  getDocenteHorarioById(docenteId: number, dia: DiaHorario, bloque: BloqueHorario) {
    return this.horarios().find(horario =>
      horario.dia === dia
      && horario.horaInicio === bloque.horaInicio
      && horario.horaFin === bloque.horaFin
      && this.getAsignacionDocenteId(this.getHorarioAsignacion(horario)) === docenteId
    );
  }

  openCreate(dia: DiaHorario, bloque: BloqueHorario) {
    if (!this.canManageHorarios()) return;
    if (!this.isAssignableBlock(bloque, dia)) return;

    if (!this.selectedCursoId()) {
      this.showError('Selecciona un curso', 'Debes seleccionar un curso antes de asignar clases al horario.');
      return;
    }

    this.openForm({ dia, horaInicio: bloque.horaInicio, horaFin: bloque.horaFin });
  }

  openEdit(horario: HorarioModel) {
    if (!this.canManageHorarios()) return;

    this.openForm({
      horario,
      dia: horario.dia,
      horaInicio: horario.horaInicio,
      horaFin: horario.horaFin
    });
  }

  importExcel(event: Event) {
    if (!this.canManageHorarios()) return;

    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';

    if (!file) return;

    if (!this.selectedCursoId()) {
      this.showError('Selecciona un curso', 'Debes seleccionar un curso antes de importar el horario.');
      return;
    }

    this.isImporting.set(true);

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const workbook = XLSX.read(reader.result, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
        const dtos = this.buildImportDtos(rows);

        if (!dtos.length) {
          this.showError('Archivo vacío', 'No se encontraron filas válidas para importar.');
          return;
        }

        forkJoin(dtos.map(dto => this.horariosService.createHorario(dto))).subscribe({
          next: () => {
            this.isImporting.set(false);
            this.errorMessage = '';
            this.showSuccess('Horarios importados', `Se importaron ${dtos.length} bloque${dtos.length === 1 ? '' : 's'} correctamente.`);
          },
          error: (err: HttpErrorResponse) => {
            this.isImporting.set(false);
            this.errorMessage = this.getErrorMessage(err, 'No se pudo importar el horario.');
            this.showError('Error al importar', this.errorMessage);
          }
        });
      } catch (error) {
        this.isImporting.set(false);
        const message = error instanceof Error ? error.message : 'No se pudo leer el archivo.';
        this.errorMessage = message;
        this.showError('Excel inválido', message);
      }
    };

    reader.onerror = () => {
      this.isImporting.set(false);
      this.showError('Error al leer', 'No se pudo leer el archivo seleccionado.');
    };

    reader.readAsArrayBuffer(file);
  }

  private openForm(data: {
    horario?: HorarioModel;
    dia: DiaHorario;
    horaInicio: string;
    horaFin: string;
  }) {
    const dialogRef = this.dialog.open(HorarioForm, {
      width: 'min(720px, 96vw)',
      maxWidth: '96vw',
      data: {
        ...data,
        asignaciones: this.getAsignacionesForBlock(data.horaInicio, data.horaFin),
        getAsignacionLabel: (asignacion: AsignacionModel) => this.getAsignacionLabel(asignacion)
      }
    });

    dialogRef.afterClosed().subscribe((result?: CreateHorarioDto) => {
      if (!result) return;

      const validationError = this.getScheduleConflict(result, data.horario);
      if (validationError) {
        this.errorMessage = validationError;
        this.showError('Conflicto de horario', validationError);
        return;
      }

      if (data.horario) {
        this.updateHorario(data.horario, result);
      } else {
        this.createHorario(result);
      }
    });
  }

  private buildImportDtos(rows: Record<string, unknown>[]) {
    const parsedRows = rows
      .map((row, index) => this.parseImportRow(row, index + 2))
      .filter((row): row is ImportHorarioRow => !!row);

    const dtos = parsedRows.map(row => this.toHorarioDto(row));
    this.validateImportDtos(dtos);

    return dtos;
  }

  private parseImportRow(row: Record<string, unknown>, rowNumber: number): ImportHorarioRow | null {
    const normalized = this.normalizeImportRow(row);
    const isEmpty = Object.values(normalized).every(value => !String(value).trim());
    if (isEmpty) return null;

    const dia = this.parseDia(normalized['dia'] ?? normalized['day'], rowNumber);
    const horaInicio = this.parseTime(
      normalized['horainicio'] ?? normalized['inicio'] ?? normalized['desde'],
      `horaInicio fila ${rowNumber}`
    );
    const horaFin = this.parseTime(
      normalized['horafin'] ?? normalized['fin'] ?? normalized['hasta'],
      `horaFin fila ${rowNumber}`
    );
    const asignacionValue = normalized['asignacionid'] ?? normalized['idasignacion'];
    const asignacionId = asignacionValue ? Number(asignacionValue) : undefined;

    return {
      dia,
      horaInicio,
      horaFin,
      materia: String(normalized['materia'] ?? '').trim(),
      docente: String(normalized['docente'] ?? normalized['profesor'] ?? '').trim(),
      asignacionId: Number.isFinite(asignacionId) ? asignacionId : undefined
    };
  }

  private normalizeImportRow(row: Record<string, unknown>) {
    return Object.entries(row).reduce<Record<string, unknown>>((acc, [key, value]) => {
      acc[this.normalizeText(key).replace(/[^a-z0-9]/g, '')] = value;
      return acc;
    }, {});
  }

  private toHorarioDto(row: ImportHorarioRow): CreateHorarioDto {
    const asignacion = this.findImportAsignacion(row);
    if (!asignacion) {
      throw new Error(`No se encontró una asignación para ${row.materia || 'materia sin nombre'} ${row.docente ? `con ${row.docente}` : ''}.`);
    }

    return {
      dia: row.dia,
      horaInicio: row.horaInicio,
      horaFin: row.horaFin,
      asignacionId: this.getAsignacionId(asignacion)
    };
  }

  private validateImportDtos(dtos: CreateHorarioDto[]) {
    const seenCourseBlocks = new Set<string>();
    const seenTeacherBlocks = new Set<string>();

    dtos.forEach(dto => {
      const asignacion = this.asignaciones().find(item => this.getAsignacionId(item) === dto.asignacionId);
      if (!asignacion) throw new Error('El archivo contiene una asignación que no existe.');

      const validationError = this.getScheduleConflict(dto);
      if (validationError) throw new Error(validationError);

      const courseKey = `${this.getAsignacionCursoId(asignacion)}|${dto.dia}|${dto.horaInicio}|${dto.horaFin}`;
      if (seenCourseBlocks.has(courseKey)) {
        throw new Error('El archivo tiene dos clases del mismo curso en el mismo bloque.');
      }
      seenCourseBlocks.add(courseKey);

      const teacherKey = `${asignacion.docenteId}|${dto.dia}|${dto.horaInicio}|${dto.horaFin}`;
      if (seenTeacherBlocks.has(teacherKey)) {
        throw new Error('El archivo tiene dos clases del mismo docente en el mismo bloque.');
      }
      seenTeacherBlocks.add(teacherKey);
    });
  }

  private findImportAsignacion(row: ImportHorarioRow) {
    const cursoId = this.selectedCursoId();
    const asignacionesCurso = this.asignaciones().filter(asignacion => this.getAsignacionCursoId(asignacion) === cursoId);

    if (row.asignacionId) {
      return asignacionesCurso.find(asignacion => this.getAsignacionId(asignacion) === row.asignacionId);
    }

    const materiaText = this.normalizeText(row.materia ?? '');
    const docenteText = this.normalizeText(row.docente ?? '');

    return asignacionesCurso.find(asignacion => {
      const materiaMatch = this.normalizeText(this.getMateriaName(asignacion)) === materiaText;
      const docenteName = this.normalizeText(this.getDocenteName(asignacion));
      const docente = asignacion.docente ?? this.users().find(user => user.id === asignacion.docenteId);
      const docenteEmail = this.normalizeText(docente?.email ?? '');
      const docenteMatch = !docenteText || docenteName === docenteText || docenteEmail === docenteText;

      return materiaMatch && docenteMatch;
    });
  }

  private parseDia(value: unknown, rowNumber: number): DiaHorario {
    const diaText = this.normalizeText(String(value ?? ''));
    const dia = this.dias.find(item => this.normalizeText(item.key) === diaText || this.normalizeText(item.label) === diaText);

    if (!dia) {
      throw new Error(`Día inválido en la fila ${rowNumber}. Usa lunes, martes, miércoles, jueves o viernes.`);
    }

    return dia.key;
  }

  private parseTime(value: unknown, label: string) {
    if (typeof value === 'number') {
      const minutes = Math.round(value * 24 * 60);
      const hours = Math.floor(minutes / 60).toString().padStart(2, '0');
      const mins = (minutes % 60).toString().padStart(2, '0');
      return `${hours}:${mins}`;
    }

    if (value instanceof Date) {
      return `${value.getHours().toString().padStart(2, '0')}:${value.getMinutes().toString().padStart(2, '0')}`;
    }

    const match = String(value ?? '').match(/(\d{1,2}):(\d{2})/);
    if (!match) throw new Error(`Formato inválido en ${label}. Usa HH:mm.`);

    return `${match[1].padStart(2, '0')}:${match[2]}`;
  }

  private normalizeText(value: string) {
    return value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  private normalizeRoleName(value: string) {
    return this.normalizeText(value).replace(/[^a-z0-9]/g, '');
  }

  private createHorario(dto: CreateHorarioDto) {
    this.errorMessage = '';

    this.horariosService.createHorario(dto).subscribe({
      next: () => this.showSuccess('Horario creado', 'La asignación se agregó al horario correctamente.'),
      error: (err: HttpErrorResponse) => {
        this.errorMessage = this.getErrorMessage(err, 'No se pudo crear el horario.');
        this.showError('Error al guardar', this.errorMessage);
      }
    });
  }

  private updateHorario(horario: HorarioModel, dto: CreateHorarioDto) {
    const horarioId = this.getHorarioId(horario);
    if (!horarioId) return;

    this.errorMessage = '';

    this.horariosService.updateHorario(horarioId, dto).subscribe({
      next: () => this.showSuccess('Horario actualizado', 'La asignación del horario se actualizó correctamente.'),
      error: (err: HttpErrorResponse) => {
        this.errorMessage = this.getErrorMessage(err, 'No se pudo actualizar el horario.');
        this.showError('Error al actualizar', this.errorMessage);
      }
    });
  }

  async deleteHorario(horario: HorarioModel) {
    if (!this.canManageHorarios()) return;

    const horarioId = this.getHorarioId(horario);
    if (!horarioId) return;

    const result = await Swal.fire({
      icon: 'warning',
      title: 'Eliminar horario',
      text: `Deseas quitar ${this.getAsignacionLabel(this.getHorarioAsignacion(horario))} de este bloque?`,
      showCancelButton: true,
      confirmButtonText: 'Si, eliminar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#b4232f'
    });

    if (!result.isConfirmed) return;

    this.errorMessage = '';

    this.horariosService.deleteHorario(horarioId).subscribe({
      next: () => this.showSuccess('Horario eliminado', 'La clase se quito del horario.'),
      error: (err: HttpErrorResponse) => {
        this.errorMessage = this.getErrorMessage(err, 'No se pudo eliminar el horario.');
        this.showError('Error al eliminar', this.errorMessage);
      }
    });
  }

  getAsignacionLabel(asignacion?: AsignacionModel) {
    if (!asignacion) return 'Sin asignación';
    return `${this.getCursoName(asignacion)} | ${this.getMateriaName(asignacion)} | ${this.getDocenteName(asignacion)}`;
  }

  getHorarioAsignacion(horario: HorarioModel) {
    return horario.asignacion
      ?? this.asignaciones().find(asignacion => this.getAsignacionId(asignacion) === horario.asignacionId);
  }

  getCursoName(asignacion?: AsignacionModel) {
    const curso = this.getCursoFromAsignacion(asignacion);
    return curso?.nombreCurso || `Curso ${this.getAsignacionCursoId(asignacion) ?? ''}`.trim();
  }

  getMateriaName(asignacion?: AsignacionModel) {
    const materiaId = this.getAsignacionMateriaId(asignacion);
    const materia = asignacion?.materia
      ?? this.materias().find(materia => this.getMateriaId(materia) === materiaId);

    return materia?.nombreMateria || materia?.nombre || materia?.name || `Materia ${materiaId ?? ''}`.trim();
  }

  getDocenteName(asignacion?: AsignacionModel) {
    const docente = asignacion?.docente
      ?? this.users().find(user => user.id === this.getAsignacionDocenteId(asignacion));

    return docente
      ? this.getUserDisplayName(docente)
      : `Docente ${this.getAsignacionDocenteId(asignacion) ?? ''}`.trim();
  }

  getUserDisplayName(user: { names?: string; lastNames?: string; email?: string }) {
    return `${user.names ?? ''} ${user.lastNames ?? ''}`.trim() || user.email || 'Sin nombre';
  }

  getDiaLabel(dia: DiaHorario) {
    return this.dias.find(item => item.key === dia)?.label ?? dia;
  }

  isAssignableBlock(bloque: BloqueHorario, dia?: DiaHorario) {
    const isClassBlock = (bloque.tipo ?? 'clase') === 'clase' || this.isExtraBlockForSelectedCurso(bloque);
    const isAllowedDay = !dia || !bloque.diasPermitidos || bloque.diasPermitidos.includes(dia);

    return isClassBlock && isAllowedDay;
  }

  isBreakBlock(bloque: BloqueHorario) {
    return bloque.tipo === 'descanso' || bloque.tipo === 'almuerzo';
  }

  getBlockLabel(bloque: BloqueHorario) {
    return bloque.label ?? 'Clase';
  }

  private getScheduleConflict(dto: CreateHorarioDto, currentHorario?: HorarioModel) {
    const newAsignacion = this.asignaciones().find(asignacion => this.getAsignacionId(asignacion) === dto.asignacionId);
    if (!newAsignacion) return 'Debes seleccionar una asignación válida.';

    const bloque = this.bloques.find(item =>
      item.horaInicio === dto.horaInicio && item.horaFin === dto.horaFin
    );

    if (bloque && !this.isAssignableBlock(bloque)) {
      return `No se pueden asignar clases durante ${this.getBlockLabel(bloque).toLowerCase()}.`;
    }

    if (bloque?.diasPermitidos && !bloque.diasPermitidos.includes(dto.dia)) {
      return 'Los bloques extra solo aplican los lunes y martes.';
    }

    if (bloque?.tipo === 'extra' && !this.isUpperGradeAsignacion(newAsignacion)) {
      return 'Los bloques extra solo aplican para grados 10 y 11.';
    }

    const currentHorarioId = currentHorario ? this.getHorarioId(currentHorario) : undefined;

    const overlapping = this.horarios().filter(horario => {
      const isSameRecord = currentHorarioId && this.getHorarioId(horario) === currentHorarioId;
      return !isSameRecord
        && horario.dia === dto.dia
        && horario.horaInicio === dto.horaInicio
        && horario.horaFin === dto.horaFin;
    });

    if (!overlapping.length) return '';

    const sameCourseConflict = overlapping.some(horario =>
      this.getAsignacionCursoId(this.getHorarioAsignacion(horario)) === this.getAsignacionCursoId(newAsignacion)
    );
    if (sameCourseConflict) {
      return 'Este curso ya tiene una clase registrada en el mismo bloque.';
    }

    const sameTeacherConflict = overlapping.some(horario =>
      this.getHorarioAsignacion(horario)?.docenteId === newAsignacion.docenteId
    );
    if (sameTeacherConflict) {
      return 'Este docente ya tiene una clase registrada en el mismo bloque.';
    }

    return '';
  }

  private getCursoFromAsignacion(asignacion?: AsignacionModel) {
    const asignacionCursoId = this.getAsignacionCursoId(asignacion);
    return this.cursos().find(curso => this.getCursoId(curso) === asignacionCursoId);
  }

  private getSelectedCurso() {
    const cursoId = this.selectedCursoId();
    return this.cursosConsulta().find(curso => this.getCursoId(curso) === cursoId);
  }

  private getAsignacionesForBlock(horaInicio: string, horaFin: string) {
    const bloque = this.bloques.find(item => item.horaInicio === horaInicio && item.horaFin === horaFin);
    const cursoId = this.selectedCursoId();
    let asignaciones = this.asignaciones();

    if (cursoId) {
      asignaciones = asignaciones.filter(asignacion => this.getAsignacionCursoId(asignacion) === cursoId);
    }

    if (bloque?.tipo !== 'extra') {
      return asignaciones;
    }

    return asignaciones.filter(asignacion => this.isUpperGradeAsignacion(asignacion));
  }

  private isUpperGradeAsignacion(asignacion: AsignacionModel) {
    const curso = this.getCursoFromAsignacion(asignacion);
    return curso ? this.isUpperGradeCurso(curso) : this.isUpperGradeName(this.getCursoName(asignacion));
  }

  private isUpperGradeCurso(curso: CursoModel) {
    return this.isUpperGradeName(curso.nombreCurso);
  }

  private isUpperGradeName(name: string) {
    const cursoName = name.toLowerCase();
    return /\b(10|11|decimo|undecimo)\b/.test(
      cursoName
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
    );
  }

  private isExtraBlockForSelectedCurso(bloque: BloqueHorario) {
    if (bloque.tipo !== 'extra') return false;

    const selectedCurso = this.getSelectedCurso();
    return selectedCurso ? this.isUpperGradeCurso(selectedCurso) : false;
  }

  private getHorarioId(horario: HorarioModel) {
    return horario.idHorario ?? horario.id;
  }

  private getAsignacionId(asignacion: AsignacionModel) {
    return asignacion.idAsignacion ?? (asignacion as AsignacionModel & { id?: number }).id ?? 0;
  }

  private getCursoId(curso: CursoModel) {
    return curso.id ?? curso.idCurso;
  }

  private getEstudianteId(estudiante?: EstudianteModel | null) {
    return this.toNumber(estudiante?.id ?? estudiante?.idEstudiante);
  }

  private getEstudianteCursoId(estudiante?: EstudianteModel | null) {
    return this.toNumber(estudiante?.curso?.id ?? estudiante?.curso?.idCurso);
  }

  private getAsignacionCursoId(asignacion?: AsignacionModel) {
    const asignacionRef = asignacion as AsignacionModel & {
      idCurso?: number | string;
      curso?: { id?: number | string; idCurso?: number | string; cursoId?: number | string };
    } | undefined;

    return this.toNumber(
      asignacionRef?.cursoId
      ?? asignacionRef?.idCurso
      ?? asignacionRef?.curso?.id
      ?? asignacionRef?.curso?.idCurso
      ?? asignacionRef?.curso?.cursoId
    );
  }

  private getAsignacionMateriaId(asignacion?: AsignacionModel) {
    const asignacionRef = asignacion as AsignacionModel & {
      idMateria?: number | string;
      materia?: { id?: number | string; idMateria?: number | string; materiaId?: number | string };
    } | undefined;

    return this.toNumber(
      asignacionRef?.materiaId
      ?? asignacionRef?.materiasIdMateria
      ?? asignacionRef?.idMateria
      ?? asignacionRef?.materia?.idMateria
      ?? asignacionRef?.materia?.id
      ?? asignacionRef?.materia?.materiaId
    );
  }

  private getAsignacionDocenteId(asignacion?: AsignacionModel) {
    const asignacionRef = asignacion as AsignacionModel & {
      docente?: { id?: number | string };
    } | undefined;

    return this.toNumber(asignacionRef?.docenteId ?? asignacionRef?.docente?.id);
  }

  private getMateriaId(materia: MateriaModel) {
    return materia.idMateria ?? materia.id ?? 0;
  }

  private getHorarioCursoId(horario: HorarioModel) {
    return this.getAsignacionCursoId(this.getHorarioAsignacion(horario));
  }

  private toNumber(value: number | string | null | undefined) {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : undefined;
  }

  private getErrorMessage(err: HttpErrorResponse, fallback: string) {
    const message = err.error?.message;

    if (Array.isArray(message)) {
      return message.join(' ');
    }

    return message || (err.status ? `${fallback} Error ${err.status}: ${err.statusText}` : fallback);
  }

  private showSuccess(title: string, text: string) {
    Swal.fire({ icon: 'success', title, text, confirmButtonText: 'Aceptar', confirmButtonColor: '#146b50' });
  }

  private showError(title: string, text: string) {
    Swal.fire({ icon: 'error', title, text, confirmButtonText: 'Aceptar', confirmButtonColor: '#b4232f' });
  }
}
