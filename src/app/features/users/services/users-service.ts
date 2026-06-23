import { API_BASE_URL } from '../../../core/config/api.config';
import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { map, tap } from 'rxjs';
import { RoleModel } from '../../roles/models/roles.model';
import { MateriaModel } from '../../materias/models/materia.model';
import { CreateUserDto, UpdateUserDto, UserModel } from '../models/user.model';

@Injectable({
  providedIn: 'root',
})
export class UsersService {
  private http = inject(HttpClient);
  private apiUrl = `${API_BASE_URL}/users`;

  private userSignal = signal<UserModel[]>([]);
  public users = this.userSignal.asReadonly();

  constructor() { this.loadUsers(); }

  loadUsers() {
    this.http.get<UserModel[]>(this.apiUrl).subscribe(data => {
      this.userSignal.set(data.map(user => this.normalizeUserMaterias(user)));
    });
  }

  getUserById(id: number) {
    return this.http.get<UserModel>(`${this.apiUrl}/${id}`).pipe(
      map(user => this.normalizeUserMaterias(user)),
      tap(normalizedUser => {
        this.userSignal.update(users =>
          users.map(currentUser => currentUser.id === id ? { ...currentUser, ...normalizedUser } : currentUser)
        );
      })
    );
  }

  createUser(user: CreateUserDto, selectedRoles: RoleModel[] = [], selectedMaterias: MateriaModel[] = []) {
    return this.http.post<UserModel>(this.apiUrl, user).pipe(
      map(newUser => this.normalizeUserMaterias(newUser)),
      tap(newUser => this.userSignal.update(users => [
        ...users,
        {
          ...newUser,
          roles: newUser.roles ?? selectedRoles,
          materias: newUser.materias?.length ? newUser.materias : selectedMaterias
        }
      ]))
    );
  }

  updateUser(id: number, user: UpdateUserDto, selectedRoles: RoleModel[] = [], selectedMaterias: MateriaModel[] = []) {
    return this.http.put<UserModel>(`${this.apiUrl}/${id}`, user).pipe(
      map(updatedUser => this.normalizeUserMaterias(updatedUser)),
      tap(updatedUser => {
        this.userSignal.update(users =>
          users.map(user => user.id === id ? {
            ...user,
            ...updatedUser,
            roles: updatedUser.roles ?? selectedRoles,
            materias: updatedUser.materias?.length ? updatedUser.materias : selectedMaterias
          } : user)
        );
      })
    );
  }

  deleteUser(id: number) {
    return this.http.delete<void>(`${this.apiUrl}/${id}`).pipe(
      tap(() => this.userSignal.update(users => users.filter(user => user.id !== id)))
    );
  }

  private normalizeUserMaterias(user: UserModel): UserModel {
    const userWithAliases = user as UserModel & {
      materia?: MateriaModel[];
      materiasAsignadas?: MateriaModel[];
      materiaIds?: number[];
      materiasIds?: number[];
    };

    const materias = userWithAliases.materias
      ?? userWithAliases.materia
      ?? userWithAliases.materiasAsignadas
      ?? this.buildMateriasFromIds(userWithAliases.materiaIds ?? userWithAliases.materiasIds)
      ?? [];

    return { ...user, materias };
  }

  private buildMateriasFromIds(ids?: number[]) {
    return ids?.map(id => ({ idMateria: id, nombreMateria: `Materia ${id}`, estado: true }));
  }
}
