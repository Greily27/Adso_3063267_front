import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { tap } from 'rxjs';
import { CreateObservadorDto, ObservadorModel, UpdateObservadorDto } from '../models/observador.model';

@Injectable({
  providedIn: 'root',
})
export class ObservadoresService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:3000/observadores';

  private observadoresSignal = signal<ObservadorModel[]>([]);
  public observadores = this.observadoresSignal.asReadonly();

  loadObservadores() {
    this.http.get<ObservadorModel[]>(this.apiUrl).subscribe({
      next: data => this.observadoresSignal.set(data),
      error: err => {
        console.error('Error al cargar observadores', err);
        this.observadoresSignal.set([]);
      }
    });
  }

  loadObservadoresByEstudiante(estudianteId: number) {
    this.http.get<ObservadorModel[]>(`${this.apiUrl}/estudiante/${estudianteId}`).subscribe({
      next: data => {
        if (data.length > 0) {
          this.observadoresSignal.set(data);
          return;
        }

        this.loadObservadores();
      },
      error: err => {
        console.error('Error al cargar observadores del estudiante', err);
        this.loadObservadores();
      }
    });
  }

  createObservador(observador: CreateObservadorDto, relations: Partial<ObservadorModel> = {}) {
    return this.http.post<ObservadorModel>(this.apiUrl, observador).pipe(
      tap(newObservador => this.observadoresSignal.update(observadores => [
        ...observadores,
        {
          ...newObservador,
          estudianteId: observador.estudianteId,
          cursoId: observador.cursoId,
          docenteId: observador.docenteId,
          fecha: observador.fecha ?? newObservador.fecha,
          categoria: newObservador.categoria ?? observador.categoria,
          descripcion: newObservador.descripcion ?? observador.descripcion,
          estudiante: relations.estudiante ?? newObservador.estudiante,
          curso: relations.curso ?? newObservador.curso,
          docente: relations.docente ?? newObservador.docente
        }
      ]))
    );
  }

  updateObservador(id: number, observador: UpdateObservadorDto) {
    return this.http.patch<ObservadorModel>(`${this.apiUrl}/${id}`, observador).pipe(
      tap(updatedObservador => {
        this.observadoresSignal.update(observadores =>
          observadores.map(currentObservador =>
            this.getObservadorId(currentObservador) === id
              ? { ...currentObservador, ...updatedObservador, ...observador }
              : currentObservador
          )
        );
      })
    );
  }

  deleteObservador(id: number) {
    return this.http.delete<void>(`${this.apiUrl}/${id}`).pipe(
      tap(() => this.observadoresSignal.update(observadores =>
        observadores.filter(observador => this.getObservadorId(observador) !== id)
      ))
    );
  }

  private getObservadorId(observador: ObservadorModel) {
    return observador.idObservador ?? observador.id;
  }
}
