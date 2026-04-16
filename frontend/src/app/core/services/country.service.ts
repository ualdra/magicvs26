import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, shareReplay, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

export interface Country {
  name: string;
  flag: string;
}

@Injectable({
  providedIn: 'root'
})
export class CountryService {
  private http = inject(HttpClient);
  private apiUrl = 'https://restcountries.com/v3.1/all?fields=name,flag,translations';
  private countries$: Observable<Country[]> | null = null;

  getCountries(): Observable<Country[]> {
    if (!this.countries$) {
      this.countries$ = this.http.get<any[]>(this.apiUrl).pipe(
        map(data => data.map(c => ({
          name: c.translations?.spa?.common || c.name.common,
          flag: c.flag
        })).sort((a, b) => a.name.localeCompare(b.name))),
        shareReplay(1),
        catchError(error => {
          console.error('Error fetching countries from API', error);
          this.countries$ = null; // Reset for retry
          return of([]);
        })
      );
    }
    return this.countries$;
  }
}
