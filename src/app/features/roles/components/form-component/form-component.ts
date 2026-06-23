import { Component, inject, Inject } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { RoleModel } from '../../models/roles.model';
import { CommonModule } from '@angular/common';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { ModulesService } from '../../../modules/services/modules';
import { Auth } from '../../../../core/services/auth';

@Component({
  selector: 'app-form-component',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    CommonModule,
    MatSelectModule,
    MatIconModule
  ],
  templateUrl: './form-component.html',
  styleUrl: './form-component.scss',
})
export class FormComponent {

  roleForm: FormGroup;
  isEditMode: boolean = false;
  private moduleService = inject(ModulesService);
  private authService = inject(Auth);
  public allModules = this.moduleService.modules;

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<FormComponent>,
    @Inject(MAT_DIALOG_DATA) public data: RoleModel
  ) {
    this.roleForm = this.fb.group({
      name: ['', [Validators.required]],
      description: ['', [Validators.required]],
      modules: [[], Validators.required]
    });
  }

  ngOnInit(): void {
    if (this.authService.userModules().includes('modules')) {
      this.moduleService.loadModules();
    }

    // Si 'data' existe, estamos en modo edición
    if (this.data) {
      this.isEditMode = true;
      this.roleForm.patchValue(this.data);
    }
  }

  compareModules(m1: any, m2: any): boolean {
    // Si ambos existen, comparamos por ID; si no, comparación simple
    return m1 && m2 ? m1.id === m2.id : m1 === m2;
  }

  onSave() {
    if (this.roleForm.valid) {
      this.dialogRef.close(this.roleForm.value);
      console.log('entra');
      
    }
  }

  onCancel() {
    this.dialogRef.close();
  }

}
