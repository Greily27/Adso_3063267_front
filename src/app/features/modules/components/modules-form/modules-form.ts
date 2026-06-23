// import { Component } from '@angular/core';
import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { ModuleModel } from '../../models/module.model';

@Component({
  selector: 'app-modules-form',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule
  ],
  templateUrl: './modules-form.html',
  styleUrl: './modules-form.scss',
})
export class ModulesForm {

  form: FormGroup;
  isEditMode: boolean = false;
  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<ModulesForm>,
    @Inject(MAT_DIALOG_DATA) public data: ModuleModel
  ) {
    this.form = this.fb.group({
      name: ['', [Validators.required]],
      description: ['', [Validators.required]]
    });
  }

  ngOnInit(): void {
    // Si 'data' existe, estamos en modo edición
    if (this.data) {
      this.isEditMode = true;
      this.form.patchValue(this.data);
    }
  }

  onSave() {
    if (this.form.valid) {
      const value = this.form.value;
      this.dialogRef.close({
        name: value.name.trim().toLowerCase(),
        description: value.description?.trim() ?? ''
      });
    }
  }

  onCancel() {
    this.dialogRef.close();
  }

}
