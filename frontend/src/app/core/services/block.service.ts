import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class BlockService {
  private readonly apiUrl = `${environment.apiUrl}/blocks`;

  constructor(private http: HttpClient) {}

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('token') || localStorage.getItem('authToken');
    let headers = new HttpHeaders();
    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`)
                       .set('Content-Type', 'application/json');
    }
    return headers;
  }

  /**
   * Bloquea a un usuario
   * @param targetId ID del usuario a bloquear
   */
  blockUser(targetId: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/${targetId}`, {}, { headers: this.getHeaders() });
  }

  /**
   * Desbloquea a un usuario
   * @param targetId ID del usuario a desbloquear
   */
  unblockUser(targetId: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${targetId}`, { headers: this.getHeaders() });
  }

  /**
   * Obtiene la lista de usuarios bloqueados por el usuario actual
   */
  getBlockedUsers(): Observable<any[]> {
    return this.http.get<any[]>(this.apiUrl, { headers: this.getHeaders() });
  }

  /**
   * Verifica si un usuario está bloqueado por el usuario actual
   * @param targetId ID del usuario a verificar
   */
  isUserBlocked(targetId: number): Observable<boolean> {
    return new Observable(observer => {
      this.getBlockedUsers().subscribe({
        next: (blockedUsers) => {
          const isBlocked = blockedUsers.some(user => user.id === targetId);
          observer.next(isBlocked);
          observer.complete();
        },
        error: (error) => {
          observer.error(error);
        }
      });
    });
  }
}