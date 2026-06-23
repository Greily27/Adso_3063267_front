import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { Auth } from '../services/auth'; // Asegúrate que el nombre de la clase sea Auth o AuthService
import { map, tap } from 'rxjs';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(Auth);
  const router = inject(Router);

  // 1. Si ya tenemos los datos en el Signal, permitimos el paso
  if (authService.isAuthenticated()) {
    return true;
  }

  // 2. Si no están en el Signal (ej: F5), usamos el checkAuthStatus del servicio
  return authService.checkAuthStatus().pipe(
    map(isLoggedIn => {
      if (!isLoggedIn) {
        // Si el token no es válido o no existe, al login
        router.navigateByUrl('/auth/login');
        return false;
      }
      return true; // Token válido, repobló el Signal y permite el paso
    })
  );
};