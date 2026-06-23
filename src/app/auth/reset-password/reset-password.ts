import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import Swal from 'sweetalert2';

import { Auth } from '../../core/services/auth';

@Component({
  selector: 'app-reset-password',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule
  ],
  templateUrl: './reset-password.html',
  styleUrl: '../log-in/log-in.scss',
})
export class ResetPassword {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private authService = inject(Auth);

  hidePassword = true;
  hideConfirmPassword = true;
  isLoading = false;

  token = this.route.snapshot.paramMap.get('token') ?? this.route.snapshot.queryParamMap.get('token') ?? '';
  hasToken = computed(() => !!this.token);

  resetPasswordForm = this.fb.group({
    password: ['', [Validators.required, Validators.minLength(6)]],
    confirmPassword: ['', [Validators.required]]
  }, { validators: this.passwordsMatch });

  onSubmit() {
    if (this.resetPasswordForm.invalid || this.isLoading || !this.token) return;

    const password = this.resetPasswordForm.controls.password.value ?? '';
    this.isLoading = true;

    this.authService.resetPassword({ token: this.token, password }).subscribe({
      next: () => {
        this.isLoading = false;
        Swal.fire({
          icon: 'success',
          title: 'Contraseña actualizada',
          text: 'Ya puedes iniciar sesión con tu nueva contraseña.',
          confirmButtonText: 'Ir al login',
          confirmButtonColor: '#146b50'
        }).then(() => this.router.navigate(['/auth/login']));
      },
      error: (err) => {
        this.isLoading = false;
        Swal.fire({
          icon: 'error',
          title: 'No se pudo actualizar',
          text: err?.error?.message ?? 'El enlace pudo expirar o no ser válido.',
          confirmButtonText: 'Aceptar',
          confirmButtonColor: '#146b50'
        });
      }
    });
  }

  private passwordsMatch(control: AbstractControl): ValidationErrors | null {
    const password = control.get('password')?.value;
    const confirmPassword = control.get('confirmPassword')?.value;

    return password && confirmPassword && password !== confirmPassword
      ? { passwordsMismatch: true }
      : null;
  }
}
