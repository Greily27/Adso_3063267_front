import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { AuditorioModel } from '../../models/auditorio.model';

@Component({
  selector: 'app-auditorio-form',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule
  ],
  templateUrl: './auditorio-form.html',
  styleUrl: './auditorio-form.scss',
})
export class AuditorioForm {
  public form;

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<AuditorioForm>,
    @Inject(MAT_DIALOG_DATA) public data: AuditorioModel | null
  ) {
    this.form = this.fb.group({
      nombre: [data?.nombre ?? '', [Validators.required, Validators.minLength(3)]]
    });
  }

  save() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.dialogRef.close({
      nombre: this.form.value.nombre?.trim() ?? ''
    });
  }
}
