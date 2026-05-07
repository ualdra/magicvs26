import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { News } from '../../models/news.model';

@Injectable({
  providedIn: 'root'
})
export class NewsService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:8080/api/news';

  getNews(): Observable<News[]> {
    const token = localStorage.getItem('token');
    const headers = token ? { headers: { Authorization: `Bearer ${token}` } } : {};

    return this.http.get<any[]>(this.apiUrl, headers).pipe(
      map(data => data.map(item => ({
        id: item.id,
        title: item.title,
        summary: item.summary,
        url: item.url,
        imageUrl: item.imageUrl,
        date: this.formatDate(item.publishDate),
        category: 'MTG Goldfish',
        categoryClass: 'bg-primary text-on-primary'
      })))
    );
  }

  getLastUpdated(): Observable<string> {
    return this.http.get<{date: string}>(`${this.apiUrl}/last-updated`).pipe(
      map(res => this.formatDisplayDate(res.date))
    );
  }

  subscribeToNewsletter(email: string): Observable<any> {
    return this.http.post('http://localhost:8080/api/newsletter/subscribe', { email });
  }

  private formatDate(dateStr: string): string {
    if (!dateStr) return 'Reciente';
    const date = new Date(dateStr);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    // Log for debugging (will show in Browser Console F12)
    console.log(`[NewsService] Formatting date: ${dateStr}, hours diff: ${diffInHours}`);

    if (diffInHours < 1) return 'Hace menos de una hora';
    if (diffInHours < 24) {
      return diffInHours === 1 ? 'Hace 1 hora' : `Hace ${diffInHours} horas`;
    }
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays === 1) {
      return 'Hace 1 día';
    }
    return `Hace ${diffInDays} días`;
  }

  private formatDisplayDate(dateStr: string): string {
    if (!dateStr) return 'Pendiente';
    const date = new Date(dateStr);
    const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    return `${date.getDate()} ${months[date.getMonth()]}`;
  }
}
