import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { finalize, timeout } from 'rxjs/operators';
import { ChangeDetectorRef, NgZone } from '@angular/core';
import { Router } from '@angular/router';
import { isValidEmail } from '../../shared/validation';

@Component({
  selector: 'app-login',
  imports: [CommonModule, FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  usernameOrEmail = '';
  password = '';
  message: string | null = null;
  error: string | null = null;
  loading = false;

  private readonly apiUrl = 'http://localhost:8080/api/users/login';

  // inject ChangeDetectorRef and NgZone to force UI updates if needed
  constructor(
    private http: HttpClient,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {}

  onSubmit(): void {
    this.message = null;
    this.error = null;

    const usernameOrEmailTrimmed = this.usernameOrEmail.trim();
    const passwordTrimmed = this.password.trim();

    // Only allow login via email (not username)
    if (!isValidEmail(usernameOrEmailTrimmed)) {
      this.error = 'Introduce un correo válido.';
      return;
    }

    if (!passwordTrimmed || passwordTrimmed.length < 8) {
      this.error = 'Introduce tu contraseña';
      return;
    }

    this.loading = true;
    this.http
      .post<UserResponse>(this.apiUrl, {
        usernameOrEmail: usernameOrEmailTrimmed,
        password: passwordTrimmed,
      })
      .pipe(
        // evita que la petición quede pendiente indefinidamente
        timeout(10000),
        // asegura que loading vuelva a false siempre (dentro de NgZone)
        finalize(() => {
          this.ngZone.run(() => {
            this.loading = false;
            this.cdr.detectChanges();
          });
        })
      )
      .subscribe({
        next: (user) => {
          // backend must return a token on successful auth
          if (!user || !user.token) {
            // treat missing token as invalid credentials
            this.ngZone.run(() => {
              this.error = 'Credenciales incorrectas';
              this.cdr.detectChanges();
            });
            return;
          }

          localStorage.setItem('token', user.token);
          localStorage.setItem('user', JSON.stringify(user));

          this.ngZone.run(() => this.router.navigateByUrl('/'));
        },
        error: (err: any) => {
          if (err && err.name === 'TimeoutError') {
            this.ngZone.run(() => {
              this.error = 'Tiempo de espera agotado. Intenta de nuevo.';
              this.cdr.detectChanges();
            });
            return;
          }

          // Usuario no existe o contraseña incorrecta (u otro error): mensaje genérico
          if (err instanceof HttpErrorResponse) {
            if (err.status === 0) {
              this.ngZone.run(() => {
                this.error = 'No se ha podido conectar con el servidor. Comprueba que el backend está en ejecución.';
                this.cdr.detectChanges();
              });
            } else if (err.status >= 400 && err.status < 500) {
              // map all client errors to invalid credentials
              this.ngZone.run(() => {
                this.error = 'Credenciales incorrectas';
                this.cdr.detectChanges();
              });
            } else {
              this.ngZone.run(() => {
                this.error = 'Error del servidor. Intenta más tarde.';
                this.cdr.detectChanges();
              });
            }
          } else {
            this.ngZone.run(() => {
              this.error = 'Error de red. Comprueba tu conexión.';
              this.cdr.detectChanges();
            });
          }
        },
      });
  }

  onInputChange(): void {
    this.error = null;
    this.message = null;
  }
}

interface UserResponse {
  id: number;
  username: string;
  email: string;
  displayName: string | null;
  friendTag: string;
  token?: string;
  eloRating: number | null;
  friendsCount: number | null;
}