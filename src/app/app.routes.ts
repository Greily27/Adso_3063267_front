import { Routes } from '@angular/router';
import { AdminLayoutComponent } from './core/components/admin-layout/admin-layout.component';
import { authGuard } from './core/guards/auth.guard';
import { moduleGuard } from './core/guards/module.guard';

export const routes: Routes = [
    {
        path: 'auth',
        loadChildren: () => import('./auth/auth.routes').then(m => m.AUTH_ROUTES)
    },
    {
        path: '',
        component: AdminLayoutComponent, // El cascarÃ³n de Material
        canActivate: [authGuard],
        children: [
            {
                path: 'dashboard',
                loadComponent: () => import('./features/dashboard/dashboard').then(m => m.Dashboard)
            },
            {
                path: 'perfil',
                loadComponent: () => import('./features/perfil/perfil').then(m => m.Perfil)
            },
            {
                path: 'users',
                canActivate: [moduleGuard],
                data: { module: 'users' },
                loadComponent: () => import('./features/users/users').then(m => m.Users)
            },
            {
                path: 'roles',
                canActivate: [moduleGuard],
                data: { module: 'roles' },
                loadComponent: () => import('./features/roles/roles').then(m => m.Roles)
            },
            {
                path: 'modules',
                canActivate: [moduleGuard],
                data: { module: 'modules' },
                loadComponent: () => import('./features/modules/modules').then(m => m.Modules)
            },
            {
                path: 'estudiantes',
                canActivate: [moduleGuard],
                data: { module: 'estudiantes' },
                loadComponent: () => import('./features/estudiantes/estudiantes').then(m => m.Estudiantes)
            },
            {
                path: 'cursos',
                canActivate: [moduleGuard],
                data: { module: 'cursos' },
                loadComponent: () => import('./features/cursos/cursos').then(m => m.Cursos)
            },
            {
                path: 'materias',
                canActivate: [moduleGuard],
                data: { module: 'materias' },
                loadComponent: () => import('./features/materias/materias').then(m => m.Materias)
            },
            {
                path: 'notas',
                canActivate: [moduleGuard],
                data: { module: 'notas' },
                loadComponent: () => import('./features/notas/notas').then(m => m.Notas)
            },
            {
                path: 'horarios',
                canActivate: [moduleGuard],
                data: { module: 'horarios' },
                loadComponent: () => import('./features/horarios/horarios').then(m => m.Horarios)
            },
            {
                path: 'guias',
                canActivate: [moduleGuard],
                data: { module: 'guias' },
                loadComponent: () => import('./features/guias/guias').then(m => m.Guias)
            },
            {
                path: 'observadores',
                canActivate: [moduleGuard],
                data: { module: 'observadores' },
                loadComponent: () => import('./features/observadores/observadores').then(m => m.Observadores)
            },
            {
                path: 'periodos',
                canActivate: [moduleGuard],
                data: { module: 'periodos' },
                loadComponent: () => import('./features/periodos/periodos').then(m => m.Periodos)
            },
            {
                path: 'boletines',
                loadComponent: () => import('./features/boletines/boletines').then(m => m.Boletines)
            },
            {
                path: 'auditorios',
                canActivate: [moduleGuard],
                data: { module: 'auditorios' },
                loadComponent: () => import('./features/auditorios/auditorios').then(m => m.Auditorios)
            },
            {
                path: 'reservas-auditorio',
                canActivate: [moduleGuard],
                data: { module: 'auditorios' },
                loadComponent: () => import('./features/auditorios/auditorios').then(m => m.Auditorios)
            },
            {
                path: 'not-found',
                loadComponent: () => import('./features/page-not-found/page-not-found').then(m => m.PageNotFound)
            },
            { path: '', redirectTo: 'dashboard', pathMatch: 'full' }
        ]
    },
    {
        path: '**',
        redirectTo: 'not-found'
    }
    // {
    //     path: '',
    //     redirectTo: 'auth',
    //     pathMatch: 'full'
    // }
];
