import { CommonModule } from '@angular/common';
import { Component, Inject, effect, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MateriaModel } from '../../../materias/models/materia.model';
import { MateriasService } from '../../../materias/services/materias-service';
import { RoleModel } from '../../../roles/models/roles.model';
import { RolesService } from '../../../roles/services/roles-service';
import { UserModel } from '../../models/user.model';
import { fileToCompressedImageDataUrl } from '../../../../shared/utils/image-file.util';

@Component({
  selector: 'app-users-component',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule
  ],
  templateUrl: './users-component.html',
  styleUrl: './users-component.scss',
})
export class UsersComponent {
  private fb = inject(FormBuilder);
  private rolesService = inject(RolesService);
  private materiasService = inject(MateriasService);
  public allRoles = this.rolesService.roles;
  public allMaterias = this.materiasService.materias;
  public isEditMode = false;
  public showMateriasForDocente = false;
  public hidePassword = true;
  public photoError = '';
  private initialMateriasSynced = false;
  public documentTypes = [
    { value: 'CC', label: 'Cedula de ciudadania' },
    { value: 'TI', label: 'Tarjeta de identidad' },
    { value: 'CE', label: 'Cedula de extranjeria' },
    { value: 'PA', label: 'Pasaporte' },
    { value: 'RC', label: 'Registro civil' },
    { value: 'NIT', label: 'NIT' }
  ];

  public form = this.fb.group({
    names: ['', Validators.required],
    lastNames: ['', Validators.required],
    phone: ['', Validators.required],
    address: ['', Validators.required],
    docType: ['', Validators.required],
    document: ['', Validators.required],
    photo: [''],
    email: ['', [Validators.required, Validators.email]],
    password: [''],
    isActive: [true, Validators.required],
    roles: [[] as RoleModel[], Validators.required],
    materias: [[] as MateriaModel[]]
  });

  constructor(
    private dialogRef: MatDialogRef<UsersComponent>,
    @Inject(MAT_DIALOG_DATA) public data: UserModel
  ) {
    effect(() => {
      const materias = this.allMaterias();

      if (!this.data || this.initialMateriasSynced || materias.length === 0) return;
      if (!this.hasDocenteRole(this.data.roles ?? [])) return;

      this.setSelectedMateriasFromData();
      this.initialMateriasSynced = true;
    });
  }

  ngOnInit() {
    this.materiasService.loadMaterias();

    this.form.controls.roles.valueChanges.subscribe(roles => {
      this.updateMateriasField(roles ?? []);
    });

    if (this.data) {
      this.isEditMode = true;
      this.form.patchValue({
        ...this.data,
        materias: this.getSelectedMateriasFromData(),
        password: ''
      } as any);
      this.updateMateriasField(this.form.controls.roles.value ?? []);
      this.setSelectedMateriasFromData();
    } else {
      this.form.get('password')?.addValidators(Validators.required);
    }
  }

  compareRoles = (r1: any, r2: any) => {
    return r1 && r2 ? r1.id === r2.id : r1 === r2;
  };

  compareMaterias = (m1: MateriaModel | null, m2: MateriaModel | null) => {
    return m1 && m2 ? this.getMateriaId(m1) === this.getMateriaId(m2) : m1 === m2;
  };

  getMateriaName(materia: MateriaModel) {
    return materia.nombreMateria || `Materia ${materia.idMateria}`;
  }

  onSave() {
    if (this.form.valid) {
      const value = this.form.value;
      if (this.isEditMode && !value.password) delete value.password;
      this.dialogRef.close(value);
    }
  }

  onCancel() {
    this.dialogRef.close();
  }

  async onPhotoSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) return;

    try {
      this.photoError = '';
      const photo = await fileToCompressedImageDataUrl(file);
      this.form.patchValue({ photo });
    } catch (error) {
      this.photoError = error instanceof Error ? error.message : 'No se pudo cargar la imagen.';
      input.value = '';
    }
  }

  private updateMateriasField(roles: RoleModel[]) {
    this.showMateriasForDocente = this.hasDocenteRole(roles);
    const materiasControl = this.form.controls.materias;

    if (this.showMateriasForDocente) {
      materiasControl.addValidators(Validators.required);
    } else {
      materiasControl.clearValidators();
      materiasControl.setValue([]);
    }

    materiasControl.updateValueAndValidity({ emitEvent: false });
  }

  private hasDocenteRole(roles: RoleModel[]) {
    return roles.some(role => this.normalizeRoleName(role.name).includes('docente'));
  }

  private normalizeRoleName(roleName: string) {
    return roleName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]/g, '')
      .toLowerCase();
  }

  getMateriaId(materia: MateriaModel) {
    return materia.idMateria ?? (materia as MateriaModel & { id?: number }).id;
  }

  private setSelectedMateriasFromData() {
    const selectedMaterias = this.getSelectedMateriasFromData();
    this.form.controls.materias.setValue(selectedMaterias);
  }

  private getSelectedMateriasFromData() {
    const selectedValues = this.getRawSelectedMaterias();
    const allMaterias = this.allMaterias();

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
    const data = this.data as UserModel & {
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
}
