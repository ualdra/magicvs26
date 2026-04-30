import { Component, Output, EventEmitter, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { catchError, debounceTime, distinctUntilChanged, finalize, switchMap, timeout } from 'rxjs/operators';
import { BehaviorSubject, Subject, of } from 'rxjs';

interface Card {
  id: number;
  name: string;
  manaCost: string;
  type: string;
  imageUrl: string;
  backImageUrl?: string;
  doubleFaced?: boolean;
  colors: string[];
}

interface CardSearchPageResponse {
  content: Card[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
}

interface SearchState {
  query: string;
  page: number;
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
  activeQuery = '';
  searchResults$ = new BehaviorSubject<Card[]>([]);
  private searchState$ = new BehaviorSubject<SearchState>({ query: '', page: 0 });
  currentPage = 0;
  pageSize = 24;
  totalElements = 0;
  totalPages = 0;
  loading = false;
  error: string | null = null;
  selectedColor = 'all';
  selectedType = 'all';
  addingCardId: number | null = null;
  private flippedCardIds = new Set<number>();

  readonly colorFilters = [
    { key: 'all', label: 'Todos' },
    { key: 'white', label: 'Blanco' },
    { key: 'blue', label: 'Azul' },
    { key: 'black', label: 'Negro' },
    { key: 'red', label: 'Rojo' },
    { key: 'green', label: 'Verde' }
  ];

  readonly typeFilters = [
    { key: 'all', label: 'Todos' },
    { key: 'creature', label: 'Criaturas' },
    { key: 'instant', label: 'Instantáneos' },
    { key: 'sorcery', label: 'Conjuros' },
    { key: 'artifact', label: 'Artefactos' },
    { key: 'enchantment', label: 'Encantamientos' },
    { key: 'planeswalker', label: 'Planeswalker' },
    { key: 'land', label: 'Tierras' }
  ];

  private searchSubject = new Subject<string>();

  constructor() {
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(query => {
      this.searchState$.next({ query, page: 0 });
    });

    this.searchState$.pipe(
      switchMap(({ query, page }) => this.performSearch(query, page)),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe((response) => {
      if (!response) {
        return;
      }

      this.searchResults$.next(response.content || []);
      this.totalElements = response.totalElements || 0;
      this.totalPages = response.totalPages || 0;
      this.currentPage = response.page || 0;
      this.loading = false;
    });
  }

  onSearchChange(query: string): void {
    this.searchQuery = query;
    this.currentPage = 0;
    this.loading = false;
    this.searchSubject.next(query);
  }

  onPageChange(page: number): void {
    if (page < 0 || page >= this.totalPages || page === this.currentPage || this.loading) {
      return;
    }

    this.currentPage = page;
    this.error = null;
    this.searchState$.next({ query: this.activeQuery || this.searchQuery, page });
  }

  get visiblePages(): number[] {
    if (this.totalPages <= 1) {
      return [0];
    }

    const pages: number[] = [];
    const maxVisible = 5;
    let start = Math.max(0, this.currentPage - 2);
    let end = Math.min(this.totalPages - 1, start + maxVisible - 1);

    if (end - start + 1 < maxVisible) {
      start = Math.max(0, end - maxVisible + 1);
    }

    for (let p = start; p <= end; p++) {
      pages.push(p);
    }

    return pages;
  }

  private performSearch(query: string, page = this.currentPage) {
    const normalizedQuery = (query || '').trim();
    const colorCode = this.mapColorFilterToCode(this.selectedColor);
    const typeFilter = this.selectedType === 'all' ? '' : this.selectedType;

    this.loading = true;
    this.error = null;
    this.activeQuery = normalizedQuery;
    const requestedPage = Math.max(0, page);
    this.currentPage = requestedPage;

    const apiUrl = `http://localhost:8080/api/cards/search?name=${encodeURIComponent(normalizedQuery)}&color=${encodeURIComponent(colorCode)}&type=${encodeURIComponent(typeFilter)}&page=${requestedPage}&size=${this.pageSize}`;

    return this.http.get<CardSearchPageResponse>(apiUrl).pipe(
      timeout(15000),
      catchError(() => {
        this.error = 'Error en la búsqueda de cartas';
        this.totalElements = 0;
        this.totalPages = 0;
        return of(null);
      }),
      finalize(() => {
        this.loading = false;
      }),
      takeUntilDestroyed(this.destroyRef)
    );
  }

  selectCard(card: Card): void {
    this.cardSelected.emit(card);
    this.addingCardId = card.id;
    setTimeout(() => {
      if (this.addingCardId === card.id) {
        this.addingCardId = null;
      }
    }, 320);
  }

  toggleCardFace(card: Card, event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();

    if (!this.isDoubleFaced(card)) {
      return;
    }

    if (this.flippedCardIds.has(card.id)) {
      this.flippedCardIds.delete(card.id);
      return;
    }

    this.flippedCardIds.add(card.id);
  }

  isCardFlipped(card: Card): boolean {
    return this.flippedCardIds.has(card.id);
  }

  isDoubleFaced(card: Card): boolean {
    return !!card.doubleFaced && !!card.backImageUrl;
  }

  clearSearch(): void {
    this.searchQuery = '';
    this.activeQuery = '';
    this.searchResults$.next([]);
    this.currentPage = 0;
    this.totalElements = 0;
    this.totalPages = 0;
    this.loading = false;
    this.error = null;
    this.searchState$.next({ query: '', page: 0 });
  }

  onImageError(event: Event): void {
    const target = event.target as HTMLImageElement | null;
    if (!target) {
      return;
    }

    target.src = this.fallbackImage;
  }

  setColorFilter(color: string): void {
    this.selectedColor = color;
    this.currentPage = 0;
    this.searchState$.next({ query: this.activeQuery || this.searchQuery, page: 0 });
  }

  setTypeFilter(type: string): void {
    this.selectedType = type;
    this.currentPage = 0;
    this.searchState$.next({ query: this.activeQuery || this.searchQuery, page: 0 });
  }

  getFilteredResults(results: Card[]): Card[] {
    return results;
  }

  private mapColorFilterToCode(filter: string): string {
    const map: Record<string, string> = {
      white: 'W',
      blue: 'U',
      black: 'B',
      red: 'R',
      green: 'G'
    };
    return map[filter] ?? '';
  }

  onCardMouseMove(event: MouseEvent): void {
    const target = event.currentTarget as HTMLElement | null;
    if (!target) {
      return;
    }

    const rect = target.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const halfW = rect.width / 2;
    const halfH = rect.height / 2;
    const rotateY = ((x - halfW) / halfW) * 7;
    const rotateX = ((halfH - y) / halfH) * 7;

    target.style.setProperty('--tilt-x', `${rotateX.toFixed(2)}deg`);
    target.style.setProperty('--tilt-y', `${rotateY.toFixed(2)}deg`);
    target.style.setProperty('--glow-x', `${((x / rect.width) * 100).toFixed(2)}%`);
    target.style.setProperty('--glow-y', `${((y / rect.height) * 100).toFixed(2)}%`);
  }

  onCardMouseLeave(event: MouseEvent): void {
    const target = event.currentTarget as HTMLElement | null;
    if (!target) {
      return;
    }

    target.style.setProperty('--tilt-x', '0deg');
    target.style.setProperty('--tilt-y', '0deg');
    target.style.setProperty('--glow-x', '50%');
    target.style.setProperty('--glow-y', '50%');
  }

  private matchesColor(card: Card): boolean {
    if (this.selectedColor === 'all') {
      return true;
    }

    const colorMap: Record<string, string> = {
      W: 'white',
      U: 'blue',
      B: 'black',
      R: 'red',
      G: 'green'
    };

    const normalizedColors = (card.colors ?? []).map((color) => {
      const value = String(color || '').trim();
      const upper = value.toUpperCase();
      return colorMap[upper] ?? value.toLowerCase();
    });

    return normalizedColors.includes(this.selectedColor);
  }

  private matchesType(card: Card): boolean {
    if (this.selectedType === 'all') {
      return true;
    }

    return card.type?.toLowerCase().includes(this.selectedType) ?? false;
  }
}