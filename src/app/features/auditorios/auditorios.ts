import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import Swal from 'sweetalert2';
import { Auth } from '../../core/services/auth';
import { AsignacionModel } from '../cursos/models/curso.model';
import { CursosService } from '../cursos/services/cursos-service';
import { UserModel } from '../users/models/user.model';
import { UsersService } from '../users/services/users-service';
import { AuditorioModel, CreateReservaAuditorioDto, ReservaAuditorioModel } from './models/auditorio.model';
import { AuditoriosService } from './services/auditorios-service';
import { AuditorioForm } from './components/auditorio-form/auditorio-form';

@Component({
  selector: 'app-auditorios',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule
  ],
  templateUrl: './auditorios.html',
  styleUrl: './auditorios.scss',
})
export class Auditorios {
  private fb = inject(FormBuilder);
  private authService = inject(Auth);
  private auditoriosService = inject(AuditoriosService);
  private usersService = inject(UsersService);
  private cursosService = inject(CursosService);
  private dialog = inject(MatDialog);

  public auditorios = this.auditoriosService.auditorios;
  public reservas = this.auditoriosService.reservas;
  public users = this.usersService.users;
  public asignaciones = this.cursosService.asignaciones;
  public cursos = this.cursosService.cursos;
  public errorMessage = signal('');
  public editingReservaId = signal<number | null>(null);

  public reservaForm = this.fb.group({
    idusuario: [this.authService.currentUser()?.id ?? null as number | null, Validators.required],
    idauditorio: [null as number | null, Validators.required],
    fecha: ['', Validators.required],
    hora_inicio: ['', Validators.required],
    hora_fin: ['', Validators.required],
    idasignacion: [null as number | null]
  });

  public reservasOrdenadas = computed(() =>
    [...this.reservas()].sort((a, b) =>
      new Date(a.fecha_hora).getTime() - new Date(b.fecha_hora).getTime()
    )
  );

  constructor() {
    this.usersService.loadUsers();
    this.cursosService.loadCursos();
    this.cursosService.loadAsignaciones();
  }

  openAuditorioDialog(auditorio?: AuditorioModel) {
    const dialogRef = this.dialog.open(AuditorioForm, {
      width: '460px',
      maxWidth: '92vw',
      data: auditorio ?? null
    });

    dialogRef.afterClosed().subscribe((result?: { nombre: string }) => {
      if (!result) return;

      const request = auditorio
        ? this.auditoriosService.updateAuditorio(auditorio.idauditorio, result)
        : this.auditoriosService.createAuditorio(result);

      this.errorMessage.set('');
      request.subscribe({
        next: () => this.showSuccess(auditorio ? 'Auditorio actualizado' : 'Auditorio creado'),
        error: err => this.handleError(err, 'No se pudo guardar el auditorio.')
      });
    });
  }

  editAuditorio(auditorio: AuditorioModel) {
    this.openAuditorioDialog(auditorio);
  }

  async deleteAuditorio(auditorio: AuditorioModel) {
    const confirmed = await this.confirmDelete(`Eliminar ${auditorio.nombre}`, 'Tambien podria afectar reservas asociadas.');
    if (!confirmed) return;

    this.auditoriosService.deleteAuditorio(auditorio.idauditorio).subscribe({
      next: () => this.showSuccess('Auditorio eliminado'),
      error: err => this.handleError(err, 'No se pudo eliminar el auditorio.')
    });
  }

  saveReserva() {
    if (this.reservaForm.invalid) {
      this.errorMessage.set('Selecciona usuario, auditorio, fecha, hora de inicio y hora de fin.');
      return;
    }

    if (!this.isValidTimeRange()) {
      this.errorMessage.set('La hora de fin debe ser mayor que la hora de inicio.');
      return;
    }

    const rawValue = this.reservaForm.getRawValue();
    const payload = this.buildReservaPayload(rawValue);
    const editingId = this.editingReservaId();
    const request = editingId
      ? this.auditoriosService.updateReserva(editingId, payload)
      : this.auditoriosService.createReserva(payload);

    this.errorMessage.set('');
    request.subscribe({
      next: () => {
        this.cancelReservaEdit();
        this.auditoriosService.loadReservas();
        this.showSuccess(editingId ? 'Reserva actualizada' : 'Reserva creada');
      },
      error: err => this.handleError(err, 'No se pudo guardar la reserva.')
    });
  }

  editReserva(reserva: ReservaAuditorioModel) {
    this.editingReservaId.set(reserva.idreserva);
    this.reservaForm.patchValue({
      idusuario: reserva.idusuario,
      idauditorio: reserva.idauditorio,
      ...this.toLocalRangeParts(reserva),
      idasignacion: reserva.idasignacion
    });
  }

  cancelReservaEdit() {
    this.editingReservaId.set(null);
    this.reservaForm.reset({
      idusuario: this.authService.currentUser()?.id ?? null,
      idauditorio: null,
      fecha: '',
      hora_inicio: '',
      hora_fin: '',
      idasignacion: null
    });
  }

  async deleteReserva(reserva: ReservaAuditorioModel) {
    const confirmed = await this.confirmDelete('Eliminar reserva', this.getReservaSummary(reserva));
    if (!confirmed) return;

    this.auditoriosService.deleteReserva(reserva.idreserva).subscribe({
      next: () => this.showSuccess('Reserva eliminada'),
      error: err => this.handleError(err, 'No se pudo eliminar la reserva.')
    });
  }

  getUserName(user?: UserModel) {
    return user ? `${user.names ?? ''} ${user.lastNames ?? ''}`.trim() || user.email : 'Sin usuario';
  }

  getReservaUser(reserva: ReservaAuditorioModel) {
    return reserva.usuario ?? this.users().find(user => user.id === reserva.idusuario);
  }

  getAuditorioName(reserva: ReservaAuditorioModel) {
    return reserva.auditorio?.nombre
      ?? this.auditorios().find(auditorio => auditorio.idauditorio === reserva.idauditorio)?.nombre
      ?? `Auditorio ${reserva.idauditorio}`;
  }

  getAsignacionLabel(idasignacion?: number | null) {
    if (!idasignacion) return 'Sin asignación';

    const asignacion = this.asignaciones().find(item => item.idAsignacion === idasignacion);
    if (!asignacion) return `Asignación ${idasignacion}`;

    const curso = this.cursos().find(item => (item.id ?? item.idCurso) === asignacion.cursoId);
    const materia = curso?.materias?.find(item => (item.idMateria ?? item.id) === asignacion.materiaId)
      ?? asignacion.materia;
    const docente = asignacion.docente ?? this.users().find(user => user.id === asignacion.docenteId);

    return [
      curso?.nombreCurso ?? `Curso ${asignacion.cursoId}`,
      materia?.nombreMateria ?? materia?.nombre ?? `Materia ${asignacion.materiaId}`,
      docente ? this.getUserName(docente) : `Docente ${asignacion.docenteId}`
    ].join(' | ');
  }

  getReservaSummary(reserva: ReservaAuditorioModel) {
    return `${this.getAuditorioName(reserva)} - ${this.formatDate(reserva.fecha_hora)} a ${this.formatTime(reserva.fecha_hora_fin)}`;
  }

  formatDate(value: string | Date) {
    return new Intl.DateTimeFormat('es-CO', {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(new Date(value));
  }

  formatTime(value?: string | Date | null) {
    if (!value) return 'Sin fin';

    return new Intl.DateTimeFormat('es-CO', {
      timeStyle: 'short'
    }).format(new Date(value));
  }

  private toIsoDate(fecha: string, hora: string) {
    return new Date(`${fecha}T${hora}`).toISOString();
  }

  private isValidTimeRange() {
    const rawValue = this.reservaForm.getRawValue();
    if (!rawValue.fecha || !rawValue.hora_inicio || !rawValue.hora_fin) return false;

    const start = new Date(`${rawValue.fecha}T${rawValue.hora_inicio}`).getTime();
    const end = new Date(`${rawValue.fecha}T${rawValue.hora_fin}`).getTime();

    return Number.isFinite(start) && Number.isFinite(end) && end > start;
  }

  private buildReservaPayload(rawValue: {
    idusuario: number | null;
    idauditorio: number | null;
    fecha: string | null;
    hora_inicio: string | null;
    hora_fin: string | null;
    idasignacion: number | null;
  }): CreateReservaAuditorioDto {
    const payload: CreateReservaAuditorioDto = {
      idusuario: Number(rawValue.idusuario),
      idauditorio: Number(rawValue.idauditorio),
      fecha_hora: this.toIsoDate(rawValue.fecha ?? '', rawValue.hora_inicio ?? ''),
      fecha_hora_fin: this.toIsoDate(rawValue.fecha ?? '', rawValue.hora_fin ?? '')
    };

    if (rawValue.idasignacion !== null && rawValue.idasignacion !== undefined) {
      payload.idasignacion = Number(rawValue.idasignacion);
    }

    return payload;
  }

  private toLocalRangeParts(reserva: ReservaAuditorioModel) {
    const startParts = this.toLocalDateParts(reserva.fecha_hora);
    const endParts = reserva.fecha_hora_fin
      ? this.toLocalDateParts(reserva.fecha_hora_fin)
      : this.toLocalDateParts(new Date(new Date(reserva.fecha_hora).getTime() + 60 * 60 * 1000));

    return {
      fecha: startParts.fecha,
      hora_inicio: startParts.hora,
      hora_fin: endParts.hora
    };
  }

  private toLocalDateParts(value: string | Date) {
    const date = new Date(value);
    const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    const localValue = offsetDate.toISOString();

    return {
      fecha: localValue.slice(0, 10),
      hora: localValue.slice(11, 16)
    };
  }

  private async confirmDelete(title: string, text: string) {
    const result = await Swal.fire({
      icon: 'warning',
      title,
      text,
      showCancelButton: true,
      confirmButtonText: 'Si, eliminar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#b4232f'
    });

    return result.isConfirmed;
  }

  private handleError(err: HttpErrorResponse, fallback: string) {
    const message = err.error?.message;
    const text = Array.isArray(message) ? message.join(' ') : message || fallback;
    this.errorMessage.set(text);
    this.showError(text);
  }

  private showSuccess(title: string) {
    Swal.fire({ icon: 'success', title, confirmButtonText: 'Aceptar', confirmButtonColor: '#146b50' });
  }

  private showError(text: string) {
    Swal.fire({ icon: 'error', title: 'Error', text, confirmButtonText: 'Aceptar', confirmButtonColor: '#b4232f' });
  }
}
