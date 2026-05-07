import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Achievement, UserAchievement } from '../../models/achievement.model';

@Injectable({
  providedIn: 'root'
})
export class AchievementService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:8080/api/achievements';

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('token') || localStorage.getItem('authToken');
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  // Catálogo completo de logros (no requiere token)
  getAllAchievements(): Observable<Achievement[]> {
    return this.http.get<Achievement[]>(this.apiUrl);
  }

  // Mis logros con progreso (requiere estar autenticado)
  getMyAchievements(): Observable<UserAchievement[]> {
    return this.http.get<UserAchievement[]>(`${this.apiUrl}/me`, {
      headers: this.getHeaders()
    });
  }

  // Logros desbloqueados de otro jugador por su ID
  getUserAchievements(userId: number): Observable<UserAchievement[]> {
    return this.http.get<UserAchievement[]>(`${this.apiUrl}/user/${userId}`);
  }

  // Gana un logro manualmente por su key (para pruebas)
  earn(key: string): Observable<UserAchievement> {
    return this.http.post<UserAchievement>(`${this.apiUrl}/earn/${key}`, {}, {
      headers: this.getHeaders()
    });
  }
}
