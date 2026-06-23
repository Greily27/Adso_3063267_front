import { CommonModule } from '@angular/common';
import { Component, computed, effect, Inject, inject, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { Subscription } from 'rxjs';
import { CursosService } from '../../../cursos/services/cursos-service';
import { UsersService } from '../../../users/services/users-service';
import { UserModel } from '../../../users/models/user.model';
import { CursoModel, EstudianteModel } from '../../models/estudiante.model';
import { fileToCompressedImageDataUrl } from '../../../../shared/utils/image-file.util';

@Component({
  selector: 'app-estudiantes-form',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule
  ],
  templateUrl: './estudiantes-form.html',
  styleUrl: './estudiantes-form.scss',
})
export class EstudiantesForm implements OnInit {
  private fb = inject(FormBuilder);
  private usersService = inject(UsersService);
  private cursosService = inject(CursosService);

  public users = this.usersService.users;
  public cursos = this.cursosService.cursos;
  public isEditMode = false;
  public photoError = '';
  public documentTypes = [
    { value: 'CC', label: 'Cedula de ciudadania' },
    { value: 'TI', label: 'Tarjeta de identidad' },
    { value: 'CE', label: 'Cedula de extranjeria' },
    { value: 'PA', label: 'Pasaporte' },
    { value: 'RC', label: 'Registro civil' },
    { value: 'NIT', label: 'NIT' }
  ];
  private userSubscription?: Subscription;
  private initialCursoSynced = false;

  // En tu componente
  public usuariosFiltrados = computed(() => {
    const listaUsuarios = this.usersService.users();
    return listaUsuarios.filter(user =>
      // .some devuelve true si al menos un rol coincide con el ID
      user.roles.some(role => role.id === 4)
    );
  });


  // ngOnInit() {}

  public form = this.fb.group({
    tipoDocTutor: ['', Validators.required],
    documentoTutor: ['', Validators.required],
    emailTutor: ['', [Validators.required, Validators.email]],
    nombreTutor: ['', Validators.required],
    apellidoTutor: ['', Validators.required],
    ocupacionTutor: ['', Validators.required],
    telefonoTutor: ['', Validators.required],
    user: this.fb.control<UserModel | null>(null),
    names: [''],
    lastNames: [''],
    phone: [''],
    address: [''],
    docType: [''],
    document: [''],
    photo: [''],
    email: ['', Validators.email],
    isActive: [true, Validators.required],
    password: ['', Validators.required],
    cursoId: this.fb.control<CursoModel | null>(null, Validators.required),
  });

  constructor(
    private dialogRef: MatDialogRef<EstudiantesForm>,
    @Inject(MAT_DIALOG_DATA) public data: EstudianteModel
  ) {
    effect(() => {
      const cursos = this.cursos();

      if (!this.data || this.initialCursoSynced || cursos.length === 0) return;

      this.form.controls.cursoId.setValue(this.getSelectedCursoFromData());
      this.initialCursoSynced = true;
    });
  }

  ngOnInit() {
    this.cursosService.loadCursos();
    this.usersService.loadUsers();

    this.userSubscription = this.form.controls.user.valueChanges.subscribe(user => {
      this.patchUserFields(user);
    });

    if (this.data) {
      this.isEditMode = true;
      this.form.controls.password.clearValidators();
      this.form.controls.password.updateValueAndValidity();
      this.form.patchValue({
        tipoDocTutor: this.data.tipoDocTutor,
        documentoTutor: this.data.documentoTutor,
        emailTutor: this.data.emailTutor,
        nombreTutor: this.data.nombreTutor,
        apellidoTutor: this.data.apellidoTutor,
        ocupacionTutor: this.data.ocupacionTutor,
        telefonoTutor: this.data.telefonoTutor,
        user: this.data.user,
        cursoId: this.getSelectedCursoFromData()
      });
      this.patchUserFields(this.data.user);
    }
  }

  ngOnDestroy() {
    this.userSubscription?.unsubscribe();
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
      this.dialogRef.close(this.form.value);
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

  private patchUserFields(user: UserModel | null) {
    this.form.patchValue({
      names: user?.names ?? '',
      lastNames: user?.lastNames ?? '',
      phone: user?.phone ?? '',
      address: user?.address ?? '',
      docType: user?.docType ?? '',
      document: user?.document ?? '',
      photo: user?.photo ?? '',
      email: user?.email ?? '',
      isActive: user?.isActive ?? true,
      password: ''
    }, { emitEvent: false });
  }

  private getSelectedCursoFromData() {
    const cursoId = this.data?.curso?.id ?? this.data?.curso?.idCurso;

    if (!cursoId) return this.data?.curso ?? null;

    return this.cursos().find(curso => (curso.id ?? curso.idCurso) === cursoId) ?? this.data.curso;
  }
}
