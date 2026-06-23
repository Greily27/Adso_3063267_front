import { CommonModule } from '@angular/common';
import { Component, Inject, computed, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { Auth } from '../../../../core/services/auth';
import { CursosService } from '../../../cursos/services/cursos-service';
import { AsignacionModel } from '../../../cursos/models/curso.model';
import { GuiaModel } from '../../models/guia.model';

@Component({
  selector: 'app-guias-form',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule
  ],
  templateUrl: './guias-form.html',
  styleUrl: './guias-form.scss',
})
export class GuiasForm {
  private fb = inject(FormBuilder);
  private cursosService = inject(CursosService);
  private authService = inject(Auth);

  public cursos = this.cursosService.cursos;
  public materias = this.cursosService.materias;
  public asignaciones = this.cursosService.asignaciones;
  public currentUser = this.authService.currentUser;
  public isEditMode = false;
  public selectedFileName = '';

  public isDocenteMode = computed(() =>
    this.hasRole('docente') && !this.hasRole('admin') && !this.hasRole('administrador')
  );

  public asignacionesDisponibles = computed(() => {
    const docenteId = this.currentUser()?.id;
    if (!docenteId || !this.isDocenteMode()) return this.asignaciones();

    return this.asignaciones().filter(asignacion => asignacion.docenteId === docenteId || asignacion.docente?.id === docenteId);
  });

  public form = this.fb.group({
    titulo: ['', Validators.required],
    descripcion: ['', Validators.required],
    archivoUrl: [''],
    archivo: [null as File | null],
    estado: [true, Validators.required],
    asignacionId: [null as number | null, Validators.required],
  });

  constructor(
    private dialogRef: MatDialogRef<GuiasForm>,
    @Inject(MAT_DIALOG_DATA) public data: GuiaModel | null
  ) {}

  ngOnInit() {
    this.cursosService.loadCursos();
    this.cursosService.loadMaterias();
    this.cursosService.loadAsignaciones();

    if (!this.data) return;

    this.isEditMode = true;
    this.form.patchValue({
      titulo: this.data.titulo ?? this.data.title ?? '',
      descripcion: this.data.descripcion ?? this.data.description ?? '',
      archivoUrl: this.data.archivoUrl ?? this.data.fileUrl ?? this.data.url ?? '',
      estado: this.data.estado ?? this.data.isActive ?? true,
      asignacionId: this.data.asignacionId ?? this.data.asignacion?.idAsignacion ?? null,
    });
  }

  getCursoId(curso: { id?: number; idCurso?: number; cursoId?: number }) {
    return curso.id ?? curso.idCurso ?? curso.cursoId;
  }

  getCursoName(curso: { nombreCurso?: string; nombre?: string; name?: string; id?: number; idCurso?: number }) {
    return curso.nombreCurso ?? curso.nombre ?? curso.name ?? `Curso ${curso.id ?? curso.idCurso ?? ''}`.trim();
  }

  getMateriaId(materia: { id?: number; idMateria?: number; materiaId?: number }) {
    return materia.idMateria ?? materia.id ?? materia.materiaId;
  }

  getMateriaName(materia: { nombreMateria?: string; nombre?: string; name?: string; id?: number; idMateria?: number }) {
    return materia.nombreMateria ?? materia.nombre ?? materia.name ?? `Materia ${materia.idMateria ?? materia.id ?? ''}`.trim();
  }

  getAsignacionId(asignacion: AsignacionModel) {
    return asignacion.idAsignacion ?? (asignacion as AsignacionModel & { id?: number }).id ?? 0;
  }

  getAsignacionLabel(asignacion: AsignacionModel) {
    const curso = asignacion.curso ?? this.cursos().find(item => this.getCursoId(item) === asignacion.cursoId);
    const materia = asignacion.materia ?? this.materias().find(item => this.getMateriaId(item) === asignacion.materiaId);
    const docente = asignacion.docente;
    const docenteName = docente
      ? `${docente.names ?? ''} ${docente.lastNames ?? ''}`.trim() || docente.email
      : `Docente ${asignacion.docenteId}`;

    return `${this.getCursoName(curso ?? { id: asignacion.cursoId })} - ${this.getMateriaName(materia ?? { idMateria: asignacion.materiaId })} - ${docenteName}`;
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;

    this.form.patchValue({ archivo: file });
    this.selectedFileName = file?.name ?? '';
  }

  onSave() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    if (!this.isEditMode && !value.archivo && !(value.archivoUrl ?? '').trim()) {
      this.form.get('archivoUrl')?.setErrors({ required: true });
      this.form.get('archivoUrl')?.markAsTouched();
      return;
    }

    const selectedAsignacion = this.asignacionesDisponibles().find(asignacion => this.getAsignacionId(asignacion) === value.asignacionId);

    this.dialogRef.close({
      nombreGuia: (value.titulo ?? '').trim(),
      titulo: (value.titulo ?? '').trim(),
      descripcion: (value.descripcion ?? '').trim(),
      archivoUrl: (value.archivoUrl ?? '').trim(),
      archivo: value.archivo,
      estado: value.estado,
      asignacionId: value.asignacionId,
      cursoId: selectedAsignacion?.cursoId ?? null,
      materiaId: selectedAsignacion?.materiaId ?? null,
      docenteId: selectedAsignacion?.docenteId ?? null,
    });
  }

  onCancel() {
    this.dialogRef.close();
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
}
