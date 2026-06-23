import { API_BASE_URL } from '../../../core/config/api.config';
import { HttpClient } from '@angular/common/http';
import { HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { catchError, of, switchMap, tap, throwError } from 'rxjs';
import { CreateMateriaDto, MateriaModel, UpdateMateriaDto } from '../models/materia.model';

@Injectable({
  providedIn: 'root',
})
export class MateriasService {
  private http = inject(HttpClient);
  private apiUrl = `${API_BASE_URL}/materias`;

  private materiasSignal = signal<MateriaModel[]>([]);
  public materias = this.materiasSignal.asReadonly();

  constructor() {
    this.loadMaterias();
  }

  loadMaterias() {
    this.http.get<MateriaModel[]>(this.apiUrl).subscribe(data => {
      this.materiasSignal.set(data);
    });
  }

  createMateria(materia: CreateMateriaDto) {
    return this.http.post<MateriaModel>(this.apiUrl, materia).pipe(
      tap(newMateria => this.materiasSignal.update(materias => [...materias, newMateria]))
    );
  }

  updateMateria(id: number, materia: UpdateMateriaDto) {
    return this.http.patch<MateriaModel>(`${this.apiUrl}/${id}`, materia).pipe(
      tap(updatedMateria => {
        this.materiasSignal.update(materias =>
          materias.map(materia => materia.idMateria === id ? { ...materia, ...updatedMateria } : materia)
        );
      })
    );
  }

  deleteMateria(id: number) {
    return this.http.patch<MateriaModel>(`${this.apiUrl}/${id}`, { cursosIds: [] }).pipe(
      switchMap(() => this.http.delete<void>(`${this.apiUrl}/${id}`).pipe(
        catchError((err: HttpErrorResponse) => err.status === 404 ? of(void 0) : throwError(() => err))
      )),
      tap(() => this.materiasSignal.update(materias =>
        materias.filter(materia => materia.idMateria !== id)
      ))
    );
  }
}
