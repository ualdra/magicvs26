import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { finalize, timeout } from 'rxjs/operators';
import { ChangeDetectorRef, NgZone } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { isValidEmail } from '../../shared/validation';
import { GoogleAuthService } from '../../core/services/google-auth.service';
import { OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-login',
  imports: [CommonModule, FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login implements OnInit {
  usernameOrEmail = '';
  password = '';
  message: string | null = null;
  error: string | null = null;
  loading = false;
  
  // Password Recovery
  showForgotModal = false;
  forgotEmail = '';
  forgotLoading = false;
  forgotMessage: string | null = null;
  forgotError: string | null = null;

  // Google Registration Prompt
  showRegisterModal = false;
  googleDataForPrompt: any = null;
  private googleSub?: Subscription;

  private readonly apiUrl = 'http://localhost:8080/api/users/login';

  // inject ChangeDetectorRef and NgZone to force UI updates if needed
  constructor(
    private http: HttpClient,
    private router: Router,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone,
    private googleAuth: GoogleAuthService
  ) {}

  ngOnInit() {
    // 1. Verificamos si venimos de una redirección de Google
    this.checkGoogleRedirect();

    this.googleSub = this.googleAuth.showRegisterPrompt$.subscribe(data => {
      this.ngZone.run(() => {
        this.googleDataForPrompt = data;
        this.showRegisterModal = true;
        this.cdr.detectChanges();
      });
    });
  }

  private checkGoogleRedirect() {
    const hash = window.location.hash;
    if (hash && hash.includes('id_token=')) {
      const params = new URLSearchParams(hash.replace('#', '?'));
      const idToken = params.get('id_token');
      if (idToken) {
        // Limpiamos la URL para que no quede el token expuesto en el historial
        window.history.replaceState({}, document.title, window.location.pathname);
        this.googleAuth.handleRedirectResult(idToken);
      }
    }
  }

  onGoogleLogin() {
    this.googleAuth.loginWithGoogleRedirect('login');
  }

  ngOnDestroy() {
    this.googleSub?.unsubscribe();
  }

  proceedToRegister() {
    this.showRegisterModal = false;
    this.router.navigate(['/register/confirm'], { 
      state: { googleData: this.googleDataForPrompt } 
    });
  }

  cancelRegisterPrompt() {
    this.showRegisterModal = false;
    this.googleDataForPrompt = null;
  }

  // Password Recovery Methods
  openForgotModal() {
    this.showForgotModal = true;
    this.forgotEmail = this.usernameOrEmail.includes('@') ? this.usernameOrEmail : '';
    this.forgotError = null;
    this.forgotMessage = null;
  }

  closeForgotModal() {
    this.showForgotModal = false;
  }

  sendForgotEmail() {
    this.forgotMessage = null;
    this.forgotError = null;

    if (!this.forgotEmail || !isValidEmail(this.forgotEmail.trim())) {
      this.forgotError = 'Introduce un email válido.';
      return;
    }

    this.forgotLoading = true;
    this.http.post<any>('http://localhost:8080/api/password/forgot', { email: this.forgotEmail.trim() })
      .pipe(
        timeout(10000),
        finalize(() => {
          this.ngZone.run(() => {
            this.forgotLoading = false;
            this.cdr.detectChanges();
          });
        })
      )
      .subscribe({
        next: (res) => {
          this.ngZone.run(() => {
            this.forgotMessage = res.message;
            this.cdr.detectChanges();
            setTimeout(() => this.closeForgotModal(), 4000);
          });
        },
        error: (err) => {
          this.ngZone.run(() => {
            this.forgotError = err.error?.message || 'Error al enviar el email. Intenta más tarde.';
            this.cdr.detectChanges();
          });
        }
      });
  }

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
          this.message = `Bienvenido, ${user.displayName ?? user.username}!`;
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
          localStorage.setItem('authToken', user.token);
          localStorage.setItem('user', JSON.stringify(user));

          const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') || '/';
          this.ngZone.run(() => this.router.navigateByUrl(returnUrl));
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
  isOnline?: boolean;
  lastSeenAt?: string | null;
}