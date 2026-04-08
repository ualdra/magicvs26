import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';

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

  private readonly apiUrl = 'http://localhost:8080/api/users/login';

  constructor(private http: HttpClient, private router: Router) {}

  onSubmit(): void {
    this.message = null;
    this.error = null;

    this.http
      .post<UserResponse>(this.apiUrl, {
        usernameOrEmail: this.usernameOrEmail,
        password: this.password,
      })
      .subscribe({
        next: (user) => {
          this.message = `Bienvenido, ${user.displayName ?? user.username}!`;
          // Guardamos token y usuario en localStorage y navegamos al Home
          if (user.token) {
            localStorage.setItem('token', user.token);
          }
          localStorage.setItem('user', JSON.stringify(user));
          this.router.navigateByUrl('/');
        },
        error: (err: HttpErrorResponse) => {
          if (err.status === 401 || err.status === 400) {
            this.error = 'Usuario o contraseña incorrectos';
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
