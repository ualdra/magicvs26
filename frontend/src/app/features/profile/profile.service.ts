import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, Subject, map } from 'rxjs';

export interface ProfileResponse {
  id: number;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  country: string | null;
  bio: string | null;
  eloRating: number | null;
  gamesPlayed: number | null;
  gamesWon: number | null;
  gamesLost: number | null;
  friendTag: string | null;
  friendsCount: number | null;
  decksCount: number | null;
  email?: string | null;
  createdAt?: string | null;
  isOnline?: boolean | null;
  lastSeenAt?: string | null;
  manualRegistration?: boolean;
  googleLinked?: boolean;
}

export interface ProfileDeckSummary {
  id: number;
  name: string;
  description: string | null;
  formatName: string | null;
  totalCards: number | null;
  isPublic: boolean | null;
  updatedAt: string | null;
  createdAt?: string | null;
  colors?: string[];
  mainImageUrl?: string | null;
}

interface ApiDeckSummary {
  id: number;
  name: string;
  description?: string | null;
  formatName?: string | null;
  totalCards?: number | null;
  isPublic?: boolean | null;
  updatedAt?: string | null;
  createdAt?: string | null;
  colors?: string[] | string | null;
  colorIdentity?: string[] | string | null;
  mainColors?: string[] | string | null;
  mainImageUrl?: string | null;
}

@Injectable({
  providedIn: 'root',
})
export class ProfileService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'http://localhost:8080/api/profile';

  private profileUpdated = new Subject<ProfileResponse>();
  profileUpdated$ = this.profileUpdated.asObservable();

  notifyProfileUpdate(profile: ProfileResponse): void {
    this.profileUpdated.next(profile);
  }

  getProfile(userId: string = 'me'): Observable<ProfileResponse> {
    return this.http
      .get<ProfileResponse>(this.buildUrl(userId), { headers: this.authHeaders() })
      .pipe(map((profile) => this.normalizeProfile(profile)));
  }

  getDecks(userId: string = 'me'): Observable<ProfileDeckSummary[]> {
    return this.http
      .get<ApiDeckSummary[]>(`${this.buildUrl(userId)}/decks`, { headers: this.authHeaders() })
      .pipe(map((decks) => decks.map((deck) => this.normalizeDeck(deck))));
  }

  updateProfile(data: Partial<ProfileResponse>): Observable<ProfileResponse> {
    return this.http
      .patch<ProfileResponse>(`${this.apiUrl}/me`, data, { headers: this.authHeaders() })
      .pipe(map((profile) => this.normalizeProfile(profile)));
  }

  exportDeck(deckId: number): Observable<Blob> {
    return this.http.get(`http://localhost:8080/api/decks/${deckId}/export`, {
      headers: this.authHeaders(),
      responseType: 'blob'
    });
  }

  importDeck(name: string, deckText: string): Observable<{ deck: any, missingCards: string[] }> {
    return this.http.post<{ deck: any, missingCards: string[] }>('http://localhost:8080/api/decks/import', { name, deckText }, { headers: this.authHeaders() });
  }

  deleteAccount(): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/me`, { headers: this.authHeaders() });
  }

  changePassword(oldPassword: string, newPassword: string): Observable<void> {
    return this.http.patch<void>(`${this.apiUrl}/me/password`, { oldPassword, newPassword }, { headers: this.authHeaders() });
  }

  private buildUrl(userId: string): string {
    return userId === 'me' ? `${this.apiUrl}/me` : `${this.apiUrl}/${userId}`;
  }

  private authHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    return token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : new HttpHeaders();
  }

  private normalizeProfile(profile: ProfileResponse): ProfileResponse {
    return {
      ...profile,
      decksCount: profile.decksCount ?? 0,
    };
  }

  private normalizeDeck(deck: ApiDeckSummary): ProfileDeckSummary {
    return {
      id: deck.id,
      name: deck.name,
      description: deck.description ?? null,
      formatName: deck.formatName ?? null,
      totalCards: deck.totalCards ?? null,
      isPublic: deck.isPublic ?? null,
      updatedAt: deck.updatedAt ?? null,
      createdAt: deck.createdAt ?? null,
      colors: this.normalizeColors(deck.colors ?? deck.colorIdentity ?? deck.mainColors),
      mainImageUrl: deck.mainImageUrl ?? null,
    };
  }

  private normalizeColors(value: string[] | string | null | undefined): string[] {
    if (!value) {
      return [];
    }

    if (Array.isArray(value)) {
      return value.filter(Boolean).map((item) => item.toUpperCase());
    }

    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => item.toUpperCase());
  }
}
