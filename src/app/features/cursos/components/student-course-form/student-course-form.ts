import { CommonModule } from '@angular/common';
import { Component, Inject, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { CursosService } from '../../services/cursos-service';
import { CursoModel } from '../../models/curso.model';
import { EstudianteModel } from '../../../estudiantes/models/estudiante.model';

@Component({
  selector: 'app-student-course-form',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatSelectModule,
    MatButtonModule
  ],
  templateUrl: './student-course-form.html',
  styleUrl: './student-course-form.scss',
})
export class StudentCourseForm {
  private fb = inject(FormBuilder);
  private cursosService = inject(CursosService);

  public cursos = this.cursosService.cursos;
  public form = this.fb.group({
    curso: [null as CursoModel | null, Validators.required],
  });

  constructor(
    private dialogRef: MatDialogRef<StudentCourseForm>,
    @Inject(MAT_DIALOG_DATA) public data: EstudianteModel
  ) {}

  ngOnInit() {
    this.cursosService.loadCursos();
    this.form.patchValue({ curso: this.data.curso as CursoModel });
  }

  compareById(item1: { id?: number; idCurso?: number } | null, item2: { id?: number; idCurso?: number } | null) {
    return item1 && item2
      ? (item1.id ?? item1.idCurso) === (item2.id ?? item2.idCurso)
      : item1 === item2;
  }

  getCursoName(curso: CursoModel) {
    return curso.nombreCurso || `Curso ${curso.id ?? curso.idCurso}`;
  }

  onSave() {
    if (this.form.valid) {
      this.dialogRef.close(this.form.value.curso);
    }
  }

  onCancel() {
    this.dialogRef.close();
  }
}
