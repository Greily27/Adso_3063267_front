import { CommonModule } from '@angular/common';
import { Component, Inject, effect, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { CursosService } from '../../../cursos/services/cursos-service';
import { CursoModel } from '../../../cursos/models/curso.model';
import { MateriaModel } from '../../models/materia.model';

@Component({
  selector: 'app-materias-form',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule
  ],
  templateUrl: './materias-form.html',
  styleUrl: './materias-form.scss',
})
export class MateriasForm {
  private fb = inject(FormBuilder);
  private cursosService = inject(CursosService);

  public cursos = this.cursosService.cursos;
  public asignaciones = this.cursosService.asignaciones;
  public isEditMode = false;
  private initialCoursesSynced = false;

  public form = this.fb.group({
    nombreMateria: ['', Validators.required],
    estado: [true, Validators.required],
    cursos: [[] as CursoModel[]],
  });

  constructor(
    private dialogRef: MatDialogRef<MateriasForm>,
    @Inject(MAT_DIALOG_DATA) public data: MateriaModel
  ) {
    effect(() => {
      const cursos = this.cursos();

      this.asignaciones();

      if (!this.data || cursos.length === 0 || this.form.controls.cursos.dirty) return;

      const selectedCourses = this.getSelectedCoursesFromData();
      if (this.initialCoursesSynced && this.hasSameSelectedCourses(selectedCourses)) return;

      this.form.controls.cursos.setValue(selectedCourses);
      this.initialCoursesSynced = true;
    });
  }

  ngOnInit() {
    this.cursosService.loadCursos();
    this.cursosService.loadAsignaciones();

    if (this.data) {
      this.isEditMode = true;
      this.form.patchValue({
        nombreMateria: this.data.nombreMateria ?? '',
        estado: this.data.estado ?? true,
      });
    }
  }

  compareById = (item1: CursoModel | null, item2: CursoModel | null) => {
    if (!item1 || !item2) return item1 === item2;

    const item1Id = this.normalizeId(this.getCursoId(item1));
    const item2Id = this.normalizeId(this.getCursoId(item2));

    if (item1Id !== undefined || item2Id !== undefined) {
      return item1Id === item2Id;
    }

    return this.normalizeName(this.getCursoName(item1)) === this.normalizeName(this.getCursoName(item2));
  };

  getCursoName(curso: CursoModel) {
    return curso.nombreCurso || `Curso ${this.getCursoId(curso)}`;
  }

  onSave() {
    if (this.form.valid) {
      const value = this.form.value;
      this.dialogRef.close({
        nombreMateria: value.nombreMateria?.trim() ?? '',
        estado: value.estado ?? true,
        cursos: this.getSelectedCourses(),
      });
    }
  }

  onCancel() {
    this.dialogRef.close();
  }

  private getCursoId(curso: { id?: number | string; idCurso?: number | string; cursoId?: number | string }) {
    const cursoRef = curso as {
      id?: number | string;
      idCurso?: number | string;
      cursoId?: number | string;
      curso?: { id?: number | string; idCurso?: number | string; cursoId?: number | string };
    };

    return cursoRef.id ?? cursoRef.idCurso ?? cursoRef.cursoId ?? cursoRef.curso?.id ?? cursoRef.curso?.idCurso ?? cursoRef.curso?.cursoId;
  }

  private getSelectedCourses() {
    return this.form.controls.cursos.value ?? [];
  }

  private getSelectedCoursesFromData() {
    const selectedIds = new Set(
      this.getRawSelectedCourseIds()
        .map(id => this.normalizeId(id))
        .filter((id): id is string => id !== undefined)
    );
    const selectedNames = new Set(this.getRawSelectedCourseNames().map(name => this.normalizeName(name)));
    if (selectedIds.size === 0 && selectedNames.size === 0) return [];

    return this.cursos().filter(curso => {
      const cursoId = this.normalizeId(this.getCursoId(curso));
      const cursoName = this.normalizeName(this.getCursoName(curso));

      return (cursoId !== undefined && selectedIds.has(cursoId)) || selectedNames.has(cursoName);
    });
  }

  private getRawSelectedCourseIds() {
    const cursos = this.data?.cursos ?? [];
    const idsFromRelations = cursos
      .map(curso => this.getCursoId(curso))
      .filter((id): id is number | string => id !== undefined);

    if (idsFromRelations.length > 0) return idsFromRelations;
    if (this.data?.cursoIds?.length) return this.data.cursoIds;
    if (this.data?.cursosIds?.length) return this.data.cursosIds;

    const materiaId = this.normalizeId(this.data?.idMateria);
    if (!materiaId) return [];

    const idsFromDataAsignaciones = this.data.asignaciones
      ?.filter(asignacion => this.getAsignacionMateriaId(asignacion) === materiaId && this.getAsignacionCursoId(asignacion) !== undefined)
      .map(asignacion => this.getAsignacionCursoId(asignacion)!);

    if (idsFromDataAsignaciones?.length) return idsFromDataAsignaciones;

    const idsFromAsignaciones = this.asignaciones()
      .filter(asignacion => this.getAsignacionMateriaId(asignacion) === materiaId)
      .map(asignacion => this.getAsignacionCursoId(asignacion))
      .filter((id): id is number | string => id !== undefined);

    if (idsFromAsignaciones.length > 0) return idsFromAsignaciones;

    return this.cursos()
      .filter(curso => (curso.materias ?? []).some(materia => this.getMateriaId(materia) === materiaId))
      .map(curso => this.getCursoId(curso))
      .filter((id): id is number | string => id !== undefined);
  }

  private getRawSelectedCourseNames() {
    const materiaWithLabel = this.data as MateriaModel & { cursosLabel?: string };
    const namesFromRelations = (this.data?.cursos ?? [])
      .map(curso => this.getCursoNameFromAny(curso))
      .filter((name): name is string => !!name);
    const namesFromLabel = materiaWithLabel.cursosLabel
      ?.split(',')
      .map(name => name.trim())
      .filter(Boolean) ?? [];

    return [...namesFromRelations, ...namesFromLabel];
  }

  private getCursoNameFromAny(curso: unknown) {
    const cursoRef = curso as { nombreCurso?: string; nombre?: string; name?: string; curso?: { nombreCurso?: string; nombre?: string; name?: string } };

    return cursoRef.nombreCurso ?? cursoRef.nombre ?? cursoRef.name ?? cursoRef.curso?.nombreCurso ?? cursoRef.curso?.nombre ?? cursoRef.curso?.name;
  }

  private getMateriaId(materia: { id?: number | string; idMateria?: number | string; materiaId?: number | string }) {
    const materiaRef = materia as {
      id?: number | string;
      idMateria?: number | string;
      materiaId?: number | string;
      materiasIdMateria?: number | string;
      materia?: { id?: number | string; idMateria?: number | string; materiaId?: number | string };
    };

    return this.normalizeId(materiaRef.idMateria ?? materiaRef.id ?? materiaRef.materiaId ?? materiaRef.materiasIdMateria ?? materiaRef.materia?.idMateria ?? materiaRef.materia?.id ?? materiaRef.materia?.materiaId);
  }

  private getAsignacionCursoId(asignacion: unknown) {
    const asignacionRef = asignacion as {
      cursoId?: number | string;
      idCurso?: number | string;
      curso?: { id?: number | string; idCurso?: number | string; cursoId?: number | string };
    };

    return asignacionRef.cursoId ?? asignacionRef.idCurso ?? asignacionRef.curso?.id ?? asignacionRef.curso?.idCurso ?? asignacionRef.curso?.cursoId;
  }

  private getAsignacionMateriaId(asignacion: unknown) {
    const asignacionRef = asignacion as {
      materiaId?: number | string;
      materiasIdMateria?: number | string;
      idMateria?: number | string;
      materia?: { id?: number | string; idMateria?: number | string; materiaId?: number | string };
    };

    return this.normalizeId(
      asignacionRef.materiaId
      ?? asignacionRef.materiasIdMateria
      ?? asignacionRef.idMateria
      ?? asignacionRef.materia?.idMateria
      ?? asignacionRef.materia?.id
      ?? asignacionRef.materia?.materiaId
    );
  }

  private hasSameSelectedCourses(selectedCourses: CursoModel[]) {
    const currentIds = this.getSelectedCourses()
      .map(curso => this.getCursoId(curso))
      .map(id => this.normalizeId(id))
      .filter((id): id is string => id !== undefined)
      .sort();
    const nextIds = selectedCourses
      .map(curso => this.getCursoId(curso))
      .map(id => this.normalizeId(id))
      .filter((id): id is string => id !== undefined)
      .sort();

    return currentIds.length === nextIds.length
      && currentIds.every((id, index) => id === nextIds[index]);
  }

  private normalizeId(id: number | string | undefined | null) {
    if (id === undefined || id === null || id === '') return undefined;

    return String(id).trim();
  }

  private normalizeName(name: string | undefined | null) {
    return (name ?? '').trim().toLowerCase();
  }
}
