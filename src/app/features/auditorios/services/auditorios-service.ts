import { API_BASE_URL } from '../../../core/config/api.config';
import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { tap } from 'rxjs';
import {
  AuditorioModel,
  CreateAuditorioDto,
  CreateReservaAuditorioDto,
  ReservaAuditorioModel,
  UpdateAuditorioDto,
  UpdateReservaAuditorioDto
} from '../models/auditorio.model';

@Injectable({
  providedIn: 'root',
})
export class AuditoriosService {
  private http = inject(HttpClient);
  private apiUrl = API_BASE_URL;

  private auditoriosSignal = signal<AuditorioModel[]>([]);
  private reservasSignal = signal<ReservaAuditorioModel[]>([]);

  public auditorios = this.auditoriosSignal.asReadonly();
  public reservas = this.reservasSignal.asReadonly();

  constructor() {
    this.loadAuditorios();
    this.loadReservas();
  }

  loadAuditorios() {
    this.http.get<AuditorioModel[]>(`${this.apiUrl}/auditorios`).subscribe({
      next: auditorios => this.auditoriosSignal.set(auditorios),
      error: err => {
        console.error('Error al cargar auditorios', err);
        this.auditoriosSignal.set([]);
      }
    });
  }

  loadReservas() {
    this.http.get<ReservaAuditorioModel[]>(`${this.apiUrl}/reservas-auditorio`).subscribe({
      next: reservas => this.reservasSignal.set(reservas),
      error: err => {
        console.error('Error al cargar reservas de auditorio', err);
        this.reservasSignal.set([]);
      }
    });
  }

  createAuditorio(auditorio: CreateAuditorioDto) {
    return this.http.post<AuditorioModel>(`${this.apiUrl}/auditorios`, auditorio).pipe(
      tap(newAuditorio => this.auditoriosSignal.update(auditorios => [...auditorios, newAuditorio]))
    );
  }

  updateAuditorio(id: number, auditorio: UpdateAuditorioDto) {
    return this.http.patch<AuditorioModel>(`${this.apiUrl}/auditorios/${id}`, auditorio).pipe(
      tap(updatedAuditorio => this.auditoriosSignal.update(auditorios =>
        auditorios.map(item => item.idauditorio === id ? { ...item, ...updatedAuditorio } : item)
      ))
    );
  }

  deleteAuditorio(id: number) {
    return this.http.delete<void>(`${this.apiUrl}/auditorios/${id}`).pipe(
      tap(() => this.auditoriosSignal.update(auditorios =>
        auditorios.filter(auditorio => auditorio.idauditorio !== id)
      ))
    );
  }

  createReserva(reserva: CreateReservaAuditorioDto) {
    return this.http.post<ReservaAuditorioModel>(`${this.apiUrl}/reservas-auditorio`, reserva).pipe(
      tap(newReserva => this.reservasSignal.update(reservas => [...reservas, newReserva]))
    );
  }

  updateReserva(id: number, reserva: UpdateReservaAuditorioDto) {
    return this.http.patch<ReservaAuditorioModel>(`${this.apiUrl}/reservas-auditorio/${id}`, reserva).pipe(
      tap(updatedReserva => this.reservasSignal.update(reservas =>
        reservas.map(item => item.idreserva === id ? { ...item, ...updatedReserva } : item)
      ))
    );
  }

  deleteReserva(id: number) {
    return this.http.delete<void>(`${this.apiUrl}/reservas-auditorio/${id}`).pipe(
      tap(() => this.reservasSignal.update(reservas =>
        reservas.filter(reserva => reserva.idreserva !== id)
      ))
    );
  }
}
