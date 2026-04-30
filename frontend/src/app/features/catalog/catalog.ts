import { Component, OnInit, OnDestroy, inject, signal, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CardService, CardPage } from '../../core/services/card.service';
import { Subject, BehaviorSubject, takeUntil } from 'rxjs';
import { debounceTime, switchMap } from 'rxjs/operators';

interface FilterState {
  query: string;
  color: string;
  type: string;
  rarity: string;
  page: number;
  favoritesOnly: boolean;
}

@Component({
  selector: 'app-catalog',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './catalog.html',
  styleUrl: './catalog.scss',
})
export class CatalogComponent implements OnInit, OnDestroy {
  private cardService = inject(CardService);
  private destroy$ = new Subject<void>();
  private filterState$ = new BehaviorSubject<FilterState>({
    query: '',
    color: '',
    type: '',
    rarity: '',
    page: 0,
    favoritesOnly: false,
  });
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  cardPage = signal<CardPage | null>(null);
  isLoading = signal(true);
  currentPage = signal(0);
  totalPages = signal(0);

  activeMana = signal<string[]>([]);
  activeType = signal('Tipo');
  activeRarity = signal('Rareza');
  searchQuery = signal('');
  favoritesOnly = signal(false);

  get favoritesFillStyle(): string {
    return this.favoritesOnly() ? "'FILL' 1" : "'FILL' 0";
  }

  get cards() {
    return this.cardPage()?.cards || [];
  }

  showTypeDropdown = signal(false);
  showRarityDropdown = signal(false);

  // Hover Preview Logic
  hoveredCard = signal<any>(null);
  showHoverPreview = signal(false);
  private hoverTimer: any;

  private flippedCardIds = new Set<string>();

  isDoubleFaced(card: any): boolean {
    return !!card.imageUrl2;
  }

  isCardFlipped(card: any): boolean {
    return this.flippedCardIds.has(card.id);
  }

  toggleCardFace(cardId: string, event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    if (this.flippedCardIds.has(cardId)) {
      this.flippedCardIds.delete(cardId);
    } else {
      this.flippedCardIds.add(cardId);
    }
  }

  private readonly rarityApiMap: Record<string, string> = {
    Rareza: '',
    Común: 'common',
    Infrecuente: 'uncommon',
    Rara: 'rare',
    Mítica: 'mythic',
  };

  private readonly rarityDisplayMap: Record<string, string> = {
    Common: 'Común',
    Uncommon: 'Infrecuente',
    Rare: 'Rara',
    Mythic: 'Mítica',
  };

  rarityLabel(rarity: string): string {
    return this.rarityDisplayMap[rarity] || rarity;
  }

  private readonly typeMap: Record<string, string> = {
    Tipo: '',
    Criatura: 'creature',
    Instantáneo: 'instant',
    Conjuro: 'sorcery',
    Encantamiento: 'enchantment',
    Artefacto: 'artifact',
    Planeswalker: 'planeswalker',
    Tierra: 'land',
  };

  ngOnInit(): void {
    const isFavOnly = this.route.snapshot.queryParamMap.get('favoritesOnly') === 'true';
    if (isFavOnly) {
      this.favoritesOnly.set(true);
      const initial = this.filterState$.getValue();
      this.filterState$.next({ ...initial, favoritesOnly: true });

      // Remove the query param from the URL history so 'Back' navigation returns to normal view
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { favoritesOnly: null },
        queryParamsHandling: 'merge',
        replaceUrl: true
      });
    }

    this.filterState$
      .pipe(
        debounceTime(300),
        switchMap((state) => {
          this.isLoading.set(true);
          return this.cardService.searchCards(
            state.query,
            state.color,
            state.type,
            state.rarity,
            state.page,
            20,
            state.favoritesOnly,
          );
        }),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: (data) => {
          this.cardPage.set(data);
          this.currentPage.set(data.currentPage);
          this.totalPages.set(data.totalPages);
          this.isLoading.set(false);
        },
        error: () => this.isLoading.set(false),
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private getFilterState(page = 0): FilterState {
    return {
      query: this.searchQuery(),
      color: this.activeMana().join(','),
      type: this.typeMap[this.activeType()] ?? '',
      rarity: this.rarityApiMap[this.activeRarity()] ?? '',
      page,
      favoritesOnly: this.favoritesOnly(),
    };
  }

  @HostListener('document:click', ['$event'])
  onClickOutside(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.dropdown-trigger')) {
      this.showTypeDropdown.set(false);
      this.showRarityDropdown.set(false);
    }
  }

  onSearch(event: any): void {
    this.searchQuery.set(event.target.value);
    this.filterState$.next(this.getFilterState(0));
  }

  toggleMana(mana: string): void {
    this.activeMana.update((current) =>
      current.includes(mana) ? current.filter((m) => m !== mana) : [...current, mana],
    );
    this.filterState$.next(this.getFilterState(0));
  }

  selectType(type: string): void {
    this.activeType.set(type);
    this.showTypeDropdown.set(false);
    this.filterState$.next(this.getFilterState(0));
  }

  selectRarity(rarity: string): void {
    this.activeRarity.set(rarity);
    this.showRarityDropdown.set(false);
    this.filterState$.next(this.getFilterState(0));
  }

  resetFilters(): void {
    this.activeMana.set([]);
    this.activeType.set('Tipo');
    this.activeRarity.set('Rareza');
    this.searchQuery.set('');
    this.favoritesOnly.set(false);
    this.filterState$.next(this.getFilterState(0));
  }

  toggleFavoritesFilter(): void {
    const token = localStorage.getItem('token') || localStorage.getItem('authToken');
    if (!token) {
      this.router.navigate(['/registro']);
      return;
    }
    this.favoritesOnly.set(!this.favoritesOnly());
    this.filterState$.next(this.getFilterState(0));
  }

  nextPage(): void {
    const next = this.currentPage() + 1;
    if (next < this.totalPages()) {
      this.filterState$.next(this.getFilterState(next));
    }
  }

  prevPage(): void {
    const prev = this.currentPage() - 1;
    if (prev >= 0) {
      this.filterState$.next(this.getFilterState(prev));
    }
  }

  goToPage(page: number | string): void {
    const pageNum = typeof page === 'string' ? parseInt(page, 10) : page;
    if (isNaN(pageNum) || pageNum < 0 || pageNum >= this.totalPages()) return;
    this.filterState$.next(this.getFilterState(pageNum));
  }

  getManaCostString(manaCost: string[]): string {
    return manaCost.join('');
  }

  translateRarity(rarity: string): string {
    const map: Record<string, string> = {
      'common': 'Común',
      'uncommon': 'Infrecuente',
      'rare': 'Rara',
      'mythic': 'Mítica',
      'special': 'Especial',
      'bonus': 'Bonus'
    };
    return map[rarity.toLowerCase()] || rarity;
  }

  onMouseEnter(card: any): void {
    this.hoveredCard.set(card);
    this.clearHoverTimer();
    this.hoverTimer = setTimeout(() => {
      if (this.hoveredCard()?.id === card.id) {
        console.log('Mostrando vista previa para:', card.name);
        this.showHoverPreview.set(true);
      }
    }, 1000);
  }

  onMouseLeave(): void {
    this.clearHoverTimer();
    this.showHoverPreview.set(false);
    this.hoveredCard.set(null);
  }

  private clearHoverTimer(): void {
    if (this.hoverTimer) {
      clearTimeout(this.hoverTimer);
      this.hoverTimer = null;
    }
  }
}
