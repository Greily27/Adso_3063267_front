import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Auth } from '../services/auth';

export const dashboardGuard: CanActivateFn = () => {
  const auth = inject(Auth);
  return auth.isAcudiente() ? inject(Router).createUrlTree(['/estudiantes']) : true;
};
