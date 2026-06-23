import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import Swal from 'sweetalert2';
import { Auth } from '../../core/services/auth';
import { API_BASE_URL } from '../../core/config/api.config';
import { AsignacionModel } from '../cursos/models/curso.model';
import { CursosService } from '../cursos/services/cursos-service';
import { EstudiantesService } from '../estudiantes/services/estudiantes-service';
import { CreateGuiaDto, GuiaModel, UpdateGuiaDto } from './models/guia.model';
import { GuiasForm } from './components/guias-form/guias-form';
import { GuiasService } from './services/guias-service';

@Component({
  selector: 'app-guias',
  imports: [
    CommonModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatSelectModule
  ],
  templateUrl: './guias.html',
  styleUrl: './guias.scss',
})
export class Guias {
  private guiasService = inject(GuiasService);
  private cursosService = inject(CursosService);
  private estudiantesService = inject(EstudiantesService);
  private authService = inject(Auth);

  public cursos = this.cursosService.cursos;
  public materias = this.cursosService.materias;
  public asignaciones = this.cursosService.asignaciones;
  public currentUser = this.authService.currentUser;
  public selectedCursoId = signal<number | null>(null);
  public selectedMateriaId = signal<number | null>(null);
  public selectedEstado = signal<'all' | 'active' | 'inactive'>('all');
  public errorMessage = '';

  public isDocenteMode = computed(() =>
    this.hasRole('docente') && !this.hasRole('admin') && !this.hasRole('administrador')
  );

  public isStudentMode = computed(() => this.hasRole('estudiante'));

  public canManageGuias = computed(() => !this.isStudentMode());

  public currentStudent = computed(() => {
    const user = this.currentUser();
    if (!user) return null;

    return this.estudiantesService.estudiantes().find(estudiante =>
      estudiante.user?.id === user.id || estudiante.id === user.estudiante?.id
    ) ?? null;
  });

  public studentMateriaOptions = computed(() => {
    const cursoId = this.getCursoId(this.currentStudent()?.curso);
    if (!cursoId) return [];

    const materiasById = new Map<number, { id?: number; idMateria?: number; nombreMateria?: string; nombre?: string; name?: string }>();

    this.asignaciones()
      .filter(asignacion => this.getAsignacionCursoId(asignacion) === cursoId)
      .forEach(asignacion => {
        const materiaId = this.getAsignacionMateriaId(asignacion);
        if (!materiaId || materiasById.has(materiaId)) return;

        materiasById.set(
          materiaId,
          asignacion.materia ?? this.materias().find(materia => this.getMateriaId(materia) === materiaId) ?? { idMateria: materiaId }
        );
      });

    return [...materiasById.values()].sort((first, second) =>
      this.getMateriaName(first).localeCompare(this.getMateriaName(second), 'es', { sensitivity: 'base' })
    );
  });

  public docenteMateriaOptions = computed(() => {
    const docenteId = this.currentUser()?.id;
    if (!docenteId || !this.isDocenteMode()) return this.materias();

    const materiasById = new Map<number, { id?: number; idMateria?: number; nombreMateria?: string; nombre?: string; name?: string }>();

    this.asignaciones()
      .filter(asignacion => this.getAsignacionDocenteId(asignacion) === docenteId)
      .forEach(asignacion => {
        const materiaId = this.getAsignacionMateriaId(asignacion);
        if (!materiaId || materiasById.has(materiaId)) return;

        materiasById.set(
          materiaId,
          asignacion.materia ?? this.materias().find(materia => this.getMateriaId(materia) === materiaId) ?? { idMateria: materiaId }
        );
      });

    return [...materiasById.values()].sort((first, second) =>
      this.getMateriaName(first).localeCompare(this.getMateriaName(second), 'es', { sensitivity: 'base' })
    );
  });

  public cursoOptions = computed(() => {
    const docenteId = this.currentUser()?.id;
    if (!docenteId || !this.isDocenteMode()) return this.cursos();

    const cursoIds = new Set(
      this.asignaciones()
        .filter(asignacion => this.getAsignacionDocenteId(asignacion) === docenteId)
        .map(asignacion => this.getAsignacionCursoId(asignacion))
        .filter(Boolean)
    );

    return this.cursos().filter(curso => {
      const cursoId = this.getCursoId(curso);
      return !!cursoId && cursoIds.has(cursoId);
    });
  });

  public guiasFiltradas = computed(() => {
    const cursoId = this.selectedCursoId();
    const materiaId = this.selectedMateriaId();
    const estado = this.selectedEstado();

    return this.guiasService.guias()
      .filter(guia => this.canSeeGuia(guia))
      .filter(guia => cursoId && !this.isStudentMode() ? this.getGuiaCursoId(guia) === cursoId : true)
      .filter(guia => materiaId ? this.getGuiaMateriaId(guia) === materiaId : true)
      .filter(guia => {
        if (this.isStudentMode()) return this.isGuiaActive(guia);
        if (estado === 'all') return true;
        return this.isGuiaActive(guia) === (estado === 'active');
      })
      .sort((first, second) => this.getGuiaTitle(first).localeCompare(this.getGuiaTitle(second), 'es', { sensitivity: 'base' }));
  });

  constructor(private dialog: MatDialog) {}

  ngOnInit() {
    this.guiasService.loadGuias();
    this.cursosService.loadCursos();
    this.cursosService.loadMaterias();
    this.cursosService.loadAsignaciones();
    this.estudiantesService.loadEstudiantes();
  }

  openDialog() {
    if (!this.canManageGuias()) return;

    const dialogRef = this.dialog.open(GuiasForm, { width: 'min(720px, 96vw)', maxWidth: '96vw' });

    dialogRef.afterClosed().subscribe((result?: CreateGuiaDto) => {
      if (!result) return;

      this.errorMessage = '';
      this.guiasService.createGuia(result).subscribe({
        next: () => this.showSuccess('Guia creada', 'La guia se guardo correctamente.'),
        error: (err: HttpErrorResponse) => {
          this.errorMessage = this.getErrorMessage(err, 'No se pudo crear la guia.');
          this.showError('Error al guardar', this.errorMessage);
        }
      });
    });
  }

  handleEdit(guia: GuiaModel) {
    if (!this.canManageGuia(guia)) return;

    const guiaId = this.getGuiaId(guia);
    if (!guiaId) return;

    const dialogRef = this.dialog.open(GuiasForm, { width: 'min(720px, 96vw)', maxWidth: '96vw', data: guia });

    dialogRef.afterClosed().subscribe((result?: UpdateGuiaDto) => {
      if (!result) return;

      this.errorMessage = '';
      this.guiasService.updateGuia(guiaId, result).subscribe({
        next: () => this.showSuccess('Guia actualizada', 'La guia se actualizó correctamente.'),
        error: (err: HttpErrorResponse) => {
          this.errorMessage = this.getErrorMessage(err, 'No se pudo actualizar la guia.');
          this.showError('Error al actualizar', this.errorMessage);
        }
      });
    });
  }

  async handleDelete(guia: GuiaModel) {
    if (!this.canManageGuia(guia)) return;

    const guiaId = this.getGuiaId(guia);
    if (!guiaId) return;

    const result = await Swal.fire({
      icon: 'warning',
      title: 'Eliminar guia',
      text: `Estas seguro de eliminar ${this.getGuiaTitle(guia)}?`,
      showCancelButton: true,
      confirmButtonText: 'Si, eliminar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#b4232f'
    });

    if (!result.isConfirmed) return;

    this.errorMessage = '';
    this.guiasService.deleteGuia(guiaId).subscribe({
      next: () => this.showSuccess('Guia eliminada', 'La guia se eliminó correctamente.'),
      error: (err: HttpErrorResponse) => {
        this.errorMessage = this.getErrorMessage(err, 'No se pudo eliminar la guia.');
        this.showError('Error al eliminar', this.errorMessage);
      }
    });
  }

  selectCurso(value: number | null) {
    this.selectedCursoId.set(value);
  }

  selectMateria(value: number | null) {
    this.selectedMateriaId.set(value);
  }

  selectEstado(value: 'all' | 'active' | 'inactive') {
    this.selectedEstado.set(value);
  }

  openGuia(guia: GuiaModel) {
    const url = this.getGuiaUrl(guia);
    if (!url) {
      this.showError('Sin enlace', 'Esta guia no tiene un archivo o enlace asociado.');
      return;
    }

    window.open(url, '_blank', 'noopener,noreferrer');
  }

  getGuiaId(guia: GuiaModel) {
    return this.guiasService.getGuiaId(guia);
  }

  getGuiaTitle(guia: GuiaModel) {
    return guia.nombreGuia ?? guia.titulo ?? guia.title ?? 'Guia sin titulo';
  }

  getGuiaDescription(guia: GuiaModel) {
    return guia.descripcion ?? guia.description ?? 'Sin descripcion';
  }

  getGuiaUrl(guia: GuiaModel) {
    const url = guia.archivoUrl ?? guia.fileUrl ?? guia.url ?? '';
    if (!url || url.startsWith('http') || url.startsWith('data:') || url.startsWith('blob:')) return url;

    const cleanPath = url.startsWith('/') ? url.slice(1) : url;
    return `${API_BASE_URL}/${cleanPath}`;
  }

  isGuiaActive(guia: GuiaModel) {
    return guia.estado ?? guia.isActive ?? true;
  }

  getCursoId(curso?: { id?: number; idCurso?: number; cursoId?: number }) {
    return curso?.id ?? curso?.idCurso ?? curso?.cursoId;
  }

  getCursoName(curso?: { nombreCurso?: string; nombre?: string; name?: string; id?: number; idCurso?: number }) {
    if (!curso) return 'Todos los cursos';
    return curso.nombreCurso ?? curso.nombre ?? curso.name ?? `Curso ${curso.id ?? curso.idCurso ?? ''}`.trim();
  }

  getMateriaId(materia: { id?: number; idMateria?: number; materiaId?: number }) {
    return materia.idMateria ?? materia.id ?? materia.materiaId;
  }

  getMateriaName(materia?: { nombreMateria?: string; nombre?: string; name?: string; id?: number; idMateria?: number }) {
    if (!materia) return 'Todas las materias';
    return materia.nombreMateria ?? materia.nombre ?? materia.name ?? `Materia ${materia.idMateria ?? materia.id ?? ''}`.trim();
  }

  getGuiaCursoName(guia: GuiaModel) {
    const cursoId = this.getGuiaCursoId(guia);
    return this.getCursoName(guia.curso ?? this.cursos().find(curso => this.getCursoId(curso) === cursoId));
  }

  getGuiaMateriaName(guia: GuiaModel) {
    const materiaId = this.getGuiaMateriaId(guia);
    return this.getMateriaName(guia.materia ?? this.materias().find(materia => this.getMateriaId(materia) === materiaId));
  }

  getGuiaAsignacionName(guia: GuiaModel) {
    const asignacion = this.getGuiaAsignacion(guia);
    if (!asignacion) return 'Sin asignación';

    return `${this.getCursoName(asignacion.curso ?? this.cursos().find(curso => this.getCursoId(curso) === this.getAsignacionCursoId(asignacion)))} - ${this.getMateriaName(asignacion.materia ?? this.materias().find(materia => this.getMateriaId(materia) === this.getAsignacionMateriaId(asignacion)))}`;
  }

  canManageGuia(guia: GuiaModel) {
    if (!this.canManageGuias()) return false;
    if (!this.isDocenteMode()) return true;

    const currentUserId = this.currentUser()?.id;
    const asignacion = this.getGuiaAsignacion(guia);

    return !!currentUserId && this.getAsignacionDocenteId(asignacion) === currentUserId;
  }

  private getGuiaCursoId(guia: GuiaModel) {
    return guia.cursoId ?? guia.asignacion?.cursoId ?? guia.curso?.id ?? guia.curso?.idCurso;
  }

  private getGuiaMateriaId(guia: GuiaModel) {
    return guia.materiaId ?? guia.asignacion?.materiaId ?? guia.materia?.idMateria ?? guia.materia?.id;
  }

  private getGuiaAsignacion(guia: GuiaModel) {
    return guia.asignacion ?? this.asignaciones().find(asignacion =>
      this.getAsignacionId(asignacion) === guia.asignacionId
    );
  }

  private canSeeGuia(guia: GuiaModel) {
    if (this.isStudentMode()) {
      const cursoId = this.getCursoId(this.currentStudent()?.curso);
      if (!cursoId) return false;

      return this.getGuiaCursoId(guia) === cursoId;
    }

    if (this.isDocenteMode()) {
      const currentUserId = this.currentUser()?.id;
      const asignacion = this.getGuiaAsignacion(guia);

      return !!currentUserId && this.getAsignacionDocenteId(asignacion) === currentUserId;
    }

    return true;
  }

  getAsignacionId(asignacion: AsignacionModel) {
    return asignacion.idAsignacion ?? (asignacion as AsignacionModel & { id?: number }).id ?? 0;
  }

  private getAsignacionCursoId(asignacion?: AsignacionModel) {
    return asignacion?.cursoId ?? asignacion?.curso?.id ?? asignacion?.curso?.idCurso ?? 0;
  }

  private getAsignacionMateriaId(asignacion?: AsignacionModel) {
    return asignacion?.materiaId ?? asignacion?.materia?.idMateria ?? asignacion?.materia?.id ?? 0;
  }

  private getAsignacionDocenteId(asignacion?: AsignacionModel) {
    return asignacion?.docenteId ?? asignacion?.docente?.id ?? 0;
  }

  private hasRole(roleName: string) {
    const normalizedRole = this.normalizeText(roleName);

    return (this.currentUser()?.roles ?? []).some(role =>
      this.normalizeText(role.name ?? '').includes(normalizedRole)
    );
  }

  private normalizeText(value: string) {
    return value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  private getErrorMessage(err: HttpErrorResponse, fallback: string) {
    const message = err.error?.message;

    if (Array.isArray(message)) return message.join(' ');
    return message || (err.status ? `${fallback} Error ${err.status}: ${err.statusText}` : fallback);
  }

  private showSuccess(title: string, text: string) {
    Swal.fire({ icon: 'success', title, text, confirmButtonText: 'Aceptar', confirmButtonColor: '#146b50' });
  }

  private showError(title: string, text: string) {
    Swal.fire({ icon: 'error', title, text, confirmButtonText: 'Aceptar', confirmButtonColor: '#b4232f' });
  }
}
