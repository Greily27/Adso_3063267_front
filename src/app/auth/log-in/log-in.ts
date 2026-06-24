import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { MatCardModule } from '@angular/material/card';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import Swal from 'sweetalert2';
import { LoginInterface } from '../interfaces/login';
import { Auth } from '../../core/services/auth';

@Component({
  selector: 'app-log-in',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatInputModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatCheckboxModule,
    RouterLink
  ],
  templateUrl: './log-in.html',
  styleUrl: './log-in.scss',
})
export class LogIn {
  private fb = inject(FormBuilder);
  private authService = inject(Auth);
  private router = inject(Router);

  hidePassword = true;

  loginForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]]
  });

  onSubmit() {
    if (this.loginForm.invalid) return;

    const rawForm = this.loginForm.value as LoginInterface;
    const credentials: LoginInterface = {
      email: rawForm.email.trim().toLowerCase(),
      password: rawForm.password
    };

    this.authService.login(credentials).subscribe({
      next: (res) => {
        console.log('Usuario autenticado:', res);
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        console.error('Error en login:', err?.error?.message ?? err);
        this.showInvalidCredentialsAlert();
      }
    });
  }

  private showInvalidCredentialsAlert() {
    Swal.fire({
      icon: 'error',
      title: 'No se pudo iniciar sesión',
      text: 'Usuario o contraseña incorrectos.',
      confirmButtonText: 'Aceptar',
      confirmButtonColor: '#146b50'
    });
  }
}
