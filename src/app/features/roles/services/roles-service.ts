import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { CreateRoleDto, RoleModel } from '../models/roles.model';
import { tap } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class RolesService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:3000/roles';

  private rolesSignal = signal<RoleModel[]>([]);
  public roles = this.rolesSignal.asReadonly();

  constructor() { this.loadRoles(); }

  loadRoles() {
    this.http.get<RoleModel[]>(this.apiUrl).subscribe(data => this.rolesSignal.set(data));
  }

  createRole(role: CreateRoleDto) {
    return this.http.post<RoleModel>(this.apiUrl, role).pipe(
      tap(newRole => this.rolesSignal.update(r => [...r, newRole]))
    );
  }

  updateRole(id: number, updatedRole: Partial<CreateRoleDto>) {
    return this.http.patch<RoleModel>(`${this.apiUrl}/${id}`, updatedRole).pipe(
      tap((updatedData) => {
        // Actualizamos la señal buscando el rol por ID y fusionando los cambios
        this.rolesSignal.update(roles =>
          roles.map(role => role.id === id ? { ...role, ...updatedData } : role)
        );
      })
    );
  }

  deleteRole(id: number) {
    return this.http.delete<void>(`${this.apiUrl}/${id}`).pipe(
      tap(() => {
        // Filtramos el arreglo para quitar el rol eliminado
        this.rolesSignal.update(roles => 
          roles.filter(role => role.id !== id)
        );
      })
    );
  }


}
