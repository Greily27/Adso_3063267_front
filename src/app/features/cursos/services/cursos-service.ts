import { API_BASE_URL } from '../../../core/config/api.config';
import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { map, tap } from 'rxjs';
import { AsignacionModel, CreateAsignacionDto, CreateCursoDto, CursoModel, MateriaModel, UpdateCursoDto } from '../models/curso.model';
import { UserModel } from '../../users/models/user.model';

@Injectable({
  providedIn: 'root',
})
export class CursosService {
  private http = inject(HttpClient);
  private apiUrl = API_BASE_URL;

  private cursosSignal = signal<CursoModel[]>([]);
  private materiasSignal = signal<MateriaModel[]>([]);
  private asignacionesSignal = signal<AsignacionModel[]>([]);

  public cursos = this.cursosSignal.asReadonly();
  public materias = this.materiasSignal.asReadonly();
  public asignaciones = this.asignacionesSignal.asReadonly();

  constructor() {
    this.loadCursos();
    this.loadMaterias();
    this.loadAsignaciones();
  }

  loadCursos() {
    this.http.get<CursoModel[]>(`${this.apiUrl}/cursos`).subscribe(data => {
      this.cursosSignal.set(data.map(curso => this.normalizeCurso(curso)));
    });
  }

  getCursoById(id: number) {
    return this.http.get<CursoModel>(`${this.apiUrl}/cursos/${id}`).pipe(
      map(curso => this.normalizeCurso(curso)),
      tap(normalizedCurso => {
        this.cursosSignal.update(cursos =>
          cursos.map(curso => curso.id === id ? { ...curso, ...normalizedCurso } : curso)
        );
      })
    );
  }

  loadMaterias() {
    this.http.get<MateriaModel[]>(`${this.apiUrl}/materias`).subscribe(data => {
      this.materiasSignal.set(data);
    });
  }

  loadAsignaciones() {
    this.http.get<AsignacionModel[]>(`${this.apiUrl}/asignaciones`).subscribe({
      next: data => this.asignacionesSignal.set(data),
      error: err => {
        console.error('Error al cargar asignaciones', err);
        this.asignacionesSignal.set([]);
      }
    });
  }

  createCurso(
    curso: CreateCursoDto,
    selectedUsers: UserModel[] = [],
    selectedMaterias: MateriaModel[] = [],
    asignaciones: Array<Omit<CreateAsignacionDto, 'cursoId'>> = []
  ) {
    return this.http.post<CursoModel>(`${this.apiUrl}/cursos`, curso).pipe(
      map(newCurso => this.normalizeCurso(newCurso)),
      tap(newCurso => this.cursosSignal.update(cursos => [
        ...cursos,
        {
          ...newCurso,
          users: newCurso.users?.length ? newCurso.users : selectedUsers,
          materias: newCurso.materias?.length ? newCurso.materias : selectedMaterias
        }
      ]))
    );
  }

  createAsignacion(asignacion: CreateAsignacionDto) {
    return this.http.post<AsignacionModel>(`${this.apiUrl}/asignaciones`, asignacion).pipe(
      tap(newAsignacion => this.asignacionesSignal.update(asignaciones => [
        ...asignaciones,
        {
          ...newAsignacion,
          cursoId: newAsignacion.cursoId ?? asignacion.cursoId,
          materiaId: newAsignacion.materiaId ?? asignacion.materiaId,
          docenteId: newAsignacion.docenteId ?? asignacion.docenteId
        }
      ]))
    );
  }

  deleteAsignacion(id: number) {
    return this.http.delete<void>(`${this.apiUrl}/asignaciones/${id}`).pipe(
      tap(() => this.asignacionesSignal.update(asignaciones =>
        asignaciones.filter(asignacion => asignacion.idAsignacion !== id)
      ))
    );
  }

  updateCurso(id: number, curso: UpdateCursoDto, selectedUsers: UserModel[] = [], selectedMaterias: MateriaModel[] = []) {
    return this.http.patch<CursoModel>(`${this.apiUrl}/cursos/${id}`, curso).pipe(
      map(updatedCurso => this.normalizeCurso(updatedCurso)),
      tap(updatedCurso => {
        this.cursosSignal.update(cursos =>
          cursos.map(currentCurso => currentCurso.id === id ? {
            ...currentCurso,
            ...updatedCurso,
            directorCurso: updatedCurso.directorCurso ?? currentCurso.directorCurso,
            users: updatedCurso.users?.length ? updatedCurso.users : selectedUsers,
            materias: updatedCurso.materias?.length || selectedMaterias.length === 0 ? updatedCurso.materias ?? currentCurso.materias : selectedMaterias
          } : currentCurso)
        );
      })
    );
  }

  deleteCurso(id: number) {
    return this.http.delete<void>(`${this.apiUrl}/cursos/${id}`).pipe(
      tap(() => this.cursosSignal.update(cursos =>
        cursos.filter(curso => curso.id !== id)
      ))
    );
  }

  private normalizeCurso(curso: CursoModel): CursoModel {
    const cursoWithAliases = curso as CursoModel & {
      materia?: MateriaModel[];
      materiasAsignadas?: MateriaModel[];
      materiaIds?: number[];
      materiasIds?: number[];
      docentes?: UserModel[];
      docentesAsignados?: UserModel[];
      usuarios?: UserModel[];
    };

    const materias = cursoWithAliases.materias
      ?? cursoWithAliases.materia
      ?? cursoWithAliases.materiasAsignadas
      ?? this.buildMateriasFromIds(cursoWithAliases.materiaIds ?? cursoWithAliases.materiasIds)
      ?? [];
    const users = cursoWithAliases.users
      ?? cursoWithAliases.docentes
      ?? cursoWithAliases.docentesAsignados
      ?? cursoWithAliases.usuarios
      ?? [];

    return { ...curso, id: this.getCursoId(curso), materias, users };
  }

  public getCursoId(curso: CursoModel) {
    return curso.id ?? curso.idCurso;
  }

  private buildMateriasFromIds(ids?: number[]) {
    return ids?.map(id => ({ idMateria: id, nombreMateria: `Materia ${id}`, estado: true }));
  }
}
