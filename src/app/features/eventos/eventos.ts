import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import Swal from 'sweetalert2';
import { API_BASE_URL } from '../../core/config/api.config';
import { Auth } from '../../core/services/auth';
import { EventoDestinatario, EventoEstado, EventoFormValue, EventoModel } from './models/evento.model';
import { EventosService } from './services/eventos-service';

@Component({
  selector: 'app-eventos',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule
  ],
  templateUrl: './eventos.html',
  styleUrl: './eventos.scss'
})
export class Eventos {
  private fb = inject(FormBuilder);
  private auth = inject(Auth);
  private eventosService = inject(EventosService);

  public eventos = this.eventosService.eventos;
  public isAcudiente = this.auth.isAcudiente;
  public canManage = computed(() => !this.isAcudiente());
  public showForm = signal(false);
  public editingEvento = signal<EventoModel | null>(null);
  public selectedImage = signal<File | null>(null);
  public errorMessage = signal('');

  public readonly destinatarios: EventoDestinatario[] = ['DOCENTE', 'ESTUDIANTE', 'ACUDIENTE'];
  public readonly estados: EventoEstado[] = ['BORRADOR', 'PUBLICADO', 'CANCELADO'];

  public form = this.fb.nonNullable.group({
    titulo: ['', [Validators.required, Validators.maxLength(150)]],
    descripcion: ['', Validators.required],
    categoria: ['', Validators.required],
    fechaInicio: ['', Validators.required],
    fechaFin: ['', Validators.required],
    ubicacion: ['', Validators.required],
    destinatarios: [[] as EventoDestinatario[], Validators.required],
    estado: ['BORRADOR' as EventoEstado, Validators.required]
  });

  ngOnInit() {
    this.eventosService.loadEventos();
  }

  openCreate() {
    if (!this.canManage()) return;
    this.resetForm();
    this.showForm.set(true);
  }

  openEdit(evento: EventoModel) {
    if (!this.canManage()) return;
    this.editingEvento.set(evento);
    this.selectedImage.set(null);
    this.form.setValue({
      titulo: evento.titulo ?? '',
      descripcion: evento.descripcion ?? '',
      categoria: evento.categoria ?? '',
      fechaInicio: this.toInputDate(evento.fechaInicio),
      fechaFin: this.toInputDate(evento.fechaFin),
      ubicacion: evento.ubicacion ?? '',
      destinatarios: evento.destinatarios ?? [],
      estado: evento.estado ?? 'BORRADOR'
    });
    this.showForm.set(true);
  }

  onImageChange(event: Event) {
    const input = event.target as HTMLInputElement;
    this.selectedImage.set(input.files?.[0] ?? null);
  }

  save() {
    if (!this.canManage() || this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue() as EventoFormValue;
    if (new Date(value.fechaFin).getTime() < new Date(value.fechaInicio).getTime()) {
      this.errorMessage.set('La fecha final no puede ser anterior a la fecha inicial.');
      return;
    }

    const editing = this.editingEvento();
    const id = editing ? this.getId(editing) : undefined;
    const request = id
      ? this.eventosService.updateEvento(id, value, this.selectedImage())
      : this.eventosService.createEvento(value, this.selectedImage());

    this.errorMessage.set('');
    request.subscribe({
      next: () => {
        this.showForm.set(false);
        this.resetForm();
        Swal.fire({
          icon: 'success',
          title: id ? 'Evento actualizado' : 'Evento creado',
          confirmButtonColor: '#146b50'
        });
      },
      error: (err: HttpErrorResponse) => {
        this.errorMessage.set(this.getErrorMessage(err));
      }
    });
  }

  async remove(evento: EventoModel) {
    if (!this.canManage()) return;
    const id = this.getId(evento);
    if (!id) return;

    const result = await Swal.fire({
      icon: 'warning',
      title: 'Eliminar evento',
      text: `¿Deseas eliminar “${evento.titulo}”?`,
      showCancelButton: true,
      confirmButtonText: 'Eliminar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#b4232f'
    });
    if (!result.isConfirmed) return;

    this.eventosService.deleteEvento(id).subscribe({
      error: (err: HttpErrorResponse) => this.errorMessage.set(this.getErrorMessage(err))
    });
  }

  closeForm() {
    this.showForm.set(false);
    this.resetForm();
  }

  getImageUrl(evento: EventoModel) {
    const url = (evento.imagenUrl ?? evento.imagen ?? '').trim();
    if (!url || url.startsWith('data:') || /^https?:\/\//i.test(url)) return url;
    return `${API_BASE_URL}/${url.replace(/\\/g, '/').replace(/^\/+/, '')}`;
  }

  formatDate(value: string) {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? value
      : new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
  }

  getId(evento: EventoModel) {
    return evento.idEvento ?? evento.id;
  }

  private resetForm() {
    this.editingEvento.set(null);
    this.selectedImage.set(null);
    this.errorMessage.set('');
    this.form.reset({
      titulo: '',
      descripcion: '',
      categoria: '',
      fechaInicio: '',
      fechaFin: '',
      ubicacion: '',
      destinatarios: [],
      estado: 'BORRADOR'
    });
  }

  private toInputDate(value: string) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value.slice(0, 16);
    const offset = date.getTimezoneOffset() * 60_000;
    return new Date(date.getTime() - offset).toISOString().slice(0, 16);
  }

  private getErrorMessage(err: HttpErrorResponse) {
    const message = err.error?.message;
    return Array.isArray(message) ? message.join(' ') : message || 'No se pudo completar la operación.';
  }
}
