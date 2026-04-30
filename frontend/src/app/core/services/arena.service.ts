import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ArenaService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:8080/api';

  sendInvite(receiverId: number, deckId?: number): Observable<any> {
    const token = localStorage.getItem('token');
    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);
    const body = deckId ? { deckId } : {};
    
    return this.http.post(`${this.apiUrl}/arena/invite/${receiverId}`, body, { headers });
  }

  joinMatchmaking(deckId: number): Observable<any> {
    const token = localStorage.getItem('token');
    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);
    
    return this.http.post(`${this.apiUrl}/matchmaking/join`, { deckId }, { headers });
  }

  leaveMatchmaking(): Observable<any> {
    const token = localStorage.getItem('token');
    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);
    
    return this.http.post(`${this.apiUrl}/matchmaking/leave`, {}, { headers });
  }

  acceptInvite(matchId: number, deckId?: number): Observable<any> {
    const token = localStorage.getItem('token');
    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);
    const body = deckId ? { deckId } : {};
    
    return this.http.post(`${this.apiUrl}/arena/accept/${matchId}`, body, { headers });
  }
}
