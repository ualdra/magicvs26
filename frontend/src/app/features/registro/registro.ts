import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';

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

  private readonly apiUrl = 'http://localhost:8080/api/users/register';

  constructor(private http: HttpClient, private router: Router) {}

  onSubmit(): void {
    this.message = null;
    this.error = null;

    this.http
      .post<UserResponse>(this.apiUrl, {
        username: this.username,
        email: this.email,
        password: this.password,
        displayName: this.displayName,
      })
      .subscribe({
        next: (user) => {
          this.message = `Cuenta creada. Bienvenido, ${user.displayName ?? user.username}!`;
          if (user.token) {
            localStorage.setItem('token', user.token);
          }
          localStorage.setItem('user', JSON.stringify(user));
          this.router.navigateByUrl('/');
        },
        error: (err: HttpErrorResponse) => {
          if (err.status === 400) {
            this.error = err.error?.message ?? 'Datos inválidos o ya existentes';
          } else {
            this.error = 'Error al conectar con el servidor';
          }
        },
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
