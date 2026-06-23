import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { catchError, of, tap } from 'rxjs';
import { CreateGuiaDto, GuiaModel, UpdateGuiaDto } from '../models/guia.model';

@Injectable({
  providedIn: 'root',
})
export class GuiasService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:3000/guias';

  private guiasSignal = signal<GuiaModel[]>([]);
  public guias = this.guiasSignal.asReadonly();

  constructor() {
    this.loadGuias();
  }

  loadGuias() {
    this.http.get<GuiaModel[]>(this.apiUrl).pipe(
      catchError(err => {
        console.error('Error al cargar guías', err);
        return of([]);
      })
    ).subscribe(data => this.guiasSignal.set(data.map(guia => this.normalizeGuia(guia))));
  }

  createGuia(guia: CreateGuiaDto) {
    return this.http.post<GuiaModel>(this.apiUrl, this.toRequestBody(guia)).pipe(
      tap(newGuia => this.guiasSignal.update(guias => [
        ...guias,
        this.normalizeGuia({ ...guia, ...newGuia })
      ]))
    );
  }

  updateGuia(id: number, guia: UpdateGuiaDto) {
    return this.http.patch<GuiaModel>(`${this.apiUrl}/${id}`, this.toRequestBody(guia)).pipe(
      tap(updatedGuia => this.guiasSignal.update(guias =>
        guias.map(currentGuia =>
          this.getGuiaId(currentGuia) === id
            ? this.normalizeGuia({ ...currentGuia, ...guia, ...updatedGuia })
            : currentGuia
        )
      ))
    );
  }

  deleteGuia(id: number) {
    return this.http.delete<void>(`${this.apiUrl}/${id}`).pipe(
      tap(() => this.guiasSignal.update(guias =>
        guias.filter(guia => this.getGuiaId(guia) !== id)
      ))
    );
  }

  getGuiaId(guia: GuiaModel) {
    return guia.idGuia ?? guia.id;
  }

  private normalizeGuia(guia: GuiaModel): GuiaModel {
    return {
      ...guia,
      id: this.getGuiaId(guia),
      titulo: guia.titulo ?? guia.nombreGuia ?? guia.title ?? '',
      descripcion: guia.descripcion ?? guia.description ?? '',
      archivoUrl: guia.archivoUrl ?? guia.fileUrl ?? guia.url ?? '',
      estado: guia.estado ?? guia.isActive ?? true,
      asignacionId: guia.asignacionId ?? guia.asignacion?.idAsignacion ?? null,
      cursoId: guia.cursoId ?? guia.asignacion?.cursoId ?? guia.curso?.id ?? guia.curso?.idCurso,
      materiaId: guia.materiaId ?? guia.asignacion?.materiaId ?? guia.materia?.idMateria ?? guia.materia?.id,
      docenteId: guia.docenteId ?? guia.asignacion?.docenteId ?? guia.docente?.id
    };
  }

  private toRequestBody(payload: UpdateGuiaDto) {
    const cleanPayload = this.cleanPayload(payload);

    if (!payload.archivo) return cleanPayload;

    const formData = new FormData();

    Object.entries(cleanPayload).forEach(([key, value]) => {
      if (key === 'archivo') return;
      formData.append(key, String(value));
    });

    formData.append('archivo', payload.archivo);

    return formData;
  }

  private cleanPayload<T extends UpdateGuiaDto>(payload: T): T {
    return Object.entries(payload).reduce((acc, [key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        acc[key as keyof T] = value as T[keyof T];
      }

      return acc;
    }, {} as T);
  }
}
