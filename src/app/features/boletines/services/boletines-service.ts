import { API_BASE_URL } from '../../../core/config/api.config';
import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { catchError, Observable, of, tap } from 'rxjs';
import { BoletinPublicadoModel, PublicarBoletinesDto } from '../models/boletin.model';

@Injectable({
  providedIn: 'root',
})
export class BoletinesService {
  private http = inject(HttpClient);
  private apiUrl = `${API_BASE_URL}/boletines`;
  private readonly boletinesStorageKey = 'boletines-publicados';

  private boletinesPublicadosSignal = signal<BoletinPublicadoModel[]>([]);
  private misBoletinesSignal = signal<BoletinPublicadoModel[]>([]);

  public boletinesPublicados = this.boletinesPublicadosSignal.asReadonly();
  public misBoletines = this.misBoletinesSignal.asReadonly();

  loadBoletinesPublicados() {
    this.boletinesPublicadosSignal.set(this.readBoletinesPublicadosCache());
  }

  loadMisBoletines() {
    this.http.get<BoletinPublicadoModel[]>(`${this.apiUrl}/me`).pipe(
      catchError(err => {
        console.error('Error al cargar mis boletines', err);
        this.misBoletinesSignal.set([]);
        return of([]);
      })
    ).subscribe(data => this.misBoletinesSignal.set(data));
  }

  loadBoletinesAcudidos() {
    this.http.get<BoletinPublicadoModel[]>(`${this.apiUrl}/acudidos`).pipe(
      catchError(err => {
        console.error('Error al cargar boletines de los estudiantes asociados', err);
        return of([]);
      })
    ).subscribe(boletines => this.misBoletinesSignal.set(boletines));
  }

  getBoletinAcudido(estudianteId: number, periodoId: number) {
    return this.http.get<BoletinPublicadoModel>(
      `${this.apiUrl}/acudidos/${estudianteId}/periodos/${periodoId}`
    );
  }

  downloadBoletinAcudido(estudianteId: number, boletinId: number): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/acudidos/${estudianteId}/${boletinId}/download`, {
      responseType: 'blob'
    });
  }

  publicarBoletines(payload: PublicarBoletinesDto) {
    return this.http.post<BoletinPublicadoModel[]>(`${this.apiUrl}/publicar`, payload).pipe(
      tap(boletines => {
        this.boletinesPublicadosSignal.update(currentBoletines => {
          const boletinesMap = new Map(
            currentBoletines.map(boletin => [this.getBoletinKey(boletin), boletin])
          );

          boletines.forEach(boletin => boletinesMap.set(this.getBoletinKey(boletin), boletin));

          const nextBoletines = [...boletinesMap.values()];
          this.saveBoletinesPublicadosCache(nextBoletines);

          return nextBoletines;
        });
      })
    );
  }

  getBoletinUrl(boletin: BoletinPublicadoModel) {
    const url = (boletin.archivoUrl ?? boletin.downloadUrl ?? boletin.fileUrl ?? boletin.url ?? '').trim();

    if (!url) return '';
    if (/^(blob:|data:)/i.test(url)) return url;

    if (/^https?:/i.test(url)) {
      return this.replaceLocalhostOrigin(url);
    }

    const cleanPath = url
      .replace(/\\/g, '/')
      .replace(/^\.?\//, '')
      .replace(/^\/+/, '');

    return `${API_BASE_URL}/${cleanPath}`;
  }

  private replaceLocalhostOrigin(url: string) {
    try {
      const parsedUrl = new URL(url);

      if (['localhost', '127.0.0.1', '0.0.0.0'].includes(parsedUrl.hostname)) {
        return `${API_BASE_URL}${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}`;
      }

      return url;
    } catch {
      return url;
    }
  }

  private getBoletinKey(boletin: BoletinPublicadoModel) {
    return `${boletin.estudianteId}-${boletin.periodoId}`;
  }

  private readBoletinesPublicadosCache() {
    try {
      const cachedBoletines = localStorage.getItem(this.boletinesStorageKey);
      return cachedBoletines ? JSON.parse(cachedBoletines) as BoletinPublicadoModel[] : [];
    } catch {
      return [];
    }
  }

  private saveBoletinesPublicadosCache(boletines: BoletinPublicadoModel[]) {
    try {
      localStorage.setItem(this.boletinesStorageKey, JSON.stringify(boletines));
    } catch {
      // Si el navegador bloquea el almacenamiento, mantenemos los datos en memoria.
    }
  }
}
