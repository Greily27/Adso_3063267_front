import { Component, DestroyRef, inject, signal } from '@angular/core';
import { NavigationCancel, NavigationEnd, NavigationError, NavigationStart, Router, RouterOutlet } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);
  private loadingTimeout?: ReturnType<typeof setTimeout>;
  private readonly initialLoaderDuration = 2500;
  private readonly routeLoaderDuration = 650;
  private initialLoadDone = false;

  protected readonly title = signal('adso_3063267');
  protected readonly isLoading = signal(true);

  constructor() {
    this.hideLoader(this.initialLoaderDuration, true);

    this.router.events
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(event => {
        if (event instanceof NavigationStart) {
          this.showLoader();
          return;
        }

        if (
          event instanceof NavigationEnd
          || event instanceof NavigationCancel
          || event instanceof NavigationError
        ) {
          this.hideLoader(this.initialLoadDone ? this.routeLoaderDuration : this.initialLoaderDuration, true);
        }
      });
  }

  private showLoader() {
    if (this.loadingTimeout) {
      clearTimeout(this.loadingTimeout);
    }

    this.isLoading.set(true);
  }

  private hideLoader(delay = 0, markInitialDone = false) {
    if (this.loadingTimeout) {
      clearTimeout(this.loadingTimeout);
    }

    this.loadingTimeout = setTimeout(() => {
      this.isLoading.set(false);
      if (markInitialDone) {
        this.initialLoadDone = true;
      }
    }, delay);
  }
}
