import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

export type FriendshipStatus = 'NONE' | 'PENDING' | 'ACCEPTED';

@Injectable({
  providedIn: 'root'
})
export class FriendshipService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:8080/api/friendships';

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('token') || localStorage.getItem('authToken');
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  getStatus(targetUserId: number): Observable<{ status: FriendshipStatus }> {
    return this.http.get<{ status: FriendshipStatus }>(`${this.apiUrl}/status/${targetUserId}`, { headers: this.getHeaders() });
  }

  sendRequest(receiverId: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/request/${receiverId}`, {}, { headers: this.getHeaders() });
  }

  cancelRequest(receiverId: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/cancel/${receiverId}`, {}, { headers: this.getHeaders() });
  }

  acceptRequest(senderId: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/accept/${senderId}`, {}, { headers: this.getHeaders() });
  }

  rejectRequest(senderId: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/reject/${senderId}`, {}, { headers: this.getHeaders() });
  }

  removeFriend(friendId: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${friendId}`, { headers: this.getHeaders() });
  }

  getFriends(): Observable<any[]> {
    return this.http.get<any[]>(this.apiUrl, { headers: this.getHeaders() });
  }
}
