import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectChange, MatSelectModule } from '@angular/material/select';
import { Auth } from '../../core/services/auth';
import { BoletinPublicadoModel, PublicarBoletinDto } from './models/boletin.model';
import { BoletinesService } from './services/boletines-service';
import { CursoModel as CursoOption } from '../cursos/models/curso.model';
import { CursosService } from '../cursos/services/cursos-service';
import { EstudianteModel } from '../estudiantes/models/estudiante.model';
import { EstudiantesService } from '../estudiantes/services/estudiantes-service';
import { MateriaModel } from '../materias/models/materia.model';
import { MateriasService } from '../materias/services/materias-service';
import { NotaModel } from '../notas/models/nota.model';
import { NotasService } from '../notas/services/notas-service';
import { ObservadorModel } from '../observadores/models/observador.model';
import { ObservadoresService } from '../observadores/services/observadores-service';
import { PeriodoModel } from '../periodos/models/periodo.model';
import { PeriodosService } from '../periodos/services/periodos-service';
import { UserModel } from '../users/models/user.model';
import { UsersService } from '../users/services/users-service';

interface BoletinMateria {
  key: string;
  nombre: string;
  docente: string;
  ihs: number;
  notas: NotaModel[];
  promedio: number;
  promedioLabel: string;
  desempeno: string;
  observacion: string;
}

interface BoletinEstudiante {
  key: string;
  estudiante: EstudianteModel;
  nombre: string;
  documento: string;
  curso: string;
  materias: BoletinMateria[];
  observaciones: ObservadorModel[];
  promedio: number;
  promedioLabel: string;
  resultado: string;
  fallasJustificadas: number;
  fallasNoJustificadas: number;
}

@Component({
  selector: 'app-boletines',
  imports: [
    CommonModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatSelectModule
  ],
  templateUrl: './boletines.html',
  styleUrl: './boletines.scss',
})
export class Boletines {
  public readonly institutionLogoPath = '/images/institucion/colplinista.png';

  private cursosService = inject(CursosService);
  private periodosService = inject(PeriodosService);
  private estudiantesService = inject(EstudiantesService);
  private notasService = inject(NotasService);
  private materiasService = inject(MateriasService);
  private observadoresService = inject(ObservadoresService);
  private usersService = inject(UsersService);
  private authService = inject(Auth);
  private boletinesService = inject(BoletinesService);

  public selectedCursoId = signal<number | null>(null);
  public selectedPeriodoId = signal<number | null>(null);
  public boletinesGenerados = signal(false);
  public previewBoletinKey = signal<string | null>(null);
  public isPublishing = signal(false);
  public publishMessage = signal<string | null>(null);

  public cursos = this.cursosService.cursos;
  public periodos = this.periodosService.periodos;
  public estudiantes = this.estudiantesService.estudiantes;
  public notas = this.notasService.notas;
  public currentUser = this.authService.currentUser;
  public misBoletines = this.boletinesService.misBoletines;
  public boletinesPublicados = this.boletinesService.boletinesPublicados;

  public misBoletinesFiltrados = computed(() => {
    const periodoId = this.selectedPeriodoId();
    const boletines = this.misBoletines();

    if (!periodoId) return boletines;

    return boletines.filter(boletin => this.getBoletinPeriodoId(boletin) === periodoId);
  });

  public isDocenteMode = computed(() =>
    this.hasRole('docente') && !this.hasRole('admin') && !this.isStudentMode()
  );

  public isAdminMode = computed(() =>
    this.hasRole('admin') || this.hasRole('administrador')
  );

  public isStudentMode = computed(() => {
    const user = this.currentUser();
    const roleNames = user?.roles?.map(role => this.normalizeName(role.name)) ?? [];

    return !!user?.estudiante?.id || roleNames.some(roleName =>
      ['estudiante', 'estudiantes', 'alumno', 'alumnos'].includes(roleName)
    );
  });

  public currentStudent = computed(() => {
    const user = this.currentUser();
    if (!user) return null;

    const estudianteId = user.estudiante?.id;

    return this.estudiantes().find(estudiante =>
      (!!estudianteId && this.getEstudianteId(estudiante) === estudianteId)
      || estudiante.user?.id === user.id
      || (!!user.document && estudiante.user?.document === user.document)
    ) ?? null;
  });

  public selectedCurso = computed(() => {
    if (this.isStudentMode()) {
      return this.currentStudent()?.curso ?? null;
    }

    const cursoId = this.selectedCursoId();
    const cursos = this.cursosDisponibles();

    if (!cursoId && this.isDocenteMode() && cursos.length === 1) {
      return cursos[0];
    }

    return cursos.find(curso => this.getCursoId(curso) === cursoId) ?? null;
  });

  public cursosDisponibles = computed(() => {
    if (this.isStudentMode()) return [];
    if (!this.isDocenteMode()) return this.cursos();

    const userId = this.currentUser()?.id;
    if (!userId) return [];

    return this.cursos().filter(curso => this.isCursoDirectedByUser(curso, userId));
  });

  public selectedPeriodo = computed(() => {
    const periodoId = this.selectedPeriodoId();
    return this.periodos().find(periodo => this.getPeriodoId(periodo) === periodoId) ?? null;
  });

  public notasDelPeriodo = computed(() => {
    const periodoId = this.selectedPeriodoId();
    const notas = this.notas();

    if (!periodoId) return [];

    const hasPeriodoData = notas.some(nota => this.getNotaPeriodoId(nota) !== undefined);

    if (!hasPeriodoData) {
      return notas;
    }

    return notas.filter(nota => this.getNotaPeriodoId(nota) === periodoId);
  });

  public estudiantesFiltrados = computed(() => {
    if (this.isStudentMode()) {
      const estudiante = this.currentStudent();
      return estudiante ? [estudiante] : [];
    }

    const selectedCurso = this.selectedCurso();
    const cursoId = selectedCurso ? this.getCursoId(selectedCurso) : this.selectedCursoId();

    if (!cursoId) {
      if (this.isAdminMode()) return this.estudiantes();
      if (!this.isDocenteMode()) return [];

      const cursosIds = new Set(
        this.cursosDisponibles()
          .map(curso => this.getCursoId(curso))
          .filter((id): id is number => id !== undefined)
      );

      return this.estudiantes().filter(estudiante =>
        cursosIds.has(this.getCursoId(estudiante.curso) ?? 0)
      );
    }

    return this.estudiantes().filter(estudiante => this.getCursoId(estudiante.curso) === cursoId);
  });

  private boletinesBase = computed<BoletinEstudiante[]>(() => {
    const periodo = this.selectedPeriodo();
    const notas = this.notasDelPeriodo();

    if (!periodo) return [];

    return this.estudiantesFiltrados()
      .map(estudiante => this.buildBoletin(estudiante, notas, periodo))
      .filter(boletin => boletin.materias.length > 0);
  });

  public boletines = computed<BoletinEstudiante[]>(() => {
    if (!this.boletinesGenerados()) return [];
    return this.boletinesBase();
  });

  public previewBoletin = computed(() => {
    const previewKey = this.previewBoletinKey();
    return this.boletines().find(boletin => boletin.key === previewKey) ?? null;
  });

  public validationMessages = computed(() => {
    const messages: string[] = [];

    if (this.cursos().length === 0) {
      messages.push('No hay cursos registrados.');
    }

    if (this.periodos().length === 0) {
      messages.push('No hay periodos academicos registrados.');
    }

    if (this.isStudentMode() && !this.currentStudent()) {
      messages.push('No encontramos tu registro de estudiante asociado al usuario actual.');
    }

    if (this.isDocenteMode() && this.cursosDisponibles().length === 0) {
      messages.push('No tienes cursos asignados como director de curso.');
    }

    if (!this.isStudentMode() && !this.selectedCurso() && !this.isDocenteMode() && !this.isAdminMode()) {
      messages.push('Selecciona un curso para filtrar los estudiantes.');
    }

    if (!this.selectedPeriodo()) {
      messages.push('Selecciona un periodo para generar el boletin.');
      return messages;
    }

    if (!this.isStudentMode() && (this.selectedCurso() || this.isDocenteMode() || this.isAdminMode()) && this.estudiantesFiltrados().length === 0) {
      messages.push('No hay estudiantes registrados en el curso seleccionado.');
    }

    if (this.notas().length === 0) {
      messages.push('No hay notas registradas en el sistema.');
    } else if (this.notasDelPeriodo().length === 0) {
      messages.push('El periodo seleccionado no tiene notas registradas.');
    }

    if (this.boletinesGenerados() && this.selectedPeriodo() && this.boletines().length === 0 && this.notasDelPeriodo().length > 0) {
      messages.push(this.isStudentMode()
        ? 'No se encontraron notas para tu boletin en el periodo seleccionado.'
        : 'No se encontraron boletines con notas para los estudiantes del curso seleccionado.');
    }

    return messages;
  });

  ngOnInit() {
    this.reloadData();
  }

  public onCursoChange(event: MatSelectChange) {
    const cursoId = Number(event.value);
    this.selectedCursoId.set(cursoId > 0 ? cursoId : null);
    this.boletinesGenerados.set(false);
    this.previewBoletinKey.set(null);
    this.publishMessage.set(null);
  }

  public onPeriodoChange(event: MatSelectChange) {
    this.selectedPeriodoId.set(Number(event.value));
    this.boletinesGenerados.set(false);
    this.previewBoletinKey.set(null);
    this.publishMessage.set(null);
  }

  public reloadData() {
    this.cursosService.loadCursos();
    this.periodosService.loadPeriodos();
    this.estudiantesService.loadEstudiantes();
    this.notasService.loadNotas();
    this.materiasService.loadMaterias();
    this.observadoresService.loadObservadores();
    this.cursosService.loadAsignaciones();
    this.usersService.loadUsers();

    if (this.isStudentMode()) {
      this.boletinesService.loadMisBoletines();
    } else {
      this.boletinesService.loadBoletinesPublicados();
    }
  }

  public printReport() {
    window.print();
  }

  public generarBoletines() {
    if ((!this.isStudentMode() && !this.selectedCurso() && !this.isDocenteMode() && !this.isAdminMode()) || !this.selectedPeriodo()) return;
    if (this.isStudentMode() && !this.currentStudent()) return;

    this.boletinesGenerados.set(true);
    this.previewBoletinKey.set(this.isStudentMode() ? String(this.getEstudianteId(this.currentStudent()!)) : null);
  }

  public guardarYPublicarBoletines() {
    const periodo = this.selectedPeriodo();
    const boletines = this.boletines();

    if (!periodo || boletines.length === 0 || this.isPublishing()) return;

    const boletinesPayload = boletines.map(boletin => this.buildPublicarBoletinDto(periodo, boletin));
    const invalidBoletin = boletinesPayload.find(boletin =>
      !boletin.estudianteId
      || !boletin.periodoId
      || !boletin.cursoId
      || !Number.isFinite(boletin.promedio)
    );

    if (invalidBoletin) {
      this.publishMessage.set('No se pudo publicar: falta estudiante, curso, periodo o promedio en uno de los boletines.');
      return;
    }

    const payload = { boletines: boletinesPayload };

    this.isPublishing.set(true);
    this.publishMessage.set(null);

    this.boletinesService.publicarBoletines(payload).subscribe({
      next: data => {
        this.isPublishing.set(false);
        this.publishMessage.set(`${data.length} boletin${data.length === 1 ? '' : 'es'} guardado${data.length === 1 ? '' : 's'} y publicado${data.length === 1 ? '' : 's'} para estudiantes.`);
      },
      error: err => {
        console.error('Error al publicar boletines', err);
        this.isPublishing.set(false);
        this.publishMessage.set(this.getErrorMessage(err, 'No se pudieron guardar los boletines.'));
      }
    });
  }

  public verVistaPrevia(boletin: BoletinEstudiante) {
    this.previewBoletinKey.set(boletin.key);
  }

  public getBoletinByEstudiante(estudiante: EstudianteModel) {
    const estudianteId = String(this.getEstudianteId(estudiante));
    return this.boletines().find(boletin => boletin.key === estudianteId) ?? null;
  }

  public getBoletinPublicadoByEstudiante(estudiante: EstudianteModel) {
    const estudianteId = this.getEstudianteId(estudiante);
    const periodoId = this.selectedPeriodoId();

    if (!estudianteId || !periodoId) return null;

    return this.boletinesPublicados().find(boletin =>
      boletin.estudianteId === estudianteId && this.getBoletinPeriodoId(boletin) === periodoId
    ) ?? null;
  }

  public getNotaTrackKey(nota: NotaModel, index: number) {
    return nota.idNota
      ?? nota.id
      ?? `${nota.estudianteId ?? 'estudiante'}-${nota.materiaId ?? 'materia'}-${nota.valor}-${index}`;
  }

  public getObservacionTrackKey(observacion: ObservadorModel, index: number) {
    return observacion.idObservador
      ?? observacion.id
      ?? `${observacion.estudianteId ?? 'estudiante'}-${observacion.fecha}-${index}`;
  }

  public descargarPdf(boletin: BoletinEstudiante) {
    const periodo = this.selectedPeriodo();
    if (!periodo) return;

    this.printHtml(this.buildExportHtml(periodo, [boletin]));
  }

  public exportReport() {
    const periodo = this.selectedPeriodo();
    if (!periodo) return;

    const html = this.buildExportHtml(periodo, this.boletines());
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `boletines-${this.slugify(periodo.nombrePeriodo)}.html`;
    link.click();
    URL.revokeObjectURL(url);
  }

  public abrirBoletinPublicado(boletin: BoletinPublicadoModel) {
    const url = this.getPublishedBoletinUrl(boletin);
    if (!url) return;

    const openedWindow = window.open(url, '_blank', 'noopener,noreferrer');
    if (!openedWindow) {
      window.location.href = url;
    }
  }

  public getPublishedBoletinUrl(boletin: BoletinPublicadoModel) {
    return this.boletinesService.getBoletinUrl(boletin);
  }

  public descargarBoletinPublicado(boletin: BoletinPublicadoModel) {
    const url = this.getPublishedBoletinUrl(boletin);
    if (!url) return;

    const link = document.createElement('a');
    link.href = url;
    link.download = '';
    link.click();
  }

  public getPublishedBoletinId(boletin: BoletinPublicadoModel, index: number) {
    return boletin.idBoletin ?? boletin.id ?? `${boletin.estudianteId}-${boletin.periodoId}-${index}`;
  }

  public getPublishedPeriodoName(boletin: BoletinPublicadoModel) {
    return boletin.periodo?.nombrePeriodo
      ?? this.periodos().find(periodo => this.getPeriodoId(periodo) === this.getBoletinPeriodoId(boletin))?.nombrePeriodo
      ?? `Periodo ${this.getBoletinPeriodoId(boletin)}`;
  }

  public getPublishedDate(boletin: BoletinPublicadoModel) {
    return this.formatDate(boletin.fechaGeneracion ?? boletin.createdAt ?? boletin.updatedAt);
  }

  private printHtml(html: string) {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.setAttribute('aria-hidden', 'true');

    document.body.appendChild(iframe);

    const iframeWindow = iframe.contentWindow;
    const iframeDocument = iframe.contentDocument ?? iframeWindow?.document;

    if (!iframeWindow || !iframeDocument) {
      document.body.removeChild(iframe);
      return;
    }

    iframeDocument.open();
    iframeDocument.write(html);
    iframeDocument.close();

    let printed = false;
    const printFrame = () => {
      if (printed) return;
      printed = true;
      iframeWindow.focus();
      iframeWindow.print();

      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 1000);
    };

    iframe.onload = printFrame;
    setTimeout(printFrame, 300);
  }

  private buildPublicarBoletinDto(periodo: PeriodoModel, boletin: BoletinEstudiante): PublicarBoletinDto {
    const estudianteId = this.getEstudianteId(boletin.estudiante);
    const periodoId = this.getPeriodoId(periodo);
    const cursoId = this.getCursoId(boletin.estudiante.curso);
    const nombreArchivo = `boletin-${this.slugify(boletin.nombre)}-${this.slugify(periodo.nombrePeriodo)}.html`;

    return {
      estudianteId,
      periodoId,
      cursoId,
      promedio: boletin.promedio,
      estado: 'publicado',
      nombreArchivo,
      html: this.buildExportHtml(periodo, [boletin]),
      metadata: {
        estudiante: boletin.nombre,
        documento: boletin.documento,
        curso: boletin.curso,
        periodo: periodo.nombrePeriodo,
        promedioLabel: boletin.promedioLabel,
        resultado: boletin.resultado
      }
    };
  }

  public getPeriodoId(periodo: PeriodoModel) {
    return periodo.idPeriodo ?? 0;
  }

  private getBoletinPeriodoId(boletin: BoletinPublicadoModel) {
    return boletin.periodoId ?? boletin.periodo?.idPeriodo ?? 0;
  }

  public getCursoOptionName(curso?: CursoOption | EstudianteModel['curso'] | null) {
    return this.getCursoName(curso);
  }

  public puedeGenerarBoletines() {
    return !!this.selectedPeriodo()
      && this.estudiantesFiltrados().length > 0
      && (!!this.selectedCurso() || this.isStudentMode() || this.isDocenteMode() || this.isAdminMode());
  }

  public getPageTitle() {
    if (this.isStudentMode()) return 'Mi boletin';
    if (this.isDocenteMode()) return 'Boletines de mi curso';
    return 'Boletines';
  }

  public getPageDescription() {
    if (this.isStudentMode()) {
      return 'Consulta tu boletin academico por periodo y descargalo para conservar una copia.';
    }

    if (this.isDocenteMode()) {
      return 'Consulta y genera boletines solo para los estudiantes de los cursos donde eres director.';
    }

    if (this.isAdminMode()) {
      return 'Consulta, genera, publica y descarga boletines de todos los cursos.';
    }

    return 'Consulta el periodo, revisa la informacion academica y genera el reporte por estudiante.';
  }

  public getGenerateButtonText() {
    return this.isStudentMode() ? 'Consultar boletin' : 'Generar boletines';
  }

  public formatDate(value?: string | Date | null) {
    if (!value) return 'Sin fecha';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);

    return new Intl.DateTimeFormat('es-CO', {
      year: 'numeric',
      month: 'short',
      day: '2-digit'
    }).format(date);
  }

  private buildBoletin(estudiante: EstudianteModel, notas: NotaModel[], periodo: PeriodoModel): BoletinEstudiante {
    const estudianteId = this.getEstudianteId(estudiante);
    const notasEstudiante = notas.filter(nota => {
      const notaEstudiante = this.getNotaEstudiante(nota);
      return (notaEstudiante ? this.getEstudianteId(notaEstudiante) : nota.estudianteId) === estudianteId;
    });

    const materias = this.groupNotasByMateria(notasEstudiante, estudiante.curso);
    const promedio = this.getAverage(materias.map(materia => materia.promedio));

    return {
      key: String(estudianteId),
      estudiante,
      nombre: this.getStudentName(estudiante),
      documento: estudiante.user?.document ?? 'Sin documento',
      curso: this.getCursoName(estudiante.curso),
      materias,
      observaciones: this.getObservaciones(estudiante, periodo),
      promedio,
      promedioLabel: this.formatGrade(promedio),
      resultado: promedio >= 3 ? 'Aprobado' : 'En seguimiento',
      fallasJustificadas: 0,
      fallasNoJustificadas: 0
    };
  }

  private groupNotasByMateria(notas: NotaModel[], curso?: EstudianteModel['curso'] | CursoOption | null) {
    const groups = new Map<string, NotaModel[]>();

    notas.forEach(nota => {
      const materia = this.getNotaMateria(nota);
      const materiaId = materia ? this.getMateriaId(materia) : nota.materiaId ?? 0;
      const key = String(materiaId || this.getMateriaName(materia));
      groups.set(key, [...(groups.get(key) ?? []), nota]);
    });

    return [...groups.entries()].map(([key, materiaNotas]) => {
      const materia = this.getNotaMateria(materiaNotas[0]);
      const promedio = this.getAverage(materiaNotas.map(nota => Number(nota.valor)));

      return {
        key,
        nombre: this.getMateriaName(materia),
        docente: this.getMateriaDocente(materia, curso),
        ihs: materiaNotas.length,
        notas: materiaNotas,
        promedio,
        promedioLabel: this.formatGrade(promedio),
        desempeno: this.getDesempeno(promedio),
        observacion: this.getMateriaObservation(promedio)
      };
    });
  }

  private getObservaciones(estudiante: EstudianteModel, periodo: PeriodoModel) {
    const estudianteId = this.getEstudianteId(estudiante);
    const cursoId = this.getCursoId(estudiante.curso);
    const startDate = new Date(periodo.fechaInicial);
    const endDate = new Date(periodo.fechaFinal);
    const hasValidRange = !Number.isNaN(startDate.getTime()) && !Number.isNaN(endDate.getTime());

    return this.observadoresService.observadores().filter(observador => {
      const observadorEstudianteId = observador.estudiante
        ? this.getEstudianteId(observador.estudiante)
        : observador.estudianteId;
      const observadorCursoId = observador.curso ? this.getCursoId(observador.curso) : observador.cursoId;
      const sameStudent = observadorEstudianteId === estudianteId;
      const sameCourse = !cursoId || !observadorCursoId || observadorCursoId === cursoId;

      if (!sameStudent || !sameCourse) return false;
      if (!hasValidRange) return true;

      const observadorDate = new Date(observador.fecha);
      if (Number.isNaN(observadorDate.getTime())) return true;

      return observadorDate >= startDate && observadorDate <= endDate;
    });
  }

  private getNotaPeriodoId(nota: NotaModel) {
    const notaWithPeriodo = nota as NotaModel & {
      periodo?: { idPeriodo?: number; id?: number };
    };

    return nota.periodoId
      ?? nota.idPeriodo
      ?? notaWithPeriodo.periodo?.idPeriodo
      ?? notaWithPeriodo.periodo?.id;
  }

  private getNotaEstudiante(nota: NotaModel) {
    const estudianteId = nota.estudiante
      ? this.getEstudianteId(nota.estudiante)
      : nota.estudianteId;

    return nota.estudiante
      ?? this.estudiantes().find(estudiante => this.getEstudianteId(estudiante) === estudianteId);
  }

  private getNotaMateria(nota: NotaModel) {
    const materiaId = nota.materia
      ? this.getMateriaId(nota.materia)
      : nota.materiaId;

    return nota.materia
      ?? this.materiasService.materias().find(materia => this.getMateriaId(materia) === materiaId);
  }

  public getEstudianteId(estudiante: EstudianteModel) {
    return estudiante.id
      ?? estudiante.idEstudiante
      ?? estudiante.user?.estudiante?.id
      ?? 0;
  }

  public getCursoId(curso?: EstudianteModel['curso'] | ObservadorModel['curso'] | CursoOption | null) {
    return curso?.id ?? curso?.idCurso;
  }

  private isCursoDirectedByUser(curso: CursoOption, userId: number) {
    return this.getUserId(curso.director) === userId
      || this.getUserId(curso.directorCurso) === userId
      || this.getUserId(curso.directorId) === userId
      || this.getUserId(curso.docenteId) === userId
      || this.getUserId(curso.userId) === userId
      || this.getUserId(curso.usuarioId) === userId;
  }

  private getUserId(user: number | string | { id?: number | string } | null | undefined) {
    const rawId = typeof user === 'object' ? user?.id : user;
    const numericId = Number(rawId);
    return Number.isFinite(numericId) ? numericId : undefined;
  }

  private getCursoName(curso?: EstudianteModel['curso'] | CursoOption | null) {
    if (!curso) return 'Sin curso';
    const cursoWithAliases = curso as EstudianteModel['curso'] & {
      name?: string;
      nombre?: string;
    };

    return cursoWithAliases.nombreCurso
      ?? cursoWithAliases.name
      ?? cursoWithAliases.nombre
      ?? `Curso ${this.getCursoId(curso)}`;
  }

  private getMateriaId(materia: MateriaModel) {
    const materiaWithAliases = materia as MateriaModel & { id?: number; materiaId?: number; id_materia?: number };
    return materiaWithAliases.idMateria
      ?? materiaWithAliases.id
      ?? materiaWithAliases.materiaId
      ?? materiaWithAliases.id_materia
      ?? 0;
  }

  private getMateriaName(materia?: MateriaModel) {
    return materia?.nombreMateria ?? 'Sin materia';
  }

  public getNotaDescripcion(nota: NotaModel) {
    return nota.descripcion?.trim() || 'Registro académico del periodo.';
  }

  public getValoracionPeriodo(materia: BoletinMateria) {
    return `Valoracion: ${materia.promedioLabel} - ${materia.desempeno.toUpperCase()}`;
  }

  public getPeriodoYear(periodo?: PeriodoModel | null) {
    const date = periodo?.fechaInicial ? new Date(periodo.fechaInicial) : new Date();
    return Number.isNaN(date.getTime()) ? new Date().getFullYear() : date.getFullYear();
  }

  public getPeriodoName(periodo?: PeriodoModel | null) {
    return periodo?.nombrePeriodo ?? 'Sin periodo';
  }

  private getMateriaDocente(materia?: MateriaModel, curso?: EstudianteModel['curso'] | CursoOption | null) {
    const assignedDocente = this.getAssignedDocenteForMateria(materia, curso);
    if (assignedDocente) return this.getUserName(assignedDocente);

    const materiaWithUsers = materia as MateriaModel & {
      docentes?: Array<{ names?: string; lastNames?: string; email?: string }>;
      users?: Array<{ names?: string; lastNames?: string; email?: string }>;
    };
    const docente = materiaWithUsers.docentes?.[0] ?? materiaWithUsers.users?.[0];

    if (!docente) return 'Docente sin asignar';

    return `${docente.names ?? ''} ${docente.lastNames ?? ''}`.trim()
      || docente.email
      || 'Docente sin asignar';
  }

  private getAssignedDocenteForMateria(materia?: MateriaModel, curso?: EstudianteModel['curso'] | CursoOption | null) {
    const materiaId = materia ? this.getMateriaId(materia) : 0;
    const cursoId = this.getCursoId(curso) ?? this.selectedCursoId();

    if (!materiaId || !cursoId) return null;

    const asignacion = this.cursosService.asignaciones().find(asignacion =>
      asignacion.cursoId === cursoId && asignacion.materiaId === materiaId
    ) ?? (curso as CursoOption | null)?.asignaciones?.find(asignacion =>
      asignacion.cursoId === cursoId && asignacion.materiaId === materiaId
    );

    if (asignacion?.docente) return asignacion.docente;

    const docenteById = asignacion?.docenteId
      ? this.usersService.users().find(user => user.id === asignacion.docenteId)
      : undefined;

    if (docenteById) return docenteById;

    const selectedCursoWithUsers = this.selectedCurso() as CursoOption | null;
    const cursoUsers: UserModel[] = (curso as CursoOption | null)?.users ?? selectedCursoWithUsers?.users ?? [];
    return cursoUsers.find(user => this.userHasMateria(user, materiaId)) ?? null;
  }

  private userHasMateria(user: UserModel, materiaId: number) {
    return user.materias?.some(materia => this.getMateriaId(materia) === materiaId) ?? false;
  }

  private getUserName(user: { names?: string; lastNames?: string; email?: string }) {
    return `${user.names ?? ''} ${user.lastNames ?? ''}`.trim()
      || user.email
      || 'Docente sin asignar';
  }

  public getStudentName(estudiante: EstudianteModel) {
    return `${estudiante.user?.names ?? ''} ${estudiante.user?.lastNames ?? ''}`.trim()
      || `Estudiante ${this.getEstudianteId(estudiante)}`;
  }

  private getAverage(values: number[]) {
    const validValues = values.filter(value => !Number.isNaN(value));
    if (validValues.length === 0) return 0;

    const total = validValues.reduce((sum, value) => sum + value, 0);
    return total / validValues.length;
  }

  private formatGrade(value: number) {
    return value.toFixed(1);
  }

  private getDesempeno(value: number) {
    if (value >= 4.6) return 'Superior';
    if (value >= 4) return 'Alto';
    if (value >= 3) return 'Basico';
    return 'Bajo';
  }

  private getMateriaObservation(value: number) {
    if (value >= 4.6) return 'Desempeno sobresaliente durante el periodo.';
    if (value >= 4) return 'Cumple con los aprendizajes esperados.';
    if (value >= 3) return 'Alcanza los desempenos basicos del periodo.';
    return 'Requiere actividades de apoyo y seguimiento.';
  }

  private buildExportHtml(periodo: PeriodoModel, boletines: BoletinEstudiante[]) {
    const institutionLogoUrl = this.getInstitutionLogoUrl();
    const rows = boletines.map(boletin => `
      <section class="sheet">
        <header class="school-header">
          <div class="seal">
            <img src="${this.escapeHtml(institutionLogoUrl)}" alt="Logo institucional">
          </div>
          <div class="school-copy">
            <h1>Institucion Educativa Tecnica Plinio Mendoza Neira</h1>
            <span>Toca, Boyaca</span>
            <strong>Sede: Integrado - Jornada: Manana</strong>
            <span>Inscripcion al Dane No. 115238 - 000698 NIT. 891.855.144 - 4</span>
            <h2>INFORME DE EVALUACION ACADEMICA</h2>
          </div>
          <div class="year-box">
            <span>Ano lectivo</span>
            <strong>${this.getPeriodoYear(periodo)}</strong>
          </div>
        </header>

        <section class="student-grid">
          <div class="student-name"><span>ESTUDIANTE:</span><strong>${this.escapeHtml(boletin.nombre)}</strong></div>
          <div><span>GRADO:</span><strong>${this.escapeHtml(boletin.curso)}</strong></div>
          <div><span>CURSO:</span><strong>${this.escapeHtml(boletin.curso)}</strong></div>
          <div class="student-name"><span>DOCUMENTO:</span><strong>${this.escapeHtml(boletin.documento)}</strong></div>
          <div><span>PERIODO:</span><strong>${this.escapeHtml(periodo.nombrePeriodo)}</strong></div>
          <div><span>PROMEDIO:</span><strong>${boletin.promedioLabel}</strong></div>
        </section>

        ${boletin.materias.map(materia => `
          <table class="subject-table">
            <colgroup>
              <col class="subject-col">
              <col class="ihs-col">
              <col class="valuation-col">
              <col class="fault-col">
              <col class="fault-col">
            </colgroup>
            <thead>
              <tr><th colspan="5">${this.escapeHtml(materia.nombre.toUpperCase())}</th></tr>
            </thead>
            <tbody>
              <tr class="subject-summary-row">
                <td><strong>${this.escapeHtml(materia.nombre)}</strong><small>Prof: ${this.escapeHtml(materia.docente)}</small></td>
                <td><strong>IHS</strong><span>${materia.ihs}</span></td>
                <td><strong>${this.escapeHtml(this.getValoracionPeriodo(materia))}</strong><span>1P: ${materia.promedioLabel}</span></td>
                <td><strong>FJ: 0</strong><span>NA: ${materia.promedioLabel}</span></td>
                <td><strong>FNJ: 0</strong><span>1P:FJ: 0</span></td>
              </tr>
              ${materia.notas.map(nota => `
                <tr class="performance-row">
                  <td colspan="5">
                    <strong>${this.formatGrade(Number(nota.valor))}</strong>
                    <span>- ${this.escapeHtml(this.getNotaDescripcion(nota))}</span>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `).join('')}

        <footer class="final-summary">
          <span>Resultado: <strong>${this.escapeHtml(boletin.resultado)}</strong></span>
          <span>Promedio final: <strong>${boletin.promedioLabel}</strong></span>
        </footer>
      </section>
    `).join('');

    return `<!doctype html>
      <html lang="es">
      <head>
        <meta charset="utf-8">
        <title>Boletin</title>
        <style>
          @page {
            size: letter portrait;
            margin: 0;
          }

          * {
            box-sizing: border-box;
          }

          html,
          body {
            margin: 0;
            padding: 0;
          }

          body {
            background: #fff;
            color: #000;
            font-family: Arial, Helvetica, sans-serif;
            font-size: 10.5px;
            line-height: 1.18;
          }

          .sheet {
            width: 100%;
            min-height: 279.4mm;
            page-break-after: always;
            border-top: 4px solid #222;
            padding: 10mm 12mm;
          }

          .sheet:last-child {
            page-break-after: auto;
          }

          .school-header {
            display: grid;
            grid-template-columns: 82px 1fr 90px;
            align-items: center;
            gap: 10px;
            margin-bottom: 8px;
          }

          .seal {
            display: grid;
            place-items: center;
            width: 66px;
            height: 66px;
            justify-self: center;
          }

          .seal img {
            display: block;
            width: 56px;
            height: 56px;
            object-fit: contain;
          }

          .school-copy {
            display: grid;
            justify-items: center;
            text-align: center;
          }

          .school-copy h1,
          .school-copy h2,
          .school-copy strong,
          .school-copy span {
            margin: 0;
          }

          .school-copy h1 {
            font-size: 18px;
            line-height: 1.05;
          }

          .school-copy h2 {
            margin-top: 9px;
            font-size: 14px;
            letter-spacing: 0;
          }

          .school-copy span {
            font-size: 9px;
          }

          .year-box {
            display: grid;
            justify-items: center;
            border: 1px solid #555;
            padding: 5px;
            text-align: center;
          }

          .year-box span {
            font-size: 9px;
            text-transform: uppercase;
          }

          .year-box strong {
            font-size: 15px;
          }

          .student-grid {
            display: grid;
            grid-template-columns: 1.7fr 0.7fr 0.7fr;
            border: 1px solid #555;
            margin-bottom: 0;
          }

          .student-grid div {
            display: flex;
            gap: 3px;
            min-width: 0;
            border-right: 1px solid #aaa;
            border-bottom: 1px solid #aaa;
            padding: 3px 6px;
          }

          .student-grid div:nth-child(3n) {
            border-right: 0;
          }

          .student-grid div:nth-last-child(-n + 3) {
            border-bottom: 0;
          }

          .student-grid span {
            flex: 0 0 auto;
            font-size: 10px;
          }

          .student-grid strong {
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .subject-table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
            margin: 0;
          }

          .subject-col {
            width: 36%;
          }

          .ihs-col {
            width: 8%;
          }

          .valuation-col {
            width: 31%;
          }

          .fault-col {
            width: 12.5%;
          }

          .subject-table th,
          .subject-table td {
            border: 1px solid #888;
            padding: 2px 5px;
            vertical-align: middle;
          }

          .subject-table th {
            background: #e6e6e6;
            font-size: 13px;
            line-height: 1.05;
            text-align: center;
            text-transform: uppercase;
          }

          .subject-summary-row td {
            height: 28px;
          }

          .subject-summary-row td:not(:first-child) {
            text-align: center;
          }

          .subject-summary-row strong,
          .subject-summary-row span,
          .subject-summary-row small {
            display: block;
          }

          .subject-summary-row td:first-child strong {
            font-size: 11px;
          }

          .subject-summary-row small {
            font-size: 9px;
          }

          .performance-row td {
            border-top: 0;
            padding: 2px 8px;
          }

          .performance-row strong {
            display: inline-block;
            width: 34px;
            text-align: right;
            padding-right: 7px;
          }

          .final-summary {
            display: flex;
            justify-content: flex-end;
            gap: 24px;
            border: 1px solid #555;
            border-top: 0;
            padding: 5px 8px;
            font-size: 11px;
          }

          @media print {
            .sheet {
              break-after: page;
            }

            .sheet:last-child {
              break-after: auto;
            }
          }
        </style>
      </head>
      <body>
        ${rows}
      </body>
      </html>`;
  }

  private getInstitutionLogoUrl() {
    return new URL(this.institutionLogoPath, window.location.origin).href;
  }

  private escapeHtml(value: string) {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  private getErrorMessage(error: unknown, fallback: string) {
    const err = error as {
      error?: { message?: string | string[]; error?: string };
      message?: string;
    };
    const backendMessage = err.error?.message;

    if (Array.isArray(backendMessage)) return backendMessage.join(' ');
    if (backendMessage) return backendMessage;
    if (err.error?.error) return err.error.error;

    return fallback;
  }

  private slugify(value: string) {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }

  private normalizeName(value: string) {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  private hasRole(roleName: string) {
    return this.currentUser()?.roles?.some(role =>
      this.normalizeName(role.name).includes(roleName)
    ) ?? false;
  }
}
