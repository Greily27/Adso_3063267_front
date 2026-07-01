import { API_BASE_URL } from '../config/api.config';
import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, map, Observable, of, tap } from 'rxjs';
import { LoginInterface } from '../../auth/interfaces/login';
import { Router } from '@angular/router';
import { RoleModel } from '../../features/roles/models/roles.model';
import { UserModel } from '../../features/users/models/user.model';

// export interface Module {
//   id: number;
//   name: string;
//   description: string;
// }

// export interface Role {
//   id?: number;
//   name: string;
//   description: string;
//   modules: Module[]; // Los mÃ³dulos a los que este rol da acceso
// }

// export interface User {
//   id: number;
//   names: string;
//   lastName: string;
//   docType: string;
//   document: string;
//   email: string;
//   isActive: boolean;
//   roles: RoleModel[]; // Nota que es un array segÃºn tu JSON
// }

export interface AuthResponse {
  access_token: string; // Coincide con el snake_case de tu backend
  user: UserModel;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  password: string;
}

@Injectable({
  providedIn: 'root',
})
export class Auth {

  private http = inject(HttpClient);
  private router = inject(Router);
  private readonly API_URL = `${API_BASE_URL}/auth`;

  // 1. Estado privado (Signal) - Almacena el objeto completo del back
  private _authStatus = signal<AuthResponse | null>(null);

  // 2. Selectores pÃºblicos (Computed) - Reaccionan automÃ¡ticamente
  public currentUser = computed(() => this._authStatus()?.user);
  public isAuthenticated = computed(() => !!this._authStatus());
  public isAcudiente = computed(() => this.hasRole('acudiente'));


  public userModules = computed(() => {
    const user = this._authStatus()?.user;
    if (!user) return [];

    const allModules = user.roles.flatMap(r =>
      r.modules.map(m => this.normalizeModuleName(m.name)) // Normalizamos
    );

    return [...new Set(allModules)];
  });

  private normalizeModuleName(moduleName: string) {
    const normalizedName = moduleName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();

    const moduleAliases: Record<string, string> = {
      usuarios: 'users',
      usuario: 'users',
      modulos: 'modules',
      modulo: 'modules',
      observador: 'observadores',
      periodo: 'periodos',
      boletin: 'boletines',
      boletines: 'boletines',
      guia: 'guias',
      guias: 'guias',
      horario: 'horarios',
      horarios: 'horarios',
      auditorio: 'auditorios',
      auditorios: 'auditorios',
      reservas_auditorio: 'auditorios',
      'reservas-auditorio': 'auditorios'
    };

    return moduleAliases[normalizedName] ?? normalizedName;
  }

  /** MÃ©todo principal de Login */
  public login(credentials: LoginInterface): Observable<AuthResponse> {
    // LIMPIEZA PREVENTIVA
    localStorage.clear();

    return this.http.post<AuthResponse>(`${this.API_URL}/login`, credentials).pipe(
      tap((response) => {
        // Guardamos datos nuevos
        localStorage.setItem('token', response.access_token);
        this._authStatus.set(response);
      })
    );
  }

  public requestPasswordReset(payload: ForgotPasswordRequest): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.API_URL}/forgot-password`, payload);
  }

  public resetPassword(payload: ResetPasswordRequest): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.API_URL}/reset-password`, payload);
  }

  public logout(): void {
    localStorage.clear();
    document.body.classList.remove('app-dark-theme');
    // 2. Resetear el Signal de estado
    this._authStatus.set(null);
    this.router.navigateByUrl('/auth');
  }

  public checkAuthStatus(): Observable<boolean> {
    const token = localStorage.getItem('token');
    if (!token) return of(false);

    return this.http.get<AuthResponse>(`${this.API_URL}/check-status`).pipe(
      tap((response) => {
        console.log('Validando sesiÃ³n de:', response.user.email);
        this._authStatus.set(response);
        // Solo actualiza el token si el servidor generÃ³ uno nuevo
        localStorage.setItem('token', response.access_token);
      }),
      map(() => true),
      catchError(() => {
        this.logout();
        return of(false);
      })
    );
  }

  /** * Actualiza el rol del usuario actual en el estado global 
 * para que el menÃº (userModules) reaccione al instante.
 */
  public updateLocalUserRole(updatedRole: RoleModel): void {
    const currentStatus = this._authStatus();
    if (!currentStatus || !currentStatus.user) return;

    // Actualizamos el array de roles del usuario
    const updatedUser: UserModel = {
      ...currentStatus.user,
      roles: currentStatus.user.roles.map(r =>
        r.id === updatedRole.id ? updatedRole : r
      )
    };

    // Seteamos el nuevo estado (esto dispara automÃ¡ticamente userModules)
    this._authStatus.set({
      ...currentStatus,
      user: updatedUser
    });
  }

  public updateLocalUser(updatedUser: UserModel): void {
    const currentStatus = this._authStatus();
    if (!currentStatus || currentStatus.user.id !== updatedUser.id) return;

    this._authStatus.set({
      ...currentStatus,
      user: {
        ...currentStatus.user,
        ...updatedUser
      }
    });
  }

  public hasRole(roleName: string): boolean {
    const expectedRole = this.normalizeRoleName(roleName);
    return this.currentUser()?.roles?.some(role =>
      this.normalizeRoleName(role.name) === expectedRole
    ) ?? false;
  }

  private normalizeRoleName(roleName: string) {
    return roleName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]/g, '')
      .toLowerCase();
  }
}
