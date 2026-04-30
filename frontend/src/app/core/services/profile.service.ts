import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface UserProfile {
  id: number;
  username: string;
  displayName?: string;
  avatarUrl?: string;
  eloRating: number;
  gamesPlayed: number;
  gamesWon: number;
  gamesLost: number;
  friendsCount: number;
}

@Injectable({
  providedIn: 'root'
})
export class ProfileService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:8080/api/profile';

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('token') || localStorage.getItem('authToken');
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  getMyProfile(): Observable<UserProfile> {
    return this.http.get<UserProfile>(`${this.apiUrl}/me`, { headers: this.getHeaders() });
  }

  getUserProfile(userId: number): Observable<UserProfile> {
    return this.http.get<UserProfile>(`${this.apiUrl}/${userId}`, { headers: this.getHeaders() });
  }
}
