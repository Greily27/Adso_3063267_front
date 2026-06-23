import { API_BASE_URL } from '../../../core/config/api.config';
import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { catchError, of, tap } from 'rxjs';
import { CreatePeriodoDto, PeriodoModel, UpdatePeriodoDto } from '../models/periodo.model';

@Injectable({
  providedIn: 'root',
})
export class PeriodosService {
  private http = inject(HttpClient);
  private apiUrl = `${API_BASE_URL}/periodo`;

  private periodosSignal = signal<PeriodoModel[]>([]);
  public periodos = this.periodosSignal.asReadonly();

  constructor() {
    this.loadPeriodos();
  }

  loadPeriodos() {
    this.http.get<PeriodoModel[]>(this.apiUrl).pipe(
      catchError(err => {
        console.error('Error al cargar periodos', err);
        this.periodosSignal.set([]);
        return of([]);
      })
    ).subscribe(data => {
      this.periodosSignal.set(data);
    });
  }

  createPeriodo(periodo: CreatePeriodoDto) {
    return this.http.post<PeriodoModel>(this.apiUrl, periodo).pipe(
      tap(newPeriodo => this.periodosSignal.update(periodos => [...periodos, newPeriodo]))
    );
  }

  updatePeriodo(id: number, periodo: UpdatePeriodoDto) {
    return this.http.patch<PeriodoModel>(`${this.apiUrl}/${id}`, periodo).pipe(
      tap(updatedPeriodo => {
        this.periodosSignal.update(periodos =>
          periodos.map(periodo => periodo.idPeriodo === id ? { ...periodo, ...updatedPeriodo } : periodo)
        );
      })
    );
  }

  deletePeriodo(id: number) {
    return this.http.delete<void>(`${this.apiUrl}/${id}`).pipe(
      tap(() => this.periodosSignal.update(periodos =>
        periodos.filter(periodo => periodo.idPeriodo !== id)
      ))
    );
  }
}
