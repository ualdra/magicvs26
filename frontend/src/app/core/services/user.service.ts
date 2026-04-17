import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin } from 'rxjs';
import { map } from 'rxjs/operators';
import { User } from '../../models/user.model';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:8080/api/users';
  private profileUrl = 'http://localhost:8080/api/profile';

  getUsers(): Observable<User[]> {
    return this.http.get<User[]>(this.apiUrl);
  }

  getUserProfile(id: string | number): Observable<User> {
    return forkJoin({
      profile: this.http.get<any>(`${this.profileUrl}/${id}`),
      decks: this.http.get<any[]>(`${this.profileUrl}/${id}/decks`)
    }).pipe(
      map(({ profile, decks }) => {
        const winRate = profile.gamesPlayed > 0 
          ? Math.round((profile.gamesWon / profile.gamesPlayed) * 100 * 10) / 10 
          : 0;

        return {
          id: profile.id,
          username: profile.username,
          elo: profile.eloRating,
          avatarUrl: profile.avatarUrl,
          bio: profile.bio,
          stats: {
            matchesPlayed: profile.gamesPlayed,
            winRate: winRate,
            wins: profile.gamesWon,
            losses: profile.gamesLost,
            tournamentsWon: 0, // Placeholder
            globalRank: 0 // Placeholder
          },
          decks: decks.map(d => ({
            id: d.id,
            name: d.name,
            format: d.formatName,
            colors: d.colors,
            imageUrl: null // Placeholder as not in DTO
          }))
        };
      })
    );
  }
}
