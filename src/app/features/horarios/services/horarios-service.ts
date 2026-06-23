import { API_BASE_URL } from '../../../core/config/api.config';
import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { catchError, forkJoin, of, tap } from 'rxjs';
import { AsignacionModel } from '../../cursos/models/curso.model';
import { CursosService } from '../../cursos/services/cursos-service';
import { CreateHorarioDto, HorarioModel, UpdateHorarioDto } from '../models/horario.model';

@Injectable({
  providedIn: 'root',
})
export class HorariosService {
  private http = inject(HttpClient);
  private cursosService = inject(CursosService);
  private apiBaseUrl = API_BASE_URL;
  private apiUrl = `${API_BASE_URL}/horarios`;

  private horariosSignal = signal<HorarioModel[]>([]);
  public horarios = this.horariosSignal.asReadonly();

  loadHorarios() {
    this.http.get<HorarioModel[]>(this.apiUrl).subscribe({
      next: data => this.horariosSignal.set(data),
      error: err => {
        console.error('Error al cargar horarios', err);
        this.horariosSignal.set([]);
      }
    });
  }

  loadHorariosByCurso(cursoId: number) {
    this.http.get<HorarioModel[]>(`${this.apiUrl}/curso/${cursoId}`).subscribe({
      next: data => this.horariosSignal.set(data),
      error: err => {
        if (err.status === 404) {
          this.loadHorariosByCursoFallback(cursoId);
          return;
        }

        console.error('Error al cargar horario del curso', err);
        this.horariosSignal.set([]);
      }
    });
  }

  private loadHorariosByCursoFallback(cursoId: number) {
    forkJoin({
      horarios: this.http.get<HorarioModel[]>(this.apiUrl),
      asignaciones: this.http.get<AsignacionModel[]>(`${this.apiBaseUrl}/asignaciones`)
    }).pipe(
      catchError(err => {
        console.error('Error al cargar horarios para filtrar por curso', err);
        return of({ horarios: [], asignaciones: [] });
      })
    ).subscribe(({ horarios, asignaciones }) => {
      this.horariosSignal.set(horarios.filter(horario => this.getHorarioCursoId(horario, asignaciones) === cursoId));
    });
  }

  createHorario(horario: CreateHorarioDto) {
    return this.http.post<HorarioModel>(this.apiUrl, horario).pipe(
      tap(newHorario => this.horariosSignal.update(horarios => [
        ...horarios,
        {
          ...newHorario,
          dia: newHorario.dia ?? horario.dia,
          horaInicio: newHorario.horaInicio ?? horario.horaInicio,
          horaFin: newHorario.horaFin ?? horario.horaFin,
          asignacionId: newHorario.asignacionId ?? horario.asignacionId
        }
      ]))
    );
  }

  updateHorario(id: number, horario: UpdateHorarioDto) {
    return this.http.patch<HorarioModel>(`${this.apiUrl}/${id}`, horario).pipe(
      tap(updatedHorario => this.horariosSignal.update(horarios =>
        horarios.map(currentHorario =>
          this.getHorarioId(currentHorario) === id
            ? { ...currentHorario, ...horario, ...updatedHorario }
            : currentHorario
        )
      ))
    );
  }

  deleteHorario(id: number) {
    return this.http.delete<void>(`${this.apiUrl}/${id}`).pipe(
      tap(() => this.horariosSignal.update(horarios =>
        horarios.filter(horario => this.getHorarioId(horario) !== id)
      ))
    );
  }

  private getHorarioId(horario: HorarioModel) {
    return horario.idHorario ?? horario.id;
  }

  private getHorarioCursoId(horario: HorarioModel, asignaciones: AsignacionModel[] = this.cursosService.asignaciones()) {
    return this.getAsignacionCursoId(
      horario.asignacion
      ?? asignaciones.find(asignacion => this.getAsignacionId(asignacion) === horario.asignacionId)
    );
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

  private getAsignacionId(asignacion: AsignacionModel) {
    return asignacion.idAsignacion ?? (asignacion as AsignacionModel & { id?: number }).id ?? 0;
  }

  private toNumber(value: number | string | null | undefined) {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : undefined;
  }
}
