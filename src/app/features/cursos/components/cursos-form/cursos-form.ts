import { CommonModule } from '@angular/common';
import { Component, computed, effect, Inject, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { UserModel } from '../../../users/models/user.model';
import { UsersService } from '../../../users/services/users-service';
import { CursoModel, MateriaModel } from '../../models/curso.model';
import { CursosService } from '../../services/cursos-service';

@Component({
  selector: 'app-cursos-form',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule
  ],
  templateUrl: './cursos-form.html',
  styleUrl: './cursos-form.scss',
})
export class CursosForm {
  private fb = inject(FormBuilder);
  private usersService = inject(UsersService);
  private cursosService = inject(CursosService);

  public users = this.usersService.users;
  public docenteUsers = computed(() =>
    this.users().filter(user => this.hasDocenteRole(user))
  );
  public materias = this.cursosService.materias;
  public isEditMode = false;
  public currentStep = 1;
  public asignaciones: Array<{ docente: UserModel; materia: MateriaModel }> = [];
  public docentesPorMateria: Record<string, UserModel | null> = {};
  private initialMateriasSynced = false;

  public form = this.fb.group({
    nombreCurso: ['', Validators.required],
    directorCurso: [null as number | null],
    isActive: [true, Validators.required],
    users: [[] as UserModel[]],
    materias: [[] as MateriaModel[], Validators.required]
  });

  constructor(
    private dialogRef: MatDialogRef<CursosForm>,
    @Inject(MAT_DIALOG_DATA) public data: CursoModel
  ) {
    effect(() => {
      const materias = this.materias();

      if (!this.data || this.initialMateriasSynced || materias.length === 0) return;

      this.setSelectedMateriasFromData();
      this.initialMateriasSynced = true;
    });
  }

  ngOnInit() {
    this.usersService.loadUsers();
    this.cursosService.loadMaterias();

    if (this.data) {
      this.isEditMode = true;
      this.form.patchValue({
        ...this.data,
        directorCurso: this.data.directorCurso ?? this.getId(this.data.director),
        users: this.getDocentesFromAsignaciones(),
        materias: this.getSelectedMateriasFromData()
      } as any);
      this.asignaciones = this.getSelectedAsignacionesFromData();
      this.hydrateDocentesPorMateria();
      this.setSelectedMateriasFromData();
    }
  }

  compareById(item1: { id?: number; idMateria?: number } | null, item2: { id?: number; idMateria?: number } | null) {
    return item1 && item2
      ? (item1.id ?? item1.idMateria) === (item2.id ?? item2.idMateria)
      : item1 === item2;
  }

  getMateriaName(materia: MateriaModel) {
    return materia.nombreMateria || materia.nombre || materia.name || `Materia ${materia.idMateria ?? materia.id}`;
  }

  getUserName(user: UserModel) {
    return `${user.names} ${user.lastNames}`.trim() || `Usuario ${user.id}`;
  }

  onSave() {
    this.asignaciones = this.buildAsignacionesFromSelections();
    const selectedDocentes = this.getDocentesFromAsignaciones();
    this.form.controls.users.setValue(selectedDocentes);

    if (!this.isCurrentStepValid()) return;

    this.dialogRef.close({
      ...this.form.value,
      users: selectedDocentes,
      asignaciones: this.asignaciones,
      asignacionesIds: this.getAsignacionesIds()
    });
  }

  onCancel() {
    this.dialogRef.close();
  }

  goNext() {
    if (!this.isCurrentStepValid()) {
      this.form.markAllAsTouched();
      return;
    }

    if (this.currentStep === 2) {
      this.syncAsignacionesWithSelectedMaterias();
    }

    this.currentStep += 1;
    this.syncAsignacionesWithSelectedMaterias();
    this.autoselectUniqueDocentes();
  }

  goBack() {
    this.currentStep = Math.max(1, this.currentStep - 1);
  }

  setDocenteForMateria(materia: MateriaModel, docente: UserModel | null) {
    const materiaKey = this.getMateriaKey(materia);

    if (!materiaKey) return;

    this.docentesPorMateria = {
      ...this.docentesPorMateria,
      [materiaKey]: docente
    };

    this.asignaciones = this.buildAsignacionesFromSelections();
  }

  getDocenteForMateria(materia: MateriaModel) {
    const materiaKey = this.getMateriaKey(materia);
    return materiaKey ? this.docentesPorMateria[materiaKey] ?? null : null;
  }

  getSelectedDocentes() {
    return this.getDocentesFromAsignaciones();
  }

  getSelectedMaterias() {
    return this.form.controls.materias.value ?? [];
  }

  getDocentesForMateria(materia: MateriaModel) {
    const materiaId = this.getMateriaId(materia);

    if (materiaId === undefined) return [];

    return this.docenteUsers().filter(user =>
      user.materias?.some(userMateria => this.getMateriaId(userMateria) === materiaId)
    );
  }

  isCurrentStepValid() {
    if (this.currentStep === 1) {
      return !!this.form.controls.nombreCurso.valid
        && !!this.form.controls.isActive.valid
        && this.getSelectedMaterias().length > 0;
    }

    return this.form.valid
      && this.getSelectedMaterias().length > 0
      && this.buildAsignacionesFromSelections().length === this.getSelectedMaterias().length;
  }

  private getId(value: number | object | null | undefined) {
    return this.getAnyId(value, [
      'id',
      'idUsuario',
      'usuarioId',
      'idUser',
      'userId',
      'docenteId'
    ]) ?? null;
  }

  private getAnyId(value: number | object | null | undefined, keys: string[]) {
    if (typeof value === 'number') return value;
    if (!value) return undefined;

    const candidate = value as Record<string, unknown>;

    for (const key of keys) {
      const id = candidate[key];
      if (typeof id === 'number') return id;
      if (typeof id === 'string' && id.trim() !== '' && !Number.isNaN(Number(id))) return Number(id);
    }

    return undefined;
  }

  private hasDocenteRole(user: UserModel) {
    return user.roles?.some(role => role.name.toLowerCase().includes('docente')) ?? false;
  }

  private setSelectedMateriasFromData() {
    this.form.controls.materias.setValue(this.getSelectedMateriasFromData());
  }

  private getSelectedMateriasFromData() {
    const selectedValues = this.getRawSelectedMaterias();
    const allMaterias = this.materias();

    if (selectedValues.length === 0) return [];

    const selectedIds = new Set(
      selectedValues
        .map(materia => this.getMateriaId(materia))
        .filter((id): id is number => id !== undefined)
    );

    if (allMaterias.length === 0) {
      return selectedValues;
    }

    return allMaterias.filter(materia => {
      const id = this.getMateriaId(materia);
      return id !== undefined && selectedIds.has(id);
    });
  }

  private getRawSelectedMaterias(): MateriaModel[] {
    const data = this.data as CursoModel & {
      materia?: MateriaModel[];
      materiasAsignadas?: MateriaModel[];
      materiaIds?: number[];
      materiasIds?: number[];
    };

    const materias = data?.materias ?? data?.materia ?? data?.materiasAsignadas ?? [];
    if (materias.length > 0) return materias;

    const ids = data?.materiaIds ?? data?.materiasIds ?? [];
    return ids.map(id => ({ idMateria: id, nombreMateria: `Materia ${id}`, estado: true }));
  }

  private getMateriaId(materia: MateriaModel) {
    return this.getAnyId(materia, [
      'idMateria',
      'materiaId',
      'id_materia',
      'id'
    ]);
  }

  private getMateriaKey(materia: MateriaModel) {
    const materiaId = this.getMateriaId(materia);
    return materiaId ? String(materiaId) : '';
  }

  private getDocenteId(docente: UserModel) {
    return this.getAnyId(docente, [
      'id',
      'idUsuario',
      'usuarioId',
      'idUser',
      'userId',
      'docenteId'
    ]);
  }

  private getAsignacionesIds() {
    return this.buildAsignacionesFromSelections()
      .map(asignacion => ({
        docenteId: this.getDocenteId(asignacion.docente) ?? 0,
        materiaId: this.getMateriaId(asignacion.materia) ?? 0
      }))
      .filter(asignacion => asignacion.docenteId > 0 && asignacion.materiaId > 0);
  }

  private buildAsignacionesFromSelections() {
    return this.getSelectedMaterias()
      .map(materia => {
        const docente = this.getDocenteForMateria(materia);
        return docente ? { docente, materia } : null;
      })
      .filter((asignacion): asignacion is { docente: UserModel; materia: MateriaModel } => !!asignacion);
  }

  private syncAsignacionesWithSelectedMaterias() {
    const selectedMateriaIds = new Set(
      this.getSelectedMaterias()
        .map(materia => this.getMateriaId(materia))
        .filter((id): id is number => id !== undefined)
    );

    this.asignaciones = this.asignaciones.filter(asignacion => {
      const materiaId = this.getMateriaId(asignacion.materia);
      return materiaId !== undefined && selectedMateriaIds.has(materiaId);
    });

    const nextDocentesPorMateria: Record<string, UserModel | null> = {};

    Object.entries(this.docentesPorMateria).forEach(([materiaKey, docente]) => {
      const materiaId = Number(materiaKey);

      if (docente && selectedMateriaIds.has(materiaId)) {
        nextDocentesPorMateria[materiaKey] = docente;
      }
    });

    this.docentesPorMateria = nextDocentesPorMateria;
  }

  private autoselectUniqueDocentes() {
    const nextDocentesPorMateria = { ...this.docentesPorMateria };

    this.getSelectedMaterias().forEach(materia => {
      const materiaKey = this.getMateriaKey(materia);

      if (!materiaKey || nextDocentesPorMateria[materiaKey]) return;

      const docentes = this.getDocentesForMateria(materia);

      if (docentes.length === 1) {
        nextDocentesPorMateria[materiaKey] = docentes[0];
      }
    });

    this.docentesPorMateria = nextDocentesPorMateria;
    this.asignaciones = this.buildAsignacionesFromSelections();
  }

  private getSelectedAsignacionesFromData() {
    const cursoId = this.data?.id ?? this.data?.idCurso;
    const asignaciones = this.data?.asignaciones?.length
      ? this.data.asignaciones
      : this.cursosService.asignaciones().filter(asignacion => asignacion.cursoId === cursoId);

    return asignaciones
      .map(asignacion => {
        const docente = asignacion.docente
          ?? this.users().find(user => this.getId(user) === asignacion.docenteId)
          ?? this.data.users?.find(user => this.getId(user) === asignacion.docenteId);
        const materia = asignacion.materia
          ?? this.getSelectedMateriasFromData().find(materia => this.getMateriaId(materia) === asignacion.materiaId);

        return docente && materia ? { docente, materia } : null;
      })
      .filter((asignacion): asignacion is { docente: UserModel; materia: MateriaModel } => !!asignacion);
  }

  private hydrateDocentesPorMateria() {
    this.docentesPorMateria = this.asignaciones.reduce((acc, asignacion) => {
      const materiaKey = this.getMateriaKey(asignacion.materia);

      if (materiaKey) {
        acc[materiaKey] = asignacion.docente;
      }

      return acc;
    }, {} as Record<string, UserModel | null>);
  }

  private getDocentesFromAsignaciones() {
    const docentesById = new Map<number, UserModel>();

    this.buildAsignacionesFromSelections().forEach(asignacion => {
      const docenteId = this.getDocenteId(asignacion.docente);

      if (docenteId !== undefined) {
        docentesById.set(docenteId, asignacion.docente);
      }
    });

    if (docentesById.size === 0 && this.asignaciones.length > 0) {
      this.asignaciones.forEach(asignacion => {
        const docenteId = this.getDocenteId(asignacion.docente);

        if (docenteId !== undefined) {
          docentesById.set(docenteId, asignacion.docente);
        }
      });
    }

    return Array.from(docentesById.values());
  }
}
