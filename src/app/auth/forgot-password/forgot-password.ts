import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import Swal from 'sweetalert2';

import { Auth } from '../../core/services/auth';

@Component({
  selector: 'app-forgot-password',
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
  templateUrl: './forgot-password.html',
  styleUrl: '../log-in/log-in.scss',
})
export class ForgotPassword {
  private fb = inject(FormBuilder);
  private authService = inject(Auth);

  isLoading = false;

  forgotPasswordForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]]
  });

  onSubmit() {
    if (this.forgotPasswordForm.invalid || this.isLoading) return;

    const email = this.forgotPasswordForm.controls.email.value ?? '';
    this.isLoading = true;

    this.authService.requestPasswordReset({ email }).subscribe({
      next: () => this.showSuccessMessage(),
      error: (err) => this.showErrorMessage(err)
    });
  }

  private showSuccessMessage() {
    this.isLoading = false;

    Swal.fire({
      icon: 'success',
      title: 'Revisa tu correo',
      text: 'Si el correo está registrado, recibirás un enlace para recuperar tu contraseña.',
      confirmButtonText: 'Aceptar',
      confirmButtonColor: '#146b50'
    });

    this.forgotPasswordForm.reset();
  }

  private showErrorMessage(err: any) {
    this.isLoading = false;

    const message = err?.status === 404
      ? 'El endpoint /auth/forgot-password no existe todavía en el backend.'
      : err?.status === 0
        ? 'No se pudo conectar con el backend publicado.'
        : err?.error?.message ?? 'No se pudo enviar el enlace de recuperación.';

    Swal.fire({
      icon: 'error',
      title: 'No se envió el correo',
      text: message,
      confirmButtonText: 'Aceptar',
      confirmButtonColor: '#146b50'
    });
  }
}
