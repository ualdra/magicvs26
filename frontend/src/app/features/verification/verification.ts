import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Router, ActivatedRoute } from '@angular/router';
import { finalize } from 'rxjs/operators';
import { ChangeDetectorRef, NgZone } from '@angular/core';

@Component({
  selector: 'app-verification',
  imports: [CommonModule, FormsModule],
  templateUrl: './verification.html'
})
export class Verification {
  code = '';
  error: string | null = null;
  loading = false;
  pendingId: number | null = null;

  private readonly apiUrl = 'http://localhost:8080/api/users/register/confirm';

  constructor(private http: HttpClient, private router: Router, private route: ActivatedRoute, private cdr: ChangeDetectorRef, private ngZone: NgZone) {
    const id = this.route.snapshot.paramMap.get('pendingId');
    if (id) {
      this.pendingId = Number(id);
    } else {
      this.error = 'No se ha encontrado una solicitud de registro pendiente.';
    }
  }

  submit(): void {
    this.error = null;
    if (!this.pendingId) {
      this.error = 'Código inválido';
      return;
    }
    if (!this.code || this.code.trim().length === 0) {
      this.error = 'Introduce el código de verificación';
      return;
    }

    this.loading = true;
    this.http.post<UserResponse>(this.apiUrl, { pendingId: this.pendingId, code: this.code.trim() })
      .pipe(finalize(() => {
        this.ngZone.run(() => {
          this.loading = false;
          this.cdr.detectChanges();
        });
      }))
      .subscribe({
        next: (user) => {
          this.ngZone.run(() => {
            // Guardar datos en localstorage
            if (user.token) {
              localStorage.setItem('token', user.token);
            }
            localStorage.setItem('user', JSON.stringify(user));
            
            // Forzar recarga ligera o navegación para actualizar el estado del layout
            this.router.navigateByUrl('/').then(() => {
              window.location.reload(); // Asegura que el Nav se refresque con el usuario logueado
            });
          });
        },
        error: (err: HttpErrorResponse) => {
          this.ngZone.run(() => {
            const backendMsg = err.error?.message || null;
            if (err.status === 400) {
              this.error = backendMsg || 'Código de verificación incorrecto o expirado.';
            } else if (err.status === 0) {
              this.error = 'No se ha podido conectar con el servidor';
            } else {
              this.error = backendMsg || 'Error inesperado al verificar el código';
            }
            this.cdr.detectChanges();
          });
        }
      });
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
