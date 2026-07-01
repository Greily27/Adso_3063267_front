import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { forkJoin, map, of, switchMap } from 'rxjs';
import Swal from 'sweetalert2';
import { Auth } from '../../core/services/auth';
import { API_BASE_URL } from '../../core/config/api.config';
import { AsignacionModel, CursoModel as CursoAsignacionModel, MateriaModel } from '../cursos/models/curso.model';
import { CursosService } from '../cursos/services/cursos-service';
import { CursoModel as EstudianteCursoModel, EstudianteModel, UpdateEstudianteDto } from '../estudiantes/models/estudiante.model';
import { EstudiantesService } from '../estudiantes/services/estudiantes-service';
import { DiaHorario, HorarioModel } from '../horarios/models/horario.model';
import { HorariosService } from '../horarios/services/horarios-service';
import { UpdateUserDto, UserModel } from '../users/models/user.model';
import { UsersService } from '../users/services/users-service';
import { fileToCompressedImageDataUrl } from '../../shared/utils/image-file.util';

interface BloquePerfilHorario {
  horaInicio: string;
  horaFin: string;
  label?: string;
  tipo?: 'clase' | 'descanso' | 'almuerzo';
}

@Component({
  selector: 'app-perfil',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule
  ],
  templateUrl: './perfil.html',
  styleUrl: './perfil.scss',
})
export class Perfil {
  private fb = inject(FormBuilder);
  private authService = inject(Auth);
  private usersService = inject(UsersService);
  private estudiantesService = inject(EstudiantesService);
  private cursosService = inject(CursosService);
  private horariosService = inject(HorariosService);
  private initialFormPatched = false;
  private loadedHorarioCursoId = 0;

  public documentTypes = [
    { value: 'CC', label: 'Cedula de ciudadania' },
    { value: 'TI', label: 'Tarjeta de identidad' },
    { value: 'CE', label: 'Cedula de extranjeria' },
    { value: 'PA', label: 'Pasaporte' },
    { value: 'RC', label: 'Registro civil' },
    { value: 'NIT', label: 'NIT' }
  ];

  public successMessage = '';
  public errorMessage = '';
  public photoError = '';
  public isSaving = false;
  private brokenProfilePhoto = signal('');
  private selectedPhotoFile = signal<File | null>(null);

  public dias: Array<{ key: DiaHorario; label: string }> = [
    { key: 'lunes', label: 'Lunes' },
    { key: 'martes', label: 'Martes' },
    { key: 'miércoles', label: 'Miércoles' },
    { key: 'jueves', label: 'Jueves' },
    { key: 'viernes', label: 'Viernes' }
  ];

  public bloques: BloquePerfilHorario[] = [
    { horaInicio: '07:00', horaFin: '08:00' },
    { horaInicio: '08:00', horaFin: '09:00' },
    { horaInicio: '09:00', horaFin: '09:15', tipo: 'descanso', label: 'Descanso' },
    { horaInicio: '09:15', horaFin: '10:15' },
    { horaInicio: '10:15', horaFin: '11:15' },
    { horaInicio: '11:15', horaFin: '12:15', tipo: 'almuerzo', label: 'Almuerzo' },
    { horaInicio: '12:15', horaFin: '13:15' },
    { horaInicio: '13:15', horaFin: '14:15' },
    { horaInicio: '14:15', horaFin: '15:15' },
    { horaInicio: '15:15', horaFin: '16:00' }
  ];

  public currentUser = computed(() => {
    const authUser = this.authService.currentUser();
    return this.usersService.users().find(user => user.id === authUser?.id) ?? authUser ?? null;
  });

  public currentStudent = computed(() => {
    const user = this.currentUser();
    const relationId = this.toNumber(user?.estudiante?.id);

    return this.estudiantesService.estudiantes().find(estudiante =>
      this.getEstudianteId(estudiante) === relationId || estudiante.user?.id === user?.id
    ) ?? null;
  });

  public roleLabel = computed(() => {
    const roles = this.currentUser()?.roles ?? [];
    return roles
      .map(role => role.name.replace(/^rol\s+/i, '').trim().toUpperCase())
      .join(', ') || 'SIN ROL';
  });

  public userNameLabel = computed(() => {
    const user = this.currentUser();

    return `${user?.names ?? ''} ${user?.lastNames ?? ''}`.trim()
      || user?.email
      || 'Sin nombre';
  });

  public profilePhoto() {
    return this.getValidPhotoSource(this.form.controls.photo.value)
      || this.getValidPhotoSource(this.currentUser()?.photo)
      || '';
  }

  public hasProfilePhoto() {
    const photo = this.profilePhoto();

    return !!photo && photo !== this.brokenProfilePhoto();
  }

  public isStudentProfile = computed(() =>
    (this.currentUser()?.roles ?? []).some(role => role.name.toLowerCase().includes('estudiante'))
  );

  public isDocenteProfile = computed(() =>
    (this.currentUser()?.roles ?? []).some(role => role.name.toLowerCase().includes('docente'))
  );

  public courseLabel = computed(() => this.getCursoName(this.currentStudent()?.curso));

  public docenteAsignaciones = computed(() => {
    const docenteId = this.currentUser()?.id;
    if (!docenteId || !this.isDocenteProfile()) return [];

    return this.cursosService.asignaciones()
      .filter(asignacion => this.getAsignacionDocenteId(asignacion) === docenteId)
      .map(asignacion => ({
        id: this.getAsignacionId(asignacion),
        curso: this.getCursoName(this.getCursoFromAsignacion(asignacion)),
        materia: this.getMateriaName(asignacion)
      }))
      .sort((first, second) =>
        first.curso.localeCompare(second.curso, 'es', { numeric: true, sensitivity: 'base' })
        || first.materia.localeCompare(second.materia, 'es', { numeric: true, sensitivity: 'base' })
      );
  });

  public studentScheduleCount = computed(() => {
    const cursoId = this.currentStudentCursoId();
    if (!cursoId || !this.isStudentProfile()) return 0;

    return this.horariosService.horarios().filter(horario => this.getHorarioCursoId(horario) === cursoId).length;
  });

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
    tipoDocTutor: [''],
    documentoTutor: [''],
    emailTutor: ['', Validators.email],
    nombreTutor: [''],
    apellidoTutor: [''],
    ocupacionTutor: [''],
    telefonoTutor: ['']
  });

  private syncFormEffect = effect(() => {
    const user = this.currentUser();
    const estudiante = this.currentStudent();

    if (!user || this.initialFormPatched) return;

    this.patchForm(user, estudiante);
    this.initialFormPatched = true;
  });

  private syncStudentScheduleEffect = effect(() => {
    const cursoId = this.currentStudentCursoId();

    if (!this.isStudentProfile() || !cursoId || this.loadedHorarioCursoId === cursoId) return;

    this.loadedHorarioCursoId = cursoId;
    this.horariosService.loadHorariosByCurso(cursoId);
  });

  ngOnInit() {
    this.usersService.loadUsers();
    this.estudiantesService.loadEstudiantes();
    this.cursosService.loadCursos();
    this.cursosService.loadMaterias();
    this.cursosService.loadAsignaciones();
  }

  public getStudentHorario(dia: DiaHorario, bloque: BloquePerfilHorario) {
    const cursoId = this.currentStudentCursoId();
    if (!cursoId) return undefined;

    return this.horariosService.horarios().find(horario =>
      horario.dia === dia
      && horario.horaInicio === bloque.horaInicio
      && horario.horaFin === bloque.horaFin
      && this.getHorarioCursoId(horario) === cursoId
    );
  }

  public getHorarioAsignacion(horario?: HorarioModel) {
    if (!horario) return undefined;

    return horario.asignacion
      ?? this.cursosService.asignaciones().find(asignacion => this.getAsignacionId(asignacion) === horario.asignacionId);
  }

  public getHorarioMateriaName(horario?: HorarioModel) {
    return this.getMateriaName(this.getHorarioAsignacion(horario));
  }

  public getHorarioDocenteName(horario?: HorarioModel) {
    const asignacion = this.getHorarioAsignacion(horario);
    const docente = asignacion?.docente ?? this.usersService.users().find(user => user.id === this.getAsignacionDocenteId(asignacion));

    return docente ? this.getUserDisplayName(docente) : 'Sin docente';
  }

  public isBreakBlock(bloque: BloquePerfilHorario) {
    return bloque.tipo === 'descanso' || bloque.tipo === 'almuerzo';
  }

  public saveProfile() {
    const user = this.currentUser();
    const estudiante = this.currentStudent();

    if (!user?.id) {
      this.errorMessage = 'No se pudo identificar el usuario logueado.';
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    const userDto = this.toUserDto(value, user);
    const selectedRoles = user.roles ?? [];

    this.isSaving = true;
    this.successMessage = '';
    this.errorMessage = '';

    const userUpdate = this.usersService.updateUser(user.id, userDto, selectedRoles).pipe(
      switchMap(updatedUser => {
        const photo = this.selectedPhotoFile();
        if (!photo) return of(updatedUser);

        return this.usersService.updateUserPhoto(user.id, photo).pipe(
          map(photoUpdatedUser => ({
            ...updatedUser,
            ...photoUpdatedUser,
            roles: photoUpdatedUser.roles ?? updatedUser.roles ?? selectedRoles
          }))
        );
      })
    );

    forkJoin({
      user: userUpdate,
      estudiante: this.isStudentProfile() && estudiante
        ? this.estudiantesService.updateEstudiante(this.getEstudianteId(estudiante), this.toEstudianteDto(value))
        : of(null)
    }).subscribe({
      next: ({ user: updatedUser }) => {
        this.isSaving = false;
        this.selectedPhotoFile.set(null);
        this.form.controls.password.setValue('');
        this.authService.updateLocalUser({
          ...user,
          ...updatedUser,
          roles: updatedUser.roles ?? selectedRoles
        });
        this.successMessage = 'Perfil actualizado correctamente.';
        this.showSuccessAlert(this.successMessage);
      },
      error: (err: HttpErrorResponse) => {
        this.isSaving = false;
        console.error('Error al actualizar perfil', err);
        this.errorMessage = this.getErrorMessage(err, 'No se pudo actualizar el perfil.');
        this.showErrorAlert(this.errorMessage);
      }
    });
  }

  public async onPhotoSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) return;

    try {
      this.photoError = '';
      const photo = await fileToCompressedImageDataUrl(file);
      this.selectedPhotoFile.set(file);
      this.brokenProfilePhoto.set('');
      this.form.patchValue({ photo });
    } catch (error) {
      this.photoError = error instanceof Error ? error.message : 'No se pudo cargar la imagen.';
      input.value = '';
    }
  }

  public onProfilePhotoError(event: Event) {
    const image = event.target as HTMLImageElement;
    this.brokenProfilePhoto.set(image.currentSrc || image.src || this.profilePhoto());
  }

  private patchForm(user: UserModel, estudiante: EstudianteModel | null) {
    this.form.patchValue({
      names: user.names ?? '',
      lastNames: user.lastNames ?? '',
      phone: user.phone ?? '',
      address: user.address ?? '',
      docType: user.docType ?? '',
      document: user.document ?? '',
      photo: user.photo ?? '',
      email: user.email ?? '',
      password: '',
      tipoDocTutor: estudiante?.tipoDocTutor ?? '',
      documentoTutor: estudiante?.documentoTutor ?? '',
      emailTutor: estudiante?.emailTutor ?? '',
      nombreTutor: estudiante?.nombreTutor ?? '',
      apellidoTutor: estudiante?.apellidoTutor ?? '',
      ocupacionTutor: estudiante?.ocupacionTutor ?? '',
      telefonoTutor: estudiante?.telefonoTutor ?? ''
    });
  }

  private getValidPhotoSource(photo?: string | null) {
    const cleanPhoto = photo?.trim();
    const normalizedPhoto = cleanPhoto?.toLowerCase();

    if (!cleanPhoto || normalizedPhoto === 'default.jpg' || normalizedPhoto?.includes('colplinista')) {
      return '';
    }

    if (this.isRawBase64Image(cleanPhoto)) {
      return `data:image/${this.getBase64ImageType(cleanPhoto)};base64,${cleanPhoto}`;
    }

    if (
      cleanPhoto.startsWith('data:image/')
      || cleanPhoto.startsWith('http://')
      || cleanPhoto.startsWith('https://')
    ) {
      return cleanPhoto;
    }

    const relativePhotoPath = cleanPhoto
      .replace(/\\/g, '/')
      .replace(/^\.?\//, '')
      .replace(/^\/+/, '');

    const staticPhotoPath = relativePhotoPath.startsWith('uploads/')
      ? relativePhotoPath
      : `uploads/${relativePhotoPath}`;

    return `${API_BASE_URL}/${staticPhotoPath}`;
  }

  private isRawBase64Image(value: string) {
    return /^(\/9j\/|iVBORw0KGgo|R0lGODlh|UklGR)/.test(value);
  }

  private getBase64ImageType(value: string) {
    if (value.startsWith('iVBORw0KGgo')) return 'png';
    if (value.startsWith('R0lGODlh')) return 'gif';
    if (value.startsWith('UklGR')) return 'webp';

    return 'jpeg';
  }

  private toUserDto(value: ReturnType<typeof this.form.getRawValue>, currentUser: UserModel): UpdateUserDto {
    const dto: UpdateUserDto = {
      names: value.names ?? '',
      lastNames: value.lastNames ?? '',
      phone: value.phone ?? '',
      address: value.address ?? '',
      docType: value.docType ?? '',
      document: value.document ?? '',
      email: value.email ?? '',
      isActive: currentUser.isActive,
      roleIds: (currentUser.roles ?? [])
        .map(role => role.id)
        .filter((id): id is number => id !== undefined)
    };

    if (value.password) {
      dto.password = value.password;
    }

    return dto;
  }

  private toEstudianteDto(value: ReturnType<typeof this.form.getRawValue>): UpdateEstudianteDto {
    return {
      tipoDocTutor: value.tipoDocTutor ?? '',
      documentoTutor: value.documentoTutor ?? '',
      emailTutor: value.emailTutor ?? '',
      nombreTutor: value.nombreTutor ?? '',
      apellidoTutor: value.apellidoTutor ?? '',
      ocupacionTutor: value.ocupacionTutor ?? '',
      telefonoTutor: value.telefonoTutor ?? ''
    };
  }

  private getEstudianteId(estudiante: EstudianteModel) {
    return this.toNumber(estudiante.id ?? estudiante.idEstudiante);
  }

  private getCursoName(curso?: EstudianteCursoModel | CursoAsignacionModel | null) {
    if (!curso) return 'Sin curso asignado';
    const cursoRef = curso as EstudianteCursoModel & CursoAsignacionModel;
    return cursoRef.nombreCurso || cursoRef.name || cursoRef.nombre || `Curso ${cursoRef.id ?? cursoRef.idCurso}`;
  }

  private currentStudentCursoId() {
    return this.getCursoId(this.currentStudent()?.curso);
  }

  private getCursoId(curso?: EstudianteCursoModel | CursoAsignacionModel | null) {
    return this.toNumber(curso?.id ?? curso?.idCurso);
  }

  private getCursoFromAsignacion(asignacion?: AsignacionModel) {
    const cursoId = this.getAsignacionCursoId(asignacion);
    return this.cursosService.cursos().find(curso => this.getCursoId(curso) === cursoId) ?? null;
  }

  private getMateriaName(asignacion?: AsignacionModel) {
    const materiaId = this.getAsignacionMateriaId(asignacion);
    const materia = asignacion?.materia
      ?? this.cursosService.materias().find(currentMateria => this.getMateriaId(currentMateria) === materiaId);

    return materia?.nombreMateria || materia?.nombre || materia?.name || `Materia ${materiaId ?? ''}`.trim();
  }

  private getUserDisplayName(user: UserModel) {
    return `${user.names ?? ''} ${user.lastNames ?? ''}`.trim() || user.email || 'Sin nombre';
  }

  private getHorarioCursoId(horario: HorarioModel) {
    return this.getAsignacionCursoId(this.getHorarioAsignacion(horario));
  }

  private getAsignacionId(asignacion?: AsignacionModel) {
    const asignacionRef = asignacion as AsignacionModel & { id?: number | string } | undefined;
    return this.toNumber(asignacionRef?.idAsignacion ?? asignacionRef?.id);
  }

  private getAsignacionCursoId(asignacion?: AsignacionModel) {
    const asignacionRef = asignacion as AsignacionModel & {
      idCurso?: number | string;
      curso?: { id?: number | string; idCurso?: number | string; cursoId?: number | string };
    } | undefined;

    return this.toNumber(
      asignacionRef?.cursoId
      ?? asignacionRef?.idCurso
      ?? asignacionRef?.curso?.id
      ?? asignacionRef?.curso?.idCurso
      ?? asignacionRef?.curso?.cursoId
    );
  }

  private getAsignacionMateriaId(asignacion?: AsignacionModel) {
    const asignacionRef = asignacion as AsignacionModel & {
      idMateria?: number | string;
      materia?: { id?: number | string; idMateria?: number | string; materiaId?: number | string };
    } | undefined;

    return this.toNumber(
      asignacionRef?.materiaId
      ?? asignacionRef?.materiasIdMateria
      ?? asignacionRef?.idMateria
      ?? asignacionRef?.materia?.idMateria
      ?? asignacionRef?.materia?.id
      ?? asignacionRef?.materia?.materiaId
    );
  }

  private getAsignacionDocenteId(asignacion?: AsignacionModel) {
    const asignacionRef = asignacion as AsignacionModel & {
      docente?: { id?: number | string };
    } | undefined;

    return this.toNumber(asignacionRef?.docenteId ?? asignacionRef?.docente?.id);
  }

  private getMateriaId(materia?: MateriaModel) {
    return this.toNumber(materia?.idMateria ?? materia?.id);
  }

  private toNumber(value: number | string | null | undefined) {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : 0;
  }

  private getErrorMessage(err: HttpErrorResponse, fallback: string) {
    const message = err.error?.message;

    if (Array.isArray(message)) return message.join(' ');
    return message || (err.status ? `${fallback} Error ${err.status}: ${err.statusText}` : fallback);
  }

  private showSuccessAlert(message: string) {
    Swal.fire({
      icon: 'success',
      title: 'Perfil actualizado',
      text: message,
      confirmButtonText: 'Aceptar',
      confirmButtonColor: '#146b50'
    });
  }

  private showErrorAlert(message: string) {
    Swal.fire({
      icon: 'error',
      title: 'No se pudo actualizar',
      text: message,
      confirmButtonText: 'Aceptar',
      confirmButtonColor: '#146b50'
    });
  }
}
