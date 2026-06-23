import { API_BASE_URL } from '../../../core/config/api.config';
import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { tap } from 'rxjs';
import { CreateEstudianteDto, EstudianteModel, UpdateEstudianteDto } from '../models/estudiante.model';
import { UsersService } from '../../users/services/users-service';

@Injectable({
  providedIn: 'root',
})
export class EstudiantesService {
  private http = inject(HttpClient);
  private userService = inject(UsersService);
  private apiUrl = API_BASE_URL;

  private estudiantesSignal = signal<EstudianteModel[]>([]);

  public estudiantes = this.estudiantesSignal.asReadonly();

  constructor() {
    this.loadEstudiantes();
  }

  loadEstudiantes() {
    this.http.get<EstudianteModel[]>(`${this.apiUrl}/estudiantes`).subscribe(data => {
      this.estudiantesSignal.set(data.map(estudiante => this.normalizeEstudiante(estudiante)));
    });
  }

  

  createEstudiante(estudiante: CreateEstudianteDto) {
    return this.http.post<EstudianteModel>(`${this.apiUrl}/estudiantes`, estudiante).pipe(
      tap(newEstudiante => this.estudiantesSignal.update(estudiantes => [
        ...estudiantes,
        this.normalizeEstudiante(newEstudiante)
      ]))
    );
  }

  updateEstudiante(id: number, estudiante: UpdateEstudianteDto) {
    return this.http.patch<EstudianteModel>(`${this.apiUrl}/estudiantes/${id}`, estudiante).pipe(
      tap(updatedEstudiante => {
        const normalizedEstudiante = this.normalizeEstudiante(updatedEstudiante);

        this.estudiantesSignal.update(estudiantes =>
          estudiantes.map(estudiante => this.getEstudianteId(estudiante) === id
            ? { ...estudiante, ...normalizedEstudiante }
            : estudiante
          )
        );
      })
    );
  }

  deleteEstudiante(id: number) {
    return this.http.delete<void>(`${this.apiUrl}/estudiantes/${id}`).pipe(
      tap(() => this.estudiantesSignal.update(estudiantes =>
        estudiantes.filter(estudiante => this.getEstudianteId(estudiante) !== id)
      ))
    );
  }

  private normalizeEstudiante(estudiante: EstudianteModel): EstudianteModel {
    return {
      ...estudiante,
      id: this.getEstudianteId(estudiante),
      curso: estudiante.curso
        ? {
          ...estudiante.curso,
          id: estudiante.curso.id ?? estudiante.curso.idCurso
        }
        : estudiante.curso
    };
  }

  private getEstudianteId(estudiante: EstudianteModel) {
    return estudiante.id ?? estudiante.idEstudiante;
  }
}
