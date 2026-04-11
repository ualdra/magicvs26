import { Component, Output, EventEmitter, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { BehaviorSubject, Subject, Observable } from 'rxjs';

interface Card {
  id: number;
  name: string;
  manaCost: string;
  type: string;
  imageUrl: string;
  colors: string[];
}

@Component({
  selector: 'app-deck-search-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './deck-search-panel.html',
  styleUrls: ['./deck-search-panel.scss']
})
export class DeckSearchPanelComponent {
  @Output() cardSelected = new EventEmitter<Card>();
  readonly fallbackImage = 'https://placehold.co/488x680/111827/e5e7eb?text=MagicVS';

  private http = inject(HttpClient);
  private destroyRef = inject(DestroyRef);

  searchQuery = '';
  searchResults$ = new BehaviorSubject<Card[]>([]);
  loading = false;
  error: string | null = null;

  private searchSubject = new Subject<string>();

  constructor() {
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(query => this.performSearch(query));
  }

  onSearchChange(query: string): void {
    this.searchQuery = query;
    this.searchSubject.next(query);
  }

  private performSearch(query: string): void {
    if (!query || query.trim().length < 2) {
      this.searchResults$.next([]);
      return;
    }

    this.loading = true;
    this.error = null;

    // TODO: Reemplazar con la URL real del API
    const apiUrl = `http://localhost:8080/api/cards/search?name=${encodeURIComponent(query)}`;

    this.http.get<Card[]>(apiUrl).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (results) => {
        this.searchResults$.next(results);
        this.loading = false;
      },
      error: () => {
        console.error('Search error occurred');
        this.error = 'Error en la búsqueda de cartas';
        this.loading = false;
      }
    });
  }

  selectCard(card: Card): void {
    this.cardSelected.emit(card);
    this.searchQuery = '';
    this.searchResults$.next([]);
  }

  clearSearch(): void {
    this.searchQuery = '';
    this.searchResults$.next([]);
    this.error = null;
  }

  onImageError(event: Event): void {
    const target = event.target as HTMLImageElement | null;
    if (!target) {
      return;
    }

    target.src = this.fallbackImage;
  }
}
