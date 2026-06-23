import { Component, computed, inject, signal } from '@angular/core';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { AsyncPipe } from '@angular/common';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { Observable } from 'rxjs';
import { map, shareReplay } from 'rxjs/operators';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Auth } from '../../services/auth';

@Component({
  selector: 'app-admin-layout',
  templateUrl: './admin-layout.component.html',
  styleUrl: './admin-layout.component.scss',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatToolbarModule,
    MatButtonModule,
    MatSidenavModule,
    MatListModule,
    MatIconModule,
    AsyncPipe,
  ],
})
export class AdminLayoutComponent {
  private breakpointObserver = inject(BreakpointObserver);
  public authService = inject(Auth);
  public isDarkTheme = signal(false);
  private brokenCurrentUserPhoto = signal('');
  public menuItems = computed(() => {
    const modules = this.authService.userModules();
    const normalizedModules = modules.map(moduleName => this.getModuleRoute(moduleName));
    const currentUser = this.authService.currentUser();
    const roleNames = currentUser?.roles?.map(role => this.normalizeName(role.name)) ?? [];
    const isStudent = !!currentUser?.estudiante?.id || roleNames.some(roleName =>
      ['estudiante', 'estudiantes', 'alumno', 'alumnos'].includes(roleName)
    );
    const shouldShowBoletines = normalizedModules.some(moduleName =>
      ['boletines', 'periodos', 'notas', 'estudiantes'].includes(moduleName)
    ) || isStudent;
    const nextModules = shouldShowBoletines && !normalizedModules.includes('boletines')
      ? [...modules, 'boletines']
      : modules;

    return ['perfil', ...new Set(nextModules.filter(moduleName => this.getModuleRoute(moduleName) !== 'perfil'))];
  });
  public currentUser = this.authService.currentUser;
  private moduleIcons: Record<string, string> = {
    users: 'group',
    usuarios: 'group',
    roles: 'admin_panel_settings',
    modules: 'widgets',
    modulos: 'widgets',
    estudiantes: 'school',
    cursos: 'class',
    materias: 'menu_book',
    notas: 'grade',
    guias: 'description',
    horarios: 'calendar_month',
    observadores: 'assignment',
    periodos: 'event',
    boletines: 'article',
    auditorios: 'event_seat',
    'reservas-auditorio': 'event_seat',
    perfil: 'account_circle',
  };

  constructor() {
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    this.setTheme(savedTheme ? savedTheme === 'dark' : prefersDark);
  }

  isHandset$: Observable<boolean> = this.breakpointObserver.observe(Breakpoints.Handset).pipe(
    map((result) => result.matches),
    shareReplay(),
  );

  toggleTheme() {
    this.setTheme(!this.isDarkTheme());
  }

  logout(){
    this.authService.logout();
  }

  getCurrentUserPhoto() {
    return this.getValidPhotoSource(this.currentUser()?.photo);
  }

  hasCurrentUserPhoto() {
    const photo = this.getCurrentUserPhoto();

    return !!photo && photo !== this.brokenCurrentUserPhoto();
  }

  getCurrentUserRole() {
    const roleName = this.currentUser()?.roles?.[0]?.name ?? 'Usuario';

    return roleName
      .replace(/^rol\s+/i, '')
      .trim()
      .toUpperCase();
  }

  getCurrentUserName() {
    const user = this.currentUser();

    return `${user?.names ?? ''} ${user?.lastNames ?? ''}`.trim()
      || user?.email
      || 'Sin nombre';
  }

  onUserPhotoError(event: Event) {
    const image = event.target as HTMLImageElement;
    this.brokenCurrentUserPhoto.set(image.currentSrc || image.src || this.getCurrentUserPhoto());
  }

  onModuleClick(event: MouseEvent, moduleName: string) {
    return;
  }

  getModuleLink(moduleName: string) {
    return `/${this.getModuleRoute(moduleName)}`;
  }

  getModuleIcon(moduleName: string) {
    return this.moduleIcons[this.getModuleRoute(moduleName)] ?? 'apps';
  }

  getModuleLabel(moduleName: string) {
    const moduleLabels: Record<string, string> = {
      users: 'Usuarios',
      roles: 'Roles',
      modules: 'Módulos',
      estudiantes: 'Estudiantes',
      cursos: 'Cursos',
      materias: 'Materias',
      notas: 'Notas',
      guias: 'Guías',
      horarios: 'Horarios',
      observadores: 'Observadores',
      periodos: 'Períodos',
      boletines: 'Boletines',
      auditorios: 'Auditorios',
      'reservas-auditorio': 'Auditorios',
      perfil: 'Perfil'
    };

    const routeName = this.getModuleRoute(moduleName);

    return moduleLabels[routeName] ?? moduleName.charAt(0).toUpperCase() + moduleName.slice(1);
  }

  getModuleRoute(moduleName: string) {
    const normalizedName = this.normalizeName(moduleName);

    const moduleRoutes: Record<string, string> = {
      usuarios: 'users',
      usuario: 'users',
      modulos: 'modules',
      modulo: 'modules',
      observador: 'observadores',
      periodo: 'periodos',
      boletin: 'boletines',
      guia: 'guias',
      guias: 'guias',
      horario: 'horarios',
      auditorio: 'auditorios',
      reservas_auditorio: 'auditorios',
      'reservas-auditorio': 'auditorios'
    };

    return moduleRoutes[normalizedName] ?? normalizedName;
  }

  private normalizeName(value: string) {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  private getValidPhotoSource(photo?: string | null) {
    const cleanPhoto = photo?.trim();
    const normalizedPhoto = cleanPhoto?.toLowerCase();

    if (!cleanPhoto || normalizedPhoto === 'default.jpg' || normalizedPhoto?.includes('colplinista')) {
      return '';
    }

    if (this.isRawBase64Image(cleanPhoto)) {
      return `data:image/${this.getBase64ImageType(cleanPhoto)};base64,${cleanPhoto}`;
    }

    if (
      cleanPhoto.startsWith('data:image/')
      || cleanPhoto.startsWith('http://')
      || cleanPhoto.startsWith('https://')
      || cleanPhoto.startsWith('/')
    ) {
      return cleanPhoto;
    }

    const relativePhotoPath = cleanPhoto
      .replace(/\\/g, '/')
      .replace(/^\.?\//, '');

    const staticPhotoPath = relativePhotoPath.startsWith('uploads/')
      ? relativePhotoPath
      : `uploads/${relativePhotoPath}`;

    return `http://localhost:3000/${staticPhotoPath}`;
  }

  private isRawBase64Image(value: string) {
    return /^(\/9j\/|iVBORw0KGgo|R0lGODlh|UklGR)/.test(value);
  }

  private getBase64ImageType(value: string) {
    if (value.startsWith('iVBORw0KGgo')) return 'png';
    if (value.startsWith('R0lGODlh')) return 'gif';
    if (value.startsWith('UklGR')) return 'webp';

    return 'jpeg';
  }

  private setTheme(isDark: boolean) {
    this.isDarkTheme.set(isDark);
    document.body.classList.toggle('app-dark-theme', isDark);
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  }
}
