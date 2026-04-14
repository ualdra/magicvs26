import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { finalize } from 'rxjs/operators';
import { ChangeDetectorRef, NgZone } from '@angular/core';
import { isValidUsername, isValidEmail, isValidPassword, sanitizeDisplayName, containsMaliciousPayload, isValidDisplayName } from '../../shared/validation';

@Component({
  selector: 'app-registro',
  imports: [CommonModule, FormsModule],
  templateUrl: './registro.html',
  styleUrl: './registro.scss',
})
export class Registro {
  username = '';
  email = '';
  password = '';
  displayName = '';
  message: string | null = null;
  error: string | null = null;
  loading = false;

  private readonly apiUrlInitiate = 'http://localhost:8080/api/users/register/initiate';

  constructor(private http: HttpClient, private router: Router, private cdr: ChangeDetectorRef, private ngZone: NgZone) {}

  onSubmit(): void {
    this.message = null;
    this.error = null;

    // Frontend validation
    if (!isValidUsername(this.username)) {
      if (/\s/.test(this.username)) {
        this.error = 'El nombre de usuario no puede contener espacios.';
      } else {
        this.error = 'Usuario inválido. Solo letras (A-Z, a-z), guion bajo o guion medio (3-16 caracteres).';
      }
      return;
    }
    if (!isValidEmail(this.email)) {
      this.error = 'Email con formato inválido.';
      return;
    }
    if (!isValidPassword(this.password)) {
      this.error = 'La contraseña debe tener entre 8 y 12 caracteres, al menos una mayúscula, un número y un símbolo.';
      return;
    }
    if (containsMaliciousPayload(this.username) || containsMaliciousPayload(this.email) || containsMaliciousPayload(this.displayName)) {
      this.error = 'Entrada sospechosa detectada.';
      return;
    }

    const safeDisplay = sanitizeDisplayName(this.displayName);

    // validate displayName (apodo) - do not allow spaces
    if (safeDisplay && !isValidDisplayName(safeDisplay)) {
      this.error = 'Nombre visible inválido. El apodo no puede contener espacios ni caracteres especiales.';
      return;
    }

    this.loading = true;
    this.http
      .post<{ pendingId: number }>(this.apiUrlInitiate, {
        username: this.username,
        email: this.email,
        password: this.password,
        displayName: safeDisplay,
      })
      .pipe(
        finalize(() => {
          this.ngZone.run(() => {
            this.loading = false;
            this.cdr.detectChanges();
          });
        })
      )
      .subscribe({
        next: (resp) => {
          this.ngZone.run(() => {
            // navigate to verification page with pendingId
            this.router.navigateByUrl(`/verify/${resp.pendingId}`);
          });
        },
        error: (err: HttpErrorResponse) => {
          this.ngZone.run(() => {
            // Prefer backend message when available
            const backendMsg = err.error?.message || err.error?.error || err.error?.detail || null;
            if (err.status === 400) {
              if (backendMsg) {
                // map some known backend messages to friendlier texts
                const lower = backendMsg.toLowerCase();
                if (lower.includes('email') && lower.includes('en uso')) {
                  this.error = 'El correo ya está registrado.';
                } else if (lower.includes('nombre de usuario') && lower.includes('en uso')) {
                  this.error = 'El nombre de usuario ya está en uso.';
                } else {
                  this.error = backendMsg;
                }
              } else {
                this.error = 'Datos inválidos o ya existentes';
              }
            } else if (err.status === 409) {
              this.error = backendMsg ?? 'Recurso en conflicto';
            } else if (err.status === 502) {
              this.error = backendMsg ?? 'No se pudo enviar el correo de verificación (SMTP)';
            } else if (err.status === 0) {
              this.error = 'No se ha podido conectar con el servidor';
            } else {
              this.error = 'Error al conectar con el servidor';
            }
            this.cdr.detectChanges();
          });
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
