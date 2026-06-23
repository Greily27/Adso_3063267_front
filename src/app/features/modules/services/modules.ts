import { API_BASE_URL } from '../../../core/config/api.config';
import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { CreateModuleDto, ModuleModel, UpdateModuleDto } from '../models/module.model';
import { Observable, tap } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class ModulesService {

  private http = inject(HttpClient);
  private apiUrl = API_BASE_URL;

  // 1. Definimos la seÃ±al privada que almacenarÃ¡ el estado
  private modulesSignal = signal<ModuleModel[]>([]);

  // 2. Exponemos la seÃ±al como ReadOnly para los componentes
  public modules = this.modulesSignal.asReadonly();

  // 3. Opcional: Una seÃ±al computada (ej: contar mÃ³dulos)
  public totalModules = computed(() => this.modulesSignal().length);

  loadModules() {
    this.http.get<ModuleModel[]>(`${this.apiUrl}/modules`).subscribe({
      next: data => {
        this.modulesSignal.set(data);
      },
      error: err => {
        console.error('Error al cargar modulos', err);
        this.modulesSignal.set([]);
      }
    });
  }

  createModule(newModule: CreateModuleDto) {
    return this.http.post<ModuleModel>(`${this.apiUrl}/modules`, newModule).pipe(
      tap((createdModule) => {
        // Actualizamos la seÃ±al de forma inmutable
        this.modulesSignal.update(modules => [...modules, createdModule]);
      })
    );
  }

  updateModule(id: number, updatedModule: UpdateModuleDto) {
    return this.http.patch<ModuleModel>(`${this.apiUrl}/modules/${id}`, updatedModule).pipe(
      tap((updatedData) => {
        // Actualizamos la seÃ±al de forma inmutable buscando el elemento por ID
        this.modulesSignal.update(modules =>
          modules.map(mod => mod.id === id ? { ...mod, ...updatedData } : mod)
        );
      })
    );
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/modules/${id}`).pipe(
      tap(() => {
        // Actualizamos la seÃ±al eliminando el mÃ³dulo por su ID
        this.modulesSignal.update(modules =>
          modules.filter(module => module.id !== id)
        );
      })
    );
  }

}
