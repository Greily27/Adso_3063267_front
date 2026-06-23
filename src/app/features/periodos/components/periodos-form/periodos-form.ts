import { CommonModule } from '@angular/common';
import { Component, Inject, inject } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { PeriodoModel } from '../../models/periodo.model';

@Component({
  selector: 'app-periodos-form',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule
  ],
  templateUrl: './periodos-form.html',
  styleUrl: './periodos-form.scss',
})
export class PeriodosForm {
  private fb = inject(FormBuilder);
  public isEditMode = false;

  public form = this.fb.group({
    nombrePeriodo: ['', Validators.required],
    fechaInicial: ['', Validators.required],
    fechaFinal: ['', Validators.required],
  }, { validators: this.dateRangeValidator });

  constructor(
    private dialogRef: MatDialogRef<PeriodosForm>,
    @Inject(MAT_DIALOG_DATA) public data: PeriodoModel
  ) {}

  ngOnInit() {
    if (this.data) {
      this.isEditMode = true;
      this.form.patchValue({
        nombrePeriodo: this.data.nombrePeriodo ?? '',
        fechaInicial: this.toDateInputValue(this.data.fechaInicial),
        fechaFinal: this.toDateInputValue(this.data.fechaFinal),
      });
    }
  }

  onSave() {
    if (this.form.valid) {
      const value = this.form.value;
      this.dialogRef.close({
        nombrePeriodo: value.nombrePeriodo?.trim() ?? '',
        fechaInicial: value.fechaInicial ?? '',
        fechaFinal: value.fechaFinal ?? '',
      });
    }
  }

  onCancel() {
    this.dialogRef.close();
  }

  private dateRangeValidator(control: AbstractControl): ValidationErrors | null {
    const fechaInicial = control.get('fechaInicial')?.value;
    const fechaFinal = control.get('fechaFinal')?.value;

    if (!fechaInicial || !fechaFinal) return null;

    return new Date(fechaFinal) < new Date(fechaInicial)
      ? { invalidDateRange: true }
      : null;
  }

  private toDateInputValue(value?: string) {
    if (!value) return '';

    return value.includes('T') ? value.split('T')[0] : value;
  }
}
