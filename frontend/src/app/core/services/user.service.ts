import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, catchError, of } from 'rxjs';
import { PublicUser } from '../../models/user.model';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:8080/api/users';

  getUsers(): Observable<PublicUser[]> {
    return this.http.get<PublicUser[]>(this.apiUrl);
  }

  logout(token: string): Observable<void> {
    const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
    return this.http.post<void>(`${this.apiUrl}/logout`, {}, { headers }).pipe(
      catchError(() => of(undefined as any))
    );
  }
}
