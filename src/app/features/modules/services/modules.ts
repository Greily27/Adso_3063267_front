import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { CreateModuleDto, ModuleModel, UpdateModuleDto } from '../models/module.model';
import { Observable, tap } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class ModulesService {

  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:3000';

  // 1. Definimos la señal privada que almacenará el estado
  private modulesSignal = signal<ModuleModel[]>([]);

  // 2. Exponemos la señal como ReadOnly para los componentes
  public modules = this.modulesSignal.asReadonly();

  // 3. Opcional: Una señal computada (ej: contar módulos)
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
        // Actualizamos la señal de forma inmutable
        this.modulesSignal.update(modules => [...modules, createdModule]);
      })
    );
  }

  updateModule(id: number, updatedModule: UpdateModuleDto) {
    return this.http.patch<ModuleModel>(`${this.apiUrl}/modules/${id}`, updatedModule).pipe(
      tap((updatedData) => {
        // Actualizamos la señal de forma inmutable buscando el elemento por ID
        this.modulesSignal.update(modules =>
          modules.map(mod => mod.id === id ? { ...mod, ...updatedData } : mod)
        );
      })
    );
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/modules/${id}`).pipe(
      tap(() => {
        // Actualizamos la señal eliminando el módulo por su ID
        this.modulesSignal.update(modules =>
          modules.filter(module => module.id !== id)
        );
      })
    );
  }

}
