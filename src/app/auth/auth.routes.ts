import { Routes } from '@angular/router';

export const AUTH_ROUTES: Routes = [
  {
    path: '',
    children: [
      {
        path: 'login',
        loadComponent: () => import('./log-in/log-in').then(m => m.LogIn)
      },
      {
        path: 'sign-in',
        loadComponent: () => import('./sign-in/sign-in').then(m => m.SignIn)
      },
      {
        path: 'forgot-password',
        loadComponent: () => import('./forgot-password/forgot-password').then(m => m.ForgotPassword)
      },
      {
        path: 'reset-password/:token',
        loadComponent: () => import('./reset-password/reset-password').then(m => m.ResetPassword)
      },
      { path: '', redirectTo: 'login', pathMatch: 'full' }
    ]
  }
];
