import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { tap } from 'rxjs';
import { API_BASE_URL } from '../../../core/config/api.config';
import { EventoFormValue, EventoModel } from '../models/evento.model';

@Injectable({ providedIn: 'root' })
export class EventosService {
  private http = inject(HttpClient);
  private apiUrl = `${API_BASE_URL}/eventos`;
  private eventosSignal = signal<EventoModel[]>([]);

  public eventos = this.eventosSignal.asReadonly();

  loadEventos() {
    this.http.get<EventoModel[]>(this.apiUrl).subscribe({
      next: eventos => this.eventosSignal.set(eventos),
      error: err => {
        console.error('Error al cargar eventos', err);
        this.eventosSignal.set([]);
      }
    });
  }

  createEvento(value: EventoFormValue, imagen?: File | null) {
    return this.http.post<EventoModel>(this.apiUrl, this.toFormData(value, imagen)).pipe(
      tap(evento => this.eventosSignal.update(eventos => [...eventos, evento]))
    );
  }

  updateEvento(id: number, value: EventoFormValue, imagen?: File | null) {
    return this.http.patch<EventoModel>(`${this.apiUrl}/${id}`, this.toFormData(value, imagen)).pipe(
      tap(evento => this.eventosSignal.update(eventos =>
        eventos.map(actual => this.getId(actual) === id ? { ...actual, ...evento } : actual)
      ))
    );
  }

  deleteEvento(id: number) {
    return this.http.delete<void>(`${this.apiUrl}/${id}`).pipe(
      tap(() => this.eventosSignal.update(eventos => eventos.filter(evento => this.getId(evento) !== id)))
    );
  }

  private toFormData(value: EventoFormValue, imagen?: File | null) {
    const formData = new FormData();
    formData.append('titulo', value.titulo.trim());
    formData.append('descripcion', value.descripcion.trim());
    formData.append('categoria', value.categoria.trim());
    formData.append('fechaInicio', value.fechaInicio);
    formData.append('fechaFin', value.fechaFin);
    formData.append('ubicacion', value.ubicacion.trim());
    formData.append('destinatarios', JSON.stringify(value.destinatarios));
    formData.append('estado', value.estado);
    if (imagen) formData.append('imagen', imagen, imagen.name);
    return formData;
  }

  private getId(evento: EventoModel) {
    return evento.idEvento ?? evento.id;
  }
}
