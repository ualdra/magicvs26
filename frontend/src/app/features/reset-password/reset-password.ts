import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { finalize, timeout } from 'rxjs/operators';
import { NgZone, ChangeDetectorRef } from '@angular/core';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './reset-password.html',
})
export class ResetPassword implements OnInit {
  token: string | null = null;
  newPassword = '';
  confirmPassword = '';
  
  isValidating = true;
  isTokenValid = false;
  
  isSubmitting = false;
  message: string | null = null;
  error: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private http: HttpClient,
    private router: Router,
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.token = this.route.snapshot.paramMap.get('token');
    
    if (!this.token) {
      this.isTokenValid = false;
      this.isValidating = false;
      this.error = 'Enlace de recuperación inválido.';
      return;
    }

    this.validateToken();
  }

  validateToken() {
    this.http.get<any>(`http://localhost:8080/api/password/validate?token=${this.token}`)
      .pipe(
        timeout(10000),
        finalize(() => {
          this.ngZone.run(() => {
            this.isValidating = false;
            this.cdr.detectChanges();
          });
        })
      )
      .subscribe({
        next: (res) => {
          this.ngZone.run(() => {
            this.isTokenValid = res.valid;
            this.cdr.detectChanges();
          });
        },
        error: (err) => {
          this.ngZone.run(() => {
            this.isTokenValid = false;
            this.error = err.error?.message || 'El enlace ha expirado o no es válido.';
            this.cdr.detectChanges();
          });
        }
      });
  }

  onSubmit() {
    this.message = null;
    this.error = null;

    if (this.newPassword !== this.confirmPassword) {
      this.error = 'Las contraseñas no coinciden.';
      return;
    }

    if (this.newPassword.length < 8) {
      this.error = 'La contraseña debe tener al menos 8 caracteres.';
      return;
    }

    this.isSubmitting = true;
    this.http.post<any>('http://localhost:8080/api/password/reset', {
      token: this.token,
      password: this.newPassword
    })
    .pipe(
      timeout(10000),
      finalize(() => {
        this.ngZone.run(() => {
          this.isSubmitting = false;
          this.cdr.detectChanges();
        });
      })
    )
    .subscribe({
      next: (res) => {
        this.ngZone.run(() => {
          this.message = res.message + ' Redirigiendo al login...';
          this.cdr.detectChanges();
          setTimeout(() => this.router.navigate(['/login']), 3000);
        });
      },
      error: (err) => {
        this.ngZone.run(() => {
          this.error = err.error?.message || 'Error al actualizar la contraseña.';
          this.cdr.detectChanges();
        });
      }
    });
  }
}
