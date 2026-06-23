import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Auth } from '../services/auth';

export const moduleGuard: CanActivateFn = (route, state) => {
  const authService = inject(Auth);
  const router = inject(Router);

  // 1. Obtenemos el nombre del mÃ³dulo (con un fallback vacÃ­o si es undefined)
  const requiredModule = route.data['module'] as string;

  // 2. SI LA RUTA NO TIENE 'module' DEFINIDO, dejamos pasar 
  // (O puedes decidir bloquear, pero para Dashboard debe ser flexible)
  if (!requiredModule) {
    return true; 
  }

  // 3. Ahora sÃ­, válidamos con seguridad
  const normalizedRequiredModule = requiredModule
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

  const hasAccess = authService.userModules().includes(normalizedRequiredModule);

  if (hasAccess) {
    return true;
  }

  console.warn(`Acceso denegado al mÃ³dulo: ${requiredModule}`);
  router.navigate(['/dashboard']); 
  return false;
};
