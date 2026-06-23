import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Auth } from '../../core/services/auth';
import { CursosService } from '../cursos/services/cursos-service';
import { EstudiantesService } from '../estudiantes/services/estudiantes-service';
import { MateriasService } from '../materias/services/materias-service';
import { UsersService } from '../users/services/users-service';
import { NotasService } from '../notas/services/notas-service';
import { ObservadoresService } from '../observadores/services/observadores-service';
import { PeriodosService } from '../periodos/services/periodos-service';
import { EstudianteModel, CursoModel as EstudianteCursoModel } from '../estudiantes/models/estudiante.model';
import { NotaModel } from '../notas/models/nota.model';
import { ObservadorModel } from '../observadores/models/observador.model';
import { UserModel } from '../users/models/user.model';

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule, RouterLink, MatButtonModule, MatIconModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard {
  private authService = inject(Auth);
  private usersService = inject(UsersService);
  private estudiantesService = inject(EstudiantesService);
  private cursosService = inject(CursosService);
  private materiasService = inject(MateriasService);
  private notasService = inject(NotasService);
  private observadoresService = inject(ObservadoresService);
  private periodosService = inject(PeriodosService);

  public today = new Date();

  public currentUser = this.authService.currentUser;
  public isDocente = computed(() => this.hasRole('docente') && !this.hasRole('admin'));
  public isEstudiante = computed(() => this.hasRole('estudiante') && !this.hasRole('admin') && !this.hasRole('docente'));

  public docenteCursos = computed(() => {
    const userId = this.currentUser()?.id;
    if (!userId) return [];

    const asignacionesCursoIds = new Set(
      this.cursosService.asignaciones()
        .filter(asignacion => asignacion.docenteId === userId)
        .map(asignacion => asignacion.cursoId)
    );

    return this.cursosService.cursos().filter(curso => {
      const cursoId = curso.id ?? curso.idCurso;
      const isAssigned = cursoId ? asignacionesCursoIds.has(cursoId) : false;
      const isInUsers = curso.users?.some(user => user.id === userId);
      const isDirector = curso.director?.id === userId
        || curso.directorCurso === userId
        || curso.docenteId === userId
        || curso.userId === userId
        || curso.usuarioId === userId
        || curso.directorId === userId;

      return isAssigned || isInUsers || isDirector;
    });
  });

  public docenteMaterias = computed(() => {
    const userId = this.currentUser()?.id;
    if (!userId) return [];

    const materiaIds = new Set(
      this.cursosService.asignaciones()
        .filter(asignacion => asignacion.docenteId === userId)
        .map(asignacion => asignacion.materiaId)
    );

    const materiasFromUser = this.currentUser()?.materias ?? [];
    const materiasFromService = this.materiasService.materias()
      .filter(materia => materiaIds.has(this.getMateriaId(materia)));

    return [...materiasFromUser, ...materiasFromService]
      .filter((materia, index, materias) =>
        materias.findIndex(current => this.getMateriaId(current) === this.getMateriaId(materia)) === index
      );
  });

  public docenteEstudiantes = computed(() => {
    const cursoIds = new Set(this.docenteCursos().map(curso => curso.id ?? curso.idCurso));
    return this.estudiantesService.estudiantes().filter(estudiante =>
      cursoIds.has(estudiante.curso?.id ?? estudiante.curso?.idCurso)
    );
  });

  public docenteStats = computed(() => [
    {
      label: 'Cursos asignados',
      value: this.docenteCursos().length,
      helper: 'Cursos a cargo',
      icon: 'class',
      accent: 'green'
    },
    {
      label: 'Estudiantes',
      value: this.docenteEstudiantes().length,
      helper: 'En tus cursos',
      icon: 'school',
      accent: 'blue'
    },
    {
      label: 'Materias',
      value: this.docenteMaterias().length,
      helper: 'Asignadas a tu perfil',
      icon: 'menu_book',
      accent: 'purple'
    },
    {
      label: 'Notas registradas',
      value: this.docenteNotasCount(),
      helper: 'De tus cursos',
      icon: 'grade',
      accent: 'red'
    }
  ]);

  public estudianteActual = computed(() => {
    const user = this.currentUser();
    if (!user) return null;

    const userDocument = this.normalizeText(user.document);
    const userEmail = this.normalizeText(user.email);
    const estudiantes = this.estudiantesService.estudiantes();

    return estudiantes.find(estudiante => estudiante.user?.id === user.id)
      ?? estudiantes.find(estudiante => userDocument && this.normalizeText(estudiante.user?.document) === userDocument)
      ?? estudiantes.find(estudiante => userEmail && this.normalizeText(estudiante.user?.email) === userEmail)
      ?? estudiantes.find(estudiante => this.getEstudianteId(estudiante) === this.getCurrentUserEstudianteId(user))
      ?? null;
  });

  public estudianteNotas = computed(() => {
    const estudiante = this.estudianteActual();
    const user = this.currentUser();
    if (!user) return [];

    return this.notasService.notas().filter(nota => this.belongsToCurrentStudent(nota, estudiante, user));
  });

  public estudiantePromedio = computed(() => {
    const notas = this.estudianteNotas().map(nota => Number(nota.valor)).filter(value => !Number.isNaN(value));
    if (notas.length === 0) return 'Sin notas';

    const total = notas.reduce((sum, value) => sum + value, 0);
    return (total / notas.length).toFixed(1);
  });

  public estudianteObservaciones = computed(() => {
    const estudiante = this.estudianteActual();
    const user = this.currentUser();
    if (!user) return [];

    return this.observadoresService.observadores().filter(observador => this.belongsToCurrentStudent(observador, estudiante, user));
  });

  public estudianteStats = computed(() => [
    {
      label: 'Promedio',
      value: this.estudiantePromedio(),
      helper: 'Promedio general',
      icon: 'trending_up',
      accent: 'green'
    },
    {
      label: 'Notas',
      value: this.estudianteNotas().length,
      helper: 'Registros académicos',
      icon: 'grade',
      accent: 'blue'
    },
    {
      label: 'Observaciones',
      value: this.estudianteObservaciones().length,
      helper: 'Seguimiento escolar',
      icon: 'assignment',
      accent: 'purple'
    },
    {
      label: 'Curso',
      value: this.estudianteCursoName(),
      helper: 'Grupo asignado',
      icon: 'class',
      accent: 'red'
    }
  ]);

  public latestGrades = computed(() =>
    this.estudianteNotas()
      .filter(nota => !Number.isNaN(Number(nota.valor)))
      .slice(-5)
      .reverse()
      .map(nota => ({
        value: Number(nota.valor).toFixed(1),
        subject: this.getMateriaName(nota.materia),
        description: nota.descripcion?.trim() || 'Registro académico'
      }))
  );

  public activePeriod = computed(() => {
    const now = new Date();
    return this.periodosService.periodos().find(periodo => {
      const start = new Date(periodo.fechaInicial);
      const end = new Date(periodo.fechaFinal);
      return !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && now >= start && now <= end;
    }) ?? this.periodosService.periodos()[0] ?? null;
  });

  public activePeriodName = computed(() => this.activePeriod()?.nombrePeriodo ?? 'Sin periodo');
  public estudianteCursoName = computed(() => this.getCursoName(this.estudianteCurso()));

  ngOnInit() {
    this.observadoresService.loadObservadores();
  }

  public stats = computed(() => {
    const users = this.usersService.users();
    const estudiantes = this.estudiantesService.estudiantes();
    const cursos = this.cursosService.cursos();

    return [
      {
        label: 'Usuarios activos',
        value: users.filter(user => user.isActive).length,
        helper: `${users.length} registrados`,
        icon: 'group',
        accent: 'blue'
      },
      {
        label: 'Estudiantes',
        value: estudiantes.length,
        helper: `${this.countWithCourse()} con curso asignado`,
        icon: 'school',
        accent: 'green'
      },
      {
        label: 'Cursos',
        value: cursos.length,
        helper: `${cursos.filter(curso => curso.isActive).length} activos`,
        icon: 'dashboard_customize',
        accent: 'purple'
      },
      {
        label: 'Módulos',
        value: this.authService.userModules().length,
        helper: `${this.authService.userModules().length} disponibles para tu rol`,
        icon: 'widgets',
        accent: 'red'
      }
    ];
  });

  public summary = computed(() => ({
    materias: this.materiasService.materias().length,
    modulos: this.authService.userModules().length,
    accesos: this.authService.userModules().length,
    usuarios: this.usersService.users().length
  }));

  public canAccessModule = (moduleName: string) => this.authService.userModules().includes(moduleName);

  public courseDistribution = computed(() => {
    const estudiantes = this.estudiantesService.estudiantes();
    const cursos = this.cursosService.cursos();
    const max = Math.max(
      ...cursos.map(curso => estudiantes.filter(estudiante => estudiante.curso?.id === curso.id).length),
      1
    );

    return cursos.slice(0, 5).map(curso => {
      const total = estudiantes.filter(estudiante => estudiante.curso?.id === curso.id).length;

      return {
        name: curso.nombreCurso,
        total,
        width: `${Math.max((total / max) * 100, total ? 8 : 0)}%`
      };
    });
  });

  public latestStudents = computed(() =>
    this.estudiantesService.estudiantes()
      .slice(-4)
      .reverse()
      .map(estudiante => ({
        name: `${estudiante.user?.names ?? ''} ${estudiante.user?.lastNames ?? ''}`.trim() || 'Sin usuario',
        course: estudiante.curso?.nombreCurso ?? 'Sin curso'
      }))
  );

  private countWithCourse() {
    return this.estudiantesService.estudiantes().filter(estudiante => !!estudiante.curso?.id).length;
  }

  private docenteNotasCount() {
    const cursoIds = new Set(this.docenteCursos().map(curso => curso.id ?? curso.idCurso));
    return this.notasService.notas().filter(nota => {
      const cursoId = nota.cursoId ?? nota.estudiante?.curso?.id ?? nota.estudiante?.curso?.idCurso;
      return cursoIds.has(cursoId);
    }).length;
  }

  private hasRole(roleName: string) {
    return this.currentUser()?.roles?.some(role =>
      role.name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .includes(roleName)
    ) ?? false;
  }

  private getMateriaId(materia?: { idMateria?: number; id?: number }) {
    return materia?.idMateria ?? materia?.id ?? 0;
  }

  private getMateriaName(materia?: { nombreMateria?: string; nombre?: string; name?: string }) {
    return materia?.nombreMateria ?? materia?.nombre ?? materia?.name ?? 'Materia';
  }

  private belongsToCurrentStudent(
    record: NotaModel | ObservadorModel,
    estudiante: EstudianteModel | null,
    user: UserModel
  ) {
    const estudianteId = estudiante ? this.getEstudianteId(estudiante) : null;
    const userEstudianteId = this.getCurrentUserEstudianteId(user);
    const recordEstudiante = record.estudiante;
    const recordEstudianteId = this.getRecordEstudianteId(record);
    const recordUser = recordEstudiante?.user;
    const userDocument = this.normalizeText(user.document);
    const userEmail = this.normalizeText(user.email);

    return (!!estudianteId && recordEstudianteId === estudianteId)
      || (!!userEstudianteId && recordEstudianteId === userEstudianteId)
      || recordUser?.id === user.id
      || (!!userDocument && this.normalizeText(recordUser?.document) === userDocument)
      || (!!userEmail && this.normalizeText(recordUser?.email) === userEmail);
  }

  private getRecordEstudianteId(record: NotaModel | ObservadorModel) {
    return record.estudianteId ?? this.getEstudianteId(record.estudiante);
  }

  private getEstudianteId(estudiante?: EstudianteModel | null) {
    return estudiante?.id ?? estudiante?.idEstudiante ?? null;
  }

  private getCurrentUserEstudianteId(user: UserModel) {
    return user.estudiante?.id ?? null;
  }

  private estudianteCurso() {
    const estudiante = this.estudianteActual();
    const cursoFromStudent = estudiante?.curso ?? null;
    const cursoId = this.getCursoId(cursoFromStudent);

    if (cursoId) {
      return this.cursosService.cursos().find(curso => this.getCursoId(curso) === cursoId) ?? cursoFromStudent;
    }

    return cursoFromStudent
      ?? this.currentUser()?.cursos?.[0]
      ?? null;
  }

  private getCursoId(curso?: (EstudianteCursoModel & { cursoId?: number }) | null) {
    return curso?.id ?? curso?.idCurso ?? curso?.cursoId ?? null;
  }

  private getCursoName(curso?: (EstudianteCursoModel & { nombreCurso?: string; nombre?: string; name?: string }) | null) {
    return curso?.nombreCurso
      ?? curso?.nombre
      ?? curso?.name
      ?? (this.getCursoId(curso) ? `Curso ${this.getCursoId(curso)}` : 'Sin curso');
  }

  private normalizeText(value?: string | null) {
    return value?.trim().toLowerCase() ?? '';
  }
}
