import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { delay, map } from 'rxjs/operators';
import { Match } from '../../models/match.model';

@Injectable({
  providedIn: 'root'
})
export class MatchService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:8080/api/matches';

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('token') || localStorage.getItem('authToken');
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  getLiveMatches(): Observable<Match[]> {
    const liveMatches: Match[] = [
      {
        id: 'LV-001',
        status: 'LIVE',
        format: 'MODERN',
        player1: {
          username: 'Xalthar_MTG',
          elo: 1420,
          deckSummary: { archetype: 'Murktide Regent', colors: ['U', 'R'] }
        },
        player2: {
          username: 'Lumina_Soul',
          elo: 1385,
          deckSummary: { archetype: 'Hammer Time', colors: ['W'] }
        }
      },
      {
        id: 'LV-002',
        status: 'LIVE',
        format: 'STANDARD',
        player1: {
          username: 'Spark_Mage',
          elo: 1250,
          deckSummary: { archetype: 'Mono Red Burn', colors: ['R'] }
        },
        player2: {
          username: 'Nature_Protector',
          elo: 1245,
          deckSummary: { archetype: 'Selesnya Toxic', colors: ['G', 'W'] }
        }
      }
    ];
    return of(liveMatches).pipe(delay(800));
  }

  getMatchHistory(): Observable<Match[]> {
    return this.http.get<Match[]>(`${this.apiUrl}/history`, { headers: this.getHeaders() });
  }

  getMatchById(id: string): Observable<Match | undefined> {
    return this.getMatchHistory().pipe(
      map(matches => matches.find(m => m.id === id))
    );
  }
}
