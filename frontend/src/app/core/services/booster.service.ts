import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { CardSummary } from '../../models/user-card.model';

@Injectable({
  providedIn: 'root'
})
export class BoosterService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:8080/api/boosters';

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('token') || localStorage.getItem('authToken');
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  openBooster(): Observable<CardSummary[]> {
    return this.http.post<CardSummary[]>(`${this.apiUrl}/open`, {}, { headers: this.getHeaders() });
  }
}
