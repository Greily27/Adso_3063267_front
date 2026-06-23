import { API_BASE_URL } from '../../../core/config/api.config';
import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { tap } from 'rxjs';
import { CreateNotaDto, NotaModel, UpdateNotaDto } from '../models/nota.model';

@Injectable({
  providedIn: 'root',
})
export class NotasService {
  private http = inject(HttpClient);
  private apiUrl = `${API_BASE_URL}/notas`;

  private notasSignal = signal<NotaModel[]>([]);
  public notas = this.notasSignal.asReadonly();

  constructor() {
    this.loadNotas();
  }

  loadNotas() {
    this.http.get<NotaModel[]>(this.apiUrl).subscribe({
      next: data => this.notasSignal.set(data),
      error: err => {
        console.error('Error al cargar notas', err);
        this.notasSignal.set([]);
      }
    });
  }

  createNota(nota: CreateNotaDto, relations: Partial<NotaModel> = {}) {
    return this.http.post<NotaModel>(this.apiUrl, nota).pipe(
      tap(newNota => this.notasSignal.update(notas => [
        ...notas,
        {
          ...newNota,
          cursoId: nota.cursoId,
          estudianteId: nota.estudianteId,
          materiaId: nota.materiaId,
          periodoId: nota.periodoId,
          descripcion: newNota.descripcion ?? nota.descripcion,
          estudiante: relations.estudiante ?? newNota.estudiante,
          materia: relations.materia ?? newNota.materia
        }
      ]))
    );
  }

  updateNota(id: number, nota: UpdateNotaDto) {
    return this.http.patch<NotaModel>(`${this.apiUrl}/${id}`, nota).pipe(
      tap(updatedNota => {
        this.notasSignal.update(notas =>
          notas.map(currentNota => {
            const currentId = currentNota.idNota ?? currentNota.id;
            return currentId === id
              ? { ...currentNota, ...nota, ...updatedNota }
              : currentNota;
          })
        );
      })
    );
  }

  deleteNota(id: number) {
    return this.http.delete<void>(`${this.apiUrl}/${id}`).pipe(
      tap(() => this.notasSignal.update(notas =>
        notas.filter(nota => (nota.idNota ?? nota.id) !== id)
      ))
    );
  }
}
