import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { AsignacionModel } from '../../../cursos/models/curso.model';
import { CreateHorarioDto, DiaHorario, HorarioModel } from '../../models/horario.model';

export interface HorarioFormData {
  horario?: HorarioModel;
  dia: DiaHorario;
  horaInicio: string;
  horaFin: string;
  asignaciones: AsignacionModel[];
  getAsignacionLabel: (asignacion: AsignacionModel) => string;
}

@Component({
  selector: 'app-horario-form',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule
  ],
  templateUrl: './horario-form.html',
  styleUrl: './horario-form.scss',
})
export class HorarioForm {
  private fb = inject(FormBuilder);
  private dialogRef = inject(MatDialogRef<HorarioForm>);
  public data = inject<HorarioFormData>(MAT_DIALOG_DATA);

  public form = this.fb.group({
    dia: [this.data.dia, Validators.required],
    horaInicio: [this.data.horaInicio, Validators.required],
    horaFin: [this.data.horaFin, Validators.required],
    asignacionId: [this.data.horario?.asignacionId ?? null as number | null, Validators.required]
  });

  get isEditMode() {
    return !!this.data.horario;
  }

  get canSave() {
    return this.form.valid;
  }

  onSave() {
    this.form.markAllAsTouched();
    if (!this.canSave) return;

    const value = this.form.getRawValue();
    const dto: CreateHorarioDto = {
      dia: value.dia as DiaHorario,
      horaInicio: value.horaInicio!,
      horaFin: value.horaFin!,
      asignacionId: Number(value.asignacionId)
    };

    this.dialogRef.close(dto);
  }

  onCancel() {
    this.dialogRef.close();
  }

  getAsignacionId(asignacion: AsignacionModel) {
    return asignacion.idAsignacion ?? (asignacion as AsignacionModel & { id?: number }).id ?? 0;
  }
}
